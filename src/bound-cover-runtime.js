import {settings} from './common.js';
import {processBoundCover} from './bound-cover.js';
if(typeof $response!=='undefined' && typeof $request!=='undefined') {
  const argument=typeof $argument==='undefined'?{_missing:true}:$argument,config=settings(argument);
  let done=false,timer;const finish=value=>{if(!done){done=true;clearTimeout(timer);$done(value);}};
  timer=setTimeout(()=>finish({}),config.wait*1000+700);
  processBoundCover($request,$response,argument,{store:$persistentStore,client:$httpClient,deadline:Date.now()+config.wait*1000})
    .then(finish).catch(()=>finish({}));
}
