# 0.2.2 卡片覆盖与验收

目标仍为先检测、再把带分数标题交给App；不改为仅缓存显示。App自身网络超时仍是限制，等待许可不能改变App的超时设置。

| 入口 | 本版代码处理 | 本机验证依据 | 真机状态 |
|---|---|---|---|
| 首页横屏 | av JSON | 接口模拟、回归 | 用户已确认旧标题版成功 |
| 首页竖屏/Story流 | vertical_av、story URI JSON | 专项测试 | 本版待验证 |
| 关注视频/全部动态 | JSON archive、内嵌card JSON、动态v2 gRPC | 专项测试与Apple JSCore | 本版待验证 |
| 个人/UP投稿主页 | JSON space、Space/Archive gRPC | 回归测试 | 用户已确认旧标题版主页能显示分数；本版待回归 |
| 搜索综合/视频分类 | JSON、SearchAll字段4、SearchByType字段6 | 专项测试与Apple JSCore | 本版待验证 |
| 搜索UP主附带视频 | AuthorNew字段21、Upper字段11中的AvItem | 字段路径适配、模拟样例 | 本版待验证 |
| 搜索合集附带视频 | Collection字段4中的AvItem | 字段路径适配 | 本版待验证 |

这不是“所有真机卡片已通过”的证明。未出现的接口/协议版本不能靠猜测保证。

普通UGC视频使用官方视频信息→player/wbi/v2→字幕JSON。无字幕或短于50字，不能提供有效AI分数。直播、图文、番剧、付费课程不是这条普通视频字幕接口的统一对象，不能冒充检测成功。

## 本机诊断

打开目标页面触发新请求，等列表返回后，在Safari打开 https://www.bilibili.com/noaitext-status 。该地址由本机脚本直接响应，不把诊断数据发送到网页服务器。

诊断记录最近24个已命中响应的接口路径（无query）、卡片数量、缓存数量、评分成功数、状态计数和耗时。不会记录Key/Cookie/标题/搜索词。

- 无新记录：脚本没命中/HTTPS解密没生效/请求未返回；不能断言无视频。
- NO_VIDEO_TITLES：已命中，但卡片格式没有识别出来，需要按该接口适配。
- UNSUPPORTED_FRAME：二进制消息压缩/帧/协议不支持，保持原响应。
- NO_SUB/SHORT：卡片识别成功，但字幕不可用。
- LOGIN/NO_KEY/PARAM/AUTH：登录或AI配置问题。
- TIMEOUT/PENDING/BUDGET_FAIL_OPEN：检测时间不足；不是AI分数。

代码规则不会把没检测到的条目标成0%。

## 字段依据

https://github.com/Janson20/bilibili-api-collect-mirror/blob/master/grpc_api/bilibili/polymer/app/search/v1/search.proto
https://github.com/Janson20/bilibili-api-collect-mirror/blob/master/grpc_api/bilibili/app/dynamic/v2/dynamic.proto
https://github.com/Janson20/bilibili-api-collect-mirror/blob/master/grpc_api/bilibili/app/space/v1/space.proto
