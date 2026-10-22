import {detectVideo as oldDetector} from '../.performance-baseline/detector.js';
import {detectVideo as newDetector} from '../src/detector.js';
import {settings as oldSettings} from '../.performance-baseline/common.js';
import {settings as newSettings} from '../src/common.js';
function environment(){
 const values=new Map([['noaitext.ios.v1.session',JSON.stringify({cookie:'SESSDATA=fixture',until:Date.now()+86400000})]]),store={read:k=>values.get(k),write:(v,k)=>{values.set(k,v);return true;}};
 let calls=0;
 const mock=(req,done)=>{calls++;const aid=Number(/[?&]aid=(\d+)/.exec(req.url)?.[1]||100);let data,delay=40;
 if(req.url.includes('/x/web-interface/view'))data={code:0,data:{aid,bvid:'BV'+String(aid).padStart(10,'0'),pages:[{cid:aid+100}]}};
 else if(req.url.includes('/x/web-interface/nav'))data={code:0,data:{isLogin:true,wbi_img:{img_url:'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',sub_url:'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png'}}};
 else if(req.url.includes('/x/player/wbi/v2'))data={code:0,data:{aid,cid:aid+100,subtitle:{subtitles:[{lan:'zh-Hans',subtitle_url:'https://aisubtitle.hdslb.com/bfs/subtitle/'+aid+'.json'}]}}};
 else if(req.url.includes('/bfs/subtitle/'))data={body:[{content:'模拟字幕用于排队性能测试，所有数字都不是实际视频检测和实际API延迟。'.repeat(5)}]};
 else {delay=350;data={choices:[{finish_reason:'stop',message:{content:'{"score":0.14}'}}]};}
 setTimeout(()=>done(null,{status:200},JSON.stringify(data)),delay);};
 return{store,client:{get:mock,post:mock},count:()=>calls};
}
for(const [label,detector,settings]of [['old-0.3.0',oldDetector,oldSettings],['new-0.3.1',newDetector,newSettings]]){
 const env=environment(),config=settings('key=fixture-not-a-real-key'),start=Date.now();
 await Promise.all(Array.from({length:8},(_,i)=>detector({aid:String(100+i),cid:String(200+i)},config,env)));
 console.log(JSON.stringify({fixture:true,version:label,concurrency:config.concurrent,videos:8,totalMs:Date.now()-start,httpCalls:env.count()}));
}
