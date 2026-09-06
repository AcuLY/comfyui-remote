---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: deployment-operations
  authority:
    subject: operations/production-service-restart
    kind: operational
  readWhen:
    - 候选构建成功后替换本仓库 Next.js 生产进程与工件时
    - 诊断生产服务重启或工件切换失败时
  sources:
    - AGENTS.md
    - package.json
    - .gitignore
    - docs/runbooks/deployment/next-build.md
  verifiedBy:
    - powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/runbook-contract-harness.ps1
    - npm run docs:check
  environment:
    - 本地 Windows 生产检出，或通过 SSH 到达的同一 mypc 检出
  risk: 只停止精确的仓库范围 Next.js 生产进程树；旧监听消失后才切换同卷候选工件，并在原监听端口启动替代服务。
  recovery: "#故障处理与恢复"
  verificationState: exercised
  lastVerified: "2026-07-13"
---

# 生产服务与工件重启

## 适用场景

只有在部署锁内通过[生产候选构建](./next-build.md)生成并记录 `$candidateNext`、`$deploymentId`、`$deploymentCommit` 与 `$buildLog` 后才使用本流程。旧监听完全消失前不得移动活跃 `$repo\.next`；候选工件切换后必须在旧服务的同一端口启动，并立即进行[部署验证](./verification.md)。

绝不能使用 `Stop-Process -Name node -Force`。不得停止 `next dev`、队列 worker、Codex、编辑器或无关 Node 服务。

## 前置条件

- 候选工件包含 `BUILD_ID`，位于生产检出同一卷的相邻目录，并且路径与构建阶段记录完全一致。
- 活跃 `$repo\.next` 仍由旧 `next start` 使用；构建阶段没有修改它。
- 部署锁与 worker 状态门仍然有效。
- 能够识别精确的仓库范围 `next start` 根进程及其所有 Node 后代。归属、监听端口或候选工件有歧义时停止流程，不终止任何进程，也不切换工件。

## 操作步骤

1. 解析生产进程树和唯一服务端口。仓库路径与 `next start` 命令共同识别根进程；扩展后代可以捕获监听进程，而不会扩大到其他 Node 应用。同一端口可能同时有 IPv4 和 IPv6 监听，因此从 `$oldListeners` 去重端口，而不是要求监听记录只有一条：

   ```powershell
   # runbook-contract: production-service-discovery
   $repo = (Resolve-Path "D:\Luca\Code\MyProject\comfyui-manager").Path
   $nodes = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'")
   $prodRoots = @($nodes | Where-Object {
     $_.CommandLine -like "*$repo*" -and $_.CommandLine -match 'next.*\bstart\b'
   })
   if ($prodRoots.Count -ne 1) {
     throw "必须恰好找到一个仓库范围 next start 根进程。"
   }

   $prodPids = [System.Collections.Generic.HashSet[int]]::new()
   foreach ($process in $prodRoots) { [void]$prodPids.Add([int]$process.ProcessId) }
   do {
     $added = $false
     foreach ($process in $nodes) {
       if ($prodPids.Contains([int]$process.ParentProcessId) -and
           $prodPids.Add([int]$process.ProcessId)) {
         $added = $true
       }
     }
   } while ($added)

   $oldListeners = @(Get-NetTCPConnection -State Listen | Where-Object {
     $prodPids.Contains([int]$_.OwningProcess)
   })
   if ($oldListeners.Count -eq 0) {
     throw "仓库范围生产进程树没有监听端口；停止并诊断。"
   }
   $servicePorts = @($oldListeners |
     ForEach-Object { [int]$_.LocalPort } |
     Sort-Object -Unique)
   if ($servicePorts.Count -ne 1) {
     throw "旧生产进程树必须恰好拥有一个唯一监听端口。"
   }
   $servicePort = [int]$servicePorts[0]
   ```

2. 在停止旧服务前完成候选工件预检。候选路径必须与构建阶段记录一致、与生产检出同级且同卷；必需清单、服务端目录和静态目录必须完整，备份路径也必须尚不存在。任何检查失败都保持旧服务运行：

   ```powershell
   # runbook-contract: production-artifact-preflight
   $repoParent = Split-Path -Parent $repo
   $activeNext = Join-Path $repo ".next"
   $candidateNext = [System.IO.Path]::GetFullPath($candidateNext)
   $expectedCandidateNext = [System.IO.Path]::GetFullPath(
     (Join-Path $repoParent ".comfyui-manager-next-$deploymentId")
   )
   $backupNext = Join-Path $repoParent ".comfyui-manager-next-backup-$deploymentId"
   $activeBuildIdPath = Join-Path $activeNext "BUILD_ID"

   if (-not [string]::Equals(
       $candidateNext,
       $expectedCandidateNext,
       [System.StringComparison]::OrdinalIgnoreCase
     )) {
     throw "候选工件路径与本次 deploymentId 的构建记录不一致。"
   }
   if (-not [string]::Equals(
       (Split-Path -Parent $candidateNext),
       $repoParent,
       [System.StringComparison]::OrdinalIgnoreCase
     )) {
     throw "候选工件必须是生产检出同级的构建阶段记录路径。"
   }
   if (-not [string]::Equals(
       [System.IO.Path]::GetPathRoot($candidateNext),
       [System.IO.Path]::GetPathRoot($repo),
       [System.StringComparison]::OrdinalIgnoreCase
     )) {
     throw "候选工件与生产检出不在同一卷。"
   }
   $candidateRequiredFiles = @(
       "BUILD_ID",
       "build-manifest.json",
       "routes-manifest.json",
       "required-server-files.json"
     )
   foreach ($requiredFile in $candidateRequiredFiles) {
     if (-not (Test-Path -LiteralPath (Join-Path $candidateNext $requiredFile) -PathType Leaf)) {
       throw "候选工件缺少必需文件：$requiredFile"
     }
   }
   $candidateRequiredDirectories = @("server", "static")
   foreach ($requiredDirectory in $candidateRequiredDirectories) {
     if (-not (Test-Path -LiteralPath (Join-Path $candidateNext $requiredDirectory) -PathType Container)) {
       throw "候选工件缺少必需目录：$requiredDirectory"
     }
   }
   if (-not (Test-Path -LiteralPath $activeBuildIdPath -PathType Leaf)) {
     throw "活跃生产工件缺少 BUILD_ID；不得自动替换。"
   }
   if (Test-Path -LiteralPath $backupNext) {
     throw "备份路径已存在；不得覆盖未知旧工件。"
   }

   $candidateBuildId = (Get-Content -LiteralPath (Join-Path $candidateNext "BUILD_ID") -Raw -Encoding utf8).Trim()
   $previousBuildId = (Get-Content -LiteralPath $activeBuildIdPath -Raw -Encoding utf8).Trim()
   if (-not $candidateBuildId -or -not $previousBuildId) {
     throw "候选或活跃 BUILD_ID 为空。"
   }
   $candidateServerFiles = Get-Content -LiteralPath (Join-Path $candidateNext "required-server-files.json") -Raw -Encoding utf8 | ConvertFrom-Json
   if ($candidateServerFiles.config.distDir -ne ".next") {
     throw "候选 required-server-files.json 的 distDir 不是 .next。"
   }
   ```

3. 确认所有选中 PID 都不属于 `next dev`，再只停止该精确进程树，并优先停止最新子进程：

   ```powershell
   # runbook-contract: production-service-stop
   $targets = @($nodes | Where-Object { $prodPids.Contains([int]$_.ProcessId) } |
     Sort-Object CreationDate -Descending)
   if ($targets.CommandLine -match 'next.*\bdev\b') {
     throw "拒绝停止包含 next dev 的进程树。"
   }
   foreach ($process in $targets) {
     Stop-Process -Id $process.ProcessId -Force -Confirm:$false
   }

   $stopDeadline = (Get-Date).AddSeconds(15)
   do {
     $remainingListeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
       Where-Object { $prodPids.Contains([int]$_.OwningProcess) })
     if ($remainingListeners.Count -eq 0) { break }
     Start-Sleep -Milliseconds 250
   } while ((Get-Date) -lt $stopDeadline)
   if ($remainingListeners.Count -ne 0) {
     throw "旧生产监听仍未消失；保留锁且不要切换工件或启动替代进程。"
   }
   ```

4. 只有旧监听消失后，才把活跃工件备份到已预检的同卷相邻目录，再把已预检的候选工件移到 `$repo\.next`。第一次移动失败时旧工件保持原位；第二次移动失败且活跃路径为空时，立即恢复备份。这里是受控同卷切换，不承诺 Windows 目录移动在所有文件系统和故障条件下具有原子性：

   ```powershell
   # runbook-contract: production-artifact-swap
   foreach ($requiredFile in $candidateRequiredFiles) {
     if (-not (Test-Path -LiteralPath (Join-Path $candidateNext $requiredFile) -PathType Leaf)) {
       throw "停服后复核发现候选文件缺失；保持旧工件原位。"
     }
   }
   foreach ($requiredDirectory in $candidateRequiredDirectories) {
     if (-not (Test-Path -LiteralPath (Join-Path $candidateNext $requiredDirectory) -PathType Container)) {
       throw "停服后复核发现候选目录缺失；保持旧工件原位。"
     }
   }
   $currentCandidateBuildId = (Get-Content -LiteralPath (Join-Path $candidateNext "BUILD_ID") -Raw -Encoding utf8).Trim()
   $currentPreviousBuildId = (Get-Content -LiteralPath (Join-Path $activeNext "BUILD_ID") -Raw -Encoding utf8).Trim()
   if ($currentCandidateBuildId -ne $candidateBuildId -or $currentPreviousBuildId -ne $previousBuildId) {
     throw "停服后的工件复核与停服前预检不一致；拒绝切换。"
   }
   if (Test-Path -LiteralPath $backupNext) {
     throw "停服后备份路径出现冲突；保持旧工件原位。"
   }
   Move-Item -LiteralPath $activeNext -Destination $backupNext -ErrorAction Stop
   try {
     Move-Item -LiteralPath $candidateNext -Destination $activeNext -ErrorAction Stop
   } catch {
     $swapError = $_
     if (-not (Test-Path -LiteralPath $activeNext) -and
         (Test-Path -LiteralPath $backupNext -PathType Container)) {
       try {
         Move-Item -LiteralPath $backupNext -Destination $activeNext -ErrorAction Stop
       } catch {
         throw "候选工件切换失败，旧工件自动恢复也失败；不得启动服务。"
       }
     }
     throw $swapError
   }
   ```

5. 只有候选工件已就位且备份仍保留时，才在隐藏窗口以第 1 步记录的 `$servicePort` 启动生产服务。保持既有运行时日志名 `server.log` 与 `server.err.log`：

   ```powershell
   # runbook-contract: production-service-start
   $arguments = "/c cd /d `"$repo`" && npx next start -p $servicePort > server.log 2> server.err.log"
   Start-Process -FilePath "cmd.exe" -ArgumentList $arguments -WindowStyle Hidden
   ```

6. 通过 SSH 向 `mypc` 传输同一命令时，仍使用构建阶段和第 1 步记录的精确 `$repo` 与 `$servicePort`，并使用 Windows 进程创建器使服务在 SSH 会话结束后继续运行：

   ```powershell
   $wmicCommand = "cmd /c cd /d `"$repo`" && npx next start -p $servicePort > server.log 2> server.err.log"
   wmic process call create $wmicCommand
   ```

   `wmic` 不提供正常交互式命令行环境；应调用 `npx next start -p $servicePort`，而不是裸 `next start` 或默认端口启动。

7. 重复第 1 步的进程树发现，定位新进程树拥有的监听。新监听的唯一端口必须等于 `$servicePort`；不得接受自动回退到 3000、3001 或其他空闲端口。随后立即进入部署验证，并在验证成功前保留 `$backupNext`。

## 预期结果

旧生产进程树和监听已消失，旧工件安全保存在 `$backupNext`，候选工件成为新的 `$repo\.next`。新的仓库范围 `next start` 进程树在原 `$servicePort` 监听，开发或无关 Node 进程均未变化。

## 故障处理与恢复

- 进程匹配返回零个或多个根进程，或 `$oldListeners` 对应多个唯一端口时，不停止任何进程。报告安全的 PID、命令类别和端口数量证据并保留锁。
- 有界等待后选中的旧监听仍存在时，不得切换 `.next`，也不得启动第二个生产服务。保留锁并检查精确的选中 PID。
- 候选路径、卷、完整性、`BUILD_ID` 或备份路径在停服前检查失败时，不停止旧服务。停服后的再次复核失败时，旧 `.next` 仍在原位；用同一 `$servicePort` 重新启动旧工件并完成验证。候选移动失败后，只有活跃路径为空时才自动恢复 `$backupNext`；自动恢复失败时绝不能启动服务。
- 新服务没有在 `$servicePort` 监听或部署验证失败时，保留锁与已记录 Generation 批次，并执行精确回滚：先按本手册的进程归属规则停止新进程树并确认其监听消失；再把失败候选从 `$repo\.next` 移到尚不存在的同卷隔离路径，把 `$backupNext` 恢复为 `$repo\.next`；最后用同一 `$servicePort` 启动旧工件并完整验证。任一步有歧义都停止，不覆盖目录，也不终止无关进程。
- 旧工件恢复并验证成功前不得释放锁或恢复 Generation。新工件完整验证且本次暂停的 Generation 已恢复后，才能核对并清理 `$backupNext`、失败候选、构建日志或遗留 Git 工作树；只清理本次 `$deploymentId` 的精确路径。

## 验证状态

本流程已于 2026-07-13 在本地 Windows 生产检出演练：只停止唯一的仓库范围 `next start` 进程树，确认旧监听消失后备份旧 `.next`、切换候选工件，并在原端口 `3000` 启动新实例；新 `BUILD_ID` 与候选一致，完整验证后才关闭回滚窗口。该次没有触发自动回滚，也没有执行通过 SSH 向 `mypc` 启动服务的变体；这些路径继续由受控合同覆盖。脱敏证据见 `openspec/changes/rebuild-documentation-governance/evidence/2026-07-13-workflow-production-migration.md`。

## 上级导航

- [返回生产部署运行手册](./README.md)
