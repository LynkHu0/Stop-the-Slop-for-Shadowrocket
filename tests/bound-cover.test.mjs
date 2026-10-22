import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import jpeg from 'jpeg-js';import {strToU8} from 'fflate';
import {settings,write} from '../src/common.js';
import {taggedCover,prepareCoverRequest,resolveBinding,jpegImageUrl,tokenFrom} from '../src/cover-binding.js';
import {processCoverList,processGrpcCoverList} from '../src/cover-list.js';
import {processBoundCover} from '../src/bound-cover.js';
import {varint,concat,encodeFrame,grpcFrames,parseMessage,fields,child,text} from '../src/protobuf.js';
import {supportedJpeg} from '../src/image-codec.js';
const config=settings('key=fixture-not-a-real-key');const raw='https://i0.hdslb.com/bfs/archive/shared.jpg';
const storage=()=>{const values=new Map();return{values,read:k=>values.get(k),write:(v,k)=>{values.set(k,v);return true;}};};
const f=(n,b)=>concat([varint(n*8+2),varint(b.length),b]);const s=(n,v)=>f(n,strToU8(v));const n=(k,v)=>concat([varint(k*8),varint(v)]);
function image(width=480,height=360){return jpeg.encode({width,height,data:new Uint8Array(width*height*4).fill(180)},80).data;}
function environment(){
 const store=storage(),calls=[];write(store,'session',{cookie:'SESSDATA=fixture',until:Date.now()+86400000});
 const mock=(req,done)=>{calls.push(req);let data;const aid=/[?&]aid=(\d+)/.exec(req.url)?.[1] || '100';
 if(req.url.includes('/x/web-interface/view'))data={code:0,data:{aid,bvid:'BV1234567890',pages:[{cid:200}]}};
 else if(req.url.includes('/x/web-interface/nav'))data={code:0,data:{isLogin:true,wbi_img:{img_url:'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',sub_url:'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png'}}};
 else if(req.url.includes('/x/player/wbi/v2'))data={code:0,data:{aid,cid:200,subtitle:{subtitles:[{lan:'zh-Hans',subtitle_url:'https://aisubtitle.hdslb.com/bfs/subtitle/fixture.json'}]}}};
 else if(req.url.includes('/bfs/subtitle/'))data={body:[{content:'这是一段本地测试字幕，用于确认绑定视频和字幕的身份，以及最终图片分数处理。'.repeat(5)}]};
 else data={choices:[{finish_reason:'stop',message:{content:'{"score":0.14}'}}]};
 setTimeout(()=>done(null,{status:200},JSON.stringify(data)),1);};
 return{store,calls,client:{get:mock,post:mock}};
}

test('list response is synchronous and never calls AI; titles/order/cursors remain unchanged',()=>{
 const store=storage();const input={code:0,data:{items:[{goto:'av',param:'100',title:'横屏',cover:raw},{goto:'vertical_av',param:'101',title:'竖屏',cover:raw+'@480w_854h_1c.webp'}],cursor:'keep',has_more:true}};
 const out=processCoverList({url:'https://app.bilibili.com/x/v2/feed/index'}, {body:JSON.stringify(input),headers:{}},'key=fixture',{store,client:new Proxy({},{get(){throw new Error('network call in list');}})});
 assert.equal(out instanceof Promise,false);const json=JSON.parse(out.body);
 assert.deepEqual(json.data.items.map(x=>x.title),['横屏','竖屏']);assert.equal(json.data.cursor,'keep');assert.equal(json.data.has_more,true);
 assert.match(json.data.items[0].cover,/\/noaitext\/v030\//);assert.match(json.data.items[1].cover,/@480w_854h_1c.webp$/);
});
test('same picture bound to different videos cannot share or guess metadata',()=>{
 const store=storage();const a=taggedCover(raw,{aid:'100',cid:'200'},store,config),b=taggedCover(raw,{aid:'101',cid:'201'},store,config);
 assert.notEqual(tokenFrom(a),tokenFrom(b));const ra=prepareCoverRequest({url:a+'@640w_360h_1c.webp'}),rb=prepareCoverRequest({url:b+'@640w_360h_1c.webp'});
 assert.equal(resolveBinding(ra,store).aid,'100');assert.equal(resolveBinding(rb,store).aid,'101');
 assert.equal(resolveBinding({...ra,url:ra.url.replace('shared.jpg','wrong.jpg')},store),null);
 assert.equal(resolveBinding({...ra,url:ra.url.replace('i0.hdslb.com','i1.hdslb.com')},store).aid,'100');
 assert.equal(resolveBinding({url:raw},store),null);
});
test('native crop appending and dropped query still retain token in alias path',()=>{
 const store=storage(),alias=taggedCover(raw,{aid:'100'},store,config);
 const request=prepareCoverRequest({url:alias+'@672w_504h_1c.webp'});
 assert.match(request.url,/@672w_504h_1c.jpg\?_nai=/);assert.doesNotMatch(request.url,/\/noaitext\//);
 assert.equal(resolveBinding(request,store).aid,'100');
 assert.equal(resolveBinding({url:request.url.split('?')[0],headers:request.headers},store).aid,'100');
 assert.equal(resolveBinding({url:alias+'@480w_270h_1c.webp'},store).aid,'100');
});
test('4:3,16:9,9:16 keep their ratios; oversized requests shrink proportionally',()=>{
 for(const [w,h] of [[480,360],[480,270],[480,854],[1200,900],[1920,1080],[1080,1920]]){
  const url=jpegImageUrl(raw+'@'+w+'w_'+h+'h_1c.webp');const m=/@(\d+)w_(\d+)h_1c.jpg/.exec(url);assert.ok(m);
  const nw=Number(m[1]),nh=Number(m[2]);assert.equal(nw*h,nh*w);assert.ok(nw<=800&&nh<=1200&&nw*nh<=480000);
 }
 assert.equal(supportedJpeg(image(480,854)),true);
});
test('video without a displayed title still binds its explicit ID and cover',()=>{
 const out=processCoverList({url:'https://app.bilibili.com/x/v2/channel/feed'},{body:JSON.stringify({code:0,data:{items:[{goto:'av',param:'100',cover:raw},{goto:'live',param:'99',cover:raw}]}}),headers:{}},'key=fixture',{store:storage()});
 const json=JSON.parse(out.body);assert.match(json.data.items[0].cover,/noaitext/);assert.equal(json.data.items[1].cover,raw);
});
test('search gRPC list returns tagged cover without AI or changed title',()=>{
 const item=concat([s(1,'bilibili://video/100'),s(2,'100'),s(3,'av'),f(37,concat([s(1,'搜索视频'),s(2,raw)]))]);
 const body=encodeFrame(f(4,item));const out=processGrpcCoverList({url:'https://grpc.biliapi.net/bilibili.polymer.app.search.v1.Search/SearchAll'},{body,headers:{}},'key=fixture',{store:storage()});
 assert.equal(out instanceof Promise,false);
 const card=child(fields(child(fields(parseMessage(grpcFrames(out.body)[0].decoded),4)[0]),37)[0]);assert.equal(text(card,1),'搜索视频');assert.match(text(card,2),/noaitext\/v030/);
});
test('following/space protobuf cover fields are bound without mutating titles',()=>{
 const archive=concat([s(1,'关注视频'),s(2,raw),n(7,100),n(8,200)]);const dynamic=n(1,2);const item=concat([dynamic,f(3,f(5,f(2,archive)))]);
 const cases=[['https://grpc.biliapi.net/bilibili.app.dynamic.v2.Dynamic/DynAll',f(1,f(1,item))],['https://grpc.biliapi.net/bilibili.app.space.v1.Space/Archive',f(1,concat([s(1,'个人投稿'),s(4,raw),s(5,'bilibili://video/100'),s(6,'100')]))]];
 for(const [url,root]of cases){const out=processGrpcCoverList({url},{body:encodeFrame(root,1),headers:{'grpc-encoding':'gzip'}},'key=fixture',{store:storage()});assert.ok(out.body);assert.equal(grpcFrames(out.body)[0].flag,1);}
});
test('bound cover alone gets official subtitles and DeepSeek then returns AI JPEG',async()=>{
 const env=environment(),alias=taggedCover(raw,{aid:'100',cid:'200'},env.store,config);
 const req=prepareCoverRequest({url:alias+'@480w_854h_1c.webp'});
 const out=await processBoundCover(req,{body:image(480,854),headers:{ETag:'old'}},'key=fixture-not-a-real-key',env);
 const decoded=jpeg.decode(out.body);assert.equal(decoded.width,480);assert.equal(decoded.height,854);assert.equal(out.headers.ETag,undefined);
 assert.equal(env.calls.filter(r=>r.url.includes('api.deepseek.com')).length,1);assert.ok(env.calls.find(r=>r.url.includes('/x/player/wbi/v2')).url.includes('aid=100'));
 const count=env.calls.length;await processBoundCover(req,{body:image(),headers:{}},'key=fixture-not-a-real-key',env);assert.equal(env.calls.length,count);
});
test('untagged avatar and expired bindings never call AI',async()=>{
 const env=environment();assert.deepEqual(await processBoundCover({url:raw},{body:image()},'key=fixture',env),{});assert.equal(env.calls.length,0);
 const alias=taggedCover(raw,{aid:'100'},env.store,config,Date.now()-4*86400000);const req=prepareCoverRequest({url:alias});
 const out=await processBoundCover(req,{body:image(),headers:{}},'key=fixture',env);assert.ok(out.body);assert.equal(env.calls.length,0);
});
test('shipped list entry is immediate even when AI provider never responds',async()=>{
 const code=await readFile(new URL('../dist/NoAIText-iOS-Cover-0.3.2/Script/NoAIText.CoverList.js',import.meta.url),'utf8');let output,network=0;
 vm.runInNewContext(code,{$request:{url:'https://app.bilibili.com/x/v2/feed/index'},$response:{body:JSON.stringify({code:0,data:{items:[{goto:'av',param:'100',title:'原始标题',cover:raw}]}}),headers:{}},$argument:'key=fixture',$persistentStore:storage(),$httpClient:{get(){network++},post(){network++}},$done:r=>{output=r;},console:{log(){}}},{timeout:1000});
 assert.ok(output?.body);assert.equal(network,0);assert.equal(JSON.parse(output.body).data.items[0].title,'原始标题');
});
test('cover module has no title modifier and excludes internal subtitle APIs from list hooks',async()=>{
 const s=await readFile(new URL('../dist/NoAIText-iOS-Cover-0.3.2/NoAIText.Cover.srmodule',import.meta.url),'utf8');assert.doesNotMatch(s,/script-path=Script\/NoAIText.Title.js/);
 const pattern=s.split('NoAIText.CoverList = ')[1].split('pattern=')[1].split(', requires-body')[0],re=new RegExp(pattern);
 assert.ok(re.test('https://app.bilibili.com/x/v2/channel/feed?cid=1'));assert.equal(re.test('https://api.bilibili.com/x/web-interface/view?aid=100'),false);assert.equal(re.test('https://api.bilibili.com/x/player/wbi/v2?cid=200'),false);
});

test('all three shipped stages connect list ID -> native image request -> scored cover',async()=>{
 const root=new URL('../dist/NoAIText-iOS-Cover-0.3.2/Script/',import.meta.url);const env=environment();
 async function run(name,globals){const code=await readFile(new URL('NoAIText.'+name+'.js',root),'utf8');return new Promise((resolve,reject)=>{try{vm.runInNewContext(code,{$persistentStore:env.store,$httpClient:env.client,$argument:'key=fixture-not-a-real-key',setTimeout,clearTimeout,Uint8Array,ArrayBuffer,console:{log(){}},...globals,$done:resolve},{timeout:1000});}catch(e){reject(e);}});}
 const listed=await run('CoverList',{$request:{url:'https://app.bilibili.com/x/v2/feed/index'},$response:{body:JSON.stringify({code:0,data:{items:[{goto:'vertical_av',param:'100',player_args:{cid:200},title:'原始竖屏视频',cover:raw}]}}),headers:{}}});
 const card=JSON.parse(listed.body).data.items[0];assert.equal(card.title,'原始竖屏视频');assert.equal(env.calls.length,0);
 const request=await run('CoverRequest',{$request:{url:card.cover+'@480w_854h_1c.webp'}});
 const output=await run('Cover',{$request:request,$response:{body:image(480,854),headers:{}}});assert.equal(jpeg.decode(output.body).height,854);assert.equal(env.calls.filter(x=>x.url.includes('api.deepseek.com')).length,1);
});
