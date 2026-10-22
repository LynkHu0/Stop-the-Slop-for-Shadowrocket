# Stop the Slop for Shadowrocket 0.4.2

当前路线恢复为标题前缀「14%」，不再拦截封面、修改图片地址或进行JPEG处理。

默认Flash + 思考high，DeepSeek并发1~100、默认10，保留已有首页横竖屏/搜索/主页/动态JSON与指定gRPC适配，以及评分缓存和本机诊断。

安装看docs/INSTALL-Title.txt，切换时必须停用全部旧封面和TEST模块，替换4个标题脚本和标题模块，再编译、重启刷新B站。旧封面临时路径可能留在App缓存中，需要加载新列表或清理图片缓存。

- npm run build：当前标题版安装目录。
- npm test：生成历史回归包及当前标题包，运行模拟接口检查。
- npm run build:cover：历史封面版回归/回退构建，不与标题模块同时启用。

标题路线仍会等待字幕/推理后返回列表，并发与high不保证即时加载或消除App自身超时。没有字幕和错误不能成为数字评分。AI百分比是启发式分数，不是经过校准的概率或作者来源证明。

手机包仅含4个JS、标题模块、安装说明与许可证，不含个人Key、Cookie或日志。历史版本留在上级版本存档。

0.4.2采用上游Jev主路径极简判断问题，仅增加JSON分数输出约束；字幕直接作为user文本。并未更换成Jev引擎，DeepSeek的自报分数不能等同其choice概率。提示词版本独立，旧评分缓存不复用。

## 下载与首次安装

- [下载安装包](https://github.com/LynkHu0/Stop-the-Slop-for-Shadowrocket/releases/latest)，解压后阅读 INSTALL.txt。
- 需要 iOS、Shadowrocket、自己的 DeepSeek API Key，以及可正常使用的 B站网页登录态。
- 将安装包的 Script 目录下4个脚本复制至 iCloud 云盘/Shadowrocket/Script/，将 `.srmodule` 文件复制至 iCloud 云盘/Shadowrocket/Modules/。在 Shadowrocket 模块中启用并填写自己的 Key，编译配置。HTTPS 解密证书须由使用者自行安装、信任和配置。
- 脚本在本机读取 B站会话以请求官方字幕；字幕发送至 DeepSeek 官方接口用于评分，Key 仅用于 DeepSeek 请求，B站 Cookie 不发送给 DeepSeek。调用会消耗自己的 API 余额。不要分享已填写 Key 的模块、会话或日志。
- 停用全部旧版同类模块后再启用当前标题版。详见 [完整安装说明](docs/INSTALL-Title.txt)。

## 开发

需要 Node.js，执行 `npm ci` 后可运行 `npm run build`；`npm test` 会构建回归用包并运行模拟测试。本次发布59项检查通过，不能替代最新版 B站 App 真机兼容性或识别准确率验证。

## 来源与命名

检测问题参考 [MauroPello/stop-the-slop](https://github.com/MauroPello/stop-the-slop)，来源与许可情况见 [UPSTREAM.md](UPSTREAM.md)。仓库和历史脚本中的 NoAIText 名称与 yaki1210/NoAIText 固定规则插件无关联。本版使用 DeepSeek 对字幕判断，不采用其固定句式规则。
