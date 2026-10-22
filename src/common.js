import { md5 } from 'js-md5';
export const PREFIX = 'noaitext.ios.v1.';
export const PROMPT_VERSION = 'upstream-jev-question-v1';
// Match the upstream Jev primary question. Only adapt the numeric output format
// required by the DeepSeek chat API; add no hand-written style heuristics.
export const instructions = `Is it AI-generated, yes or no?
Output JSON only: {"score": p}, where p is a number between 0 and 1 representing the AI-generated likelihood.`;
export { md5 };
export function read(store, key, fallback = null) {
  try { return JSON.parse(store.read(PREFIX + key) || 'null') ?? fallback; } catch { return fallback; }
}
export function write(store, key, value) {
  if (!store.write(JSON.stringify(value), PREFIX + key)) throw new Error('STORE');
}
export function coverKey(raw) {
  const match = /^https?:\/\/i\d+\.hdslb\.com\/bfs\/archive\/([^?#@]+)/i.exec(String(raw || ''));
  return match ? md5(match[1]) : null;
}
export function cleanHeaders(original, type) {
  const headers = { ...original };
  for (const key of Object.keys(headers)) {
    if (/^(content-length|content-encoding|transfer-encoding|etag|content-md5|last-modified|expires|content-type|cache-control)$/i.test(key)) delete headers[key];
  }
  headers['Content-Type'] = type;
  headers['Cache-Control'] = 'no-store';
  return headers;
}
export function settings(argument = '') {
  let pairs = {};
  if (argument && typeof argument === 'object') pairs = { ...argument };
  else {
    const raw = String(argument || '').trim();
    if (raw.startsWith('{')) {
      try { const value=JSON.parse(raw); if(value && typeof value==='object') pairs=value; } catch {}
    } else for (const part of raw.split('&')) {
      const i = part.indexOf('=');
      if (i < 0) continue;
      try { pairs[decodeURIComponent(part.slice(0,i))] = decodeURIComponent(part.slice(i+1)); } catch {}
    }
  }
  const key = String(pairs.key || '').trim().replace(/^(["'])(.*)\1$/, '$2').replace(/^Bearer\s+/i, '').trim();
  const keyIssue = pairs._missing || /\{\{/.test(key) ? 'PARAM' : (!key || /^(?:请|填|YOUR_|<)/i.test(key) ? 'NO_KEY' : null);
  const clamp = (value, fallback, min, max) => Number.isFinite(Number(value)) && value !== '' && value !== undefined ? Math.min(max, Math.max(min, Number(value))) : fallback;
  const serial=pairs.serial===true || pairs.serial==='true';
  return {
    key, keyIssue,serial,
    model: (pairs.model || 'deepseek-flash').trim(),
    thinking: pairs.thinking !== 'false' && pairs.thinking !== false,
    effort: ['low','high','max'].includes(pairs.effort) ? pairs.effort : 'high',
    wait: clamp(pairs.wait, 45, 5, 50),
    concurrent: serial?1:Math.floor(clamp(pairs.concurrent, 10, 1, 100)),
    cacheDays: clamp(pairs.cacheDays, 7, 1, 30),
  };
}
