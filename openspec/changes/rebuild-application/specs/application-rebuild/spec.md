## ADDED Requirements

### Requirement: 全新工程与完整数据保全

系统 SHALL 以全新工程实现已确认业务能力，并只从旧版迁移数据和业务文件。

#### Scenario: 处理旧版数据

- **WHEN** 执行新版迁移
- **THEN** 完整保存原始数据库与业务文件，显式转换到新模型，逐项报告无法映射内容
- **AND** 不引入旧页面、旧 API 兼容层或双写路径

### Requirement: 页面先经 Figma 审核

系统页面 SHALL 在 Figma 中完成用户审核后进入正式前端实施。

#### Scenario: 页面尚未批准

- **WHEN** 页面只有初稿或仍有用户反馈未解决
- **THEN** 将页面标为待审核并继续设计修订，不标记为实施完成或设计已批准

### Requirement: 组件和样式统一复用

应用 SHALL 优先使用 PrimeReact v10 MIT 组件，并集中管理主题与样式配置。

#### Scenario: 开发基础交互

- **WHEN** 组件库已具有所需组件
- **THEN** 使用现成组件和公开配置，不再创建平行的同类基础组件
- **AND** 不引入 Tailwind 或需要申请 key/收费的组件发行版

### Requirement: 生产与训练命名和实现范围

系统 SHALL 使用 `production` 与 `training` 作为业务模块标识及对应代码目录、页面与 API 前缀；训练侧既有正式实体统一使用 `Training` 前缀。本版只实现已有图片生产与 LoRA 训练能力，不确定或实现视频模型、接口或页面。

#### Scenario: 使用本版模块入口

- **WHEN** 进入新版业务模块或调用其领域接口
- **THEN** 使用 `/production/**`、`/training/**` 及 `/api/production/**`、`/api/training/**`
- **AND** 无有效导航记录时默认进入 `/production/tasks`，不出现视频占位入口

### Requirement: 公共生产组织与按类型划分的小节

生产模块 SHALL 由 `ProductionProject` 与 `ProductionTemplate` 拥有公共文件夹、小节列表和排序，使用 `ProductionImageSection` 与 `ProductionTemplateImageSection` 表达当前图片配置。公共组织与前端容器应允许后续接入其他小节类型，图片编辑器、任务、结果和文件资产仍保持明确的类型归属。

#### Scenario: 编辑生产项目或模板

- **WHEN** 用户浏览小节列表、调整文件夹或排序、进入小节编辑
- **THEN** 公共层处理组织信息，由小节类型对应的界面处理配置与结果，本版只提供图片小节
- **AND** 项目与模板复用配置协议但独立拥有记录，模板导入项目继续深复制

#### Scenario: 查看与执行当前图片任务

- **WHEN** 查看项目任务或执行“生成全部图片小节”
- **THEN** 统一入口明确已接入任务的类型、状态和计数，图片生成保存 `ProductionImageTask` 与 `ProductionImageAttempt`
- **AND** 结果与文件分别归 `ProductionImageResult` 和 `ProductionImageArtifact`，不因入口统一合并不同类型业务模型

#### Scenario: 执行项目级生命周期与导出操作

- **WHEN** 用户归档或删除项目、复制或删除小节、导出当前交付包
- **THEN** 公共层协调各小节类型的配置、结果和文件逻辑，本版只执行已有图片逻辑
- **AND** 图片重试、审核、彻底删除与 JPEG/ZIP 导出规则保持，未来其他小节的具体行为不作为本版实现要求

### Requirement: 逐组确认后同步设计文档

设计维护 SHALL 在每轮用户确认后及时更新相关文档与设计输入，再进入下一组；未确认建议保持待定，不将命名或架构确认标记为页面批准或功能完成。

#### Scenario: 用户确认当前讨论组

- **WHEN** 用户确认或修正当前组的设计结论
- **THEN** 将当前组未评论项按已展示建议确认、有评论项按用户修订处理，只把这些结论及必要联动写回决策文档，保留旧实现证据和历史来源的真实名称
- **AND** 不以确认一组作为采纳整份审视报告或开展视频开发的授权
