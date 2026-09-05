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
