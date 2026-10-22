import {settings,cleanHeaders} from './common.js';
import {tokenFrom,resolveBinding} from './cover-binding.js';
import {detectVideo,DetectionError} from './detector.js';
import {supportedJpeg,rewriteJpeg} from './image-codec.js';
import {recordDiagnostic} from './diagnostics.js';
const badge=result=>result?.state==='ok'
  ?{text:'AI '+Math.round(result.score*100)+'%',color:result.score>=.7?[255,103,103]:result.score>=.4?[246,199,88]:[64,224,139]}
  :{text:({NO_KEY:'NO KEY',PARAM:'PARAM',AUTH:'AUTH',LOGIN:'LOGIN',NO_SUB:'NO SUB',SHORT:'SHORT',TIMEOUT:'TIMEOUT',RATE:'RATE',BALANCE:'BALANCE',BIND:'LINK'})[result?.code]||'ERROR',color:[246,199,88]};
export async function processBoundCover(request,response,argument,env) {
  if(!tokenFrom(request.url,request.headers))return {};
  const started=Date.now(),profile={};let result;
  if(!supportedJpeg(response.body)){recordDiagnostic(env.store,'Cover',request,{reason:'UNSUPPORTED_IMAGE'},started);return {};}
  const meta=resolveBinding(request,env.store);
  if(!meta)result={code:'BIND'};
  else try{result=await detectVideo(meta,settings(argument),{...env,profile,onProgress:(stage,timings)=>recordDiagnostic(env.store,'Cover',request,{changed:1,reason:stage,timings},started)});}catch(error){result={code:error instanceof DetectionError?error.code:'ERROR'};}
  const b=badge(result),encodingStarted=Date.now();const body=rewriteJpeg(response.body,b.text,b.color);profile.encodeMs=Date.now()-encodingStarted;
  recordDiagnostic(env.store,'Cover',request,{changed:body?1:0,completed:result.state==='ok'&&!profile.cached?1:0,hits:profile.cached?1:0,states:{[result.state==='ok'?'OK':result.code]:1},timings:profile},started);
  return body?{headers:cleanHeaders(response.headers,'image/jpeg'),body}:{};
}
