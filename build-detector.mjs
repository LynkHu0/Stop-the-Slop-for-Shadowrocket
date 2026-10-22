import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(root,'dist','NoAIText-iOS-DeepSeek-0.1.1');
await rm(out,{recursive:true,force:true});
await mkdir(path.join(out,'Script'),{recursive:true});
for(const [entry,name] of [['feed','Feed'],['session','Session'],['image-request-probe','ImageRequest'],['cover','Cover']]) {
 await build({entryPoints:[path.join(root,'src',entry+'.js')],bundle:true,format:'iife',platform:'browser',target:'es2020',inject:[path.join(root,'src/buffer-shim.js')],minify:true,outfile:path.join(out,'Script','NoAIText.'+name+'.js')});
}
for(const [dep,name] of [['jpeg-js','jpeg-js-LICENSE.txt'],['js-md5','js-md5-LICENSE.txt']]) await copyFile(path.join(root,'node_modules',dep,'LICENSE'+(dep==='js-md5'?'.txt':'')),path.join(out,name));
await copyFile(path.join(root,'docs','INSTALL-DeepSeek.txt'),path.join(out,'INSTALL.txt'));
const module=`#!name=NoAIText B站文案检测 DeepSeek
#!desc=手机本地取B站字幕并调用自己的DeepSeek API，封面显示疑似AI文案分数；不是作者来源证明。请先停用TEST模块。
#!version=0.1.1
#!arguments=DeepSeekKey:请填写自己的Key,模型:deepseek-flash,思考:true,强度:high,等待秒:45,并发:2,缓存天:7
#!arguments-desc=DeepSeekKey：自己的API Key，仅保存在本机模块参数。\n模型：默认deepseek-flash，可改deepseek-v4-pro。\n思考：true开启，false关闭。\n强度：low/high/max。\n等待秒：5至50，默认45，首次检测期间封面可能等待。\n并发：1至3，默认2，软限制。\n缓存天：1至30，默认7。\n不要分享填写过Key的模块或.meta文件。

[Script]
NoAIText.Feed = type=http-response, pattern=^https://(?:app[.]bilibili[.]com|app[.]biliapi[.]net|app[.]biliapi[.]com|api[.]bilibili[.]com)/(?:(?:x/|dynamic_svr/)[^?]*), requires-body=1, max-size=3145728, engine=jsc, timeout=5, script-path=Script/NoAIText.Feed.js
NoAIText.Session = type=http-request, pattern=^https://(?:www|m|api)[.]bilibili[.]com(?:[/?]|$), engine=jsc, timeout=5, script-path=Script/NoAIText.Session.js
NoAIText.ImageRequest = type=http-request, pattern=^https://i[0-9]+[.]hdslb[.]com/bfs/archive/, engine=jsc, timeout=5, script-path=Script/NoAIText.ImageRequest.js
NoAIText.Cover = type=http-response, pattern=^https://i[0-9]+[.]hdslb[.]com/bfs/archive/, requires-body=1, binary-body-mode=1, max-size=800000, engine=jsc, timeout=60, script-path=Script/NoAIText.Cover.js, argument=key={{{DeepSeekKey}}}&model={{{模型}}}&thinking={{{思考}}}&effort={{{强度}}}&wait={{{等待秒}}}&concurrent={{{并发}}}&cacheDays={{{缓存天}}}

[MITM]
hostname = %APPEND% app.bilibili.com, app.biliapi.net, app.biliapi.com, api.bilibili.com, www.bilibili.com, m.bilibili.com, i0.hdslb.com, i1.hdslb.com, i2.hdslb.com
h2 = true
`;
await writeFile(path.join(out,'NoAIText.DeepSeek.srmodule'),module);
console.log(out);
