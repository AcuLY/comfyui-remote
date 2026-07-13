---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: deployment-operations
  authority:
    subject: operations/deployment-next-build
    kind: operational
  readWhen:
    - 部署期间生成生产 Next.js 候选构建时
    - 诊断竞争构建或失败的生产构建时
  sources:
    - AGENTS.md
    - package.json
    - next.config.ts
    - .gitignore
    - prisma.config.ts
    - prisma/schema.prisma
    - prisma/schema.sqlite.prisma
    - node_modules/next/dist/build/index.js
  verifiedBy:
    - npm run docs:check
  environment:
    - 已获取部署锁、且可在同一卷创建相邻临时目录的 Windows 生产检出
  risk: 只在同卷的独立分离式干净工作树中生成候选工件；构建期间绝不读取、写入、删除或重命名活跃检出的 .next。
  recovery: "#故障处理与恢复"
  verificationState: not-exercised
  lastVerified: null
---

# Next.js 生产候选构建

## 适用场景

完成目标选择、两次 worker 状态门、所有必要 Generation 暂停和数据库同步后使用本流程。Next.js 构建会清理自身输出目录，因此绝不能在仍由 `next start` 使用的生产检出中原地运行 `next build`。本流程在同一卷的相邻分离式 Git 工作树中构建精确的已提交版本，再把完整 `.next` 移出工作树，作为尚未生效的候选工件。

候选构建成功后必须先进入[服务重启](./service-restart.md)，在旧监听完全停止后切换工件，再进行[部署验证](./verification.md)。不得只为验证仅开发或仅文档变更而运行生产构建。

## 前置条件

- 持有目标检出的部署锁。
- 确认 Training 空闲，并记录本次部署暂停的所有 Generation 批次。
- 目标检出的已跟踪文件必须干净；候选工作树只构建当前 `HEAD`，不会包含未提交改动。
- `package-lock.json` 已提交，并且目标环境能够通过已批准的软件源或本地缓存执行 `npm ci`。依赖只安装到候选工作树，不共享生产检出的 `node_modules`。
- 两套 Prisma client 都由候选工作树内的 schema 生成。生成只写候选 `src/generated/prisma` 与 `src/generated/prisma-sqlite`；本阶段绝不运行 `prisma db push`，数据库同步仍只属于[数据库同步](./database-sync.md)。
- 候选工作树、候选工件和构建日志路径必须尚不存在，并且与目标检出位于同一卷。

## 操作步骤

1. 固定提交和同卷候选路径，并拒绝脏的已跟踪状态、路径碰撞或并发构建：

   ```powershell
   # runbook-contract: deployment-next-build
   $repo = (Resolve-Path "D:\Luca\Code\MyProject\comfyui-manager").Path
   $repoParent = Split-Path -Parent $repo
   $deploymentCommit = (& git -C $repo rev-parse HEAD).Trim()
   if ($LASTEXITCODE -ne 0 -or -not $deploymentCommit) {
     throw "无法固定目标检出的部署提交。"
   }

   $trackedChanges = @(& git -C $repo status --porcelain --untracked-files=no)
   if ($LASTEXITCODE -ne 0 -or $trackedChanges.Count -ne 0) {
     throw "目标检出存在未提交的已跟踪改动；候选构建不会隐式包含这些改动。"
   }

   $deploymentId = "$($deploymentCommit.Substring(0, 12))-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"
   $candidateWorktree = Join-Path $repoParent ".comfyui-manager-build-$deploymentId"
   $candidateNext = Join-Path $repoParent ".comfyui-manager-next-$deploymentId"
   $buildLog = Join-Path $repoParent ".comfyui-manager-build-$deploymentId.log"
   $candidateBuildPrefix = Join-Path $repoParent ".comfyui-manager-build-"
   $repoVolume = [System.IO.Path]::GetPathRoot($repo)

   foreach ($path in @($candidateWorktree, $candidateNext, $buildLog)) {
     if ([System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($path)) -ne $repoVolume) {
       throw "候选路径必须与生产检出位于同一卷：$path"
     }
     if (Test-Path -LiteralPath $path) {
       throw "候选路径已存在；不得覆盖：$path"
     }
   }

   $builds = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
     Where-Object {
       ($_.CommandLine -like "*$repo*" -or $_.CommandLine -like "*$candidateBuildPrefix*") -and
       ($_.CommandLine -like '*next*build*' -or $_.CommandLine -like '*.next\build*')
     })
   if ($builds.Count -gt 0) {
     $builds | Select-Object ProcessId, ParentProcessId, CreationDate
     throw "本仓库范围内已有活跃 Next 构建。"
   }

   & git -C $repo worktree add --detach $candidateWorktree $deploymentCommit
   if ($LASTEXITCODE -ne 0) { throw "创建 detached 候选 worktree 失败。" }

   $candidateTrackedChanges = @(& git -C $candidateWorktree status --porcelain --untracked-files=no)
   if ($LASTEXITCODE -ne 0 -or $candidateTrackedChanges.Count -ne 0) {
     throw "候选 worktree 不是干净的精确提交。"
   }

   $sourceEnv = Join-Path $repo ".env"
   $candidateEnv = Join-Path $candidateWorktree ".env"
   $candidateNodeModules = Join-Path $candidateWorktree "node_modules"
   $candidateGeneratedPostgres = Join-Path $candidateWorktree "src\generated\prisma"
   $candidateGeneratedSqlite = Join-Path $candidateWorktree "src\generated\prisma-sqlite"
   $savedDbProviderExists = Test-Path Env:DB_PROVIDER
   $savedDbProvider = $env:DB_PROVIDER

   try {
     if (Test-Path -LiteralPath $sourceEnv -PathType Leaf) {
       Copy-Item -LiteralPath $sourceEnv -Destination $candidateEnv -ErrorAction Stop
     }

     Push-Location -LiteralPath $candidateWorktree
     try {
       & npm ci --no-audit --no-fund *> $buildLog
       if ($LASTEXITCODE -ne 0) { throw "候选依赖安装失败；检查专用构建日志。" }
       $env:DB_PROVIDER = "postgresql"
       & npx prisma generate *>> $buildLog
       if ($LASTEXITCODE -ne 0) { throw "候选 PostgreSQL Prisma client 生成失败。" }
       $env:DB_PROVIDER = "sqlite"
       & npx prisma generate *>> $buildLog
       if ($LASTEXITCODE -ne 0) { throw "候选 SQLite Prisma client 生成失败。" }
       if ($savedDbProviderExists) { $env:DB_PROVIDER = $savedDbProvider }
       else { Remove-Item Env:DB_PROVIDER -ErrorAction SilentlyContinue }
       & npx next build --webpack *>> $buildLog
       if ($LASTEXITCODE -ne 0) { throw "候选生产构建失败；检查专用构建日志。" }
     } finally {
       Pop-Location
     }

     $worktreeNext = Join-Path $candidateWorktree ".next"
     Move-Item -LiteralPath $worktreeNext -Destination $candidateNext -ErrorAction Stop
   } finally {
     if ($savedDbProviderExists) { $env:DB_PROVIDER = $savedDbProvider }
     else { Remove-Item Env:DB_PROVIDER -ErrorAction SilentlyContinue }
     if (Test-Path -LiteralPath $candidateEnv -PathType Leaf) {
       Remove-Item -LiteralPath $candidateEnv -Force
     }
   }

   foreach ($requiredFile in @(
       "BUILD_ID",
       "build-manifest.json",
       "routes-manifest.json",
       "required-server-files.json"
     )) {
     if (-not (Test-Path -LiteralPath (Join-Path $candidateNext $requiredFile) -PathType Leaf)) {
       throw "候选工件缺少必需文件：$requiredFile"
     }
   }
   foreach ($requiredDirectory in @("server", "static")) {
     if (-not (Test-Path -LiteralPath (Join-Path $candidateNext $requiredDirectory) -PathType Container)) {
       throw "候选工件缺少必需目录：$requiredDirectory"
     }
   }
   foreach ($cleanupTarget in @(
       $candidateNodeModules,
       $candidateGeneratedPostgres,
       $candidateGeneratedSqlite
     )) {
     $resolvedCleanupTarget = (Resolve-Path -LiteralPath $cleanupTarget -ErrorAction Stop).Path
     if (-not [string]::Equals(
         $resolvedCleanupTarget,
         [System.IO.Path]::GetFullPath($cleanupTarget),
         [System.StringComparison]::OrdinalIgnoreCase
       ) -or -not $resolvedCleanupTarget.StartsWith(
         "$candidateWorktree\",
         [System.StringComparison]::OrdinalIgnoreCase
       )) {
       throw "生成目录不在精确候选工作树内；拒绝自动清理。"
     }
     Remove-Item -LiteralPath $resolvedCleanupTarget -Recurse -Force
   }
   & git -C $repo worktree remove $candidateWorktree
   if ($LASTEXITCODE -ne 0) {
     throw "候选工件已生成，但临时 worktree 清理失败；保留部署锁并人工核对。"
   }
   ```

2. 检查 `$buildLog` 与 `$candidateNext\diagnostics` 中的成功证据及意外警告，并记录 `$deploymentCommit`、`$candidateNext`、`$buildLog` 和 `$deploymentId`。这些值是服务重启阶段的工件交接，不得重新猜测或扫描选择。
3. 再次确认生产进程仍在使用 `$repo\.next`，且本阶段没有读取、修改、移动或删除该目录。候选工件在旧生产监听停止前绝不能移动到 `$repo\.next`。
4. 直接进入服务重启；不要先清理候选工件，也不要在生产检出补跑一次 `next build`。

## 预期结果

同一卷的 `$candidateNext` 包含当前已提交版本的完整 `BUILD_ID`，构建日志可供审查，临时工作树已正常注销。旧生产进程、生产依赖目录和 `$repo\.next` 在整个构建阶段均未变化，候选工件尚未生效。

## 故障处理与恢复

- 另一个构建活跃时等待或与其 owner 协调；不得启动第二个构建，也不得删除其锁。
- 候选构建失败时不得重启生产服务。活跃 `$repo\.next` 和生产 `node_modules` 未被接触，因此服务继续使用旧工件；保留部署锁、构建日志、候选工作树和已记录 Generation 批次进行诊断。
- `Another next build process is already running` 只允许在候选工作树内诊断。证明没有候选构建进程后，也只能处理 `$candidateWorktree\.next\lock`；绝不能查看或删除活跃 `$repo\.next\lock`。
- 失败路径始终恢复调用方原有 `DB_PROVIDER` 并移除候选 `.env` 副本。确认路径归属和诊断证据后，只递归清理精确候选 `node_modules` 与两套 `src/generated` 目录，再用 `git worktree remove` 清理候选工作树；不得使用 `--force` 掩盖未知文件。
- `$candidateNext` 已生成但尚未切换时，生产状态没有改变。可以保留它供本次部署重试，或在核对精确路径后清理；绝不能在旧监听仍存在时替换 `$repo\.next`。

## 验证状态

本流程尚未实际演练。当前 `verifiedBy` 只静态检查分离式工作树、同卷路径、独立依赖安装、候选构建命令、活跃工件隔离和清理边界，不执行依赖安装、生产构建、工件移动、临时配置复制或工作树创建与删除。

## 上级导航

- [返回生产部署运行手册](./README.md)
