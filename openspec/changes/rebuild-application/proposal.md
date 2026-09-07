# Why

旧应用结构和实验前端已无法作为新版持续建设的基底。用户完成全量功能、领域、接口、视觉和技术选型核对后，要求新分支归档决策，并先在 Figma 审核每个页面。

# What Changes

- 按最终决策全新建设生产（`production`）与训练（`training`）两个对等模块和独立平台能力。
- 生产 Project/Template 及小节组织支持未来类型扩展，本版只开发图片生成；训练功能仍只涵盖 LoRA，不确定或实现视频模型与页面。已确认名称与操作边界见 [逐组确认补充](decisions/09-forward-compatibility.md)。
- 采用 React/Vite/React Router、PrimeReact v10、Fastify/TypeBox、Drizzle/SQLite。
- 保全旧数据与业务文件并显式转换；旧代码及兼容路径不进入新版。
- 页面必须先通过 Figma 用户审核，再进入该页面正式前端实施。

# Capabilities

## New Capabilities

- `application-rebuild`: 新版工程、数据保全和设计先行交付边界。

## Modified Capabilities

无。本目录先记录已批准的新目标；旧运行时文档不被伪装为新版已完成实现。

# Impact

后续实现涉及前后端工程、SQLite 数据映射及本版已确认页面。当前按用户逐组确认及时更新设计文档与输入，不修改运行时，也不开展视频开发。
