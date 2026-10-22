import {settings,cleanHeaders} from './common.js';
import {collectTitles} from './title.js';
import {grpcRoute,collectProtoTitles} from './grpc-title.js';
import {grpcFrames,parseMessage,serialize,encodeFrame,concat} from './protobuf.js';
import {taggedCover,tokenFrom,rememberBindings} from './cover-binding.js';
import {recordDiagnostic} from './diagnostics.js';
function attach(targets,store,config) {
  let count=0;const tokens=[];
  for(const target of targets){
    const tagged=taggedCover(target.object[target.key],target.meta,store,config);
    if(!tagged)continue;target.object[target.key]=tagged;tokens.push(tokenFrom(tagged));count++;
  }
  if(tokens.length)rememberBindings(store,tokens);
  return count;
}
export function collectJsonCovers(data,commits=[]) {
  const titles=collectTitles(data,commits),covers=[],seen=new Map();
  function collect(object,meta) {
    if(!object || typeof object!=='object')return;
    let keys=seen.get(object);if(!keys){keys=new Set();seen.set(object,keys);}
    for(const key of ['cover','pic','cover_url','ff_cover','pic_4_3']) {
      if(keys.has(key))continue;keys.add(key);
      if(typeof object[key]==='string')covers.push({object,key,meta});
      else if(object[key] && typeof object[key].url==='string')covers.push({object:object[key],key:'url',meta});
    }
  }
  for(const title of titles)for(const object of [title.card,title.object])collect(object,title.meta);
  // Some channel/story cards have no title but still carry an explicit video ID.
  let visits=0;
  function walk(value,depth=0) {
    if(!value || typeof value!=='object' || depth>24 || ++visits>20000)return;
    if(Array.isArray(value)){for(const item of value)walk(item,depth+1);return;}
    if(value.ad_info || /^(?:ad|live|article|picture)/i.test(value.card_goto || ''))return;
    const kind=value.goto || value.card_goto;
    if(!kind || ['av','vertical_av'].includes(kind)) {
      const uri=String(value.uri || value.url || '');
      const positive=v=>/^\d+$/.test(String(v||''))&&Number(v)>0?String(v):'';
      const aid=positive(value.aid || value.avid || value.player_args?.aid || value.args?.aid || (['av','vertical_av'].includes(kind)?value.param:'') || /^bilibili:\/\/(?:video|story)\/(\d+)/.exec(uri)?.[1]);
      const candidate=String(value.bvid || value.player_args?.bvid || value.args?.bvid || /\/video\/(BV[a-zA-Z0-9]{10})(?:[/?#]|$)/.exec(uri)?.[1] || '');
      const bvid=/^BV[a-zA-Z0-9]{10}$/.test(candidate)?candidate:'';
      if(aid || bvid)collect(value,{aid,bvid,cid:positive(value.cid || value.player_args?.cid)});
    }
    for(const child of Object.values(value))walk(child,depth+1);
  }
  walk(data.data || data);
  return covers;
}
export function processCoverList(request,response,argument,env) {
  const started=Date.now(),config=settings(argument);let data;
  try{data=typeof response.body==='string'?JSON.parse(response.body):response.body;}catch{return {};}
  if(!data || typeof data!=='object' || (data.code!==undefined && data.code!==0))return {};
  const commits=[],targets=collectJsonCovers(data,commits);const count=attach(targets,env.store,config);
  recordDiagnostic(env.store,'Cover JSON',request,{changed:count,reason:count?'TAGGED_NO_AI_WAIT':'NO_VIDEO_COVERS'},started);
  if(!count)return {};for(const commit of commits)commit();
  return {headers:cleanHeaders(response.headers,'application/json; charset=utf-8'),body:JSON.stringify(data)};
}
export function processGrpcCoverList(request,response,argument,env) {
  const started=Date.now(),route=grpcRoute(request.url);if(!route)return {};
  const frames=grpcFrames(response.body),parsed=[];
  for(const frame of frames)if(frame.flag!==128){const root=parseMessage(frame.decoded);parsed.push({frame,root,items:collectProtoTitles(root,route)});}
  const count=attach(parsed.flatMap(p=>p.items.covers),env.store,settings(argument));
  recordDiagnostic(env.store,'Cover gRPC',request,{changed:count,reason:count?'TAGGED_NO_AI_WAIT':'NO_VIDEO_COVERS'},started);
  if(!count)return {};
  for(const p of parsed){p.items.commit();p.frame.output=serialize(p.root);}
  const body=concat(frames.map(f=>f.output?encodeFrame(f.output,f.flag):f.raw));
  const type=Object.entries(response.headers||{}).find(([k])=>k.toLowerCase()==='content-type')?.[1]||'application/grpc';
  return {headers:cleanHeaders(response.headers,type),body};
}
