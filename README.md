# Stop the Slop for Shadowrocket

> **AI Script Detector for Bilibili · Shadowrocket Edition**：读取 B站视频字幕，用自己的 DeepSeek API 为文案评分，并在支持的视频标题前显示如「14%」的疑似分数。

[![Download](https://img.shields.io/badge/Download-GitHub_Releases-0f172a?style=flat-square)](https://github.com/LynkHu0/stop-the-slop-for-shadowrocket/releases/latest)
[![Runtime](https://img.shields.io/badge/Runtime-Shadowrocket-5865f2?style=flat-square)](#installation)
[![Privacy](https://img.shields.io/badge/Privacy-Policy-15803d?style=flat-square)](PRIVACY.md)
[![Upstream](https://img.shields.io/badge/Reference-Stop_the_Slop-555?style=flat-square)](https://github.com/MauroPello/stop-the-slop)

**非官方社区项目，不是 Stop the Slop、Shadowrocket 或 B站的官方产品，未经其背书。** 检测问题参考 [MauroPello/stop-the-slop](https://github.com/MauroPello/stop-the-slop)；本项目实现 Shadowrocket 脚本适配和 DeepSeek 调用，不使用上游的 YouTube 评分后端。

---

## 下载与相关项目

- **安装包：** [下载最新版本](https://github.com/LynkHu0/stop-the-slop-for-shadowrocket/releases/latest)，当前发布版本为 **0.4.3**。
- **浏览器插件版：** [Stop the Slop for BIlibili](https://github.com/LynkHu0/Stop-the-Slop-for-Bilibili)。
- **问题反馈：** [GitHub Issues](https://github.com/LynkHu0/stop-the-slop-for-shadowrocket/issues)。请注明设备、系统、Shadowrocket和B站版本，不要附带Key、Cookie或填写过参数的模块。
- **上游参考：** [Stop the Slop — YouTube AI Script Detector](https://github.com/MauroPello/stop-the-slop)。

---

## 功能

- **标题评分前缀：** 在受支持的普通视频列表标题前显示疑似评分，保留封面和视频链接，不拦截或重绘图片。
- **字幕驱动检测：** 使用可获取的 B站官方字幕，不根据标题猜测文案，不自动转录无字幕视频。
- **列表接口适配：** 覆盖部分首页、搜索、UP空间、动态的JSON和指定gRPC结构；客户端版本或接口变化可能影响匹配。
- **自己的 DeepSeek Key：** 默认Flash、思考开启、high强度，可在模块参数中调整。没有开发者运营的集中评分服务器。
- **评分缓存与并发：** 缓存默认7天，可设1–30天；模型并发1–100、默认10，跨脚本为软限制，不保证实际并发始终等于设置值。
- **本机诊断与会话清除：** 查看脱敏状态和耗时，在确认后清除模块保存的 B站会话。

**「14%」只是分数的显示格式。** 它不是经过校准的概率，不表示14%的文案由AI生成，也不能证明创作来源。不要据此指控作者或作出处罚。

---

## 仓库结构

```text
├── src/                       # 字幕、评分、JSON/gRPC、诊断与会话脚本
├── docs/                      # 安装说明和接口覆盖说明
├── tests/                     # 模拟接口及打包脚本检查
├── scripts/                   # 开发与验证辅助脚本
├── build-title.mjs            # 当前标题版构建入口
├── build-*.mjs                # 历史回归构建入口
├── package.json
├── PRIVACY.md                 # 会话、Key、缓存及清除说明
└── UPSTREAM.md                # 参考来源与许可说明
```

运行 `npm run build` 后，当前安装文件生成到 `dist/NoAIText-iOS-Title-0.4.3/`。历史脚本文件名保留为兼容用途，与 yaki1210/NoAIText 固定规则插件无关联，不使用其检测判据。

---

<a id="installation"></a>
## 安装

### 设备兼容性

这是 **Shadowrocket 模块**，不是仅面向某一设备的独立App。Shadowrocket的设备支持范围见其 [App Store页面](https://apps.apple.com/us/app/shadowrocket/id932747118)，但能安装Shadowrocket不代表本模块一定兼容。

| 设备 | 本项目当前状态 |
|---|---|
| iPhone | 主要适配场景；最新版B站全部入口和新增会话清除页仍需真机验收 |
| iPad | 兼容性待验证，需检查客户端接口和脚本运行环境 |
| Mac | 兼容性待验证；B站网页与客户端可能使用不同接口 |
| Apple TV | 兼容性待验证；不能承诺脚本、HTTPS解密、客户端接口及会话准备流程均可复用 |

跨设备运行需要相应版本支持脚本和HTTPS解密，且客户端请求命中本模块已适配接口。下列步骤目前按 **iPhone / iCloud** 场景编写，不是其他设备的已验证安装指南。

### 导入模块

1. 准备 Shadowrocket、自己的 DeepSeek API Key、可用的 B站网页登录态，以及用户自行配置的HTTPS解密环境。
2. [下载安装ZIP](https://github.com/LynkHu0/stop-the-slop-for-shadowrocket/releases/latest) 并解压，先阅读 `INSTALL.txt` 和 `PRIVACY.md`。
3. 把 `Script/` 中4个JS复制到 `iCloud云盘/Shadowrocket/Script/`，把 `NoAIText.Title.srmodule` 复制到 `iCloud云盘/Shadowrocket/Modules/`。
4. **停用全部旧版封面、TEST及其他旧NoAIText模块**。在Shadowrocket中启用 `Stop the Slop for Shadowrocket`，填写自己的Key并编译配置。
5. 按 [完整安装说明](docs/INSTALL-Title.txt) 准备会话，重新打开B站刷新新列表。

证书安装、信任和HTTPS解密范围由用户自行管理，本项目不会自动创建或信任证书。填写Key且具备会话后，打开受支持列表可能自动调用模型并消耗API余额。

---

## 使用限制

- 仅分析官方字幕前15000字符。无字幕、太短、登录/API错误和超时不生成数字评分。
- 为修改列表标题，模块会等待字幕和推理后返回该批列表，可能导致加载转圈或超时；提高并发不保证更快，也可能增加短时用量和限流。
- 模型分数未做来源识别基准校准，不应作为真实性、原创性或违规证据。
- 当前版本通过 **63项模拟自动检查**，包括确认清除、过期表单、重放保护和打包脚本；这不等于已通过各设备真机验收。

---

## 隐私与会话清除

模块保存部分B站Cookie用于请求官方字幕，**不把这份Cookie发送给DeepSeek**。字幕和检测提示词发送至DeepSeek官方接口，使用你自己的API余额。

会话的14天是逻辑有效期，不保证到期擦除；停用模块也不会自动删除持久数据。Key保存在模块参数中，iCloud和系统备份由用户及应用设置决定。

清除会话时：先完全退出B站并等待请求结束，在模块仍启用时用Safari访问 `https://www.bilibili.com/noaitext-status`，勾选确认后清除；成功后停用模块或Session脚本，避免再次捕获。

这只清除本机保存的会话值，不退出B站账号、不撤销服务器会话、不删除Key或评分缓存。保存期限、实际清除范围及备份处理见 **[PRIVACY.md](PRIVACY.md)**。

---

## 开发与检查

```sh
git clone https://github.com/LynkHu0/stop-the-slop-for-shadowrocket.git
cd stop-the-slop-for-shadowrocket
npm ci
npm run build
npm test
```

`npm test` 会生成历史回归包。日常安装只使用当前标题版，勿同时启用旧版包。

---

## 上游与许可证

感谢 **MauroPello** 的 [Stop the Slop](https://github.com/MauroPello/stop-the-slop)。检测问题参考 commit `dec988b03ff63224aa6d6c796b5963eb3ccac95e` 的Jev主路径问题；本版仍调用DeepSeek，其自报分数不能等同于Jev的choice概率。

上游README声明MIT，但完整许可文件及版权声明尚待确认。本仓库未据此自行宣称已经完善开源授权，详见 **[UPSTREAM.md](UPSTREAM.md)**。
