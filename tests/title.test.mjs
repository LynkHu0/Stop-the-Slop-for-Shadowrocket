import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {collectTitles,rewriteTitles,titlePrefix,processTitles} from '../src/title.js';
import {settings,write} from '../src/common.js';
const config=settings('key=fixture-not-a-real-key');
function environment(options={}) {
 const values=new Map(),requests=[];
 const store={read:k=>values.get(k),write:(v,k)=>{values.set(k,v);return true;}};
 write(store,'session',{cookie:'SESSDATA=fixture; DedeUserID=1',until:Date.now()+86400000});
 const respond=method=>(request,done)=>{
  requests.push({method,...request});
  let payload,status=200;
  const aid=/[?&]aid=(\d+)/.exec(request.url)?.[1] || '100';
  if(request.url.includes('/x/web-interface/view')) payload={code:0,data:{aid,bvid:'BV1234567890',pages:[{cid:Number(aid)+100}]}};
  else if(request.url.includes('/x/web-interface/nav')) payload={code:0,data:{isLogin:true,wbi_img:{img_url:'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',sub_url:'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png'}}};
  else if(request.url.includes('/x/player/wbi/v2')) payload={code:0,data:{aid,cid:Number(aid)+100,subtitle:{subtitles:options.noSub?[]:[{lan:'ai-zh',subtitle_url:'https://aisubtitle.hdslb.com/bfs/subtitle/'+aid+'.json'}]}}};
  else if(request.url.includes('/bfs/subtitle/')) payload={body:[{content:'这是一段模拟字幕，只用于验证字幕获取评分和标题前缀链路。'.repeat(5)}]};
  else if(request.url.includes('api.deepseek.com')) {status=options.auth?401:200;payload={choices:[{finish_reason:'stop',message:{content:JSON.stringify({score:options.score??.14})}}]};}
  else throw new Error('Unexpected mock URL');
  setTimeout(()=>done(null,{status},JSON.stringify(payload)),options.delay || 1);
 };
 return {store,requests,client:{get:respond('get'),post:respond('post')}};
}
function feed(cards=[{goto:'av',param:'100',title:'原始视频标题',cover:'https://i0.hdslb.com/bfs/archive/test.jpg@480w_360h_1c.webp',uri:'bilibili://video/100'}]) {return JSON.stringify({code:0,data:{items:cards}});}

test('direct title extraction needs no cover mapping and rejects live/ad/article',()=>{
 const payload=JSON.parse(feed([
  {goto:'av',param:'100',title:'没有封面的普通视频'},
  {goto:'live',aid:'101',title:'直播'},
  {goto:'article',aid:'102',title:'文章'},
  {goto:'av',param:'103',title:'广告',ad_info:{type:1}},
  {modules:{module_dynamic:{major:{archive:{aid:'104',title:'动态视频'}}}}},
  {uri:'bilibili://video/105',title:{text:'搜索视频'}},
  {mid:106,title:'UP主名'},
 ]));
 const targets=collectTitles(payload);assert.equal(targets.length,3);
 assert.deepEqual(targets.map(t=>t.meta.aid),['100','104','105']);
});
test('official subtitle + DeepSeek produces requested 「14%」 prefix and preserves covers/links',async()=>{
 const env=environment();const original=JSON.parse(feed());
 const result=await rewriteTitles(JSON.stringify(original),config,env);
 const item=JSON.parse(result.body).data.items[0];
 assert.equal(item.title,'「14%」原始视频标题');
 assert.equal(item.cover,original.data.items[0].cover);assert.equal(item.uri,original.data.items[0].uri);
 assert.equal(result.completed,1);assert.equal(env.requests.filter(r=>r.method==='post').length,1);
 const calls=env.requests.length;const cached=await rewriteTitles(feed(),config,env);
 assert.equal(cached.hits,1);assert.equal(env.requests.length,calls);
 assert.equal(JSON.parse(cached.body).data.items[0].title,item.title);
});
test('same video appearing twice is scored once; prefixes do not accumulate',async()=>{
 const env=environment();const raw=feed([{goto:'av',param:'100',title:'原始标题'},{goto:'av',param:'100',title:'「99%」原始标题'}]);
 const result=await rewriteTitles(raw,config,env);
 assert.deepEqual(JSON.parse(result.body).data.items.map(x=>x.title),['「14%」原始标题','「14%」原始标题']);
 assert.equal(env.requests.filter(r=>r.method==='post').length,1);
});
test('no subtitles/login/key and API errors cannot become percentage scores',async()=>{
 const noSub=await rewriteTitles(feed(),config,environment({noSub:true}));assert.equal(JSON.parse(noSub.body).data.items[0].title,'「无字幕」原始视频标题');
 const missing=await rewriteTitles(feed(),settings(''),environment());assert.match(JSON.parse(missing.body).data.items[0].title,/^「未配Key」/);
 const auth=await rewriteTitles(feed(),config,environment({auth:true}));assert.match(JSON.parse(auth.body).data.items[0].title,/^「认证失败」/);
 const env=environment();env.store.write('','noaitext.ios.v1.session');
 assert.match(JSON.parse((await rewriteTitles(feed(),config,env)).body).data.items[0].title,/^「需登录」/);
 for(const score of [-1,NaN,2,'0.14']) assert.equal(titlePrefix({state:'ok',score}),'「检测失败」');
 assert.equal(titlePrefix({state:'ok',score:0}),'「0%」');assert.equal(titlePrefix({state:'ok',score:1}),'「100%」');
});
test('whole-batch deadline does not multiply per video; remaining cards are pending',async()=>{
 const env=environment();const raw=feed(Array.from({length:6},(_,i)=>({goto:'av',param:String(100+i),title:'视频'+i})));
 const result=await rewriteTitles(raw,config,{...env,deadline:Date.now()+500});
 assert.ok(JSON.parse(result.body).data.items.every(x=>x.title.startsWith('「待检」')));
 assert.equal(env.requests.length,0);
});
test('cache hits still render before expired batch budget',async()=>{
 const env=environment();await rewriteTitles(feed(),config,env);const count=env.requests.length;
 const result=await rewriteTitles(feed([{goto:'av',param:'101',title:'未缓存'},{goto:'av',param:'100',title:'已缓存'}]),config,{...env,deadline:Date.now()+100});
 assert.deepEqual(JSON.parse(result.body).data.items.map(x=>x.title),['「待检」未缓存','「14%」已缓存']);
 assert.equal(env.requests.length,count);
});
test('invalid/non-JSON/protobuf/error/unsupported cards pass through',async()=>{
 for(const body of ['\x0a\x00','not json','{"code":-101}',feed([{goto:'live',param:'100',title:'直播'}])]) {
  const env=environment();const output=await processTitles({}, {body,headers:{}},'',env);assert.deepEqual(output,{});assert.equal(env.requests.length,0);
 }
});
test('build module has title/session/gRPC scripts, safe endpoints and triple-brace parameters',async()=>{
 const root=new URL('../dist/NoAIText-iOS-Title-0.2.2/',import.meta.url);
 const module=await readFile(new URL('NoAIText.Title.srmodule',root),'utf8');
 assert.match(module,/key=\{\{\{DeepSeekKey\}\}\}/);
 assert.doesNotMatch(module,/hdslb|ImageRequest|NoAIText.Cover/);
 const pattern=module.split('pattern=')[1].split(', requires-body')[0];const re=new RegExp(pattern);
 for(const url of ['https://app.bilibili.com/x/v2/feed/index?x=1','https://app.biliapi.net/x/v2/search/type?x=1','https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?x=1']) assert.ok(re.test(url));
 for(const url of ['https://api.bilibili.com/x/web-interface/view?aid=100','https://api.bilibili.com/x/player/wbi/v2?aid=100','https://api.bilibili.com/x/web-interface/nav','https://api.deepseek.com/chat/completions']) assert.equal(re.test(url),false);
 const env=environment();const script=await readFile(new URL('Script/NoAIText.Title.js',root),'utf8');
 const response=await new Promise((resolve,reject)=>{
  try {vm.runInNewContext(script,{$request:{url:'https://app.bilibili.com/x/v2/feed/index'},$response:{body:feed(),headers:{'Content-Length':'old','Content-Encoding':'gzip',ETag:'old'}},$argument:'key=fixture-not-a-real-key',$persistentStore:env.store,$httpClient:env.client,$done:resolve,setTimeout,clearTimeout,console:{log(){}}},{timeout:1000});} catch(e){reject(e);}
 });
 assert.match(JSON.parse(response.body).data.items[0].title,/^「14%」/);
 assert.equal(response.headers['Content-Encoding'],undefined);assert.equal(response.headers.ETag,undefined);assert.equal(response.headers['Content-Length'],undefined);
 assert.equal(env.requests.filter(r=>r.method==='post').length,1);
});
