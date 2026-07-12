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
    - 成功构建后替换本仓库 Next.js 生产进程时
    - 诊断生产服务重启失败时
  sources:
    - AGENTS.md
    - package.json
    - .gitignore
  verifiedBy:
    - powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/runbook-contract-harness.ps1
    - npm run docs:check
  environment:
    - 本地 Windows 生产检出，或通过 SSH 到达的同一 mypc 检出
  risk: 只停止精确的仓库范围 Next.js 生产进程树；绝不停止所有 Node 进程，也不接触 Next.js 开发服务。
  recovery: "#故障处理与恢复"
  verificationState: not-exercised
  lastVerified: null
---

# 生产服务重启

## 适用场景

只有在部署锁内成功完成生产构建后才使用本流程。重启后必须立即进行[部署验证](./verification.md)。

绝不能使用 `Stop-Process -Name node -Force`。不得停止 `next dev`、队列 worker、Codex、编辑器或无关 Node 服务。

## 前置条件

- 必需构建已在该目标检出成功完成。
- 部署锁与 worker 状态门仍然有效。
- 识别精确的仓库范围 `next start` 根进程及其所有 Node 后代。归属有歧义时停止流程，不终止任何进程。

## 操作步骤

1. 解析生产进程树。仓库路径与 `next start` 命令共同识别根进程；扩展后代可以捕获监听进程，而不会扩大到其他 Node 应用：

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
   ```

2. 确认所有选中 PID 都不属于 `next dev`，再只停止该精确进程树，并优先停止最新子进程：

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
     throw "旧生产监听仍未消失；保留锁且不要启动替代进程。"
   }
   ```

3. 只有旧监听消失后，才能在隐藏窗口启动生产服务。保持既有运行时日志名 `server.log` 与 `server.err.log`。不得假设端口；启动后再发现监听：

   ```powershell
   # runbook-contract: production-service-start
   $arguments = "/c cd /d `"$repo`" && npx next start > server.log 2> server.err.log"
   Start-Process -FilePath "cmd.exe" -ArgumentList $arguments -WindowStyle Hidden
   ```

4. 通过 SSH 向 `mypc` 传输同一命令时，使用 Windows 进程创建器，使其在 SSH 会话结束后继续运行：

   ```powershell
   wmic process call create "cmd /c cd /d D:\Luca\Code\MyProject\comfyui-manager && npx next start > server.log 2> server.err.log"
   ```

   `wmic` 不提供正常交互式命令行环境；应调用 `npx next start`，而不是裸 `next start`。

5. 重复进程树发现，并使用 `Get-NetTCPConnection -State Listen` 定位新进程树拥有的端口。不得硬编码 3000 或 3001；随后立即进入部署验证。

## 预期结果

该检出的旧生产进程树已消失，一个新的仓库范围 `next start` 进程树拥有已发现监听，并且开发或无关 Node 进程均未变化。

## 故障处理与恢复

- 进程匹配返回零个或多个根进程时，不停止任何进程。报告安全的 PID 与命令类别证据并保留锁。
- 有界等待后选中的旧监听仍存在时，不得启动第二个生产服务。保留锁并检查精确的选中 PID。
- 启动后没有监听时检查 `server.log` 与 `server.err.log`；不得为释放假定端口而终止无关 Node 进程。
- 新服务失败时保留部署锁与已记录 Generation 批次。回滚到旧构建或旧进程命令需要明确恢复决策。
- 验证成功前不得释放锁或恢复 Generation。

## 验证状态

本流程尚未实际演练。当前 `verifiedBy` 只检查仓库范围进程筛选、监听归属、启动命令和受控 PowerShell 合同，不停止或启动任何真实进程，也不执行 SSH 启动路径。

## 上级导航

- [返回生产部署运行手册](./README.md)
