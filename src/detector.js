import { md5, PROMPT_VERSION, instructions, read, write } from './common.js';
export class DetectionError extends Error {
  constructor(code) { super(code); this.code=code; }
}
const fail = code => { throw new DetectionError(code); };
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const MIXIN = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
export function wbiQuery(params, keys, now=Date.now()) {
  const getKey=url=>String(url || '').split('/').pop().split('.')[0];
  const combined=getKey(keys.img_url)+getKey(keys.sub_url);
  if(combined.length!==64) fail('BILI');
  const mixin=MIXIN.map(i=>combined[i]).join('').slice(0,32);
  const values={...params,wts:Math.floor(now/1000)};
  const query=Object.keys(values).sort().map(k=>encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]).replace(/[!'()*]/g,''))).join('&');
  return query+'&w_rid='+md5(query+mixin);
}
export function parseScore(payload) {
  const choice=payload?.choices?.[0];
  if(choice?.finish_reason!=='stop') fail('INCOMPLETE');
  let result;
  try { result=JSON.parse(choice.message.content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')); }
  catch { fail('RESULT'); }
  if(typeof result.score!=='number' || !Number.isFinite(result.score) || result.score<0 || result.score>1) fail('RESULT');
  return result.score;
}
export function modelRequest(transcript,config) {
  return {
    model:config.model, stream:false, max_tokens:8192,
    thinking:{type:config.thinking?'enabled':'disabled'},
    ...(config.thinking?{reasoning_effort:config.effort}:{}),
    response_format:{type:'json_object'},
    messages:[{role:'system',content:instructions},{role:'user',content:transcript.slice(0,15000)}],
  };
}
export function httpJson(client,method,options,deadline) {
  return new Promise((resolve,reject)=>{
    const remaining=deadline-Date.now();
    if(remaining<=0) return reject(new DetectionError('TIMEOUT'));
    let settled=false;
    const finish=(error,value)=>{ if(settled)return;settled=true;clearTimeout(timer); error?reject(error):resolve(value); };
    const timer=setTimeout(()=>finish(new DetectionError('TIMEOUT')),remaining);
    try {
      client[method]({...options,timeout:Math.max(1,Math.ceil(remaining/1000))},(error,response,body)=>{
        if(error) return finish(new DetectionError('NETWORK'));
        const status=Number(response?.status || response?.statusCode || 0);
        if(status===401||status===403) return finish(new DetectionError(options.url.startsWith('https://api.deepseek.com/')?'AUTH':'LOGIN'));
        if(status===402) return finish(new DetectionError('BALANCE'));
        if(status===429) return finish(new DetectionError('RATE'));
        if(status<200||status>=300) return finish(new DetectionError('HTTP'));
        try { finish(null,typeof body==='string'?JSON.parse(body):body); } catch { finish(new DetectionError('JSON')); }
      });
    } catch { finish(new DetectionError('NETWORK')); }
  });
}
function validCached(result,now) {
  return result?.until>now && result.state==='ok' && typeof result.score==='number' && result.score>=0 && result.score<=1;
}
async function claim(store,key,owner,deadline) {
  if(read(store,key)?.until>Date.now()) return false;
  write(store,key,{owner,until:deadline+1000});
  // PersistentStore has no atomic compare-and-swap. Re-read after yielding to
  // reduce duplicate claims between isolated Shadowrocket script instances.
  await sleep(35);
  return read(store,key)?.owner===owner;
}
function release(store,key,owner) { if(read(store,key)?.owner===owner) store.write('', 'noaitext.ios.v1.'+key); }
function identityOf(config,session) {
  return md5(config.key+'|'+session.cookie+'|'+config.model+'|'+config.thinking+'|'+config.effort+'|'+PROMPT_VERSION);
}
function resultKey(identity,meta) {return 'result.'+md5(identity+'|'+(meta.aid||meta.bvid)+'|'+(meta.cid||'first'));}
function metadata(store,meta,now=Date.now()) {
  const cached=read(store,'video-meta.'+(meta.aid?'av'+meta.aid:meta.bvid));
  if(!cached || cached.until<now)return null;
  if(meta.aid && String(cached.aid)!==String(meta.aid))return null;
  if(meta.bvid && cached.bvid!==meta.bvid)return null;
  return cached;
}
function normalizeMeta(store,meta) {
  const cached=metadata(store,meta);
  if(!cached)return {...meta};
  return {...meta,aid:String(cached.aid),bvid:cached.bvid,cid:meta.cid || String(cached.firstCid)};
}
function liveResult(store,key,now=Date.now()) {
  const result=read(store,key);
  return validCached(result,now) || (result?.state==='unavailable' && result.until>now)?result:null;
}
export function cachedVideoResult(meta,config,store,now=Date.now()) {
  if(config.keyIssue || !config.key)return null;
  const session=read(store,'session');if(!session?.cookie || session.until<now)return null;
  const identity=identityOf(config,session);
  return liveResult(store,resultKey(identity,meta),now) || liveResult(store,resultKey(identity,normalizeMeta(store,meta)),now);
}
export async function detectVideo(input,config,{store,client,deadline=Date.now()+config.wait*1000,profile={},onProgress}) {
  const started=Date.now();Object.assign(profile,{cached:0,duplicateWaitMs:0,prepareQueueMs:0,prepareMs:0,aiQueueMs:0,aiMs:0,requests:0,apiCalls:0});
  if(config.keyIssue || !config.key)fail(config.keyIssue || 'NO_KEY');
  if(input?.ambiguous || (!input?.aid&&!input?.bvid))fail('MAP');
  const session=read(store,'session');if(!session?.cookie || session.until<Date.now())fail('LOGIN');
  const identity=identityOf(config,session),originalKey=resultKey(identity,input);
  let meta=normalizeMeta(store,input),cacheKey=resultKey(identity,meta);
  function consume(result) {profile.cached=1;if(result.state!=='ok')fail(result.code);return result;}
  const cached=liveResult(store,cacheKey)||liveResult(store,originalKey);
  if(cached){profile.totalMs=Date.now()-started;return consume(cached);}
  const owner=md5(String(Date.now())+Math.random()),locks=[];
  let prepareSlot,aiSlot,serialSlot,preparingSince;
  function stopPrepare(){if(preparingSince!==undefined){profile.prepareMs+=Date.now()-preparingSince;preparingSince=undefined;}}
  async function acquireLock(key) {
    const start=Date.now();
    while(!await claim(store,key,owner,deadline)) {
      if(Date.now()>deadline-1000)fail('TIMEOUT');
      await sleep(100);
      const result=liveResult(store,cacheKey)||liveResult(store,originalKey);
      if(result){profile.duplicateWaitMs+=Date.now()-start;return result;}
    }
    locks.push(key);profile.duplicateWaitMs+=Date.now()-start;return null;
  }
  async function acquirePool(prefix,count,metric) {
    const start=Date.now();
    while(true) {
      for(let i=0;i<count;i++)if(await claim(store,prefix+i,owner,deadline)){profile[metric]+=Date.now()-start;return i;}
      if(Date.now()>deadline-1000)fail('TIMEOUT');await sleep(100);
    }
  }
  const headers={'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',Referer:'https://www.bilibili.com/',Cookie:session.cookie};
  const timed=async(name,action)=>{const t=Date.now();try{return await action();}finally{profile[name]=(profile[name]||0)+Date.now()-t;}};
  const get=(url,name)=>timed(name,()=>{profile.requests++;return httpJson(client,'get',{url,headers},deadline);});
  try {
    // Acquire the pipeline gate before any video lock to avoid lock-order cycles.
    if(config.serial)serialSlot=await acquirePool('serial-pipeline.',1,'prepareQueueMs');
    const ready=await acquireLock('lock.'+cacheKey.slice(7));if(ready)return consume(ready);
    const justCached=liveResult(store,cacheKey);if(justCached)return consume(justCached);
    prepareSlot=await acquirePool('prepare-slot.',Math.min(6,Math.max(4,config.concurrent)),'prepareQueueMs');
    preparingSince=Date.now();
    async function resolveVideo(force=false) {
      const known=metadata(store,meta);
      if(!force && known) {
        const cid=meta.cid || String(known.firstCid);
        if(!known.cids.includes(String(cid)))fail('MISMATCH');
        return {aid:String(known.aid),bvid:known.bvid,cid:String(cid),verified:true};
      }
      // The card itself already binds a specific AV+CID. Verify against player
      // response IDs; do not issue /view just to rediscover the same pair.
      if(!force && meta.aid && meta.cid)return {...meta,verified:false};
      const query=meta.bvid?'bvid='+encodeURIComponent(meta.bvid):'aid='+encodeURIComponent(meta.aid);
      const view=await get('https://api.bilibili.com/x/web-interface/view?'+query,'metadataMs');
      if(view?.code!==0 || !view.data)fail(view?.code===-101?'LOGIN':'BILI');
      const data=view.data;
      if((meta.aid && String(data.aid)!==String(meta.aid)) || (meta.bvid && data.bvid!==meta.bvid))fail('MISMATCH');
      const page=meta.cid?(data.pages||[]).find(p=>String(p.cid)===String(meta.cid)):(data.pages||[])[0];
      if(!page?.cid)fail('MISMATCH');
      const record={aid:String(data.aid),bvid:data.bvid,firstCid:String(data.pages[0].cid),cids:data.pages.map(p=>String(p.cid)),until:Date.now()+86400000};
      write(store,'video-meta.av'+record.aid,record);if(record.bvid)write(store,'video-meta.'+record.bvid,record);
      return {aid:record.aid,bvid:record.bvid,cid:String(page.cid),verified:true};
    }
    async function resolveWbi() {
      const nav=read(store,'wbi');if(nav?.keys && nav.until>Date.now())return nav.keys;
      const response=await get('https://api.bilibili.com/x/web-interface/nav','navMs');
      if(response?.code!==0 || !response.data?.isLogin)fail('LOGIN');
      if(!response.data.wbi_img)fail('BILI');
      write(store,'wbi',{keys:response.data.wbi_img,until:Date.now()+3600000});return response.data.wbi_img;
    }
    // Independent metadata/key requests run concurrently rather than serially.
    const [video,keys]=await Promise.all([resolveVideo(),resolveWbi()]);
    meta={...meta,aid:video.aid,bvid:video.bvid,cid:video.cid};
    const canonicalKey=resultKey(identity,meta);
    if(canonicalKey!==cacheKey) {
      cacheKey=canonicalKey;
      const available=liveResult(store,cacheKey);if(available)return consume(available);
      // Never hold a preparation slot while waiting on a canonical video lock:
      // an explicit-CID request may own that lock and itself need preparation.
      stopPrepare();release(store,'prepare-slot.'+prepareSlot,owner);prepareSlot=undefined;
      const shared=await acquireLock('lock.'+cacheKey.slice(7));if(shared)return consume(shared);
      prepareSlot=await acquirePool('prepare-slot.',Math.min(6,Math.max(4,config.concurrent)),'prepareQueueMs');preparingSince=Date.now();
    }
    const params={aid:video.aid,cid:video.cid,...(video.bvid?{bvid:video.bvid}:{})};
    const player=await get('https://api.bilibili.com/x/player/wbi/v2?'+wbiQuery(params,keys),'playerMs');
    if(player?.code!==0)fail(player?.code===-101?'LOGIN':'BILI');
    if(player.data?.aid && String(player.data.aid)!==String(video.aid))fail('MISMATCH');
    if(player.data?.cid && String(player.data.cid)!==String(video.cid))fail('MISMATCH');
    // If this response omits identity fields, keep the authoritative /view check.
    if(!video.verified && (!player.data?.aid || !player.data?.cid))await resolveVideo(true);
    const tracks=player.data?.subtitle?.subtitles || [];
    const track=tracks.find(t=>/^(ai-)?zh/i.test(t.lan||'')) || tracks[0];
    if(!track?.subtitle_url)fail('NO_SUB');
    let subtitleUrl=track.subtitle_url;if(subtitleUrl.startsWith('//'))subtitleUrl='https:'+subtitleUrl;
    if(!/^https:\/\/(?:[a-z0-9-]+\.)*(?:hdslb\.com|bilibili\.com)\//i.test(subtitleUrl))fail('SUB_URL');
    const captions=await timed('captionsMs',()=>{profile.requests++;return httpJson(client,'get',{url:subtitleUrl,headers:{Referer:'https://www.bilibili.com/'}},deadline);});
    const transcript=(captions?.body||[]).map(s=>typeof s.content==='string'?s.content:'').join('\n').trim();
    if(transcript.length<50)fail('SHORT');
    stopPrepare();
    release(store,'prepare-slot.'+prepareSlot,owner);prepareSlot=undefined;
    // Subtitle/network preparation no longer occupies a DeepSeek slot.
    if(onProgress)onProgress('AI_QUEUE',profile);
    aiSlot=await acquirePool('ai-slot.',config.concurrent,'aiQueueMs');
    const already=liveResult(store,cacheKey);if(already)return consume(already);
    if(Date.now()>deadline-1500)fail('TIMEOUT');
    const payload=await timed('aiMs',()=>{profile.requests++;profile.apiCalls++;if(onProgress)onProgress('AI_START',profile);return httpJson(client,'post',{url:'https://api.deepseek.com/chat/completions',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.key},body:JSON.stringify(modelRequest(transcript,config))},deadline);});
    const record={state:'ok',score:parseScore(payload),aid:String(video.aid),bvid:video.bvid||'',cid:String(video.cid),model:config.model,thinking:config.thinking,effort:config.effort,promptVersion:PROMPT_VERSION,transcriptHash:md5(transcript.slice(0,15000)),at:Date.now(),until:Date.now()+config.cacheDays*86400000};
    for(const key of new Set([cacheKey,originalKey,resultKey(identity,{aid:record.aid,cid:record.cid}),...(record.bvid?[resultKey(identity,{bvid:record.bvid,cid:record.cid})]:[])]))write(store,key,record);
    return record;
  } catch(error) {
    const code=error instanceof DetectionError?error.code:'ERROR';
    // Let duplicate image requests observe the same failure rather than repeat
    // the whole chain immediately. Failure records can never be numeric scores.
    const duration=['NO_SUB','SHORT'].includes(code)?300000:5000;
    for(const key of new Set([cacheKey,originalKey]))write(store,key,{state:'unavailable',code,until:Date.now()+duration});
    throw new DetectionError(code);
  } finally {
    stopPrepare();
    if(prepareSlot!==undefined)release(store,'prepare-slot.'+prepareSlot,owner);
    if(aiSlot!==undefined)release(store,'ai-slot.'+aiSlot,owner);
    if(serialSlot!==undefined)release(store,'serial-pipeline.'+serialSlot,owner);
    for(const lock of locks)release(store,lock,owner);
    profile.totalMs=Date.now()-started;
  }
}
