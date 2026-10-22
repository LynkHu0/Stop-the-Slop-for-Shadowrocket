import {read,write} from './common.js';
export const VERSION='0.4.2';
export function recordDiagnostic(store,kind,request,result,started) {
  try {
    let path=/^https?:\/\/[^/]+([^?#]*)/.exec(String(request.url || ''))?.[1] || 'unknown';
    if(kind==='Cover')path='/video-cover';
    const event={version:VERSION,at:new Date().toISOString(),kind,path,matched:result.changed || 0,videos:result.videos || 0,success:result.completed || 0,cache:result.hits || 0,states:result.states || {},reason:result.reason || '',ms:Date.now()-started};
    event.timings=Object.fromEntries(Object.entries(result.timings || {}).filter(([k,v])=>['cached','duplicateWaitMs','prepareQueueMs','prepareMs','metadataMs','navMs','playerMs','captionsMs','aiQueueMs','aiMs','requests','apiCalls','totalMs','encodeMs'].includes(k)&&Number.isFinite(v)));
    const history=read(store,'diagnostics',[]);history.push(event);
    write(store,'diagnostics',history.slice(-24));
  } catch {}
}
export function statusHtml(store) {
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const history=read(store,'diagnostics',[]).slice().reverse();
  const rows=history.map(e=>`<article><b>${escape(e.kind)} · 命中 ${e.matched} · 新评分 ${e.success} · 缓存 ${e.cache}</b><p>${escape(e.reason || Object.entries(e.states).map(([k,v])=>k+': '+v).join('，'))}</p>${e.timings?'<p>重复等待 '+((e.timings.duplicateWaitMs||0)/1000).toFixed(1)+'s · 字幕排队 '+((e.timings.prepareQueueMs||0)/1000).toFixed(1)+'s · 字幕准备 '+((e.timings.prepareMs||0)/1000).toFixed(1)+'s · AI排队 '+((e.timings.aiQueueMs||0)/1000).toFixed(1)+'s · 推理 '+((e.timings.aiMs||0)/1000).toFixed(1)+'s · 改图 '+((e.timings.encodeMs||0)/1000).toFixed(2)+'s · API调用 '+(e.timings.apiCalls||0)+'</p>':''}<small>${escape(e.at)} · ${(e.ms/1000).toFixed(1)} 秒</small><details><summary>接口路径</summary>${escape(e.path)}</details></article>`).join('');
  return `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"><title>NoAIText 本机诊断</title><style>body{font:16px system-ui;background:#101319;color:#eee;padding:18px}article{padding:14px;background:#202630;margin:12px 0;border-radius:10px}small,details{color:#aebccc}p{overflow-wrap:anywhere}</style><h2>NoAIText ${VERSION} 本机诊断</h2><p>只显示本机脚本命中和结果计数，不含 Key、Cookie、视频标题或搜索词。请先打开需要测试的页面，再刷新这里。</p>${rows || '<p>暂无记录。检查模块和脚本是否已更新并重新编译。</p>'}`;
}
