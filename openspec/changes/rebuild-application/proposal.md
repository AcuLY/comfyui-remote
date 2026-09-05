# Why

旧应用结构和实验前端已无法作为新版持续建设的基底。用户完成全量功能、领域、接口、视觉和技术选型核对后，要求新分支归档决策，并先在 Figma 审核每个页面。

# What Changes

- 按最终决策全新建设两个对等模块和独立平台能力。
- 采用 React/Vite/React Router、PrimeReact v10、Fastify/TypeBox、Drizzle/SQLite。
- 保全旧数据与业务文件并显式转换；旧代码及兼容路径不进入新版。
- 页面必须先通过 Figma 用户审核，再进入该页面正式前端实施。

# Capabilities

## New Capabilities

- `application-rebuild`: 新版工程、数据保全和设计先行交付边界。

## Modified Capabilities

无。本目录先记录已批准的新目标；旧运行时文档不被伪装为新版已完成实现。

# Impact

后续实现涉及前后端工程、SQLite 数据映射及全部页面。当前任务只写文档并开始 Figma 设计，不修改运行时。
