---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: repository-maintenance
  authority:
    subject: operations/script-maintenance
    kind: operational
  readWhen:
    - 手工运行会写入仓库文件、本地文件或数据库的维护脚本时
    - 判断维护脚本是否有预演、只读、写入开关或可靠退出码时
  sources:
    - package.json
    - scripts/cleanup-latent-artifacts.mjs
    - scripts/db/collapse-preset-group-bindings.ts
    - scripts/db/migrate-zero-redundancy.ts
    - scripts/db/verify-zero-redundancy.ts
    - scripts/docs/generate-prisma-schema-compatibility.ts
    - scripts/docs/generate-repo-inventory.ts
    - scripts/fix-position-presets.py
    - scripts/migrate-preset-variants.sql
    - scripts/migrate-sqlite.sql
    - src/scripts/backfill-comfy-output-subfolder.ts
    - src/scripts/seed.mts
  verifiedBy:
    - node --import tsx --test tests/test-script-maintenance-doc.test.ts tests/test-cleanup-latent-artifacts.test.ts tests/test-collapse-preset-group-bindings.test.ts tests/test-zero-redundancy-migration.test.ts
    - python -m unittest discover -s tests -p test_fix_position_presets.py
    - npm run docs:check
  environment:
    - 已解析当前检出、精确输入目标和可恢复副本的本地维护环境
  risk: 维护入口可能原地改写受跟踪文档、删除文件或修改真实数据库；预演、退出码和输出摘要不能替代目标核对、备份与后验验证。
  recovery: "#故障处理与恢复"
  verificationState: exercised
  lastVerified: "2026-07-14"
---

# 维护脚本

## 适用场景

本流程负责手工维护入口的目标选择、预演、写入和恢复边界，不维护每个可导入内部模块的文件清单。质量分析命令由[质量分析流水线](../testing/quality-analysis.md)负责；`Training` 工作进程和内容审查执行由[队列与工作进程架构](../architecture/system/execution/queue-worker.md)负责。阅读本页不会授权修改生产数据库、运行时文件、队列或服务。

## 前置条件

- 精确确认要运行的是操作入口，而不是被其他脚本导入的内部模块；先读当前源码中的参数解析与顶层调用。
- 明确目标文件或数据库的绝对身份、提供方、当前运行环境和恢复责任方。不得依赖默认本地数据库路径猜测目标，也不得输出连接凭据。
- 运行 `git status --short`，记录当前任务范围。运行时数据、副本、日志和临时输出必须保持未跟踪，不能因维护成功而进入暂存区。
- 优先使用 `--check`、`--dry-run`、只读验证或可丢弃副本。入口没有这些能力时，先在可丢弃副本上演练；“先打印计划再立即删除”不等于预演。

## 当前入口契约

| 入口 | 状态影响 | 输入与输出 | 预演或只读模式 | 写入与退出语义 |
| --- | --- | --- | --- | --- |
| `scripts/docs/generate-prisma-schema-compatibility.ts` | 生成受跟踪的 `docs/prisma-schema-compatibility.md` | 读取两个 `Prisma` schema，输出兼容性文档 | `--check` 只比较当前内容；陈旧时退出 `1` | 不带参数时原地写入；未知参数或读写失败会非零退出 |
| `scripts/docs/generate-repo-inventory.ts` | 生成受跟踪的 `docs/repo-inventory.md` | 读取 `Git` 索引与文档元数据，输出仓库清单 | `--check` 只比较当前内容；陈旧时退出 `1` | 不带参数时原地写入；未知参数或读取失败会非零退出 |
| `scripts/cleanup-latent-artifacts.mjs` | 递归删除目标根下名为 `latents` 的目录和 `.latent` 文件 | 接收一个或多个根目录；先输出一行删除计划，再输出删除计数 | 没有预演；同一次调用在打印计划后立即删除 | 无参数、非目录或文件系统错误时退出 `1`；不存在的根会被跳过，因此退出 `0` 不能证明目标存在 |
| `scripts/db/collapse-preset-group-bindings.ts` | 折叠 `SQLite` 中重复的预制组绑定及其提示词、手动 `LoRA` 引用 | 命令行入口必须显式提供 `--database-url file:<路径>`；输出摘要或 `JSON` | 默认和 `--dry-run` 都不写入；`--format json` 可供差异审查 | 只有 `--write` 写入；与 `--dry-run` 同时使用会失败，缺少数据库参数、非法参数或数据库错误会非零退出 |
| `scripts/db/migrate-zero-redundancy.ts` | 规划或写入零冗余关系迁移 | 当前实现从进程的 `DB_PROVIDER` 与 `DATABASE_URL` 读取目标，输出摘要或 `JSON` 计划 | 不带 `--write` 时不写入；`--dry-run` 与 `--read-only` 只是显式只读标记 | `--write` 遇到无效 `JSON`、无效引用或解析差异会拒绝；计划存在上述问题时退出 `1` |
| `scripts/db/verify-zero-redundancy.ts` | 只读核对迁移后的解析结果 | 读取当前进程选中的数据库，输出摘要或 `JSON` 报告 | 始终只读；`--allow-mismatch` 只放宽解析差异的退出条件 | 退出位 `2`、`4`、`8` 分别表示无效 `JSON`、无效引用和解析差异，可组合出现 |
| `scripts/fix-position-presets.py` | 原地规范化体位预制文档 | 可选目录路径；省略时写入 `docs/product/shared-resources/position-presets.md` | 没有预演；先对显式临时副本运行并审查差异 | 成功写回后退出 `0`；参数、读取或写入异常非零退出 |
| `src/scripts/backfill-comfy-output-subfolder.ts` | 逐行补写当前数据库中的 `Run.comfyOutputSubfolder` | 从已提交提示快照的节点 `515.inputs.output_path` 提取值；输出发现、补写和跳过计数 | 没有预演，也没有目标参数；只能由进程数据库环境选择目标 | 单行异常会记录并跳过；顶层异常当前只记录而不可靠设置非零退出，因此必须用前后查询验证，不能以退出 `0` 判定成功 |
| `scripts/migrate-preset-variants.sql` 与 `scripts/migrate-sqlite.sql` | 直接修改旧版 `SQLite` 表结构和数据 | 数据库、附加库、事务与输出均由调用它们的 `SQLite` 客户端负责 | 脚本自身没有预演；只能先在可恢复副本中执行 | 退出码属于客户端；没有独立迁移批准、完整备份和恢复演练时不得对当前数据库运行 |
| `src/scripts/seed.mts` | 写入开发数据库并在 `data/images/**` 创建占位文件 | 使用当前 `DATABASE_URL`、`DB_PROVIDER` 与生成的客户端 | 没有预演 | 只允许可丢弃开发环境；成功退出 `0`，顶层失败退出 `1`，不得用于生产补数 |

`scripts/db/migrate-zero-redundancy.ts` 虽然接受 `--provider`、`--source-db`、`--verify` 和转交验证参数，但当前顶层执行没有用这些值切换数据库或启动验证器。不得把这些参数当成目标隔离或后验验证；真实目标仍由进程环境决定，验证必须单独运行 `scripts/db/verify-zero-redundancy.ts`。

`collapsePresetGroupBindings()` 的程序化调用只有在 `databaseUrl` 为 `undefined` 时才会使用进程 `DATABASE_URL`。命令行解析器在省略 `--database-url` 时传入的是 `null`，因此实际 CLI 不会回退到环境变量，而会以缺少 `DATABASE_URL` 失败；运行手册只承诺显式命令行参数。

## 操作步骤

1. 根据上表选择最小入口，并确认操作属于本地维护、生产部署还是数据库变更。生产运行时或数据库写入还必须进入[生产部署](./deployment/README.md)的锁、队列和数据库边界；本流程不替代这些门禁。
2. 对生成器先运行对应 `--check`。对预制组折叠先在数据库副本上运行 `--dry-run --format json`；对零冗余迁移先在显式环境选中的副本上运行不带 `--write` 的计划，再单独运行只读验证器。
3. 对没有预演的文件脚本，只在可丢弃副本上运行第一次调用。特别是 `cleanup-latent-artifacts.mjs`：计划行和删除发生在同一进程中，没有供人工确认的暂停点。
4. 审查精确目标、候选计数、跳过项、阻塞项和差异。任何目标身份不明、计数异常、解析差异或恢复路径缺失都必须停止，不能通过添加 `--write` 继续。
5. 获得当前任务对精确写入的授权后，才在原目标上执行写入形式。不得把副本路径、连接字符串或临时输出写进受跟踪文档和命令记录。
6. 写入后重新运行只读检查，并核对真实状态：生成文档使用 `--check` 和 `git diff -- <输出路径>`；数据库脚本使用独立查询与验证器；文件删除脚本核对保留文件和目标范围。仅看退出码或摘要不够。
7. 再次运行 `git status --short`。只把当前任务明确批准的受跟踪生成结果交给 Git；数据库、副本、日志、临时输出和运行时文件继续留在交付范围外。

## 预期结果

只有精确目标发生已批准的变化；预演与写入结果可对账，后验检查关闭了剩余计划或异常计数，无关工作树、数据库、文件和服务保持不变。

## 故障处理与恢复

- 在写入前失败时保留目标不变，报告入口、目标类别和不含秘密的错误；不得换用另一个数据库或扩大根目录重试。
- 生成文档失败时修复生成器或输入后重新生成；不得手工改输出伪造新鲜状态。
- 数据库写入部分完成时停止后续脚本和部署，保留运行证据及部署锁，并由既定恢复责任方从本次操作前的精确备份恢复或制定前向修复。不得临时切换提供方、强制推送 schema 或把本地副本当生产数据。
- 文件删除没有通用自动回滚。只能从本次操作前确认的副本恢复精确目标；没有副本时报告不可逆范围，不能用生成空文件或扩大扫描掩盖丢失。
- `backfill-comfy-output-subfolder.ts` 即使退出 `0` 也可能只记录了顶层错误；必须以数据库前后计数和抽样值决定是否恢复或重试。

## 验证状态

本流程的仓库清单生成分支已于 2026-07-14 在真实受跟踪目标上演练：先以 `scripts/docs/generate-repo-inventory.ts --check` 发现陈旧结果，获得精确写入授权后重新生成 `docs/repo-inventory.md`，审查限定差异，再以 `--check`、Git 差异和文档门禁完成后验验证。当前 `verifiedBy` 还通过源码、聚焦测试、临时测试固件或数据库副本验证其他入口的合同，但 Prisma 兼容文档写入、潜空间文件真实删除、预制组折叠写入、零冗余迁移写入、体位目录真实改写、其他文件维护入口和真实数据库操作均未实际演练。

## 上级导航

- [返回运行手册](./README.md)
