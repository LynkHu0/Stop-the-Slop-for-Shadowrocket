import { build } from 'esbuild';
import { mkdir,copyFile,writeFile,rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(root,'dist','NoAIText-iOS-Title-0.4.2');
await rm(out,{recursive:true,force:true});
await mkdir(path.join(out,'Script'),{recursive:true});
for(const [entry,name] of [['title-runtime','Title'],['session','Session'],['grpc-runtime','GrpcTitle'],['status','Status']]) {
 await build({entryPoints:[path.join(root,'src',entry+'.js')],bundle:true,format:'iife',platform:'browser',target:'es2020',minify:true,outfile:path.join(out,'Script','NoAIText.'+name+'.js')});
}
await copyFile(path.join(root,'node_modules/js-md5/LICENSE.txt'),path.join(out,'js-md5-LICENSE.txt'));
await copyFile(path.join(root,'node_modules/fflate/LICENSE'),path.join(out,'fflate-LICENSE.txt'));
await copyFile(path.join(root,'docs/INSTALL-Title.txt'),path.join(out,'INSTALL.txt'));
const module=`#!name=NoAIText B站标题文案检测
#!desc=在普通视频卡片标题前显示「14%」等疑似AI文案分数。等待字幕与推理后返回列表；不改图片。先停用所有旧封面检测模块。
#!version=0.4.2
#!arguments=DeepSeekKey:请填写自己的Key,模型:deepseek-flash,思考:true,强度:high,等待秒:45,DeepSeek并发:10,缓存天:7
#!arguments-desc=DeepSeekKey：填写自己的Key，不要分享已填写的模块或.meta。\\n模型：deepseek-flash默认，可修改。\\n思考：true默认，可改false。\\n强度：low/high/max，默认high。\\n等待秒：5~50，默认45，为整批列表的共同预算。等待期间App可能转圈或超时。\\nDeepSeek并发：1~100个任务，默认10，跨脚本软限制；实际并发受待检数量和接口响应限制。\\n缓存天：1~30，默认7。

[Script]
NoAIText.Title = type=http-response, pattern=^https://(?:app[.]bilibili[.]com|app[.]biliapi[.]net|app[.]biliapi[.]com|api[.]bilibili[.]com|api[.]vc[.]bilibili[.]com)/(?:x/v2/(?:feed/index|search[^?]*|space[^?]*)|x/polymer/(?:web-dynamic/v1/feed/(?:all|space)|web-space/[^?]*)|x/space/(?:wbi/)?arc/search|x/web-interface/(?:index/top/feed/rcmd|search/(?:all/v2|type))|dynamic_svr/v1/dynamic_svr/(?:dynamic_new|dynamic_history|space_history))(?=[/?]|$), requires-body=1, max-size=3145728, engine=jsc, timeout=60, script-path=Script/NoAIText.Title.js, argument=key={{{DeepSeekKey}}}&model={{{模型}}}&thinking={{{思考}}}&effort={{{强度}}}&wait={{{等待秒}}}&concurrent={{{DeepSeek并发}}}&serial=false&cacheDays={{{缓存天}}}
NoAIText.GrpcTitle = type=http-response, pattern=^https://(?:grpc[.]biliapi[.]net|grpc[.]biliapi[.]com|app[.]bilibili[.]com|app[.]biliapi[.]net|app[.]biliapi[.]com)/(?:bilibili[.]polymer[.]app[.]search[.]v1[.]Search/(?:SearchAll|SearchByType)|bilibili[.]app[.](?:dynamic[.]v2[.]Dynamic/(?:DynAll|DynVideo|DynAllPersonal|DynVideoPersonal|DynSpace|DynFriend)|space[.]v1[.]Space/Archive))(?:[?]|$), requires-body=1, binary-body-mode=1, max-size=3145728, engine=jsc, timeout=60, script-path=Script/NoAIText.GrpcTitle.js, argument=key={{{DeepSeekKey}}}&model={{{模型}}}&thinking={{{思考}}}&effort={{{强度}}}&wait={{{等待秒}}}&concurrent={{{DeepSeek并发}}}&serial=false&cacheDays={{{缓存天}}}
NoAIText.Status = type=http-request, pattern=^https://www[.]bilibili[.]com/noaitext-status(?:[?]|$), engine=jsc, timeout=5, script-path=Script/NoAIText.Status.js
NoAIText.Session = type=http-request, pattern=^https://(?:www|m|api)[.]bilibili[.]com/(?!noaitext-status(?:[?]|$)), engine=jsc, timeout=5, script-path=Script/NoAIText.Session.js

[MITM]
hostname = %APPEND% app.bilibili.com, app.biliapi.net, app.biliapi.com, api.bilibili.com, www.bilibili.com, m.bilibili.com, api.vc.bilibili.com, grpc.biliapi.net, grpc.biliapi.com
h2 = true
`;
await writeFile(path.join(out,'NoAIText.Title.srmodule'),module);
console.log(out);
