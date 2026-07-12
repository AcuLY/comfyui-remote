---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: deployment-operations
  authority:
    subject: operations/deployment-lock
    kind: operational
  readWhen:
    - 获取、等待、更新、保留或释放生产部署互斥锁时
  sources:
    - AGENTS.md
    - .gitignore
  verifiedBy:
    - powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/runbook-contract-harness.ps1
    - npm run docs:check
  environment:
    - 将要执行运行时部署操作的 Windows 生产检出
  risk: 锁必须覆盖目标端的每次部署修改；部署失败或未完整恢复时必须保留锁。
  recovery: "#故障处理与恢复"
  verificationState: not-exercised
  lastVerified: null
---

# 部署锁

## 适用场景

在目标机器执行部署拉取、暂停 Generation 队列、同步 Prisma、生产构建、停止/重启生产进程、公开验证或队列恢复前，必须使用 `.deploy.lock` 互斥锁。Git 暂存、提交与推送发生在锁外；纯开发服务操作也不使用该锁。

## 前置条件

- 接触锁之前解析精确的目标检出。本地检出与 `mypc` 检出具有独立运行时状态。
- 不得先用 `Test-Path` 判断是否可获取；锁归属只由原子创建目录决定。
- 后续任何阶段失败时都要准备保留锁。

## 操作步骤

1. 为本次尝试确定稳定责任方和一个不可预测的获取令牌，再原子创建目录。获取锁的 `try/catch` 只包含 `New-Item`；元数据初始化有意放在其外，避免元数据写入失败后让当前责任方回到循环中等待自己的目录。只有创建失败后确认同名目录确实存在，才将失败视为锁竞争；权限、磁盘、无效路径等非竞争错误必须立即原样抛出。重试从五秒开始，按指数退避且最多 120 秒，30 分钟后停止：

   ```powershell
   # runbook-contract: deployment-lock-acquire
   $repo = (Resolve-Path "D:\Luca\Code\MyProject\comfyui-manager").Path
   $lockDir = Join-Path $repo ".deploy.lock"
   $lockMeta = Join-Path $lockDir "owner.json"
   $lockOwner = "$env:USERNAME@$env:COMPUTERNAME"
   $acquisitionToken = [guid]::NewGuid().ToString("N")
   $lockStartedAt = (Get-Date).ToString("o")
   $deadline = (Get-Date).AddMinutes(30)
   $sleepSeconds = 5
   $lockAcquired = $false

   while (-not $lockAcquired) {
     try {
       New-Item -ItemType Directory -Path $lockDir -ErrorAction Stop | Out-Null
       $lockAcquired = $true
     } catch {
       $createError = $_
       $competingLockExists = Test-Path -LiteralPath $lockDir -PathType Container
       if (-not $competingLockExists) {
         throw $createError
       }
       if ((Get-Date) -ge $deadline) {
         if (Test-Path -LiteralPath $lockMeta) { Get-Content -LiteralPath $lockMeta -Raw }
         throw "等待 30 分钟后部署锁仍被占用；停止本次部署。"
       }
       if (Test-Path -LiteralPath $lockMeta) { Get-Content -LiteralPath $lockMeta -Raw }
       Start-Sleep -Seconds $sleepSeconds
       $sleepSeconds = [Math]::Min($sleepSeconds * 2, 120)
     }
   }
   ```

2. 获取循环完成后只初始化一次元数据，并验证已发布的 owner/token 仍属于本次尝试。使用 `git -C $repo`，避免从调用方的无关工作目录读取分支。元数据初始化失败时，停止并保留已获取目录以便显式恢复；不得重新进入获取循环。

   ```powershell
   $pausedGenerationBatches = @()
   $lockPayload = @{
     acquisitionToken = $acquisitionToken
     owner = $lockOwner
     pid = $PID
     startedAt = $lockStartedAt
     cwd = $repo
     branch = (git -C $repo rev-parse --abbrev-ref HEAD 2>$null)
     phase = "acquired"
     pausedGenerationBatches = @($pausedGenerationBatches)
   }
   $lockPayload | ConvertTo-Json -Depth 6 |
     Set-Content -LiteralPath $lockMeta -Encoding utf8 -ErrorAction Stop
   $publishedLock = Get-Content -LiteralPath $lockMeta -Raw -Encoding utf8 |
     ConvertFrom-Json
   if ($publishedLock.acquisitionToken -ne $acquisitionToken -or
       $publishedLock.owner -ne $lockOwner) {
     throw "部署锁元数据的归属验证失败。"
   }
   ```

3. 阶段变化时使用全新哈希表重写 `owner.json`。先读取当前文件，同时要求 `acquisitionToken` 和 `owner` 匹配。如果队列安全流程在任一 worker 状态门记录了 Generation 工作，就把每个返回的 `batchId` 与其精确 `runIds` 保存到 `pausedGenerationBatches`。锁元数据中绝不能写入认证 token。

   ```powershell
   function Write-DeploymentLockState([string]$Phase) {
     $currentLock = Get-Content -LiteralPath $lockMeta -Raw -Encoding utf8 |
       ConvertFrom-Json
     if ($currentLock.acquisitionToken -ne $acquisitionToken -or
         $currentLock.owner -ne $lockOwner) {
       throw "拒绝更新属于其他获取尝试的部署锁。"
     }
     $freshPayload = @{
       acquisitionToken = $acquisitionToken
       owner = $lockOwner
       pid = $PID
       startedAt = $lockStartedAt
       cwd = $repo
       branch = (git -C $repo rev-parse --abbrev-ref HEAD 2>$null)
       phase = $Phase
       pausedGenerationBatches = @($pausedGenerationBatches)
     }
     $freshPayload | ConvertTo-Json -Depth 6 |
       Set-Content -LiteralPath $lockMeta -Encoding utf8 -ErrorAction Stop
   }
   ```

4. 在目标拉取、两次 worker 状态检查、所有 Generation 暂停、数据库同步、构建、重启、本地/公开验证以及恢复本次部署的 Generation 批次期间，始终保留锁。

5. 只有验证成功且本次部署暂停的 Generation 工作全部恢复后才能释放锁。只删除该目录前，先确认字面路径并立即重新读取归属：

   ```powershell
   $expected = Join-Path $repo ".deploy.lock"
   if ($lockDir -ne $expected) {
     throw "拒绝释放非预期锁路径。"
   }
   $currentLock = Get-Content -LiteralPath $lockMeta -Raw -Encoding utf8 |
     ConvertFrom-Json
   if ($currentLock.acquisitionToken -ne $acquisitionToken -or
       $currentLock.owner -ne $lockOwner) {
     throw "拒绝释放属于其他获取尝试的部署锁。"
   }
   Remove-Item -LiteralPath $lockDir -Recurse -Force
   ```

## 预期结果

目标检出最多只归一次部署所有。元数据标识责任方、PID、获取令牌、开始时间、检出、分支和当前阶段；如有暂停记录，也只包含该次部署暂停的 Generation 批次。

## 故障处理与恢复

- 其他 owner 持锁时，检查其元数据并等待；不得并行部署，未经用户确认也不得把其目录当作“过期”目录删除。
- 达到 30 分钟期限后停止，报告安全的 owner 元数据和当前操作；没有互斥锁不得继续。
- 当前进程创建目录后无法发布初始元数据时，不得重试获取，也不得继续部署。报告精确锁路径以便显式恢复。
- 构建、重启、验证或 Generation 恢复失败时，重写失败 phase 并保留锁。只有查明失败且已恢复记录批次，或用户批准其他恢复方案后，才能释放。
- 不得仅因为路径存在就释放。获取令牌或责任方缺失/不匹配时，停止并保留目录。
- `.deploy.lock/**` 是运行时状态，绝不能暂存或提交。

## 验证状态

本流程尚未实际演练。当前 `verifiedBy` 只通过静态检查和受控 PowerShell 合同验证锁范围、忽略规则、重试边界、元数据合同和释放条件，不获取、等待、写入或释放真实部署锁。

## 上级导航

- [返回生产部署运行手册](./README.md)
