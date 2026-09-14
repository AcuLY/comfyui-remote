---
schemaVersion: 1
document:
  type: design
  status: current
  owner: product-design
  authority:
    subject: production-prototype-rebuild
    kind: reference
  readWhen:
    - 制作或审核完整生产模块原型时
  sources:
    - docs/design/prototypes/ui-design-production-plan.md
    - docs/design/prototypes/ui-design-shared-plan.md
    - docs/design/prototypes/design-foundations.md
    - src/app/design-demos/routing/routes.ts
    - src/app/design-demos/features/projects/project-list-page.tsx
    - src/app/design-demos/features/runs/queue-page.tsx
    - src/app/design-demos/features/presets/library-page.tsx
    - src/app/design-demos/features/templates/template-list.tsx
  verifiedBy:
    - npm --prefix docs/design/prototypes run build
    - npm run docs:check
---

# 生产模块重做：演示结构与新版组件

2026-09-14 用户明确要求放弃当前项目和任务方案，参考设计演示与旧前端实现生产模块全部原型。同轮用户进一步明确：演示的预制与模板不完善，主要用于任务和项目设计；预制、模板以旧前端为主要依据。本轮在已有 R03、R05～R09 的范围内合并实现，不临时发明任务编号，也不再要求逐项开工确认。设计审核仍由用户完成。

交付继续位于独立 HTML 原型工程，不接生产数据库、队列或实际生成服务。所有操作使用本浏览器会话的演示数据；可重置。生产模块入口替换当前 `/shell/project-context/` 的生产路由；训练原型保留独立入口与旧会话数据。

## 参考与实现范围

| 区域 | 优先参考 | 补充参考 | 本轮结构及操作 |
| --- | --- | --- | --- |
| 任务工作台、运行审核（R03、R07） | `features/runs/queue-page.tsx`、`pending-review-groups.tsx`、`review-page.tsx` | `src/app/queue/` 与运行审核、回收站实现 | 当前运行进度、状态页签、按项目分组的待审缩略图；队列批选与暂停/恢复/取消/重试；运行快照、用途标记、连续审核、回收站 |
| 项目列表与文件夹（R05） | `features/projects/project-list-page.tsx`、`project-list-item.tsx`、`project-folders.tsx` | `src/app/projects/` 文件夹与创建流程 | 标题和数量同排，最近结果缩略图带，紧凑状态操作；项目/文件夹选择、移动、排序、创建编辑 |
| 项目与小节（R05、R06） | `project-detail-page.tsx`、`project-section-card.tsx`、`project-section-shell.tsx`、`section-rail.tsx` | 旧小节编辑器及文件夹实现 | 小节/结果视图；缩略图、批次数与运行入口；右侧小节导航；参数、预制、提示词、LoRA、历史和结果平级编辑范围；单项新增/复制及所选/全部生成 |
| 图片与交付（R07、R08） | `project-result-card.tsx` 与运行审核 | 旧打码、导出、同步变体、归档/删除操作 | 图片多选及用途标记、单图打码、批量打码任务、导出范围与结果、同步变体、归档/删除影响确认 |
| 预制与组（R09） | 旧前端 `src/app/assets/presets/` | `features/presets/` 仅作辅助参考 | 分类侧栏、文件夹路径与行式条目；分类/组槽位、变体、正负提示词、两阶段 LoRA、成员、历史、跨变体替换和四维排序 |
| 模板（R09） | 旧前端 `src/app/assets/templates/` | `features/templates/` 仅作辅助参考 | 紧凑模板列表、编辑及小节导航；默认参数、绑定、提示词、LoRA；模板导入项目与从项目另存 |

以上相对演示文件均位于 `src/app/design-demos/`。参考业务结构和操作顺序，不复制它的旧组件实现、密度开关、过小触控区域和装饰样式。与已确认业务规则冲突的旧行为不恢复：归档仍永久只读；新建项目在同一表单选择模板；项目无手工展示排序；小节支持所选/全部生成，不恢复旧批量创建独立页和清空全部入口。

## 组件与适配契约

沿用 `PrimeReact 10.9.9 Styled`、统一主题、纯白浅色底和中性深色底。优先使用库提供的 `TabMenu`、`SelectButton`、`Dropdown`、`Dialog`、`Menu`、`Checkbox`、`InputNumber`、`ProgressBar` 等公开入口；应用负责路由、数据变更、业务拖拽和来源关系。不得通过内部 CSS 选择器重新实现组件行为。

信息密度来自合并冗余行、缩略图带和清楚的操作分组，不靠缩小触控范围。卡片可读时优先双列；编辑表单设有用的最大宽度。窄屏将辅助侧栏移入明确触发的面板或折叠区域，页面顶部保留业务操作，底部继续使用已实现的导航。标题、输入及按钮不截断关键内容。

跨页面使用同一份项目、小节、任务、图片、预制和模板数据。创建任务进入队列；图片审核同步项目结果；导入/另存模板真正改变本地结构；取消不提交。等待和执行只作明确的演示模拟，不伪装真实生成。

## 验证记录

2026-09-14 开始制作，2026-09-15 完成整合。本版已实现上述生产原型，待用户审核。训练、全局工具及真实服务保持原范围。

| 检查 | 实际结果 |
| --- | --- |
| 页面与适配 | 已观察任务、项目列表、小节编辑、图片灯箱、预制编辑、模板列表及模板小节。1440×900 浅色、1024×768 深色、393×852 手机下检查了代表页面；已修正小节页签逐字换行、空选择显示、数字输入横溢及空文件夹过高。最终所测页面无水平溢出；页签自身允许横向浏览 |
| 模板与项目 | 从统一创建表单选择模板，实际创建含3个独立小节的项目；从其中一个小节生成，任务工作台出现相同项目/小节的待提交任务 |
| 自动保存与历史 | 模板小节备注修改后失焦，出现修改前和自动保存记录；确认恢复后备注回到原值，只恢复当前对象 |
| 审核与执行 | 图片灯箱按 `J` 保留后进入下一张；单图自动打码演示保存后出现原图对照入口。失败任务重试后仍为同一任务身份、回待提交，并保留失败尝试；无输出任务不会显示“已审核完毕” |
| 打码与导出 | 项目6张用途图缺少打码时阻止导出；创建精选打码任务，模拟完成后允许打包。实际下载 `rainy-street.zip`，本机解包目录检查确认含6个非空图片条目；封面与用途图提供独立下载链接 |
| 工程验证 | 16项新生产模型/解析测试、29项保留的上下文模型测试及19项文档治理测试共64项通过；完整构建通过，机械检测无发现。浏览器所用原型无控制台错误；仓库文档检查0错误、3条缺少比较基线的关系审查提示。设计指引已同步，API及生产队列未改，生成清单已更新 |

自动生成、自动识别打码及服务执行仍是本地模拟；当前/历史工作流下载明确标为演示配置，不声称可提交给真实 ComfyUI。下载的图片包来自已注明来源的演示图片。受引用变体的单独删除提供禁用原因及先替换引用的路径，不臆造尚未确认的引用清理合同。未覆盖真机触屏、读屏、完整主题/设备/状态组合及真实后端集成；以上检查不代替用户设计批准。

## 上级路由

- [返回原型入口](../README.md)
- [生产设计范围](../ui-design-production-plan.md)
- [返回设计总览](../../README.md)
