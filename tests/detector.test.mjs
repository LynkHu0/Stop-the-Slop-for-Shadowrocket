import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import jpeg from 'jpeg-js';
import {settings,read,write,coverKey,PREFIX,md5} from '../src/common.js';
import {collectVideos,registerVideos} from '../src/feed.js';
import {captureSession} from '../src/session.js';
import {jpegCoverUrl,freshCoverUrl} from '../src/image-request-probe.js';
import {detectVideo,parseScore,modelRequest,wbiQuery} from '../src/detector.js';
import {processCover,statusBadge} from '../src/cover.js';
import {rewriteJpeg,supportedJpeg} from '../src/image-codec.js';
const url='https://i0.hdslb.com/bfs/archive/fixture.jpg';
const meta={aid:'100',bvid:'BV1234567890',cid:'200'};
function storage(){const values=new Map();return{values,read:k=>values.get(k),write:(v,k)=>{values.set(k,v);return true;}};}
function setup(options={}){
 const store=storage();write(store,'session',{cookie:'SESSDATA=test-fixture; DedeUserID=1',until:Date.now()+86400000});
 const requests=[];
 const callback=(method)=>(request,done)=>{
  requests.push({method,...request});
  let status=200,body;
  if(request.url.includes('/x/web-interface/view')) body={code:0,data:{...meta,pages:[{cid:200}]}};
  else if(request.url.includes('/x/web-interface/nav')) body={code:0,data:{isLogin:true,wbi_img:{img_url:'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',sub_url:'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png'}}};
  else if(request.url.includes('/x/player/wbi/v2')) body={code:0,data:{aid:100,cid:options.mismatch?999:200,subtitle:{subtitles:options.noSub?[]:[{lan:'ai-zh',subtitle_url:'https://aisubtitle.hdslb.com/bfs/subtitle/fixture.json'}]}}};
  else if(request.url.includes('/bfs/subtitle/')) body={body:[{content:options.short?'短字幕':'这是一段仅用于测试字幕获取和图片处理链路的文字。'.repeat(12)}]};
  else if(request.url.includes('api.deepseek.com')) {status=options.apiStatus||200;body={choices:[{finish_reason:options.finishReason||'stop',message:{content:JSON.stringify({score:options.score??0.37})}}]};}
  else throw new Error('Unexpected URL');
  setTimeout(()=>done(null,{status},JSON.stringify(body)),options.delay||1);
 };
 return{store,requests,client:{get:callback('get'),post:callback('post')}};
}
const config=settings('key=fixture-not-a-real-key');
function image(width=480,height=360){const data=new Uint8Array(width*height*4).fill(180);return jpeg.encode({width,height,data},85).data;}

test('defaults Flash thinking high; configurable flags and bounded limits',()=>{
 assert.deepEqual({model:config.model,thinking:config.thinking,effort:config.effort,wait:config.wait},{model:'deepseek-flash',thinking:true,effort:'high',wait:45});
 const off=settings('model=deepseek-v4-pro&thinking=false&effort=low&wait=999&concurrent=999');
 assert.equal(off.wait,50);assert.equal(off.concurrent,100);
 assert.equal(modelRequest('text',off).reasoning_effort,undefined);
 assert.equal(modelRequest('text',config).thinking.type,'enabled');
 assert.equal(modelRequest('a'.repeat(20000),config).messages[1].content.includes('a'.repeat(15001)),false);
});
test('preserves requested crop and query for both ratios and width-only',()=>{
 for(const transform of ['480w_360h_1c','480w_270h_1c','672w_378h_1c','480w','720w_540h_!web-dynamic.webp']){
  if(transform.includes('!')) continue;
  assert.equal(jpegCoverUrl(url+'@'+transform+'.webp?foo=1#fragment'),url+'@'+transform+'.jpg?foo=1#fragment');
 }
 assert.equal(jpegCoverUrl(url),url+'@480w.jpg');
 assert.equal(jpegCoverUrl('https://evil.example/bfs/archive/a.jpg'),null);
 assert.equal(freshCoverUrl(url+'@480w_270h_1c.webp?foo=1',60000),url+'@480w_270h_1c.jpg?foo=1&noai_v=011-1');
 assert.equal(freshCoverUrl(freshCoverUrl(url,60000),60000),freshCoverUrl(url,60000));
});
test('home, dynamic archive and search JSON mapping preserve payload and reject live',()=>{
 const payload={code:0,data:{items:[{goto:'av',param:'100',player_args:{cid:200},cover:url+'@480w_360h_1c.webp'},{goto:'live',param:'9',cover:url.replace('fixture','live')},{modules:{module_dynamic:{major:{archive:{...meta,cover:url.replace('fixture','dynamic')}}}}},{uri:'bilibili://video/333',cover:url.replace('fixture','search')}]}};
 const raw=JSON.stringify(payload),store=storage();
 assert.equal(collectVideos(raw).length,3);assert.equal(registerVideos(raw,store),3);
 assert.equal(read(store,'cover.'+coverKey(url)).aid,'100');
 assert.equal(JSON.stringify(payload),raw);
 registerVideos({data:{items:[{goto:'av',param:'999',cover:url}]}},store);
 assert.equal(read(store,'cover.'+coverKey(url)).ambiguous,true);
});
test('session capture only on Bilibili, no cookie printed or captured from CDN',()=>{
 const store=storage();assert.equal(captureSession({url:'https://www.bilibili.com/',headers:{Cookie:'SESSDATA=fixture; DedeUserID=1; unwanted=2'}},store),true);
 assert.equal(read(store,'session').cookie,'SESSDATA=fixture; DedeUserID=1');
 assert.equal(captureSession({url:'https://www.bilibili.com.evil.test/',headers:{Cookie:'SESSDATA=other'}},store),false);
});
test('signed official subtitle route -> DeepSeek -> success; no Cookie to CDN/AI',async()=>{
 const env=setup(),result=await detectVideo(meta,config,env);
 assert.equal(result.score,.37);assert.equal(result.cid,'200');
 assert.equal(env.requests.length,4);
 const player=env.requests.find(r=>r.url.includes('/x/player/wbi/v2'));
 assert.match(player.url,/w_rid=[a-f0-9]{32}/);
 const ai=env.requests.find(r=>r.method==='post');assert.equal(ai.url,'https://api.deepseek.com/chat/completions');
 assert.equal(JSON.parse(ai.body).model,'deepseek-flash');assert.equal(JSON.parse(ai.body).thinking.type,'enabled');
 assert.equal(ai.headers.Cookie,undefined);assert.equal(ai.headers.Referer,undefined);
 assert.equal(env.requests.find(r=>r.url.includes('/bfs/subtitle/')).headers.Cookie,undefined);
 const count=env.requests.length;assert.equal((await detectVideo(meta,config,env)).score,.37);assert.equal(env.requests.length,count);
 assert.ok(!JSON.stringify([...env.store.values]).includes('这是一段'));
});
test('same-video concurrency shares completed score in ordinary overlap',async()=>{
 const env=setup({delay:12});const scores=await Promise.all([detectVideo(meta,config,env),detectVideo(meta,config,env)]);
 assert.equal(scores[0].score,scores[1].score);assert.equal(env.requests.filter(r=>r.method==='post').length,1);
});
test('model/thinking/effort/key changes do not reuse old score',async()=>{
 const env=setup();await detectVideo(meta,config,env);
 for(const changed of [{model:'deepseek-v4-pro'},{thinking:false},{effort:'low'},{key:'different-fixture-key'}]) await detectVideo(meta,{...config,...changed},env);
 assert.equal(env.requests.filter(r=>r.method==='post').length,5);
});
test('no subtitles, short/mismatched sources and missing login/key never become scores',async()=>{
 for(const [options,code] of [[{noSub:true},'NO_SUB'],[{short:true},'SHORT'],[{mismatch:true},'MISMATCH']]){
  const env=setup(options);await assert.rejects(detectVideo(meta,config,env),e=>e.code===code);
  assert.equal(env.requests.some(r=>r.method==='post'),false);
 }
 const env=setup();env.store.write('',PREFIX+'session');
 await assert.rejects(detectVideo(meta,config,env),e=>e.code==='LOGIN');
 await assert.rejects(detectVideo(meta,{...config,key:''},env),e=>e.code==='NO_KEY');
 assert.equal(env.requests.length,0);
});
test('API errors, invalid score and incomplete output rejected and not cached',async()=>{
 for(const [options,code] of [[{apiStatus:401},'AUTH'],[{apiStatus:402},'BALANCE'],[{apiStatus:429},'RATE'],[{score:2},'RESULT'],[{finishReason:'length'},'INCOMPLETE']]){
  const env=setup(options);await assert.rejects(detectVideo(meta,config,env),e=>e.code===code);
  assert.equal([...env.store.values.values()].some(v=>v.includes('"state":"ok"')),false);
 }
 for(const score of [null,'0.3',-1,1.1]) assert.throws(()=>parseScore({choices:[{finish_reason:'stop',message:{content:JSON.stringify({score})}}]}));
});
test('bounded timeout releases leases and does not return numeric badge',async()=>{
 const env=setup({delay:100});await assert.rejects(detectVideo(meta,config,{...env,deadline:Date.now()+90}),e=>e.code==='TIMEOUT');
 assert.equal([...env.store.values.entries()].filter(([k,v])=>k.includes('.slot.')&&v).length,0);
 assert.equal(statusBadge({state:'unavailable',code:'TIMEOUT'}).label,'TIMEOUT');
});
test('4:3 and 16:9 cover pipeline returns AI badge, same dimensions, cleaned headers',async()=>{
 for(const [width,height] of [[480,360],[480,270],[672,378]]){
  const env=setup();write(env.store,'cover.'+coverKey(url),{...meta,until:Date.now()+10000});
  const output=await processCover({url:url+'@'+width+'w_'+height+'h_1c.jpg'},{body:image(width,height),headers:{'Content-Length':'old',ETag:'old','Content-Type':'image/webp'}},'key=fixture-not-a-real-key',env);
  const decoded=jpeg.decode(output.body);assert.equal(decoded.width,width);assert.equal(decoded.height,height);
  assert.equal(output.headers['Content-Length'],undefined);assert.equal(output.headers.ETag,undefined);assert.equal(output.headers['Content-Type'],'image/jpeg');
  const pixel=(12*width+12)*4;assert.ok(decoded.data[pixel]<80);
 }
 assert.equal(statusBadge({state:'ok',score:0}).label,'AI 0%');assert.equal(statusBadge({state:'ok',score:1}).label,'AI 100%');
 assert.equal(rewriteJpeg(new Uint8Array([1,2,3])),null);
});
test('built feed/request/cover scripts interoperate in isolated JS contexts',async()=>{
 const env=setup();
 const folder=new URL('../dist/NoAIText-iOS-DeepSeek-0.1.1/Script/',import.meta.url);
 const payload={code:0,data:{items:[{goto:'av',param:'100',player_args:{cid:200},cover:url}]}};
 function execute(script,globals){return new Promise((resolve,reject)=>{
  const context={Uint8Array,ArrayBuffer,setTimeout,clearTimeout,console:{log(){}},...globals,$done:resolve,$persistentStore:env.store,$httpClient:env.client};
  try{vm.runInNewContext(script,context,{timeout:1000});}catch(e){reject(e);}
 });}
 await execute(await readFile(new URL('NoAIText.Feed.js',folder),'utf8'),{$response:{body:JSON.stringify(payload)}});
 const request=await execute(await readFile(new URL('NoAIText.ImageRequest.js',folder),'utf8'),{$request:{url:url+'@480w_360h_1c.webp'}});
 assert.match(request.url,/@480w_360h_1c.jpg/);
 const response=await execute(await readFile(new URL('NoAIText.Cover.js',folder),'utf8'),{$request:{url:request.url},$response:{body:image(),headers:{}},$argument:'key=fixture-not-a-real-key'});
 assert.equal(jpeg.decode(response.body).height,360);assert.equal(env.requests.filter(r=>r.method==='post').length,1);
});

test('unsupported images skip AI calls and mapping collision stays ambiguous',async()=>{
 const env=setup();write(env.store,'cover.'+coverKey(url),{...meta,until:Date.now()+10000});
 assert.equal(supportedJpeg(image()),true);assert.equal(supportedJpeg(image(900,675)),false);
 assert.deepEqual(await processCover({url},{body:image(900,675),headers:{}},'key=fixture-not-a-real-key',env),{});
 assert.equal(env.requests.length,0);
 registerVideos({data:{items:[{goto:'av',param:'999',cover:url}]}},env.store);
 registerVideos({data:{items:[{goto:'av',param:'100',cover:url}]}},env.store);
 assert.equal(read(env.store,'cover.'+coverKey(url)).ambiguous,true);
});


test('module arguments use Shadowrocket triple braces and parser supports JSON/object',async()=>{
 const module=await readFile(new URL('../dist/NoAIText-iOS-DeepSeek-0.1.1/NoAIText.DeepSeek.srmodule',import.meta.url),'utf8');
 const arg=module.split('argument=')[1].split('\n')[0];
 assert.match(arg,/key=\{\{\{DeepSeekKey\}\}\}/);
 assert.equal(settings('key={{DeepSeekKey}}').keyIssue,'PARAM');
 assert.equal(settings({_missing:true}).keyIssue,'PARAM');
 assert.equal(settings('key=请填写自己的Key').keyIssue,'NO_KEY');
 assert.equal(settings({key:'fixture',thinking:false}).thinking,false);
 assert.equal(settings(JSON.stringify({key:'fixture',model:'deepseek-flash'})).key,'fixture');
 const rendered=arg.replace(/\{\{\{([^}]+)\}\}\}/g,(_,name)=>({DeepSeekKey:'fixture',模型:'deepseek-flash',思考:'true',强度:'high',等待秒:'45',并发:'2',缓存天:'7'})[name]);
 assert.equal(settings(rendered).keyIssue,null);assert.equal(settings(rendered).key,'fixture');
});
test('unmatched ordinary video JPEG has MAP badge instead of silent skip',async()=>{
 const env=setup();const result=await processCover({url},{body:image(),headers:{}},'key=fixture',env);
 assert.ok(result.body);assert.equal(env.requests.length,0);
 assert.equal(statusBadge({code:'NO_KEY'}).label,'NO KEY');
 assert.equal(statusBadge({code:'PARAM'}).label,'PARAM');
 assert.equal(statusBadge({code:'AUTH'}).label,'AUTH');
});
