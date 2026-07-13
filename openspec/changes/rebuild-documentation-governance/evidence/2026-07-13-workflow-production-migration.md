# 工作流配置生产迁移证据 — 2026-07-13

这是活动变更 `rebuild-documentation-governance` 的非规范性生产运行证据。提案、规范、设计和 `tasks.md` 继续拥有权威；本文只记录用户明确批准后实际执行的任务 `11.1`、`11.3` 迁移、验证、恢复边界和脱敏结果，不保存认证材料、项目标识、section 标识、队列载荷或私有配置值。

## 授权与固定范围

- 用户明确批准完成工作流配置迁移的真实生产部署验证，并在发现公开证书阻塞后批准调查和修复 `comfy.bgmss.fun` 的 TLS。
- 生产检出：`D:\Luca\Code\MyProject\comfyui-manager`。
- 部署分支：`codex/harness-doc-governance-handoff-20260710`。
- 固定提交：`74445e18948adc7afacc928469f8e706425a3d17`；部署前与上游分支一致。
- 运行时目标：本地 Windows `next start`，唯一监听端口 `3000`；没有把部署转移到其他检出。
- 相对 `origin/main` 没有 Prisma schema 变化，因此按运行手册跳过数据库同步，`database-sync.md` 继续保持未演练。

## TLS 与公开入口恢复

- 真实公网 A 记录为 `124.220.66.56`；本机代理 DNS 的 `198.18.0.42` 只用于代理映射，没有被当成源站证据。
- 远端 nginx 原来加载手工 TrustAsia 证书，有效期到 2026-07-09，且不属于任何 Certbot 续期配置；这解释了 `SEC_E_CERT_EXPIRED`。
- 为 `comfy.bgmss.fun` 的 80 端口块增加固定 ACME webroot 后，公网 canary 返回 `200`；Let’s Encrypt staging dry-run 和正式签发均成功。
- 新证书主题为 `comfy.bgmss.fun`，签发方为 Let’s Encrypt `YE2`，有效期到 2026-10-11；正常证书链验证返回成功，没有使用不安全 TLS 选项。
- `certbot-renew.timer` 为 active/enabled，续期配置使用 `/var/www/certbot`，证书专用 renew hook 和现有 deploy hook 均会 reload nginx；带 `--no-random-sleep-on-renew` 的专属 dry-run 成功。
- nginx 已只引用 `/etc/letsencrypt/live/comfy.bgmss.fun/**`。退役的 `/etc/nginx` 手工证书和 0644 私钥已在零引用与 `nginx -t` 通过后删除；原始回滚副本保留在 root-only、目录权限 0700 的 `/root/tls-backup-comfy-20260713-231133`。
- TLS 恢复后曾暴露第二个既有问题：计划任务 `ComfyManager-SSH-Reverse-3000` 的守护进程卡在 2026-07-11 的远端预清理 SSH 子进程，反向 Unix socket 不存在。只重启该精确计划任务及其已确认进程树后，唯一反向隧道和 `/run/comfy-manager/manager.sock` 恢复，socket 模式为 0660、owner 为 `root:nginx`，公开登录和 13 个静态资源恢复为 `200`。

## 锁、队列与候选构建

- 在公开入口恢复健康后才原子获取 `D:\Luca\Code\MyProject\comfyui-manager\.deploy.lock`，锁内固定提交、分支、端口、阶段和暂停批次集合。
- 构建前与重启前分别读取 Generation 和 Training 两类已认证状态；两次门禁的活动计数均为 `0/0`。因此没有调用暂停或恢复端点，锁中始终没有 Generation 批次。
- 候选位于同卷 detached worktree，执行独立 `npm ci`、PostgreSQL Prisma client 生成、SQLite Prisma client 生成和 `npx next build --webpack`；构建期间活跃 `.next` 的 `BUILD_ID` 保持 `31PFc0Ed92KA2SnllSeKu`。
- 第一次 `npm ci` 调用没有返回 npm 失败，而是 Windows PowerShell 把一条依赖弃用 warning 包装为终止 `NativeCommandError`。旧服务、活跃 `.next`、队列和公网入口均未改变，部署锁保持 `candidate-build-failed`。确认没有遗留候选进程后，在同一个已记录 worktree 中改为由 `cmd.exe` 合并日志并以退出码判定，随后构建成功；该修复已回写 `next-build.md` 和合同测试。
- 候选 `BUILD_ID` 为 `pNVVm9ZLShFEeCaYu9ygn`。构建日志大小为 `11708` 字节、SHA-256 为 `EBD1EFF8AA3F0BE852B6EB160BA70B7FDB68A9B7076329F8C6016CB8A05375F3`，warning 匹配行数为 `2`；日志在提取脱敏摘要后删除。
- 候选具备 `BUILD_ID`、`build-manifest.json`、`routes-manifest.json`、`required-server-files.json`、`server/` 和 `static/`；临时 `node_modules`、两套生成 client 和 worktree 均按精确路径清理。

## 重启与完整验证

- 重启前再次确认唯一仓库范围 `next start` 进程树和端口 `3000`，只停止该 Node 进程树；没有停止 `next dev`、其他 Node、训练 worker、Codex 或编辑器进程。
- 旧监听消失后，旧 `.next` 移到本次唯一备份路径，候选再切换到活跃 `.next`；新实例仍监听 `3000`，活跃 `BUILD_ID` 为 `pNVVm9ZLShFEeCaYu9ygn`。
- 本地 `http://127.0.0.1:3000` 和公开 `https://comfy.bgmss.fun` 分别使用独立、及时清理的认证会话完成相同验证：登录页 `200`、13 个静态资源全部成功、受保护 `/projects` 为 `200`、Generation 与 Training 状态 envelope 有效、ComfyUI 可达，验证时活动计数仍为 `0/0`。
- 新生产 server bundle 中有 3 个 `standard-workflow.api.json` 路径命中文件，旧 `docs/workflow.api.json` 路径命中为零；规范文件 `config/workflows/standard-workflow.api.json` 存在。
- 已认证只读 section 工作流下载第一次尝试即返回 `200` 和有效 JSON，没有创建项目、入队、写数据库或提交 ComfyUI prompt。
- 完整验证后关闭旧工件回滚窗口，删除本次旧 `.next` 备份，再删除与规范文件 SHA-256 完全一致的未跟踪 `docs/workflow.api.json` 兼容副本。删除后重复只读工作流下载，第一次尝试仍为 `200`；公开登录再次为 `200`。这证明当前实例不依赖旧文档路径。
- 本次没有暂停批次。清理旧工件、兼容副本和构建日志后，重新核对 owner/token 与空批次集合并释放 `.deploy.lock`；没有遗留候选 worktree、候选 `.next`、备份 `.next`、专用构建日志或部署锁。

## 运行手册演练结论

- `lock.md`：已演练获取、阶段更新、失败保留、恢复后释放；没有演练竞争等待和超时。
- `queue-safety.md`：已演练两次真实双 worker 零活动门；没有演练暂停、部分暂停、Training 阻断和有范围恢复。
- `next-build.md`：已演练独立安装、双 client 生成、webpack 构建、活跃工件隔离和候选清理；同时修复真实暴露的 PowerShell stderr 判定问题。
- `service-restart.md`：已演练本地精确进程树停止、同卷工件切换、原端口启动和回滚窗口关闭；没有触发自动回滚或 SSH 启动变体。
- `verification.md`：已演练本地与公开正常 TLS 的完整表面，以及旧兼容副本删除后的工作流行为；没有触发失败回滚分支。
- `database-sync.md` 未执行，继续保持 `not-exercised` 与 `lastVerified: null`。

## 剩余风险与后续边界

- 本机反向隧道守护脚本的预清理 SSH 命令只有连接超时，没有已建立会话的 keepalive/命令超时；本次只恢复精确任务，没有修改用户目录中的该脚本。若远端再次在已连接状态挂起，公开入口可能重新失去 Unix socket。该运维可靠性问题不改变工作流迁移结果，但应在后续独立范围修复。
- 本证据关闭任务 `11.1` 和 `11.3`，不替代任务 `13.7` 的最终 `$docs-audit full record`、保护分支上的最终 CI、独立复核或任务 `13.9` 的用户明确验收。
- 文档治理验收前仍不得归档本 OpenSpec，也不得自动开始父 Harness 的可观测性实施。
