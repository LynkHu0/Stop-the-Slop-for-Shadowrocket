import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {strToU8} from 'fflate';
import {parseMessage,varint,concat,serialize,fields,child,text,grpcFrames,encodeFrame} from '../src/protobuf.js';
import {collectProtoTitles,processGrpcTitles,grpcRoute} from '../src/grpc-title.js';
import {collectTitles,rewriteTitles} from '../src/title.js';
import {settings,write} from '../src/common.js';
const field=(n,data)=>concat([varint(n*8+2),varint(data.length),data]);
const number=(n,value)=>concat([varint(n*8),varint(value)]);
const string=(n,value)=>field(n,strToU8(value));
const archive=()=>concat([string(1,'关注视频原标题'),string(2,'original-cover'),string(3,'bilibili://video/100'),number(7,100),number(8,200),string(26,'BV1234567890'),field(90,new Uint8Array([255,254,0,17]))]);
const item=(type=2)=>concat([number(1,type),field(3,concat([number(1,4),field(5,field(2,archive()))])),string(6,'original-server-info')]);
const dynamic=()=>concat([field(1,concat([field(1,item()),number(5,1)])),string(20,'unknown-root-field')]);
const url='https://grpc.biliapi.net/bilibili.app.dynamic.v2.Dynamic/DynAll';
const config=settings('key=fixture-not-a-real-key');
function environment(){
 const values=new Map(),calls=[];const store={read:k=>values.get(k),write:(v,k)=>{values.set(k,v);return true;}};
 write(store,'session',{cookie:'SESSDATA=fixture',until:Date.now()+86400000});
 const mock=(request,done)=>{
  calls.push(request);let body;
  if(request.url.includes('/x/web-interface/view'))body={code:0,data:{aid:100,bvid:'BV1234567890',pages:[{cid:200}]}};
  else if(request.url.includes('/x/web-interface/nav'))body={code:0,data:{isLogin:true,wbi_img:{img_url:'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',sub_url:'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png'}}};
  else if(request.url.includes('/x/player/wbi/v2'))body={code:0,data:{aid:100,cid:200,subtitle:{subtitles:[{lan:'zh-Hans',subtitle_url:'https://aisubtitle.hdslb.com/bfs/subtitle/fixture.json'}]}}};
  else if(request.url.includes('/bfs/subtitle/'))body={body:[{content:'这是字幕文本，只用于测试字段读取和返回百分比标题的过程。'.repeat(5)}]};
  else body={choices:[{finish_reason:'stop',message:{content:'{"score":0.14}'}}]};
  setTimeout(()=>done(null,{status:200},JSON.stringify(body)),1);
 };
 return{store,calls,client:{get:mock,post:mock}};
}

test('vertical_av and story URI are supported without changing navigation fields',async()=>{
 const raw=JSON.stringify({code:0,data:{items:[{goto:'vertical_av',param:'100',title:'竖屏视频',uri:'bilibili://story/100?cid=200',player_args:{cid:200},cover:'vertical-original.webp'}]}});
 const env=environment();assert.equal(collectTitles(JSON.parse(raw)).length,1);
 const out=JSON.parse((await rewriteTitles(raw,config,env)).body).data.items[0];
 assert.equal(out.title,'「14%」竖屏视频');assert.equal(out.goto,'vertical_av');assert.equal(out.uri,'bilibili://story/100?cid=200');assert.equal(out.cover,'vertical-original.webp');
});
test('older following feed embedded JSON card is written back as a JSON string',async()=>{
 const raw=JSON.stringify({code:0,data:{cards:[{desc:{type:8},card:JSON.stringify({aid:100,cid:200,title:'旧动态视频',pic:'unchanged'})}]}});
 const out=JSON.parse((await rewriteTitles(raw,config,environment())).body);
 assert.equal(typeof out.data.cards[0].card,'string');assert.equal(JSON.parse(out.data.cards[0].card).title,'「14%」旧动态视频');
 assert.equal(JSON.parse(out.data.cards[0].card).pic,'unchanged');
});
test('protobuf round-trip preserves unknown fields and original encodings',()=>{
 const payload=dynamic();const root=parseMessage(payload);assert.deepEqual(serialize(root),payload);
 const titles=collectProtoTitles(root,'dynamic-list');assert.equal(titles.targets.length,1);assert.equal(titles.targets[0].meta.aid,'100');
 titles.targets[0].object.title='「14%」关注视频原标题';titles.commit();const out=serialize(root);
 const reread=parseMessage(out);assert.equal(text(reread,20),'unknown-root-field');
 const dynItem=child(fields(child(fields(reread,1)[0]),1)[0]);assert.equal(text(dynItem,6),'original-server-info');
 const arch=child(fields(child(fields(child(fields(dynItem,3)[0]),5)[0]),2)[0]);
 assert.equal(text(arch,1),'「14%」关注视频原标题');assert.equal(text(arch,2),'original-cover');
 assert.deepEqual(fields(arch,90)[0].data,new Uint8Array([255,254,0,17]));
});
test('following gRPC supports raw and gzip frames and retains trailers',async()=>{
 for(const flag of [0,1]){
  const trailer=encodeFrame(strToU8('grpc-status: 0\r\n'),128);
  const body=concat([encodeFrame(dynamic(),flag),trailer]);
  const env=environment();const result=await processGrpcTitles({url},{body,headers:{'content-type':'application/grpc+proto','grpc-encoding':'gzip','content-length':'old'}},'key=fixture-not-a-real-key',env);
  const frames=grpcFrames(result.body);assert.equal(frames[0].flag,flag);assert.deepEqual(frames[1].raw,trailer);
  assert.equal(collectProtoTitles(parseMessage(frames[0].decoded),'dynamic-list').targets[0].original,'「14%」关注视频原标题');
  assert.equal(result.headers['Content-Type'],'application/grpc+proto');assert.equal(result.headers['grpc-encoding'],'gzip');assert.equal(result.headers['content-length'],undefined);
  assert.equal(env.calls.filter(x=>x.url.includes('api.deepseek.com')).length,1);
 }
});
test('personal following and space Archive use their exact root schemas',()=>{
 const targets=collectProtoTitles(parseMessage(field(1,item())),'dynamic-items');assert.equal(targets.targets.length,1);
 const space=concat([field(1,concat([string(1,'个人投稿'),string(5,'bilibili://video/100'),string(6,'100'),string(14,'BV1234567890')])),number(2,1)]);
 const titles=collectProtoTitles(parseMessage(space),'space');assert.equal(titles.targets[0].original,'个人投稿');assert.equal(titles.targets[0].meta.aid,'100');
 for(const method of ['DynAll','DynVideo','DynSpace','DynVideoPersonal','DynAllPersonal'])assert.ok(grpcRoute(url.replace('DynAll',method)));
});
test('unsupported/malformed gRPC frames and non-UGC cards fail open untouched',async()=>{
 for(const body of [new Uint8Array([0,0,0]),new Uint8Array([1,0,0,0,1,0]),encodeFrame(field(1,field(1,item(15))))]){
  const env=environment();assert.deepEqual(await processGrpcTitles({url},{body,headers:{}},'',env),{});assert.equal(env.calls.length,0);
 }
});
test('distributed gRPC entry returns one modified binary response',async()=>{
 const script=await readFile(new URL('../dist/NoAIText-iOS-Title-0.2.2/Script/NoAIText.GrpcTitle.js',import.meta.url),'utf8');
 const env=environment();let doneCount=0;
 const output=await new Promise((resolve,reject)=>{
  try {vm.runInNewContext(script,{$request:{url},$response:{body:encodeFrame(dynamic()),headers:{}},$argument:'key=fixture-not-a-real-key',$persistentStore:env.store,$httpClient:env.client,$done:r=>{doneCount++;resolve(r);},setTimeout,clearTimeout,Uint8Array,ArrayBuffer,console:{log(){}}},{timeout:1000});}catch(e){reject(e);}
 });
 assert.equal(doneCount,1);assert.match(collectProtoTitles(parseMessage(grpcFrames(output.body)[0].decoded),'dynamic-list').targets[0].original,/^「14%」/);
});

test('SearchAll and SearchByType nested video cards use parent aid and preserve keywords/pagination',async()=>{
 const searchUrl='https://grpc.biliapi.net/bilibili.polymer.app.search.v1.Search/';
 const card=concat([string(1,'搜索视频原标题'),string(2,'search-cover'),field(90,new Uint8Array([0,255]))]);
 const searchItem=concat([string(1,'bilibili://video/100'),string(2,'100'),string(3,'av'),field(37,card)]);
 for(const [method,itemNumber] of [['SearchAll',4],['SearchByType',6]]) {
  const payload=concat([string(method==='SearchAll'?1:4,'影视飓风'),field(itemNumber,searchItem),field(50,new Uint8Array([9,8,7]))]);
  const env=environment();const out=await processGrpcTitles({url:searchUrl+method},{body:encodeFrame(payload),headers:{}},'key=fixture-not-a-real-key',env);
  assert.ok(out.body);const parsed=parseMessage(grpcFrames(out.body)[0].decoded);
  assert.equal(text(parsed,method==='SearchAll'?1:4),'影视飓风');assert.deepEqual(fields(parsed,50)[0].data,new Uint8Array([9,8,7]));
  const titles=collectProtoTitles(parsed,method==='SearchAll'?'search-all':'search-type');assert.equal(titles.targets[0].original,'「14%」搜索视频原标题');
 }
});
test('author search results keep author name and score the embedded AvItems',async()=>{
 const av=concat([string(1,'UP主附带视频'),string(3,'bilibili://video/100'),string(9,'av'),string(10,'100')]);
 const author=concat([string(1,'影视飓风'),field(21,av)]);
 const item=concat([string(3,'author'),field(23,author)]);
 const body=encodeFrame(field(4,item));const env=environment();
 const out=await processGrpcTitles({url:'https://grpc.biliapi.net/bilibili.polymer.app.search.v1.Search/SearchAll'},{body,headers:{}},'key=fixture-not-a-real-key',env);
 const parsed=parseMessage(grpcFrames(out.body)[0].decoded);
 const person=child(fields(child(fields(parsed,4)[0]),23)[0]);assert.equal(text(person,1),'影视飓风');
 assert.equal(text(child(fields(person,21)[0]),1),'「14%」UP主附带视频');
});
test('nested JSON search navigation and unknown wrappers retain embedded videos',async()=>{
 const body=JSON.stringify({code:0,data:{goto:'search',items:[{goto:'av',param:'100',av:{title:'嵌套搜索视频'}},{goto:'author',title:'UP主',av_items:[{goto:'av',param:'100',title:'UP投稿视频'}]}]}});
 const env=environment();const out=JSON.parse((await rewriteTitles(body,config,env)).body);
 assert.equal(out.data.items[0].av.title,'「14%」嵌套搜索视频');assert.equal(out.data.items[1].title,'UP主');assert.equal(out.data.items[1].av_items[0].title,'「14%」UP投稿视频');
 assert.equal(env.calls.filter(r=>r.url.includes('api.deepseek.com')).length,1);
});
test('local diagnostics removes query/search terms and credentials',async()=>{
 const {recordDiagnostic,statusHtml}=await import('../src/diagnostics.js');
 const env=environment();recordDiagnostic(env.store,'gRPC',{url:'https://grpc.biliapi.net/bilibili.polymer.app.search.v1.Search/SearchAll?keyword=private-search&access_key=private-token'},{changed:3,states:{OK:2,NO_SUB:1}},Date.now());
 const html=statusHtml(env.store);assert.match(html,/命中 3/);assert.match(html,/NO_SUB: 1/);assert.doesNotMatch(html,/private-search|private-token|SESSDATA=fixture/);
});
test('module intercepts both modern search RPC routes and local status page',async()=>{
 const s=await readFile(new URL('../dist/NoAIText-iOS-Title-0.2.2/NoAIText.Title.srmodule',import.meta.url),'utf8');
 const pattern=s.split('NoAIText.GrpcTitle = ')[1].split('pattern=')[1].split(', requires-body')[0];const regex=new RegExp(pattern);
 for(const method of ['SearchAll','SearchByType'])assert.ok(regex.test('https://grpc.biliapi.net/bilibili.polymer.app.search.v1.Search/'+method));
 assert.match(s,/script-path=Script\/NoAIText.Status.js/);
});
