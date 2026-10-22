import { coverKey, read, settings, cleanHeaders } from './common.js';
import { detectVideo, DetectionError } from './detector.js';
import { rewriteJpeg, supportedJpeg } from './image-codec.js';
export function statusBadge(result) {
  if(result?.state==='ok') {
    const percentage=Math.round(result.score*100);
    return {label:'AI '+percentage+'%',color:percentage>=70?[255,103,103]:percentage>=40?[246,199,88]:[64,224,139]};
  }
  const code=result?.code || 'ERROR';
  return {label:({KEY:'AUTH',NO_KEY:'NO KEY',PARAM:'PARAM',AUTH:'AUTH',LOGIN:'LOGIN',NO_SUB:'NO SUB',SHORT:'SHORT',TIMEOUT:'TIMEOUT',RATE:'RATE',BALANCE:'BALANCE',MAP:'MAP',MISMATCH:'MAP'})[code] || 'ERROR',color:[246,199,88]};
}
export async function processCover(request,response,argument,env) {
  const key=coverKey(request.url);
  if(!key) return {};
  const meta=read(env.store,'cover.'+key);
  if(!supportedJpeg(response.body)) { console.log('[NoAIText] cover: IMAGE'); return {}; }
  let result;
  try {
    if(!meta || meta.until<Date.now()) throw new DetectionError('MAP');
    result=await detectVideo(meta,settings(argument),env);
  }
  catch(error) { result={state:'unavailable',code:error instanceof DetectionError?error.code:'ERROR'}; }
  const badge=statusBadge(result);
  const output=rewriteJpeg(response.body,badge.label,badge.color);
  console.log('[NoAIText] cover: '+(result.state==='ok'?'OK':result.code));
  return output?{headers:cleanHeaders(response.headers,'image/jpeg'),body:output}:{};
}
if(typeof $response !== 'undefined' && typeof $request !== 'undefined') {
  let finished=false;
  const finish=value=>{if(!finished){finished=true;$done(value);}};
  const argument=typeof $argument==='undefined'?{_missing:true}:$argument;
  const config=settings(argument);
  const deadline=Date.now()+config.wait*1000;
  processCover($request,$response,argument,{store:$persistentStore,client:$httpClient,deadline})
    .then(finish).catch(()=>{console.log('[NoAIText] cover: IMAGE_OR_STORE');finish({});});
}
