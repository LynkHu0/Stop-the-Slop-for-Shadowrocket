import { read, write } from './common.js';
// Session stays on this phone; never forward it to the AI provider or print it.
export function captureSession(request,store) {
  if (!/^https:\/\/(?:www|m|api)\.bilibili\.com(?:[/?]|$)/i.test(String(request.url || ''))) return false;
  const raw=Object.entries(request.headers || {}).find(([key])=>key.toLowerCase()==='cookie')?.[1] || '';
  const cookies=String(raw).split(';').map(s=>s.trim()).filter(s=>/^(SESSDATA|bili_jct|DedeUserID|buvid3|buvid4)=/.test(s));
  if (!cookies.some(s=>/^SESSDATA=.+/.test(s))) return false;
  const cookie=cookies.join('; ');
  const old=read(store,'session');
  if (old?.cookie===cookie && old.until>Date.now()+86400000) return false;
  write(store,'session',{cookie,until:Date.now()+14*86400000});
  return true;
}
if(typeof $request !== 'undefined') {
  try { if(captureSession($request,$persistentStore)) console.log('[NoAIText] Bilibili login saved locally'); }
  catch { console.log('[NoAIText] login: STORE'); }
  $done({});
}
