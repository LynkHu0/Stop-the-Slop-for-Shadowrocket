# Stop the Slop for Shadowrocket

一个运行在 Shadowrocket 中的 B 站文案检测模块。读取视频字幕，用你的 DeepSeek API 分析文案，在受支持的视频列表标题前显示疑似评分。

参考 [Stop the Slop](https://github.com/MauroPello/stop-the-slop) 的检测思路，为 B 站和 Shadowrocket 做了适配。

## 支持平台

主要面向 iPhone 上的 Shadowrocket 和 B 站客户端。iPad、Mac 和 Apple TV 的兼容性尚未验证。

## 功能

- 在受支持的视频列表标题前显示评分
- 检测 B 站可获取的字幕
- 使用自己的 DeepSeek API Key，可调整模型和并发数
- 缓存检测结果，默认保留 7 天

## 下载和安装

需要 Shadowrocket、DeepSeek API Key、B 站网页登录态，以及已配置好的 HTTPS 解密环境。

1. 从 [Releases](https://github.com/LynkHu0/stop-the-slop-for-shadowrocket/releases/latest) 下载并解压安装包。
2. 将 `Script` 文件夹里的 4 个脚本复制到 `iCloud 云盘/Shadowrocket/Script/`。
3. 将 `NoAIText.Title.srmodule` 复制到 `iCloud 云盘/Shadowrocket/Modules/`。
4. 在 Shadowrocket 的“配置 → 模块”中启用模块，填写 DeepSeek API Key 并重新编译配置。
5. 完全退出并重新打开 B 站，刷新视频列表。

如果用过旧版封面或测试模块，请先停用旧模块。登录态准备和升级方法见[完整安装说明](docs/INSTALL-Title.txt)。

## 常见问题

### 为什么有的视频没有评分？

只有能获取到足够字幕的视频才会送去检测。有旁白或画面字幕，也不一定有可读取的 B 站字幕。登录状态、网络、接口变化或请求超时也可能影响检测。

### 分数代表什么？

这是模型对字幕文案的疑似评分，未经概率校准，不能证明文案是否由 AI 创作。

### 会产生费用吗？

检测会调用你填写的 DeepSeek API，消耗对应账户的余额。视频较多时，列表可能需要等待检测结果。

### 如何清除保存的 B 站会话？

先完全退出 B 站并等待请求结束，在模块仍启用时，用 Safari 打开 `https://www.bilibili.com/noaitext-status`，按页面提示确认清除。清除后停用模块或会话脚本，避免再次捕获。具体范围见[隐私说明](PRIVACY.md)。

## 相关项目

- [浏览器插件版](https://github.com/LynkHu0/stop-the-slop-for-browser)
- [问题反馈](https://github.com/LynkHu0/stop-the-slop-for-shadowrocket/issues)
- [隐私说明](PRIVACY.md) · [上游与许可说明](UPSTREAM.md)
