---
schemaVersion: 1
document:
  type: router
  status: current
  owner: shared-resources
  authority:
    subject: shared-runtime-resources
    kind: router
  readWhen:
    - 需要变更模型、设置、活动 ComfyUI 目标或工作模式导航时
    - 需要判断相似的 Generation 与 Training 资源是否真正共享时
  sources:
    - src/lib/work-mode-resources.ts
    - src/components/persistent-bottom-nav.tsx
    - src/server/services/model-asset-service.ts
    - src/server/services/comfy-target.ts
    - src/server/services/comfy-remote-file-adapter.ts
  verifiedBy:
    - npm run docs:check
    - node --import tsx --test tests/test-work-mode-resource-boundary.test.ts tests/test-comfy-target-config.test.ts tests/test-comfy-remote-file-adapter.test.ts tests/test-model-asset-remote-notes.test.ts
    - node --import tsx --test tests/test-training-prod-route-shell.test.ts
---

# 共享资源架构

## 责任边界

模型与设置是当前由 Generation 和 Training 有意共享的面向用户资源。工作模式导航属于共享基础设施：它负责切换对等资源入口，同时保持这些资源的责任方明确可见。

运行记录、项目、预设与模板不属于共享资源。底部导航根据活动工作模式，将这些资源键分别映射到 Generation 或 Training 路由。相似的界面、名称或实现辅助函数都不能授权跨领域回退读取。

## 模型资产与活动目标

模型浏览、上传、移动、哈希与备注功能使用活动 ComfyUI 目标抽象：

- 本地目标在已配置的模型根目录下解析 checkpoint 与 LoRA 目录；
- SSH 目标解析远程模型根目录，并通过加固的 SSH/SCP 适配器执行文件操作；
- 关系型模型元数据以实际绝对路径或远程路径为键，而文件字节保留在目标文件系统中。

活动目标还可以负责 ComfyUI 生命周期命令与 HTTP 隧道端点。目标选择是 Generation 执行与模型管理共享的运行时边界，并不表示 Generation 项目或工作流被转移到了共享领域。

## 设置与导航

设置使用一个共享路由，而不是重复保存工作模式状态。模式切换器按资源目标保留最近路由与滚动位置，将运行记录/项目/预设/模板切换到对等领域，并让共享的模型与设置继续停留在其共享路由。

## 故障隔离

数据库元数据、本地文件、远程文件、SSH 传输与活动目标都可能独立产生偏差。路径约束和目标感知适配器会保护文件操作，但调用方仍必须把远程命令成功与元数据持久化视为两个独立副作用。

## 相关文档

- [领域架构](../README.md)
- [系统上下文](../../system/context.md)
- [共享资源产品文档](../../../product/shared-resources/README.md)
