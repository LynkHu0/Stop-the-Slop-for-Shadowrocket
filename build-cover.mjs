import {build} from 'esbuild';
import {readFile,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),out=path.join(root,'dist/NoAIText-iOS-Cover-0.3.2');
await rm(out,{recursive:true,force:true});await mkdir(path.join(out,'Script'),{recursive:true});
for(const [entry,name] of [['cover-list-runtime','CoverList'],['cover-grpc-runtime','CoverGrpc'],['cover-request','CoverRequest'],['bound-cover-runtime','Cover'],['session','Session'],['status','Status']]) {
 await build({entryPoints:[path.join(root,'src',entry+'.js')],bundle:true,format:'iife',platform:'browser',target:'es2020',inject:[path.join(root,'src/buffer-shim.js')],minify:true,outfile:path.join(out,'Script','NoAIText.'+name+'.js')});
}
for(const [dep,file] of [['jpeg-js','LICENSE'],['js-md5','LICENSE.txt'],['fflate','LICENSE']])await copyFile(path.join(root,'node_modules',dep,file),path.join(out,dep+'-LICENSE.txt'));
await copyFile(path.join(root,'docs/INSTALL-Cover.txt'),path.join(out,'INSTALL.txt'));
// Keep the tested endpoint patterns used by the latest title adapters.
const previous=await readFile(path.join(root,'dist/NoAIText-iOS-Title-0.2.2/NoAIText.Title.srmodule'),'utf8');
const rows=previous.split('\n');
const jsonPattern='^https://(?:app[.]bilibili[.]com|app[.]biliapi[.]net|app[.]biliapi[.]com|api[.]bilibili[.]com|api[.]vc[.]bilibili[.]com)/(?:x/(?!player/|web-interface/(?:view|nav)(?:[/?]|$))[^?]*|dynamic_svr/[^?]*)(?=[?]|$)';
const grpcPattern=rows.find(s=>s.startsWith('NoAIText.GrpcTitle =')).split('pattern=')[1].split(', requires-body=')[0];
const argument='key={{{DeepSeekKey}}}&model={{{模型}}}&thinking={{{思考}}}&effort={{{强度}}}&wait={{{等待秒}}}&concurrent=1&serial=true&cacheDays={{{缓存天}}}';
const imagePattern='^https://i[0-9]+[.](?:hdslb[.]com|biliimg[.]com)/(?:noaitext/v030/[a-f0-9]+/)?bfs/';
const module=`#!name=NoAIText B站封面独立检测
#!desc=视频列表立即放行，只让带视频标识的封面等字幕与DeepSeek；保持原图比例。先停用所有旧标题/封面/TEST模块。
#!version=0.3.2
#!arguments=DeepSeekKey:请填写自己的Key,模型:deepseek-flash,思考:true,强度:high,等待秒:45,缓存天:7
#!arguments-desc=自己的DeepSeekKey，不要分享填写后的模块/.meta。\\n默认Flash+思考+high，可修改模型、思考true/false、强度low/high/max。\\n等待秒5~50（默认45）只影响封面，列表不等AI。\\n固定单路，一次只处理一个视频检测任务，旧并发参数不再使用，缓存1~30天（默认7）。

[Script]
NoAIText.CoverList = type=http-response, pattern=${jsonPattern}, requires-body=1, max-size=3145728, engine=jsc, timeout=5, script-path=Script/NoAIText.CoverList.js, argument=${argument}
NoAIText.CoverGrpc = type=http-response, pattern=${grpcPattern}, requires-body=1, binary-body-mode=1, max-size=3145728, engine=jsc, timeout=5, script-path=Script/NoAIText.CoverGrpc.js, argument=${argument}
NoAIText.CoverRequest = type=http-request, pattern=${imagePattern}, engine=jsc, timeout=5, script-path=Script/NoAIText.CoverRequest.js
NoAIText.Cover = type=http-response, pattern=${imagePattern}, requires-body=1, binary-body-mode=1, max-size=800000, engine=jsc, timeout=60, script-path=Script/NoAIText.Cover.js, argument=${argument}
NoAIText.Status = type=http-request, pattern=^https://www[.]bilibili[.]com/noaitext-status(?:[?]|$), engine=jsc, timeout=5, script-path=Script/NoAIText.Status.js
NoAIText.Session = type=http-request, pattern=^https://(?:www|m|api)[.]bilibili[.]com/(?!noaitext-status(?:[?]|$)), engine=jsc, timeout=5, script-path=Script/NoAIText.Session.js

[MITM]
hostname = %APPEND% app.bilibili.com, app.biliapi.net, app.biliapi.com, api.bilibili.com, www.bilibili.com, m.bilibili.com, api.vc.bilibili.com, grpc.biliapi.net, grpc.biliapi.com, i0.hdslb.com, i1.hdslb.com, i2.hdslb.com, i0.biliimg.com, i1.biliimg.com, i2.biliimg.com
h2 = true
`;
await writeFile(path.join(out,'NoAIText.Cover.srmodule'),module);console.log(out);
