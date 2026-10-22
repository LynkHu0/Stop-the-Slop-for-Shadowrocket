import {recordDiagnostic} from './diagnostics.js';
import {settings} from './common.js';
import {processGrpcTitles} from './grpc-title.js';
if(typeof $response!=='undefined' && typeof $request!=='undefined') {
  const argument=typeof $argument==='undefined'?{_missing:true}:$argument;
  const config=settings(argument);
  const started=Date.now();
  let done=false,watchdog;
  const finish=value=>{if(!done){done=true;clearTimeout(watchdog);$done(value);}};
  watchdog=setTimeout(()=>{recordDiagnostic($persistentStore,'gRPC',$request,{reason:'PIPELINE_FAIL_OPEN'},started);console.log('[NoAIText gRPC] FAIL_OPEN');finish({});},config.wait*1000+700);
  processGrpcTitles($request,$response,argument,{store:$persistentStore,client:$httpClient,deadline:Date.now()+config.wait*1000})
    .then(finish).catch(()=>{recordDiagnostic($persistentStore,'gRPC',$request,{reason:'PIPELINE_FAIL_OPEN'},started);console.log('[NoAIText gRPC] FAIL_OPEN');finish({});});
}
