---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: development-operations
  authority:
    subject: operations/development-service
    kind: operational
  readWhen:
    - 启动、停止、重启或定位本仓库 Next.js 开发服务时
  sources:
    - AGENTS.md
    - package.json
    - .gitignore
  verifiedBy:
    - npm run docs:check
  environment:
    - 用于开发的本地 Windows 检出
  risk: 停止 PID 前必须同时匹配仓库、Next.js 开发命令与目标监听端口；绝不停止 Next.js 生产服务或无关 Node 进程。
  recovery: "#故障处理与恢复"
  verificationState: not-exercised
  lastVerified: null
---

# 开发服务

## 适用场景

本流程只用于定位、启动、停止、重启或验证当前检出的 `npm run dev` / `next dev` 服务。开发服务不是生产部署。

纯开发服务管理任务不得获取 `.deploy.lock`、同步 Prisma、清理 `.next`、运行 `next build`、暂停或恢复队列、停止 `next start`、执行公开验证或运行 Git 交付。

## 前置条件

- 在 `D:\Luca\Code\MyProject\comfyui-manager` 中操作，或把下文 `$repo` 替换为解析后的当前检出。
- 启动新进程前选择目标开发端口。不得假设现有服务使用 3000；生产服务也可能配置在该端口。
- 保留 `.next/dev`；启动或重启开发服务不得清理 `.next`。

## 操作步骤

### 发现仓库范围服务及其真实端口

1. 只查找命令行同时包含本仓库与 `next dev` 的 Node 根进程。为每个根进程单独构建后代集合，避免端口选择扩大到另一棵开发进程树：

   ```powershell
   # runbook-contract: development-service-discovery
   $repo = (Resolve-Path "D:\Luca\Code\MyProject\comfyui-manager").Path
   $nodes = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'")
   $devRoots = @($nodes | Where-Object {
     $_.CommandLine -like "*$repo*" -and $_.CommandLine -match 'next.*\bdev\b'
   })

   function Get-NodeTreePids([int]$rootPid, [object[]]$allNodes) {
     $pids = [System.Collections.Generic.HashSet[int]]::new()
     [void]$pids.Add($rootPid)
     do {
       $added = $false
       foreach ($process in $allNodes) {
         if ($pids.Contains([int]$process.ParentProcessId) -and
             $pids.Add([int]$process.ProcessId)) {
           $added = $true
         }
       }
     } while ($added)
     return ,$pids
   }

   $devTrees = @($devRoots | ForEach-Object {
     $pids = Get-NodeTreePids -rootPid $_.ProcessId -allNodes $nodes
     $listeners = @(Get-NetTCPConnection -State Listen | Where-Object {
       $pids.Contains([int]$_.OwningProcess)
     })
     [pscustomobject]@{ RootPid = $_.ProcessId; Pids = $pids; Listeners = $listeners }
   })
   $devTrees | ForEach-Object { $_.Listeners } |
     Select-Object LocalAddress, LocalPort, OwningProcess
   ```

2. 以报告的监听为准。没有监听表示服务尚未就绪；存在多个可能监听时，检查精确进程树并停止，不得猜测端口。

### 启动服务

3. 显式设置已批准的空闲端口，再在隐藏后台窗口启动。日志文件属于本地运行时工件，必须保持未跟踪：

   ```powershell
   # runbook-contract: development-service-start
   $repo = (Resolve-Path "D:\Luca\Code\MyProject\comfyui-manager").Path
   $port = [int]$env:COMFY_MANAGER_DEV_PORT
   if ($port -lt 1) { throw "请把 COMFY_MANAGER_DEV_PORT 设置为目标开发端口。" }
   $arguments = "/c cd /d `"$repo`" && npx next dev -p $port > server-dev-$port.log 2> server-dev-$port.err.log"
   Start-Process -FilePath "cmd.exe" -ArgumentList $arguments -WindowStyle Hidden
   ```

4. 重复发现。只有仓库范围 `next dev` 进程树拥有目标监听，且 `http://127.0.0.1:$port/login` 正常响应后才能继续。

### 停止或重启服务

5. 选中拥有目标端口的唯一开发进程树，再只停止该树中的精确 PID，并优先停止子进程。绝不能使用 `Stop-Process -Name node -Force`：

   ```powershell
   # runbook-contract: development-service-stop
   $port = [int]$env:COMFY_MANAGER_DEV_PORT
   $matches = @($devTrees | Where-Object { $_.Listeners.LocalPort -contains $port })
   if ($matches.Count -ne 1) { throw "目标端口上必须恰好有一棵仓库范围 next dev 进程树。" }
   $selectedPids = $matches[0].Pids
   $targets = @($nodes | Where-Object { $selectedPids.Contains([int]$_.ProcessId) } |
     Sort-Object CreationDate -Descending)
   foreach ($process in $targets) {
     Stop-Process -Id $process.ProcessId -Force -Confirm:$false
   }
   ```

6. 确认精确监听已消失。需要重启时重复启动与验证步骤；不得接触仓库范围 `next start` 进程。

## 预期结果

一个显式选定的开发端口由当前检出的 `next dev` 进程树拥有，`/login` 可通过该已发现端口访问，生产与无关 Node 进程保持不变。

## 故障处理与恢复

- 进程归属或监听有歧义时，不停止任何进程。报告候选 PID、命令类别与端口，不输出环境秘密。
- 启动失败时只检查 `server-dev-$port.log` 与 `server-dev-$port.err.log`；保留 `.next/dev` 与全部生产状态。
- 目标端口被其他进程占用时，选择另一个已批准端口或与其 owner 协调；不得仅为收回端口而终止占用者。

## 验证状态

本服务控制流程尚未实际演练。当前 `verifiedBy` 只检查进程筛选、监听归属和受控 PowerShell 合同，不启动、停止或重启开发服务。

## 上级导航

- [返回开发环境运行手册](./README.md)
