---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: development-operations
  authority:
    subject: operations/local-database-bootstrap
    kind: operational
  readWhen:
    - 为全新本地开发检出初始化 PostgreSQL 或 SQLite 数据库时
  sources:
    - package.json
    - prisma.config.ts
    - .env.example
    - prisma/schema.prisma
    - prisma/schema.sqlite.prisma
    - src/scripts/seed.mts
  verifiedBy:
    - node --import tsx --test tests/test-agent-policy-runbooks.test.ts
    - npm run docs:check
  environment:
    - 尚无需要保留数据的本地 Windows 开发检出
  risk: 初始化会执行开发迁移、删除部分既有种子相关记录，并在 data/images 下写入占位文件；不得对生产、共享或身份不明的数据库运行。
  recovery: "#故障处理与恢复"
  verificationState: not-exercised
  lastVerified: null
---

# 本地数据库初始化

## 适用场景

本流程只为全新或明确可丢弃的本地开发数据库创建 schema 并写入开发种子数据。它不负责生产数据库同步、已有数据库升级、数据修复或提供方切换；这些操作必须进入[生产数据库同步](../deployment/database-sync.md)或另行批准的维护流程。

## 前置条件

- 当前任务已明确授权初始化这个精确本地数据库。仅阅读本页不构成写入授权。
- 已从 `.env.example` 创建项目根 `.env`，并让 `DB_PROVIDER` 与 `DATABASE_URL` 指向同一个精确目标。
- 目标是全新或已确认可丢弃的本地开发数据库。只要 URL 指向远程、共享、生产或身份不明的数据库，就必须停止。
- 如果目标已含需要保留的数据，先取得可恢复备份并改用有明确迁移与恢复责任方的流程。
- 已运行 `npm ci`。初始化期间不得同时运行会写入同一数据库的服务或脚本。

## 操作步骤

1. 在仓库根目录只验证 `.env` 中的提供方和 URL 形状，不输出连接串：

   ```powershell
   # runbook-contract: local-database-bootstrap-preflight
   $repo = (Resolve-Path "D:\Luca\Code\MyProject\comfyui-manager").Path
   $provider = $databaseUrl = $envLines = $null
   try {
     $envLines = Get-Content -LiteralPath (Join-Path $repo ".env") -Encoding utf8
     function Get-LocalEnvValue([string]$Name) {
       $line = $envLines | Where-Object { $_ -match "^\s*$Name\s*=" } |
         Select-Object -First 1
       if (-not $line) { return $null }
       return ($line -replace "^\s*$Name\s*=\s*", "").Trim().Trim('"').Trim("'")
     }

     $provider = (Get-LocalEnvValue "DB_PROVIDER")
     if ([string]::IsNullOrWhiteSpace($provider)) { $provider = "postgresql" }
     $provider = $provider.ToLowerInvariant()
     $databaseUrl = Get-LocalEnvValue "DATABASE_URL"
     if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
       throw "DATABASE_URL 未配置。"
     }
     if ($provider -eq "sqlite" -and -not $databaseUrl.StartsWith("file:")) {
       throw "SQLite 必须使用 file: DATABASE_URL。"
     }
     if ($provider -notin @("postgresql", "postgres", "sqlite")) {
       throw "DB_PROVIDER 只能是 postgresql 或 sqlite。"
     }
     if ($provider -ne "sqlite" -and $databaseUrl -notmatch '^postgres(?:ql)?://') {
       throw "PostgreSQL 必须使用 postgres:// 或 postgresql:// DATABASE_URL。"
     }
   } finally {
     $provider = $databaseUrl = $envLines = $line = $null
     Remove-Variable provider, databaseUrl, envLines, line -ErrorAction SilentlyContinue
   }
   ```

2. 再次确认目标身份和恢复边界。该确认不能只依赖 URL 形状；SQLite 要解析到当前本地检出预期的数据文件，PostgreSQL 要确认主机、数据库名和账号确属本地开发目标，但不得把连接串写入日志或证据。

3. 在 Windows PowerShell 中让 `prisma.config.ts` 和种子入口直接读取项目根 `.env`，运行统一初始化命令：

   ```powershell
   Set-Location -LiteralPath $repo
   npm run db:bootstrap
   if ($LASTEXITCODE -ne 0) { throw "本地数据库初始化失败。" }
   ```

   不要直接运行 `npm run db:bootstrap:sqlite`：该软件包脚本使用 POSIX 行内环境变量语法，不是 Windows PowerShell 命令。SQLite 也应在 `.env` 中设置 `DB_PROVIDER=sqlite` 和对应 `file:` URL 后使用统一命令。

4. `db:bootstrap` 会运行开发迁移，再执行 `src/scripts/seed.mts`。种子入口会清理部分运行、图片、回收站和提示词块记录，并在 `data/images/**` 写入占位图片；它不是面向已有数据的无损填充命令。

5. 只在初始化成功后检查迁移状态：

   ```powershell
   npx prisma migrate status
   if ($LASTEXITCODE -ne 0) { throw "Prisma 迁移状态未就绪。" }
   ```

   然后才可按[开发服务](./dev-service.md)启动 `next dev`，并用[本地验证](./local-verification.md)检查应用。不得把服务能启动单独视为种子数据完整性的证明。

## 预期结果

所选本地提供方的 schema 已达到当前开发迁移状态，匹配提供方的 Prisma client 可用，开发种子入口成功退出，且所有数据库文件、占位图片和日志仍属于未跟踪本地运行数据。

## 故障处理与恢复

- 提供方、URL 或目标身份不一致时，在迁移前停止；不得通过临时覆盖环境变量绕过 `.env` 冲突。
- 迁移失败时不要继续执行种子入口，也不要切换提供方重试。保留精确错误，确认目标与迁移状态后再决定前向修复或恢复。
- 种子入口失败时不要盲目重跑；它可能已经删除部分记录或写入部分占位文件。先核对数据库与 `data/images/**` 的实际状态，再按初始化前确认的恢复方案处理。
- 对明确新建且可丢弃的 SQLite 目标，删除数据库文件和对应占位数据也必须再次获得精确路径授权；对 PostgreSQL 或任何已有数据目标，只能按事先确认的备份恢复或前向修复。
- 一旦发现目标可能是生产、共享或远程数据库，立即停止并报告，不得尝试清理、回滚、重建或隐藏已发生的写入。

## 验证状态

本流程尚未实际演练。当前 `verifiedBy` 只静态核对软件包脚本、Prisma 提供方选择、示例环境、种子入口副作用和 PowerShell 合同，不运行迁移、不生成 client、不写数据库，也不创建占位图片。

## 上级导航

- [返回开发环境运行手册](./README.md)
