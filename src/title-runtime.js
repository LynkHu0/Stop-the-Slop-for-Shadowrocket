import {recordDiagnostic} from './diagnostics.js';
import {settings} from './common.js';
import {processTitles} from './title.js';
if(typeof $response!=='undefined' && typeof $request!=='undefined') {
  const argument=typeof $argument==='undefined'?{_missing:true}:$argument;
  const config=settings(argument);
  const started=Date.now();
  let done=false;
  let watchdog;
  const finish=value=>{if(!done){done=true;clearTimeout(watchdog);$done(value);}};
  watchdog=setTimeout(()=>{recordDiagnostic($persistentStore,'JSON',$request,{reason:'BUDGET_FAIL_OPEN'},started);console.log('[NoAIText Title] FAIL_OPEN');finish({});},config.wait*1000+700);
  processTitles($request,$response,argument,{store:$persistentStore,client:$httpClient,deadline:Date.now()+config.wait*1000})
    .then(finish).catch(()=>{console.log('[NoAIText Title] RESPONSE_OR_STORE_ERROR');finish({});});
}
