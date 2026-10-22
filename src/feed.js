import { coverKey, read, write } from './common.js';
const positive = value => /^\d+$/.test(String(value || '')) && Number(value) > 0 ? String(value) : '';
const bv = value => /^BV[a-zA-Z0-9]{10}$/.test(String(value || '')) ? String(value) : '';
export function collectVideos(body) {
  let data;
  try { data = typeof body === 'string' ? JSON.parse(body) : body; } catch { return []; }
  if (!data || (data.code !== undefined && data.code !== 0)) return [];
  const videos = new Map();
  function walk(value, depth) {
    if (!value || typeof value !== 'object' || depth > 24 || videos.size >= 150) return;
    if (Array.isArray(value)) { for (const item of value) walk(item, depth+1); return; }
    // Avoid advertisements, live rooms, bangumi and article cards.
    const allowed = !value.goto || value.goto === 'av';
    if (allowed) {
      const uri = /^(?:bilibili:\/\/video\/|https?:\/\/(?:www\.)?bilibili\.com\/video\/av)(\d+)/.exec(value.uri || '');
      const bvid = bv(value.bvid || value.args?.bvid || value.player_args?.bvid);
      const aid = positive(value.aid || value.args?.aid || value.player_args?.aid || (value.goto === 'av' ? value.param : '') || uri?.[1]);
      const cid = positive(value.cid || value.player_args?.cid);
      for (const key of ['cover','pic']) {
        const cover = coverKey(value[key]);
        if (!cover || (!aid && !bvid)) continue;
        const meta = { aid, bvid, cid, title: String(value.title || '').slice(0,200) };
        const prior = videos.get(cover);
        if (prior && !((prior.aid && prior.aid === meta.aid) || (prior.bvid && prior.bvid === meta.bvid))) videos.set(cover,{ ambiguous: true });
        else videos.set(cover,meta);
      }
    }
    for (const item of Object.values(value)) walk(item, depth+1);
  }
  walk(data.data || data,0);
  return [...videos];
}
export function registerVideos(body,store,now=Date.now()) {
  const videos=collectVideos(body);
  let index=read(store,'cover-index',[]).filter(x=>typeof x==='string');
  for (const [key,meta] of videos) {
    const prior=read(store,'cover.'+key);
    const conflict = prior && prior.until>now && (prior.ambiguous || (!meta.ambiguous
      && (!((prior.aid && prior.aid===meta.aid) || (prior.bvid && prior.bvid===meta.bvid))
        || (prior.cid && meta.cid && prior.cid !== meta.cid))));
    write(store,'cover.'+key,{...(conflict ? {ambiguous:true} : meta),until:now+3*86400000});
    index=index.filter(x=>x!==key); index.push(key);
  }
  while(index.length>800) { store.write('', 'noaitext.ios.v1.cover.'+index.shift()); }
  write(store,'cover-index',index);
  return videos.length;
}
if (typeof $response !== 'undefined') {
  try { console.log('[NoAIText] mapped covers: '+registerVideos($response.body,$persistentStore)); }
  catch { console.log('[NoAIText] feed: STORE_OR_JSON'); }
  $done({});
}
