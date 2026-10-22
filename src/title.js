import { settings, cleanHeaders } from './common.js';
import {recordDiagnostic} from './diagnostics.js';
import { detectVideo, DetectionError, cachedVideoResult } from './detector.js';
const positive = value => /^\d+$/.test(String(value || '')) && Number(value)>0 ? String(value) : '';
const bv = value => /^BV[a-zA-Z0-9]{10}$/.test(String(value || '')) ? String(value) : '';
const OWN_PREFIX = /^「(?:\d{1,3}%|待检|超时|无字幕|字幕短|需登录|未配Key|参数错误|认证失败|余额不足|限流|检测失败)」\s*/;
export function titlePrefix(result) {
  if(result?.state==='ok' && typeof result.score==='number' && Number.isFinite(result.score) && result.score>=0 && result.score<=1) return '「'+Math.round(result.score*100)+'%」';
  const text=({NO_SUB:'无字幕',SHORT:'字幕短',LOGIN:'需登录',NO_KEY:'未配Key',PARAM:'参数错误',AUTH:'认证失败',BALANCE:'余额不足',RATE:'限流',TIMEOUT:'超时',PENDING:'待检'})[result?.code] || '检测失败';
  return '「'+text+'」';
}
export function collectTitles(data, commits = []) {
  const targets=[];
  let visited=0;
  function visit(value,depth) {
    if(!value || typeof value!=='object' || depth>24 || ++visited>20000 || targets.length>=150) return;
    if(Array.isArray(value)) { for(const child of value) visit(child,depth+1);return; }
    if(value.ad_info || /^(?:ad|banner|live|article|picture)/i.test(String(value.card_goto || ''))) return;
    const uri=String(value.uri || value.url || '');
    const uriAid=/^(?:bilibili:\/\/(?:video|story)\/|https?:\/\/(?:www\.)?bilibili\.com\/video\/av)(\d+)/.exec(uri)?.[1];
    const uriBv=/(?:^|\/)video\/(BV[a-zA-Z0-9]{10})(?:[/?#]|$)/.exec(uri)?.[1];
    const bvid=bv(value.bvid || value.args?.bvid || value.player_args?.bvid || uriBv);
    const aid=positive(value.aid || value.avid || value.args?.aid || value.player_args?.aid || (['av','vertical_av'].includes(value.goto) || ['av','vertical_av'].includes(value.card_goto) ? value.param : '') || uriAid);
    const cid=positive(value.cid || value.player_args?.cid);
    const title=typeof value.title==='string'?{object:value,key:'title'}
      :(value.title && typeof value.title.text==='string'?{object:value.title,key:'text'}:null);
    const videoKind=!value.goto || ['av','vertical_av'].includes(value.goto);
    if(videoKind && title && (aid || bvid)) targets.push({...title,card:value,meta:{aid,bvid,cid},original:title.object[title.key]});
    // Search JSON may split parent navigation and nested displayed fields.
    if(videoKind && (aid || bvid)) for(const key of ['av','ugc_inline']) {
      const nested=value[key];
      if(nested && typeof nested==='object' && typeof nested.title==='string' && !nested.aid && !nested.bvid) {
        targets.push({card:value,object:nested,key:'title',original:nested.title,meta:{aid,bvid,cid}});
      }
    }
    // Older dynamic feeds embed video cards as JSON strings.
    if(typeof value.card==='string' && value.card.length<1048576) {
      try { const card=JSON.parse(value.card); visit(card,depth+1);commits.push(()=>{value.card=JSON.stringify(card);}); } catch {}
    }
    for(const child of Object.values(value)) visit(child,depth+1);
  }
  visit(data.data || data,0);
  return targets;
}
export async function analyzeTitleTargets(targets,config,env) {
  const states={};
  const groups=new Map();
  for(const target of targets) {
    const key=(target.meta.aid || target.meta.bvid)+':'+(target.meta.cid || 'first');
    if(!groups.has(key)) groups.set(key,{meta:target.meta,targets:[]});
    groups.get(key).targets.push(target);
  }
  function apply(group,result) {
    const state=result?.state==='ok'?'OK':result?.code || 'ERROR';
    states[state]=(states[state] || 0)+group.targets.length;
    for(const target of group.targets) target.object[target.key]=titlePrefix(result)+target.original.replace(OWN_PREFIX,'');
  }
  const pending=[];
  let hits=0,completed=0;
  for(const group of groups.values()) {
    const cached=cachedVideoResult(group.meta,config,env.store);
    if(cached) {apply(group,cached);hits++;}
    else pending.push(group);
  }
  let next=0;
  let blockingError;
  const deadline=env.deadline ?? Date.now()+config.wait*1000;
  async function worker() {
    while(next<pending.length) {
      const group=pending[next++];
      if(blockingError) {apply(group,{code:blockingError});continue;}
      if(Date.now()>deadline-1200) {apply(group,{code:'PENDING'});continue;}
      let result;
      try {result=await detectVideo(group.meta,config,{...env,deadline});completed++;}
      catch(error) {
        result={code:error instanceof DetectionError?error.code:'ERROR'};
        if(['NO_KEY','PARAM','AUTH','LOGIN','BALANCE','RATE'].includes(result.code)) blockingError=result.code;
      }
      apply(group,result);
    }
  }
  await Promise.all(Array.from({length:Math.min(config.concurrent,pending.length)},worker));
  return {changed:targets.length,videos:groups.size,hits,completed,states};
}

export async function rewriteTitles(body,config,env) {
  let data;
  try { data=typeof body==='string'?JSON.parse(body):body; } catch { return {changed:0,reason:'NOT_JSON'}; }
  if(!data || typeof data!=='object' || (data.code!==undefined && data.code!==0)) return {changed:0,reason:'API_ERROR'};
  const commits=[];
  const targets=collectTitles(data,commits);
  if(!targets.length) return {changed:0,reason:'NO_VIDEO_TITLES'};
  const result=await analyzeTitleTargets(targets,config,env);
  for(const commit of commits) commit();
  return {...result,body:JSON.stringify(data)};
}
export async function processTitles(request,response,argument,env) {
  const started=Date.now();
  const result=await rewriteTitles(response.body,settings(argument),env);
  recordDiagnostic(env.store,'JSON',request,result,started);
  console.log('[NoAIText Title] '+(result.changed?`titles=${result.changed} cache=${result.hits} completed=${result.completed}`:result.reason));
  return result.changed?{headers:cleanHeaders(response.headers,'application/json; charset=utf-8'),body:result.body}:{};
}
