import {settings,cleanHeaders} from './common.js';
import {recordDiagnostic} from './diagnostics.js';
import {analyzeTitleTargets} from './title.js';
import {bytes,parseMessage,fields,child,text,integer,setText,serialize,grpcFrames,encodeFrame,concat} from './protobuf.js';
const positive=value=>Number.isSafeInteger(value)&&value>0?String(value):'';
const bv=value=>/^BV[a-zA-Z0-9]{10}$/.test(value)?value:'';
export function grpcRoute(url) {
  const path=String(url).split('?')[0];
  if(/\/bilibili[.]polymer[.]app[.]search[.]v1[.]Search\/SearchAll$/.test(path))return 'search-all';
  if(/\/bilibili[.]polymer[.]app[.]search[.]v1[.]Search\/SearchByType$/.test(path))return 'search-type';
  if(/\/bilibili[.]app[.]dynamic[.]v2[.]Dynamic\/(DynAll|DynVideo)$/.test(path))return 'dynamic-list';
  if(/\/bilibili[.]app[.]dynamic[.]v2[.]Dynamic\/(DynAllPersonal|DynVideoPersonal|DynSpace|DynFriend)$/.test(path))return 'dynamic-items';
  if(/\/bilibili[.]app[.]space[.]v1[.]Space\/Archive$/.test(path))return 'space';
  return null;
}
export function collectProtoTitles(root,route) {
  const targets=[],covers=[],commits=[];
  function target(message,meta,titleField=1,coverField=2) {
    if(!meta.aid&&!meta.bvid)return;
    const originalCover=text(message,coverField);
    if(originalCover){const object={url:originalCover};covers.push({object,key:'url',original:originalCover,meta});commits.push(()=>{if(object.url!==originalCover)setText(message,coverField,object.url);});}
    const original=text(message,titleField);if(!original)return;
    const object={title:original};targets.push({object,key:'title',original,meta});
    commits.push(()=>{if(object.title!==original)setText(message,titleField,object.title);});
  }
  function dynamic(item,depth=0) {
    if(depth>8 || targets.length>=150)return;
    // Only UGC and forwarded UGC; skip live, ads, articles and PGC.
    const type=integer(item,1);if(![1,2].includes(type))return;
    for(const moduleField of fields(item,3)) {
      const module=child(moduleField);
      for(const dynamicField of fields(module,5)) {
        const dynamicModule=child(dynamicField);
        for(const archiveField of fields(dynamicModule,2)) {
          const archive=child(archiveField);
          if(integer(archive,14))continue;
          target(archive,{aid:positive(integer(archive,7)),cid:positive(integer(archive,8)),bvid:bv(text(archive,26))});
        }
        for(const forwardField of fields(dynamicModule,6)) {
          for(const originalField of fields(child(forwardField),1))dynamic(child(originalField),depth+1);
        }
      }
    }
  }
  function fromUri(uri,param='') {
    const aid=/^(?:bilibili:\/\/(?:video|story)\/|https?:\/\/(?:www\.)?bilibili\.com\/video\/av)(\d+)/.exec(uri)?.[1] || (/^\d+$/.test(param)?param:'');
    return {aid,bvid:bv(/\/video\/(BV[a-zA-Z0-9]{10})(?:[/?#]|$)/.exec(uri)?.[1] || ''),cid:''};
  }
  function avItem(message) {
    const goto=text(message,9);if(goto && !['av','vertical_av'].includes(goto))return;
    target(message,fromUri(text(message,3),text(message,10)));
  }
  function searchItem(item) {
    const goto=text(item,3),meta=fromUri(text(item,1),text(item,2));
    // Item holds navigation; the nested card holds the displayed title.
    if(!goto || ['av','vertical_av'].includes(goto)) {
      for(const card of fields(item,37)) {
        const video=child(card);
        for(const shareField of fields(video,6))for(const v of fields(child(shareField),2)) {
          const share=child(v);meta.bvid=bv(text(share,1)) || meta.bvid;meta.cid=positive(integer(share,2));
        }
        target(video,meta);
      }
      for(const card of fields(item,27)) {
        const video=child(card);let details={...meta};
        for(const inlineField of fields(video,9)) {
          const inline=child(inlineField);
          for(const playerField of fields(inline,3)) {
            const player=child(playerField);details.aid=positive(integer(player,2))||details.aid;details.cid=positive(integer(player,3));
          }
          target(inline,details,2,8);
        }
        target(video,details);
      }
    }
    // Author/collection cards may contain ordinary videos; author labels are untouched.
    for(const card of fields(item,23))for(const av of fields(child(card),21))avItem(child(av));
    for(const card of fields(item,36))for(const av of fields(child(card),11))avItem(child(av));
    for(const card of fields(item,33))for(const av of fields(child(card),4))avItem(child(av));
  }
  if(route==='search-all' || route==='search-type') {
    for(const item of fields(root,route==='search-all'?4:6))searchItem(child(item));
  } else if(route==='space') {
    for(const itemField of fields(root,1)) {
      const item=child(itemField),uri=text(item,5);
      const aid=/bilibili:\/\/(?:video|story)\/(\d+)/.exec(uri)?.[1] || (/^\d+$/.test(text(item,6))?text(item,6):'');
      target(item,{aid,bvid:bv(text(item,14)),cid:''},1,4);
    }
  } else if(route==='dynamic-list') {
    for(const list of fields(root,1))for(const item of fields(child(list),1))dynamic(child(item));
  } else if(route==='dynamic-items')for(const item of fields(root,1))dynamic(child(item));
  return {targets,covers,commit:()=>commits.forEach(f=>f())};
}
export async function processGrpcTitles(request,response,argument,env) {
  const started=Date.now();
  const route=grpcRoute(request.url);if(!route)return {};
  let frames,parsed;
  try {
    frames=grpcFrames(response.body);
    parsed=frames.filter(f=>f.flag!==128).map(frame=>({frame,root:parseMessage(frame.decoded)}));
    for(const p of parsed)p.titles=collectProtoTitles(p.root,route);
  } catch {recordDiagnostic(env.store,'gRPC',request,{reason:'UNSUPPORTED_FRAME'},started);console.log('[NoAIText gRPC] UNSUPPORTED_FRAME');return {};}
  const targets=parsed.flatMap(p=>p.titles.targets);
  if(!targets.length){recordDiagnostic(env.store,'gRPC',request,{reason:'NO_VIDEO_TITLES'},started);console.log('[NoAIText gRPC] NO_VIDEO_TITLES');return {};}
  const result=await analyzeTitleTargets(targets,settings(argument),env);
  recordDiagnostic(env.store,'gRPC',request,result,started);
  for(const p of parsed) {p.titles.commit();p.frame.output=serialize(p.root);}
  const body=concat(frames.map(f=>f.output?encodeFrame(f.output,f.flag):f.raw));
  const originalType=Object.entries(response.headers||{}).find(([k])=>k.toLowerCase()==='content-type')?.[1] || 'application/grpc';
  console.log(`[NoAIText gRPC] titles=${result.changed} cache=${result.hits} completed=${result.completed}`);
  return {headers:cleanHeaders(response.headers,originalType),body};
}
