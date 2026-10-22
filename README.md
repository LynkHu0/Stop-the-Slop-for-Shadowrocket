# Stop the Slop for Shadowrocket 0.4.3

**非官方社区项目，不是 Stop the Slop、Shadowrocket 或 B站的官方产品，未经其背书。** 检测问题参考 [MauroPello/stop-the-slop](https://github.com/MauroPello/stop-the-slop)；模型调用和 iOS适配由本项目实现，使用自己的 DeepSeek API Key。

[下载安装包](https://github.com/LynkHu0/Stop-the-Slop-for-Shadowrocket/releases/latest) · [安装说明](docs/INSTALL-Title.txt) · [隐私与清除数据](PRIVACY.md) · [来源与许可待确认事项](UPSTREAM.md)

## 功能与限制

- 从 B站可用官方字幕取前15000字符，使用DeepSeek给出AI文案疑似评分；成功后在支持的视频列表标题前显示如「14%」。该百分比只是分数格式，不是校准概率或AI创作字数比例，不能证明作者使用了AI。
- 支持部分首页、搜索、空间、动态的JSON及指定gRPC结构；不保证最新版B站所有入口可用。无字幕、太短、登录/API失败和超时均不生成数字评分。
- 不拦截封面图片。处理列表时会等待字幕和推理，可能导致App加载转圈或超时。默认Flash、思考high，并发1–100、默认10，缓存默认7天。提高并发可能增加API用量或触发限流，不保证即时返回。
- 启用模块、填写Key并具备会话后，打开受支持列表会自动发起检测并消耗API余额。先阅读隐私说明；停用旧版封面/TEST/其他NoAIText模块后再启用当前版。

## 安装

需要iOS、Shadowrocket、自己的DeepSeek Key、可使用的B站网页登录态和用户自行配置的HTTPS解密环境。

1. 下载Release安装ZIP并解压，阅读INSTALL.txt。
2. 复制4个脚本至 iCloud云盘/Shadowrocket/Script/，复制 `.srmodule` 至 iCloud云盘/Shadowrocket/Modules/。
3. 在Shadowrocket模块中启用并填写自己的Key，编译配置。证书安装、信任与HTTPS解密范围由用户自行管理；本项目不会替用户创建或信任证书。
4. 按安装说明准备B站网页登录态，重新打开B站刷新列表。

## 本机会话与退出

模块捕获并保存部分B站Cookie供字幕请求使用，不把Cookie发送给DeepSeek。会话按14天逻辑有效期判断，**到期或停用模块不保证自动擦除**。Key保存在填写过的模块参数中，不属于加密密码保险箱。iCloud/系统备份情况取决于用户和应用设置。

停止检测并完全退出B站App后，在模块仍启用时，用Safari访问 `https://www.bilibili.com/noaitext-status`，勾选确认并点击“清除本机会话”。成功后停用模块或Session脚本，避免再次捕获。此操作不退出B站账号、不撤销服务器会话、不删除Key或评分缓存。完整说明见 [PRIVACY.md](PRIVACY.md)。

## 开发与验证

```sh
npm ci
npm run build
npm test
```

本次发布运行63项模拟自动检查，其中包括会话清除确认、过期表单、重放保护和打包后状态脚本验证；不代表真机兼容性或来源识别准确率已经验收。`npm test`会生成历史回归包，日常安装只使用当前标题版，不混用旧包。

0.4.3：新增本机会话清除入口；补全数据保存、外发和清除说明；明确非官方关系；使源码标签与安装包对应。检测提示词、标题分数格式和并发默认值未改。

历史脚本中的NoAIText名称与 yaki1210/NoAIText 固定规则插件无关联，不使用其检测判据。来源与许可情况见UPSTREAM.md，本补丁未补造或变更许可证。
