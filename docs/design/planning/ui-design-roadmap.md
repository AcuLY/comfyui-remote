---
schemaVersion: 1
document:
  type: design
  status: current
  owner: product-design
  authority:
    subject: new-frontend-ui-design-roadmap
    kind: reference
  readWhen:
    - 核对新版应用业务任务范围与功能依赖时
  sources:
    - docs/design/planning/ui-design-coverage.md
    - docs/design/planning/ui-design-shared-plan.md
    - docs/design/planning/ui-design-production-plan.md
    - docs/design/planning/ui-design-training-plan.md
  verifiedBy:
    - npm run docs:check
---

# 新版应用功能规划

当前状态：**原型已删除，仅保留功能规划，视觉未定。**

本文保存业务任务编号、范围和行为规则。新设计从新的文件开始；这里的功能规划不规定视觉风格、组件库、页面组成或布局，也不沿用原型制作、验收和批准记录。

## 业务任务索引

| 编号 | 业务范围 | 功能规划 |
| --- | --- | --- |
| R02-01～R02-03 | 导航与登录 | [共享功能](ui-design-shared-plan.md#r02-导航与登录) |
| R03-01～R03-03 | 生产任务工作台 | [共享功能](ui-design-shared-plan.md#r03-生产任务工作台) |
| R04-01～R04-05 | 模型管理 | [共享功能](ui-design-shared-plan.md#r04-模型管理) |
| R05-01～R05-06 | 生产项目与小节组织 | [生产功能](ui-design-production-plan.md) |
| R06-01～R06-04 | 生产图片编辑与历史 | [生产功能](ui-design-production-plan.md) |
| R07-01～R07-04 | 图片审核与回收站 | [生产功能](ui-design-production-plan.md) |
| R08-01～R08-06 | 打码、导出与项目生命周期 | [生产功能](ui-design-production-plan.md) |
| R09-01～R09-10 | 生产预制与模板 | [生产功能](ui-design-production-plan.md) |
| R10-01～R10-06 | 训练项目与内容 | [训练功能](ui-design-training-plan.md) |
| R11-01～R11-04 | 构图编辑与训练素材 | [训练功能](ui-design-training-plan.md) |
| R12-01～R12-08 | 训练任务与运行 | [训练功能](ui-design-training-plan.md) |
| R13-01～R13-05 | 训练预制与模板 | [训练功能](ui-design-training-plan.md) |
| R14-01～R14-08 | 设置 | [共享功能](ui-design-shared-plan.md#r14-设置) |
| R15-01～R15-03 | 监控、日志与审计 | [共享功能](ui-design-shared-plan.md#r15-监控日志与审计) |
| R16-01～R16-04 | 跨页功能验收 | [共享功能](ui-design-shared-plan.md#r16-跨页验收任务) |

共79项功能任务（共享26、生产30、训练23）。[覆盖清单](ui-design-coverage.md)保留 `C02`～`C12`、`I01`～`I23`、`L01`～`L20`、`S01`～`S09` 共63个功能覆盖编号。

## 尚未确定的业务问题

| 编号 | 范围 | 影响 |
| --- | --- | --- |
| Q-01 | 素材生成任务终态删除：候选被代表图、参考图、输入或运行样本引用时的处置 | 仅 R12-03 等待此项决策，不自定解绑或删除语义，不阻止其他任务 |
| Q-03 | 尚未明确的业务路由后缀 | 按业务入口和返回规则确定，不把 API 地址当作前端路由 |

## 业务来源

下列业务输入来自固定提交 [d127cd31][source-root]，属于功能规划来源；后续业务变更需要按对应合同核对。

| 编号 | 来源 | 用途 |
| --- | --- | --- |
| D0 | [最终口径][d0] | 业务优先级与范围 |
| D1 | [设置][d1] | 字段、只读状态及设置归属 |
| D2 | [领域模型][d2] | 身份、关系、生命周期、修改历史 |
| D3 | [HTTP API][d3] | 操作、冲突和逐项结果 |
| D4 | [信息架构][d4] | 仅导航与浏览器行为；不采用其视觉或组件规定 |
| D6 | [平台功能][d6] | 登录、模型、任务、监控、日志、审计 |
| D7 | [图像生产功能][d7] | 生产项目、图片、任务、审核、打码与导出 |
| D8 | [训练功能][d8] | 训练项目、素材、任务、运行、预制与模板 |
| D9 | [前向兼容][d9] | 命名、资源身份与执行职责 |

## 保留的业务规则

| 编号 | 规则 | 行为边界 |
| --- | --- | --- |
| U-02 | 一级模块为“生产 / 训练”；页面命名空间为 `/production/**` 与 `/training/**` | 图像生产与 LoRA 训练用于具体业务描述 |
| U-03 | 公共 `ProductionSection` 与图片配置一对一，模板同理；用户始终操作一个小节 | 列表、文件夹、排序、面包屑基于公共小节；新增仍一次完成。“生成全部图片小节”明确本版运行范围，不增加配置身份表单或视频类型选择器 |
| U-04 | 图片生成、批量打码、训练素材生成、训练运行保留各自任务语义 | 可共用任务展示组件及项目范围视图；不得合并成万能任务状态机。训练优先、单 `GPU`、唯一执行目标；空闲 ComfyUI 进程本身不阻止训练 |
| U-05 | 历史、业务日志／审计及跳转使用完整 `module + resourceType + resourceId` | 界面显示自然名称，图片配置返回所属公共小节；无业务目标的系统事件不伪造目标。历史还覆盖构图输入关系、`Provider` 参数、代表图，不能缩成文本历史 |
| U-06 | 导出为 `<EXPORT_ROOT>/<项目名>/<slug>.zip`；内部图片目录按稳定项目 ID 组织 | 导出显示项目名文件夹、`slug` 文件名和覆盖说明，不加 `images` 层；内部路径只在需要定位时展示，不增加可编辑路径模板 |
| U-07 | 正式训练类型为 `Training*`，角色生图字段为 `imageProductionPrompt`，构图代表图为 `selectedImageId` | D8 少量旧 `selectedResultId` 描述按 D2／D3 对齐；训练项目没有 `slug`，代表图更换不改 `Caption` |
| U-08 | `FC-17` 将 ComfyUI 通信／队列／文件／进程技术服务与图片 `Workflow` 适配分开；`GPU` 协调归共享层 | 任务等待与设置错误准确解释原因；不新增执行平台、`worker` 仪表盘、多 `GPU` 或视频占位 |

## 导航行为

| 编号 | 功能要求 |
| --- | --- |
| N-01 | `/` 恢复有效的上次导航；首次或失效进入 `/production/tasks`，不新增概览仪表盘首页 |
| N-02 | 两模块均提供任务、项目、预制、模板入口；模型、监控与日志、设置属于全局工具；切换模块进入对应任务范围；提供主题偏好功能；无退出登录入口 |
| N-03 | 生产项目可访问概览、小节、图片、任务；编辑、导出、归档作用于当前项目；全局与项目任务使用同一业务规则并保留范围 |
| N-04 | 训练项目可访问概览、角色档案、参考图、构图、训练素材、任务；构图包含提示词、输入图、候选、代表图和 `Caption` |
| N-05 | 已明确路径包括 `/login`、`/training/projects/:id/sections`；旧 `/assets/loras` 回退共享模型页，遵循 D6 COMPAT-001 |
| N-06 | 稳定深链、浏览器前后导航、刷新恢复、查询／展开／当前位置／滚动恢复；详情保留来源范围；可分享筛选写入 URL；图片多选仅属当前会话 |

## 当前不纳入的界面

| 分组 | 不在当前功能范围内的能力 |
| --- | --- |
| 通用 | 视频及占位入口／空接口、多目标／多 `GPU`／角色权限管理、通用媒体库、大 `KPI` 首页、趋势图／实时日志流、原始 `console` 独立页、全局历史中心、`worker` 面板、模型上传／物理文件删除 |
| 生产 | 缓冲队列、旧三页签状态、手工任务刷新、部署暂停批次、清空队列独立模型、部分成功图片任务、仅删记录保留输出、复制项目新建、批量创建小节、`enabled`、清空全部小节、单节 `Workflow`、预制手工同步、复杂分阶段 `Dry Run`／`Apply`、全部或仅保留图批量打码、导出历史版本、反归档、`Workflow` 上传／在线编辑 |
| 训练 | 角色分析／`Prompt`／`Caption` 任务、`DatasetVersion`／`Freeze`／`Preview` 实体、`SectionRun`、候选 `keep/reject`／`Caption`、原始参考图直接进入训练结果池、跨项目媒体复用、独立从模板创建、训练暂停、多活动 `Run`、唯一最终 `LoRA`、归档恢复、从 `checkpoint` 直接创建预制 |
| 设置 | `Token` 原文查看／修改、在线修改数据根、SSH 私钥上传／密码、隧道开关、主动健康／环境测试、自动启停策略、刷新频率／超时／并发等内部协议配置、`Provider` 或图片模型选择器 |

未来视频输入、播放、音轨、模型兼容与 `GPU` 行为不作为本轮前置问题；当前版本的图片和训练设计可以独立完成。



## 上级路由

- [设计文档](../README.md)

[source-root]: https://github.com/AcuLY/comfyui-remote/tree/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application
[d0]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/00-final-decisions.md
[d1]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/01-settings.md
[d2]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/02-domain-models.md
[d3]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/03-http-api.md
[d4]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/04-design-and-components.md
[d6]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/06-platform-features.md
[d7]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/07-image-production-features.md
[d8]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/08-lora-training-features.md
[d9]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/09-forward-compatibility.md
