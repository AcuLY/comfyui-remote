---
schemaVersion: 1
document:
  type: testing
  status: current
  owner: quality-pipeline
  authority:
    subject: quality-analysis-pipeline
    kind: canonical
  readWhen:
    - 运行或修改 Phase 0 基线与 Phase 1 离线质量评估时
    - 判断质量分析文件属于输入、生成输出还是临时证据时
  sources:
    - src/server/quality
    - scripts/quality
    - tests/fixtures/quality/auto-review-analysis/reference-section-exclusions.json
  verifiedBy:
    - node --import tsx --test tests/test-quality-phase0-baseline.test.ts tests/test-quality-phase1-offline-eval.test.ts tests/test-quality-phase1-reviewer.test.ts tests/test-quality-script-governance.test.ts
---

# 质量分析流水线

Phase 0 基线生成和 Phase 1 离线评估是当前评估工具，不是活跃产品计划。`src/server/quality/**` 负责算法、阈值与序列化，`scripts/quality/**` 负责 CLI 入口。

## 受管文件

| 路径 | 负责人 | 分类 | 重生成或验证方式 |
| --- | --- | --- | --- |
| `tests/fixtures/quality/auto-review-analysis/reference-section-exclusions.json` | `quality-analysis` | 已提交的基准 fixture | 作为 `quality:baseline -- --exclusions` 的输入；报告命令不得覆盖它。 |
| `reports/quality/auto-review-analysis/phase0-labeled-images.csv` | `quality-analysis` | 重生成产物，也是 Phase 1 输入 | 使用显式本地数据库运行 `npm run quality:baseline -- --db <本地 SQLite 文件> --out <临时输出目录>` |
| `reports/quality/auto-review-analysis/valid-projects-trash-rate-by-section-project.csv` | `quality-analysis` | 重生成产物 | `npm run quality:baseline -- --db <本地 SQLite 文件> --out <临时输出目录>` |
| `reports/quality/auto-review-analysis/valid-projects-trash-rate-by-section.csv` | `quality-analysis` | 重生成产物 | `npm run quality:baseline -- --db <本地 SQLite 文件> --out <临时输出目录>` |
| `reports/quality/auto-review-analysis/valid-projects-trash-rate-by-section.md` | `quality-analysis` | 重生成产物 | `npm run quality:baseline -- --db <本地 SQLite 文件> --out <临时输出目录>` |
| `reports/quality/auto-review-analysis/valid-projects-trash-rate-summary.json` | `quality-analysis` | 重生成产物 | `npm run quality:verify -- --phase 0` |

默认输出目录是 `reports/quality/auto-review-analysis`。未显式指定输入时，Phase 1 会读取该目录中的 Phase 0 标注 CSV；预测文件必须来自真实评审输出，离线评估器不会虚构预测。

## 验证、重生成与可移植性

- 在干净检出中，`npm run quality:verify -- --phase 0` 只能读取并校验已提交的 `summary` 产物。它不会查询数据库、不会重生成其他报告，也不会证明 `summary` 中记录的文件路径仍然存在。
- Phase 0 重生成依赖未提交的本地 SQLite 数据库。虽然源码有默认路径 `prisma/data/comfyui.db`，执行维护任务时仍应显式传入 `--db <本地 SQLite 文件>`，并用 `--out <临时输出目录>` 隔离结果；干净检出本身不包含该数据库。
- 当前 `summary` 的 `sourceDb` 与 `reportPaths` 保存了生成机器上的绝对来源追踪路径。这些字段只能说明历史生成来源，不能跨 Windows、WSL 或其他检出目录解析为当前文件位置，也不能单独证明产物可在另一台机器按字节复现。
- 评估变更时先写入显式临时 `--out` 目录。只有在检查完整差异并运行对应验证命令后，才能替换已提交报告。
- 历史 PRD 中更晚的阶段不是当前流水线承诺；扩展范围必须进入 OpenSpec。

## Phase 1 离线评估

Phase 1 使用 Phase 0 标注 CSV 和显式预测文件进行离线评估。典型隔离命令如下，其中预测文件必须真实存在：

```powershell
npm run quality:evaluate -- --phase 1 --labeled <Phase 0 标注 CSV> --predictions <预测 JSONL> --out <临时输出目录>
npm run quality:verify -- --phase 1 --out <临时输出目录>
```

## 上级入口

- [测试文档](README.md)
