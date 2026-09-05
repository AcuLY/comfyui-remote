# ComfyUI Manager 全新重建与 Figma 设计

这是本轮对话已确认决策的正式入口，收录截至 2026-09-05 的全部清单条目。新分支为 `codex/rebuild-decisions-figma`，源基线为 `3a51ac47f46003d4bbb05ff2d292c6a3edafe5f1`。

## 阅读顺序

| 文档 | 内容 |
| --- | --- |
| [最终口径](decisions/00-final-decisions.md) | 最新决策、被替代方案与少量待细化边界 |
| [设置](decisions/01-settings.md) | SH、CT、IP、IC、EX、TG、LE |
| [领域模型](decisions/02-domain-models.md) | RV、SI、SD、IPD、LTD |
| [HTTP API](decisions/03-http-api.md) | API、IAPI、LAPI |
| [前端设计与组件](decisions/04-design-and-components.md) | IA、VD、CA |
| [技术栈与迁移](decisions/05-stack-and-migration.md) | TS、MIG |
| [平台功能](decisions/06-platform-features.md) | 平台、模型、媒体、审计、基础设施的全部去留 |
| [图像生产功能](decisions/07-image-production-features.md) | 项目、小节、任务、审核、打码、导出、Preset、Template、Workflow |
| [LoRA 训练功能](decisions/08-lora-training-features.md) | 角色、参考图、Section、素材生成、Caption、训练、checkpoint 与文件 |
| [Figma 设计审核](figma/README.md) | 逐页确认规则、首轮设计范围与交接入口 |
| [旧实现风险与覆盖](evidence/legacy-risks-and-coverage.md) | 原扫描附录与实现风险 |
| [原始清单](evidence/source-inventory.md) | 无损快照，保留全部编号和历史上下文 |

## 状态与边界

- 业务与技术决策已确认；整理文档不等于运行代码完成。
- 用户要求先在 Figma 审核每个页面，再实施该页面。后端和数据方案不依赖页面像素稿，但具体实施按后续任务授权推进。
- 当前系统没有投入使用；全新重建，仅保留/迁移旧数据与业务文件。旧代码和依赖留在当前 Git 历史中，不作为新版工程基底。
- 本次工作为新分支文档归档和开始 Figma 设计；不执行旧目录删除、数据迁移或服务部署。
- 本地分支归档不触发 GitHub 合并、Harness 或 CI 整理。

## 完整性

原始清单包含 588 个唯一编号（含功能、细化决策和风险项）。分主题整理保留全部编号；原始清单另外原样保存。规范化过程中仅同步对话已经裁定的旧措辞，具体记录见 [整理说明](evidence/consolidation.md)。
