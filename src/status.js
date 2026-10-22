import {statusHtml} from './diagnostics.js';
if(typeof $request!=='undefined') {
  if(/^https:\/\/www[.]bilibili[.]com\/noaitext-status(?:[?#]|$)/.test(String($request.url || ''))) {
    $done({response:{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'},body:statusHtml($persistentStore)}});
  } else $done({});
}
