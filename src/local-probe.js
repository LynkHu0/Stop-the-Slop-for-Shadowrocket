import { rewriteJpeg } from './image-codec.js';
export { rewriteJpeg, drawTestBadge } from './image-codec.js';
if (typeof $response !== 'undefined' && typeof $request !== 'undefined') {
  try {
    const output = rewriteJpeg($response.body);
    if (!output) {
      console.log('[NoAIText Probe] passthrough');
      $done({});
    } else {
      const headers = { ...($response.headers || {}) };
      for (const key of Object.keys(headers)) {
        if (/^(content-length|content-encoding|transfer-encoding|etag|content-md5|last-modified|expires)$/i.test(key)) delete headers[key];
      }
      headers['Content-Type'] = 'image/jpeg';
      headers['Cache-Control'] = 'no-store';
      console.log('[NoAIText Probe] JPEG rewritten');
      $done({ headers, body: output });
    }
  } catch (error) {
    console.log('[NoAIText Probe] ' + String(error));
    $done({});
  }
}
