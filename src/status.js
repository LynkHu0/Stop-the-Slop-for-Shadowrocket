import {statusHtml} from './diagnostics.js';
import {PREFIX,read,write} from './common.js';

export function statusResponse(request,store) {
  if(!/^https:\/\/www[.]bilibili[.]com\/noaitext-status(?:[?#]|$)/.test(String(request.url || ''))) return {};
  let message='';
  if(String(request.method || 'GET').toUpperCase()==='POST') {
    const fields={};
    for(const pair of String(request.body || '').split('&')) {
      const i=pair.indexOf('=');if(i<0)continue;
      try{fields[decodeURIComponent(pair.slice(0,i))]=decodeURIComponent(pair.slice(i+1).replace(/\+/g,' '));}catch{}
    }
    const nonce=read(store,'statusClearNonce');
    if(fields.action==='clear-session' && fields.confirm==='yes' && nonce?.value===fields.nonce && nonce.until>Date.now()) {
      if(!store.write('',PREFIX+'session'))throw new Error('STORE');
      message='已清除本机保存的 B站会话。B站账号没有退出；Key、评分缓存和诊断记录没有删除。';
    } else message='未执行清除：请刷新页面，勾选确认后再提交。';
  }
  // Single-use form token prevents a cross-site request from silently clearing the session.
  const nonce=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
  write(store,'statusClearNonce',{value:nonce,until:Date.now()+600000});
  return {response:{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'},body:statusHtml(store,{message,clearNonce:nonce})}};
}
if(typeof $request!=='undefined') {
  try{$done(statusResponse($request,$persistentStore));}
  catch{$done({response:{status:500,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'},body:'本机会话操作失败，请重试。'}});}
}
