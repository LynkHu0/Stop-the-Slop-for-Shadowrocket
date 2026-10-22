import {md5,read,write} from './common.js';
const IMAGE=/^(https?:\/\/(?:i\d+\.hdslb\.com|i\d+\.biliimg\.com))(\/bfs\/[^?#]*)([?#].*)?$/i;
const ALIAS=/^(https?:\/\/(?:i\d+\.hdslb\.com|i\d+\.biliimg\.com))(\/bfs\/[^/?#]+)\/noaitext\/v030\/([a-f0-9]{32})(\/[^?#]*)([?#].*)?$/i;
export function originalImage(raw) {
  raw=String(raw || '');if(raw.startsWith('//'))raw='https:'+raw;
  const alias=ALIAS.exec(raw);return alias?alias[1]+alias[2]+alias[4]+(alias[5]||''):raw;
}
const baseImage=raw=>originalImage(raw).replace(/^https?:\/\/[^/]+/i,'').split(/[?#@]/)[0];
export function taggedCover(raw,meta,store,config,now=Date.now()) {
  raw=originalImage(raw);const match=IMAGE.exec(raw);
  if(!match || (!meta.aid&&!meta.bvid))return null;
  const bucket=/^(\/bfs\/[^/]+)(\/.*)$/.exec(match[2]);if(!bucket)return null;
  const imageHash=md5(baseImage(raw));
  const token=md5([meta.aid||'',meta.bvid||'',meta.cid||'first',imageHash,config.model,config.thinking,config.effort,md5(config.key||''),Math.floor(now/60000)].join('|'));
  write(store,'binding.'+token,{meta:{aid:String(meta.aid||''),bvid:String(meta.bvid||''),cid:String(meta.cid||'')},imageHash,until:now+3*86400000});
  return match[1]+bucket[1]+'/noaitext/v030/'+token+bucket[2]+(match[3]||'');
}
export function rememberBindings(store,tokens) {
  let index=read(store,'binding-index',[]);
  const fresh=new Set(tokens);index=index.filter(t=>!fresh.has(t));index.push(...fresh);
  while(index.length>3000)store.write('','noaitext.ios.v1.binding.'+index.shift());
  write(store,'binding-index',index);
}
export function tokenFrom(raw,headers={}) {
  const alias=ALIAS.exec(String(raw||''));if(alias)return alias[3];
  const query=/[?&]_nai=([a-f0-9]{32})(?:[&#@]|$)/.exec(String(raw||''));if(query)return query[1];
  const header=Object.entries(headers).find(([k])=>k.toLowerCase()==='x-noaitext-token')?.[1];
  return /^[a-f0-9]{32}$/.test(header||'')?header:null;
}
function gcd(a,b){while(b){const r=a%b;a=b;b=r;}return a;}
export function jpegImageUrl(raw) {
  const match=IMAGE.exec(originalImage(raw));if(!match)return null;
  const path=match[2],at=path.indexOf('@'),last=path.lastIndexOf('@');
  const base=at<0?path:path.slice(0,at);
  let transform=at<0?'480w':path.slice(last+1).replace(/\.(?:avif|webp|png|jpe?g)$/i,'');
  const w=/(\d+)w(?:_|$)/.exec(transform),h=/(\d+)h(?:_|$)/.exec(transform);
  if(w && h) {
    const width=Number(w[1]),height=Number(h[1]);
    if(width>800 || height>1200 || width*height>480000){
      const divisor=gcd(width,height),rw=width/divisor,rh=height/divisor;
      let scale=Math.floor(Math.min(800/rw,1200/rh,Math.sqrt(480000/(rw*rh))));
      let nw,nh;
      if(scale>=1){nw=rw*scale;nh=rh*scale;}
      else {const factor=Math.min(800/width,1200/height,Math.sqrt(480000/(width*height)));nw=Math.max(1,Math.floor(width*factor));nh=Math.max(1,Math.floor(height*factor));}
      transform=transform.replace(w[0],w[0].replace(w[1]+'w',nw+'w')).replace(h[0],h[0].replace(h[1]+'h',nh+'h'));
    }
  } else if(w && Number(w[1])>480) transform=transform.replace(w[1]+'w','480w');
  else if(h && !w && Number(h[1])>800)transform=transform.replace(h[1]+'h','800h');
  return match[1]+base+'@'+transform+'.jpg'+(match[3]||'');
}
export function prepareCoverRequest(request) {
  const token=tokenFrom(request.url,request.headers);if(!token)return {};
  let url=jpegImageUrl(request.url);if(!url)return {};
  const [noHash,hash]=url.split('#');
  url=noHash.replace(/([?&])_nai=[^&]*(&?)/g,(_,a,b)=>b?a:'');
  url+=(url.includes('?')?'&':'?')+'_nai='+token+(hash?'#'+hash:'');
  return {url,headers:{...request.headers,'X-NoAIText-Token':token}};
}
export function resolveBinding(request,store,now=Date.now()) {
  const token=tokenFrom(request.url,request.headers);if(!token)return null;
  const binding=read(store,'binding.'+token);
  if(!binding || binding.until<now || binding.imageHash!==md5(baseImage(request.url)))return null;
  return binding.meta;
}
