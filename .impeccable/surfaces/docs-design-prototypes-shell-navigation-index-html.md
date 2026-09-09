---
version: 1
slug: "docs-design-prototypes-shell-navigation-index-html"
primary_target: "docs/design/prototypes/shell/navigation/index.html"
related_targets: ["docs/design/prototypes/src/navigation.jsx","docs/design/prototypes/src/navigation.css"]
---

# 全局导航外壳

范围为事前已登记的R02-01，`Operate`模式；任务及制作边界见 docs/design/prototypes/reviews/R02-01.md。用户要求继续计划下一项，本轮只执行此项，不能临时追加项目导航、登录或业务列表。

沿用已确认的基础主题、字号与40px触控普通控件／44px图标控件。IA-05/06已固定导航区域位置：桌面侧栏顶部模块、中部四入口、底部全局工具；手机顶部模块、底部四入口、更多内全局工具。因此不重新选择视觉世界或无关版式。

本轮呈现：宽屏展开侧栏，窄屏默认图标栏并支持手动收放；按用户后续反馈，收起时模块使用图片／训练芯片图标，两个图标合在一条竖向圆角轨道内，选中项用原生圆形按钮高亮，名称保留在悬停提示与无障碍标签；展开侧栏和手机顶部仍显示完整名称。手机显示完整四个入口，更多使用原生模态对话框的右侧呈现。活动入口同时有图标、名称和非颜色标识。占位内容明确不是业务页面，便于评审可用空间。

交互只包含基本入口级模块记忆和片段导航，首次进入生产任务；不实现项目页签、查询／滚动恢复或真实鉴权。原生链接支持浏览器历史，退出登录仅演示入口。主题遵循共享偏好。完成以桌面、窄屏、手机及短横屏实测、实际限制记录和用户待审核稿为准，不自标设计已确认。
