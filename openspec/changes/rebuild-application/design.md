# 背景与目标

用户已确认全新重建，并保留现有数据和业务文件。本变更以 [最终口径](decisions/00-final-decisions.md) 及分主题决策为设计输入。

## 技术边界

前端 React/Vite/React Router 与后端 Fastify 独立构建；生产同源提供页面与 API。PrimeReact v10 为唯一主组件库，样式主题模块化集中复用。`production` 与 `training` 两个业务模块对等，模型/认证/设置/监控等平台能力按实际模块名公开。SQLite 使用 Drizzle 和 better-sqlite3。

生产模块的 `ProductionProject`、`ProductionTemplate` 以及文件夹、小节列表和排序属于公共组织层；图片配置、任务、结果与资产采用明确的图片类型。本版只接入图片小节，前端按小节类型进入相应编辑器与结果视图。训练模型统一使用 `Training*` 前缀，当前仍只提供 LoRA 训练。完整已确认名称与项目操作边界见 [命名与小节扩展边界](decisions/09-forward-compatibility.md)，视频具体命名、模型、页面和执行功能均不在本版范围。

小节组织字段与配置分开保存：ProductionSection 与 ProductionImageSection 一对一，模板对应 ProductionTemplateSection 与 ProductionTemplateImageSection。公共记录拥有名称、文件夹、类型和排序，图片记录拥有参数及图片配置关联；对用户和 API 保持单一逻辑小节，由原领域操作协调创建、复制与删除，不增加两步创建流程。

## 设计与实现

Figma 是页面布局、视觉、交互状态的审核载体；领域模型和 API 由仓库文档拥有。每个页面标明对应决策 ID、组件来源、关键状态及审核状态。未通过用户审核的页面只属于设计稿，不能据此展开正式页面实现。

逐组讨论时，用户反馈当前组即按原建议确认未评论项、有评论项按用户修订处理；先更新相关文档与设计输入，再进入下一组。该规则不扩展到尚未逐组讨论的建议；设计确认和页面批准分别记录，不能互相替代。

## 迁移

保存完整原始 SQLite 与业务文件；新建 schema 后按类型转换。缺失信息和无法映射内容逐项列出，不能伪造或静默丢弃。迁移过程不重放旧非终态任务。

## 具体内容

完整功能、参数、状态机、字段归属、API 与迁移规则按 [目录](README.md) 分文档维护，不在此重复复制。
