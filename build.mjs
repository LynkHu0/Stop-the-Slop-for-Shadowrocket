import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';

const root = path.dirname(fileURLToPath(import.meta.url));
for (const [entry, name] of [
  ['feed-probe', 'NoAIText.FeedProbe.js'],
  ['image-request-probe', 'NoAIText.ImageRequestProbe.js'],
  ['local-probe', 'NoAIText.LocalImageProbe.js'],
]) {
  await build({
    entryPoints: [path.join(root, 'src', `${entry}.js`)],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    inject: [path.join(root, 'src/buffer-shim.js')],
    minify: true,
    outfile: path.join(root, 'dist', name),
  });
}
const phoneTest = path.join(root, 'dist', 'phone-test');
const phoneScripts = path.join(phoneTest, 'Script');
await mkdir(phoneScripts, { recursive: true });
for (const name of ['NoAIText.ImageRequestProbe.js', 'NoAIText.LocalImageProbe.js']) {
  await copyFile(path.join(root, 'dist', name), path.join(phoneScripts, name));
}
await copyFile(path.join(root, 'node_modules', 'jpeg-js', 'LICENSE'), path.join(phoneTest, 'jpeg-js-LICENSE.txt'));
const module = `#!name=NoAIText B站封面 TEST 探针
#!desc=测试小火箭是否能改写B站原版App普通视频封面。命中的bfs/archive JPEG左上角会替换为TEST标记；不调用AI，不改标题。
#!version=0.0.6

[Script]
NoAIText.ImageRequestProbe = type=http-request, pattern=^https://i[0-9]+[.]hdslb[.]com/bfs/archive/, engine=jsc, timeout=5, script-path=Script/NoAIText.ImageRequestProbe.js
NoAIText.CoverProbe = type=http-response, pattern=^https://i[0-9]+[.]hdslb[.]com/bfs/archive/, requires-body=1, binary-body-mode=1, max-size=800000, engine=jsc, timeout=10, script-path=Script/NoAIText.LocalImageProbe.js

[MITM]
hostname = %APPEND% app.bilibili.com, app.biliapi.net, app.biliapi.com, i0.hdslb.com, i1.hdslb.com, i2.hdslb.com
h2 = true
`;
await writeFile(path.join(phoneTest, 'NoAIText.CoverProbe.srmodule'), module);
await writeFile(path.join(phoneTest, 'INSTALL.txt'), `# B站封面 TEST 探针（临时测试版）

此包只测试 Shadowrocket 对 B站视频封面的本机改写，不调用 DeepSeek、不读取字幕。bfs/archive/ 视频封面保留请求中的宽高和裁切参数，仅将格式改为 JPEG；没有裁切参数时按原图比例缩小，再由本机脚本画上 TEST；头像等其他图片路径不匹配。

## 从 0.0.4 / 0.0.5 更新

替换 Script/NoAIText.ImageRequestProbe.js，并在 Shadowrocket/Modules 中用本包的 NoAIText.CoverProbe.srmodule 替换旧文件。回到 Shadowrocket 的 配置 > 模块，刷新现有模块并重新编译当前配置；不要额外添加第二个同名测试模块。

## 安装

1. 将本压缩包 AirDrop 到 iPhone，在“文件”中解压。
2. 把 Script 文件夹里的两个 NoAIText.*Probe.js 放入 iCloud 云盘/Shadowrocket/Script/。本地能读取即可，iCloud 同步不需要成功。
3. 把 NoAIText.CoverProbe.srmodule 放入 iCloud 云盘/Shadowrocket/Modules/，回到 Shadowrocket 的 配置 > 模块，刷新列表并启用 NoAIText B站封面 TEST 探针。
4. 确认当前配置的 HTTPS 解密包含 i0.hdslb.com、i1.hdslb.com、i2.hdslb.com，然后在 B站首页刷新推荐流。

判断：B站首页或其他页面的视频封面左上角出现 TEST，说明封面请求改写、JPEG 编解码和 App 显示链路成功；看不到 TEST 时，到 Shadowrocket 数据日志中查看 NoAIText Probe 记录。

测试后停用并移除此临时模块即可。它不是完整检测版本。
`);
console.log('Built NoAIText.LocalImageProbe.js and the phone test module.');
