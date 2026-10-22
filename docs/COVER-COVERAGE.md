# 封面版0.3.0覆盖说明

| 卡片来源 | ID与封面读取 |
|---|---|
| 首页横屏/竖屏/Story | 同一JSON卡片的aid/bvid/player_args/视频URI及cover/pic/ff_cover |
| UP/个人/频道JSON容器 | 递归卡片，接受明确视频ID的无标题封面；不把频道或UP ID当视频ID |
| 搜索JSON | 外层导航ID与内层av/ugc_inline cover |
| 搜索gRPC | SearchAll第4字段、SearchByType第6字段内的视频卡片第37/27字段，以及UP/合集附带AvItem |
| 关注JSON | archive对象及内嵌JSON card字符串 |
| 关注gRPC | 动态v2 DynAll/DynVideo/DynAllPersonal/DynVideoPersonal/DynSpace/DynFriend |
| 空间gRPC | Space/Archive视频第4字段封面 |

比例：保留请求4:3/16:9/9:16裁切参数；大尺寸缩小，避免手机解码内存开销。
时长：不按短/长视频排除；取字幕的AV/BV和CID来自绑定。字幕目前沿用PC版最多15000字及同版评分提示词。
身份：token绑定明确视频/分P与原图路径；同图不同视频不共用绑定，CDN i0/i1分片不影响身份。

所有支持路径已做代码/模拟协议检查；原版App是否保留标记路径和实际发起新图片请求，仍不能由本机模拟证明。未知消息类型/没有可用字幕/原App图片超时不能硬填百分比。

协议字段依据沿用docs/COVERAGE.md中的公开协议记录。
