import {processCoverList} from './cover-list.js';
if(typeof $response!=='undefined' && typeof $request!=='undefined') {
  try{$done(processCoverList($request,$response,typeof $argument==='undefined'?{_missing:true}:$argument,{store:$persistentStore}));}
  catch{console.log('[NoAIText CoverList] FAIL_OPEN');$done({});}
}
