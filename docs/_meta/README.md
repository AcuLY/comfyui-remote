# 文档治理控制面

本目录只保存仓库的文档治理机制，不承载产品、架构、运维或规划事实。重大变更提案继续由 OpenSpec 管理；审计证据归入授权该审计的 OpenSpec 变更。

## 文件

- [`documentation.schema.json`](./documentation.schema.json) 定义元数据字段和十种受维护文档配置。
- [`policy.yaml`](./policy.yaml) 定义有限治理范围、显式配置选择、导航归属、禁止保留的现行路径、带类型的来源关系以及受控适配器。
- [`templates/document.md`](./templates/document.md)、[`templates/directory-readme.md`](./templates/directory-readme.md) 和 [`templates/runbook.md`](./templates/runbook.md) 是编写起点；使用前必须替换其中的尖括号占位值。

不要在这里新增逐文件 owner 注册表、生成式审计报告、产品事实、OpenSpec 模板或另一套规划生命周期。

## 元数据合同

受维护的根文件以及获准 `docs/**` owner 区域内的当前 Markdown，都以 YAML frontmatter 开头：

```yaml
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: system-architecture
  authority:
    subject: architecture/system
    kind: reference
  readWhen:
    - 修改系统边界时
  sources:
    - src/server/example.ts
  verifiedBy:
    - npm run relevant:test
```

单个文档的实例元数据是该文档的权威描述。`policy.yaml` 通过显式路径模式分配 schema 配置，检查器必须为每份当前文档精确解析出一个配置，再校验 `documentation.schema.json` 中对应的 `$defs` 项；不得根据路径子串推断类型或 owner。schema 顶层 `anyOf` 只为改善编写体验，不能代替治理校验。

仓库路径采用 Git 拼写：相对仓库、使用 `/` 分隔、区分大小写，不允许盘符前缀、开头 `/`、`.` 或 `..` 路径段、重复分隔符或通配标记。策略中的 `include`/`source` 模式可以使用 `glob`，但仍必须相对仓库且不得逃逸仓库。

所有第一方 Markdown 的人类可读文本都必须以简体中文为主体。路径、命令、代码、协议字段、稳定枚举和检查器固定词表中的技术专名可以保留原文；未列入固定词表的外文专名必须使用 Markdown 行内代码明确标记，不能通过添加少量汉字绕过语言门禁。OpenSpec 结构词豁免只在 `openspec/**` 生效。

## 配置类型

| 配置 | 用途 | 附加合同 |
| --- | --- | --- |
| `router` | `README.md` 导航页 | 只负责路由读者，不重复详细事实的权威内容。 |
| `architecture` | 当前系统与领域结构 | `type: architecture`、`status: current`。 |
| `product` | 当前面向用户的能力知识 | `type: product`、`status: current`。 |
| `design` | 当前视觉与交互知识 | `type: design`、`status: current`。 |
| `api` | 独立维护的接口合同 | `type: api`、`status: current`。 |
| `testing` | 独立维护的测试基础设施知识 | `type: testing`、`status: current`。 |
| `runbook` | 可执行的运维流程 | 追加 `environment`、`risk`、`recovery`、`verificationState` 和 `lastVerified`。只有实际演练流程时才能使用 `exercised` 和日期；静态审查或非写入合同测试必须使用 `not-exercised` 与 `null`。 |
| `placeholder` | 已批准但不得虚构内容的未来上下文文件 | 要求 `status: deferred`、激活元数据和权威边界。 |
| `root-file` | 已批准的根入口和兼容指针 | 只允许 `router`、`architecture`、`product` 或 `design` 类型。 |
| `existing-generator` | 已由生成器负责的受维护文档 | 追加生成器路径、输入、独立再生成命令和非写入检查。 |

`sources` 标识文档主张的证据路径，`verifiedBy` 列出验证这些主张的非写入命令或测试。两者都不是文字待办列表，也不能代替更新触发器。

## 策略语义

- `scope` 是有限治理范围矩阵。`frontmatter: none` 表示不对该范围应用当前文档 schema，并不禁止模板中出现示例 frontmatter。
- 策略映射采用封闭结构：未知键、缺失控制字段、空核心规则集、被禁用的 OpenSpec/Skill 校验以及未知 schema 关键字都属于配置失败，不得使用宽松默认值。
- 每个 `rootEntrypoints` 路径都必须被 Git 跟踪，并且精确解析到一条有限 scope 规则。
- `profiles` 为每份当前文档精确选择一个 schema 配置。
- `navigation.roots` 是获准的图入口。责任区域重叠时，以匹配入口路径最长的责任方为准；当 `reverseLinkRequired` 为 `true` 时，每份当前详细文档都必须反向链接该入口。
- `forbiddenLivePaths` 标识验收时不得残留的旧路径或归属错误路径。
- `contract` 关系是阻断项，必须指向 `adapters.generators` 或 `adapters.contracts` 中的受控适配器。生成器参数向量只允许仓库固定的 `tsx scripts/docs/<generator> --check` 形式。源码合同适配器选择由检查器持有的允许列表类型，策略不得向其提供可执行参数。`review` 关系只发出有责任方和原因的非阻断语义告警，绝不会自动调用 `$docs-audit`。
- 适配器配置离线运行。检查只报告漂移及独立修复命令，校验期间不会重新生成内容。生成器负责的 frontmatter 必须与适配器的输出、owner、入口、再生成命令和精确非写入检查一致。
- 受控合同测试返回结构化结果：只有断言不匹配属于仓库违规，语法、导入或运行器故障属于工具故障。检查器会在代码字面量与模板片段、结构化映射键值、软件包/OpenSpec 配置、`.env*`、`Dockerfile`、TOML 和仓库脚本中检测禁止现行路径的消费者；检查器自测、治理负面 fixture、注释和进行中的 OpenSpec 迁移证据除外。

## 编写流程

1. 选择最近的模板，只在获准 owner 区域创建文件。
2. 替换所有尖括号值，并选择正确的 `document.type`。
3. 让 `authority` 指向一个规范化主题和权威类型；通过链接引用上级责任方，不要重复其内容。
4. 记录精确证据路径与非写入验证。
5. 只有真实的结构、导航或来源关系合同需要时才新增或修改策略；不要只为让单个文件通过而增加实例行。
6. 运行 `npm run docs:check` 以及对应源码或运行时测试。
