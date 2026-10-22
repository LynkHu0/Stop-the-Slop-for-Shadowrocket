import test from 'node:test';import assert from 'node:assert/strict';
import {detectVideo} from '../src/detector.js';import {settings,write} from '../src/common.js';
const config=settings('key=fixture-not-a-real-key&concurrent=4');
function environment({aiDelay=5,viewDelay=1,navDelay=1,status=200,omitIdentity=false}={}) {
 const values=new Map(),events=[];const store={read:k=>values.get(k),write:(v,k)=>{values.set(k,v);return true;}};
 write(store,'session',{cookie:'SESSDATA=fixture; DedeUserID=1',until:Date.now()+86400000});
 const client={};for(const method of ['get','post'])client[method]=(req,done)=>{
  const at=Date.now();events.push({url:req.url,method,at});const aid=Number(/[?&]aid=(\d+)/.exec(req.url)?.[1]||100);let payload,delay=1;
  if(req.url.includes('/x/web-interface/view')){delay=viewDelay;payload={code:0,data:{aid,bvid:'BV1234567890',pages:[{cid:aid+100}]}};}
  else if(req.url.includes('/x/web-interface/nav')){delay=navDelay;payload={code:0,data:{isLogin:true,wbi_img:{img_url:'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',sub_url:'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png'}}};}
  else if(req.url.includes('/x/player/wbi/v2'))payload={code:0,data:{...(omitIdentity?{}:{aid,cid:aid+100}),subtitle:{subtitles:[{lan:'ai-zh',subtitle_url:'https://aisubtitle.hdslb.com/bfs/subtitle/'+aid+'.json'}]}}};
  else if(req.url.includes('/bfs/subtitle/'))payload={body:[{content:'这个字幕只是模拟视频的文本，测试网络队列和缓存隔离，不代表任何真实视频。'.repeat(5)}]};
  else {delay=aiDelay;payload={choices:[{finish_reason:'stop',message:{content:'{"score":0.14}'}}]};}
  setTimeout(()=>{events.push({finish:req.url,at:Date.now()});done(null,{status:method==='post'?status:200},JSON.stringify(payload));},delay);
 };
 return{store,client,events};
}
test('AV+CID path removes redundant view call while preserving high effort',async()=>{
 const env=environment(),profile={};await detectVideo({aid:'100',cid:'200'},config,{...env,profile});
 assert.equal(env.events.some(e=>e.url?.includes('/x/web-interface/view')),false);
 assert.equal(profile.requests,4);assert.equal(profile.apiCalls,1);assert.ok(profile.prepareMs>0);assert.ok(profile.aiMs>0);
 const cached={};await detectVideo({aid:'100',cid:'200'},config,{...env,profile:cached});assert.equal(cached.requests,0);assert.equal(cached.cached,1);
});
test('metadata and WBI requests start concurrently',async()=>{
 const env=environment({viewDelay:90,navDelay:90});await detectVideo({aid:'100'},config,env);
 const view=env.events.find(e=>e.url?.includes('/x/web-interface/view')),nav=env.events.find(e=>e.url?.includes('/x/web-interface/nav'));
 assert.ok(Math.abs(view.at-nav.at)<40,'independent requests should overlap');
});
test('AI queue does not prevent other videos preparing subtitles',async()=>{
 const env=environment({aiDelay:400}),one={...config,concurrent:1};
 const results=await Promise.all([detectVideo({aid:'100',cid:'200'},one,env),detectVideo({aid:'101',cid:'201'},one,env)]);
 assert.equal(results.length,2);
 const captionFinished=env.events.filter(e=>e.finish?.includes('/bfs/subtitle/'));
 const firstAiFinished=env.events.find(e=>e.finish?.includes('api.deepseek.com'));
 assert.equal(captionFinished.length,2);assert.ok(captionFinished.every(e=>e.at<firstAiFinished.at));
});
test('first-part and explicit-CID callers share canonical result without deadlock',async()=>{
 const env=environment({aiDelay:100});
 const result=await Promise.all([detectVideo({aid:'100'},config,env),detectVideo({aid:'100',cid:'200'},config,env)]);
 assert.ok(result.every(r=>r.cid==='200'));assert.equal(env.events.filter(e=>e.method==='post').length,1);
});
test('BV and AV aliases reuse scored part after authoritative view metadata',async()=>{
 const env=environment();await detectVideo({aid:'100'},config,env);const calls=env.events.filter(e=>e.url).length;
 await detectVideo({bvid:'BV1234567890',cid:'200'},config,env);await detectVideo({aid:'100',cid:'200'},config,env);
 assert.equal(env.events.filter(e=>e.url).length,calls);
});
test('player missing identity forces /view verification instead of trusting unknown source',async()=>{
 const env=environment({omitIdentity:true});await detectVideo({aid:'100',cid:'200'},config,env);
 assert.equal(env.events.filter(e=>e.url?.includes('/x/web-interface/view')).length,1);
});
test('overlapping failed images do not repeatedly call the rejected AI key',async()=>{
 const env=environment({status:401});
 await assert.rejects(detectVideo({aid:'100',cid:'200'},config,env),e=>e.code==='AUTH');
 await assert.rejects(detectVideo({aid:'100',cid:'200'},config,env),e=>e.code==='AUTH');
 assert.equal(env.events.filter(e=>e.method==='post').length,1);
});

test('concurrent first-part aliases cannot exhaust preparation slots waiting on CID owners',async()=>{
 const env=environment({aiDelay:60});const jobs=[];
 for(let i=0;i<4;i++)jobs.push(detectVideo({aid:String(100+i)},config,{...env,deadline:Date.now()+4000}));
 for(let i=0;i<4;i++)jobs.push(detectVideo({aid:String(100+i),cid:String(200+i)},config,{...env,deadline:Date.now()+4000}));
 const results=await Promise.all(jobs);assert.equal(results.length,8);assert.equal(env.events.filter(e=>e.method==='post').length,4);
});
test('AI progress events exist before slow provider completes',async()=>{
 const env=environment({aiDelay:30}),stages=[];
 await detectVideo({aid:'100',cid:'200'},config,{...env,onProgress:(name,p)=>stages.push({name,calls:p.apiCalls})});
 assert.deepEqual(stages.map(x=>x.name),['AI_QUEUE','AI_START']);assert.equal(stages[1].calls,1);
});
