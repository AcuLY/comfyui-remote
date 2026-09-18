---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: data-architecture
  authority:
    subject: operations/deployment-database-sync
    kind: operational
  readWhen:
    - 生产部署期间同步已变更的 Prisma schema 时
  sources:
    - .env.example
    - package.json
    - prisma.config.ts
    - prisma/schema.prisma
    - prisma/schema.sqlite.prisma
    - src/lib/env.ts
    - src/lib/prisma.ts
  verifiedBy:
    - node --import tsx --test tests/test-prisma-schema-domain-comments.test.ts tests/test-prisma-schema-compatibility-doc.test.ts
    - powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/runbook-contract-harness.ps1
    - npm run docs:check
  environment:
    - 已加载真实 DATABASE_URL 与 DB_PROVIDER 的部署目标
  risk: Prisma 数据库推送会修改选中的数据库；必须从真实目标选择提供方，绝不能为让命令通过而改写连接设置。
  recovery: "#故障处理与恢复"
  verificationState: not-exercised
  lastVerified: null
---

# 部署数据库同步

## 适用场景

只有已部署的 Prisma schema 发生变化时才使用本流程；不改变 schema 的变更必须跳过。在部署锁内、两次 worker 状态门和所有必要 Generation 暂停之后、生产构建之前执行。

## 前置条件

- 目标进程环境或目标 `.env` 提供真实 `DB_PROVIDER` 与 `DATABASE_URL`。
- 检查提供方与 URL 协议方案时不得输出凭据。不得临时改写 `.env`，也不得仅为让校验通过而替换数据库。
- 数据库修改已得到明确授权，并且已知失败/恢复 owner。

## 操作步骤

1. 解析精确目标检出，并只从该检出的 `.env` 读取缺失值。整个选择与同步过程放在 `try/finally` 中：命令结束后恢复调用前的 `DB_PROVIDER`/`DATABASE_URL`，原先不存在的环境变量则删除，同时清空内存中的 URL 与派生变量。不得输出 URL：

   ```powershell
   # runbook-contract: deployment-database-sync
   $repo = (Resolve-Path "D:\Luca\Code\MyProject\comfyui-manager").Path
   $envPath = Join-Path $repo ".env"
   $hadDbProvider = Test-Path Env:DB_PROVIDER
   $hadDatabaseUrl = Test-Path Env:DATABASE_URL
   $originalDbProvider = $env:DB_PROVIDER
   $originalDatabaseUrl = $env:DATABASE_URL
   $dbProvider = $dbUrl = $urlProvider = $null

   function Read-DotEnvValue([string]$Name, [string]$Path) {
     $line = Get-Content -LiteralPath $Path -Encoding utf8 |
       Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
       Select-Object -First 1
     if (-not $line) { return $null }
     return ($line -replace "^\s*$([regex]::Escape($Name))\s*=\s*", '').Trim().Trim('"').Trim("'")
   }

   try {
     $dbProvider = if ($env:DB_PROVIDER) { $env:DB_PROVIDER } else { Read-DotEnvValue "DB_PROVIDER" $envPath }
     $dbUrl = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { Read-DotEnvValue "DATABASE_URL" $envPath }
     if (-not $dbUrl) { throw "目标数据库 URL 缺失。" }

     $urlProvider = if ($dbUrl -like 'file:*') {
       "sqlite"
     } elseif ($dbUrl -match '^postgres(?:ql)?://') {
       "postgresql"
     } else {
       throw "目标数据库 URL 的 scheme 不受支持或有歧义。"
     }
     if ($dbProvider -and $dbProvider.Trim().ToLowerInvariant() -ne $urlProvider) {
       throw "DB_PROVIDER 与目标 DATABASE_URL 冲突。"
     }
     $dbProvider = $urlProvider
     $env:DB_PROVIDER = $dbProvider
     $env:DATABASE_URL = $dbUrl

     Push-Location -LiteralPath $repo
     try {
       & npx prisma generate
       if ($LASTEXITCODE -ne 0) { throw "$dbProvider Prisma 生成失败。" }
       & npx prisma db push
       if ($LASTEXITCODE -ne 0) { throw "$dbProvider Prisma 同步失败。" }
     } finally {
       Pop-Location
     }
   } finally {
     if ($hadDbProvider) { $env:DB_PROVIDER = $originalDbProvider }
     else { Remove-Item Env:DB_PROVIDER -ErrorAction SilentlyContinue }
     if ($hadDatabaseUrl) { $env:DATABASE_URL = $originalDatabaseUrl }
     else { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }

     $dbProvider = $dbUrl = $urlProvider = $originalDbProvider = $originalDatabaseUrl = $envPath = $null
     Remove-Variable dbProvider, dbUrl, urlProvider, originalDbProvider,
       originalDatabaseUrl, envPath, hadDbProvider, hadDatabaseUrl -ErrorAction SilentlyContinue
   }
   ```

2. 构建前审查 Prisma 输出与生成变更。生成 client 属于可再生成工件，绝不能把手工修改它当作恢复捷径。

## 预期结果

生成 client 与数据库 schema 对应真实部署 provider；没有改写 `.env`，没有修改另一 provider 的数据库，并且调用方原有环境变量得到精确恢复。

## 故障处理与恢复

- provider 选择有歧义时，在生成或 `db push` 前停止并保留部署锁。
- 生成失败时不得运行 `db push`；检查精确 Prisma 错误。
- `db push` 失败时保留锁与已暂停 Generation 批次。没有明确恢复决策，不得切换 provider、强制接受破坏性变更、恢复数据库或改用其他 URL 重试。
- 提交或事件证据中绝不能包含连接 URL、凭据、数据库文件或生成运行时缓存。

## 验证状态

本流程尚未在部署目标上实际演练。当前 `verifiedBy` 只静态检查提供方 schema、Prisma 配置、运行时提供方选择、示例环境、软件包命令和受控变量清理，不运行 Prisma 生成、数据库校验、迁移或 `db push`。

## 上级导航

- [返回生产部署运行手册](./README.md)
