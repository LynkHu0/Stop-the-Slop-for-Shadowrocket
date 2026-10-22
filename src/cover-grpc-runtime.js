import {processGrpcCoverList} from './cover-list.js';
if(typeof $response!=='undefined' && typeof $request!=='undefined') {
  try{$done(processGrpcCoverList($request,$response,typeof $argument==='undefined'?{_missing:true}:$argument,{store:$persistentStore}));}
  catch{console.log('[NoAIText CoverList gRPC] FAIL_OPEN');$done({});}
}
