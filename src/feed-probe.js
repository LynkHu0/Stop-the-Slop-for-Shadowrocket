function parts(raw) {
  const m = /^https?:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?/i.exec(String(raw));
  return m ? { host: m[1].toLowerCase(), path: m[2] || '/', query: m[3] || '' } : null;
}

function coverBase(raw) {
  const url = parts(raw);
  if (!url || !/^i[0-9]+\.hdslb\.com$/.test(url.host) || !/^\/bfs\/archive\//.test(url.path)) return null;
  const path = url.path.split('@')[0];
  return /\.jpe?g$/i.test(path) ? `https://${url.host}${path}` : null;
}

function isVideo(card) {
  if (!card || typeof card !== 'object') return false;
  if (card.goto && card.goto !== 'av') return false;
  if (card.goto === 'av' || card.card_goto === 'av') return true;
  return /^BV[a-zA-Z0-9]{10}$/.test(String(card.bvid || card.args?.bvid || card.player_args?.bvid || ''));
}

export function rewriteFeed(body) {
  let json;
  try { json = JSON.parse(body); } catch { return { body, count: 0 }; }
  if (json?.code !== undefined && json.code !== 0) return { body, count: 0 };
  let count = 0;
  function visit(value, depth) {
    if (!value || typeof value !== 'object' || depth > 16 || count >= 100) return;
    if (Array.isArray(value)) { for (const child of value) visit(child, depth + 1); return; }
    if (isVideo(value)) {
      for (const key of ['cover', 'pic']) {
        if (typeof value[key] !== 'string') continue;
        const base = coverBase(value[key]);
        if (!base) continue;
        value[key] = `${base}@480w_270h_1c.jpg?ntest=1`;
        count++;
        break;
      }
    }
    for (const child of Object.values(value)) visit(child, depth + 1);
  }
  visit(json?.data, 0);
  return { body: count ? JSON.stringify(json) : body, count };
}

if (typeof $response !== 'undefined' && typeof $request !== 'undefined') {
  try {
    const result = rewriteFeed($response.body);
    if (!result.count) { console.log('[NoAIText Probe] feed: no supported video covers'); $done({}); }
    else {
      const headers = { ...($response.headers || {}) };
      for (const key of Object.keys(headers)) if (/^(content-length|content-encoding|transfer-encoding)$/i.test(key)) delete headers[key];
      console.log('[NoAIText Probe] feed covers marked: ' + result.count);
      $done({ headers, body: result.body });
    }
  } catch (error) {
    console.log('[NoAIText Probe] feed parse failed: ' + String(error));
    $done({});
  }
}
