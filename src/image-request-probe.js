// Preserve the CDN crop dimensions; only request a JPEG representation.
export function jpegCoverUrl(raw) {
  const m = /^(https?:\/\/i[0-9]+\.hdslb\.com\/bfs\/archive\/[^?#]+)([?#].*)?$/i.exec(raw);
  if (!m) return null;
  const at = m[1].indexOf('@');
  const base = at < 0 ? m[1] : m[1].slice(0, at);
  const transform = at < 0 ? '' : m[1].slice(at + 1);
  // With no requested crop, width-only resizing retains the source aspect ratio.
  const jpegTransform = transform
    ? transform.replace(/\.(?:webp|avif|png|jpe?g)$/i, '') + '.jpg'
    : '480w.jpg';
  return base + '@' + jpegTransform + (m[2] || '');
}

export function freshCoverUrl(raw, now = Date.now()) {
  const url = jpegCoverUrl(raw);
  if (!url) return null;
  const [base, hash] = url.split('#');
  const clean = base.replace(/([?&])noai_v=[^&]*(&?)/g, (_, before, after) => after ? before : (before === '?' ? '' : ''));
  return clean + (clean.includes('?') ? '&' : '?') + 'noai_v=011-' + Math.floor(now / 60000) + (hash ? '#' + hash : '');
}

if (typeof $request !== 'undefined') {
  try {
    const url = freshCoverUrl(String($request.url || ''));
    $done(url ? { url } : {});
  } catch {
    $done({});
  }
}
