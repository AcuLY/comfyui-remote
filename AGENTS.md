<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:auth-debug-rules -->
# UI auth for local verification

When UI verification redirects to `/login` or otherwise needs an authenticated
session, read the login token from the project-root `.env` file and use it to
log in. Do not hard-code the token, print it in logs, or commit token values.
<!-- END:auth-debug-rules -->

<!-- BEGIN:subagent-development-rules -->
# 子代理开发规则

- 当已经制定开发计划，并且计划中存在多个没有明显强耦合、可以并行推进的模块或任务时，推荐使用子代理完成实际代码或文档更改。
- 启用子代理时，主代理负责拆分边界、提供上下文、明确每个子代理的负责范围、允许修改的目录/文件和验收标准。
- 子代理返回后，主代理必须检查改动是否冲突、是否遗漏计划项、是否引入旧兼容路径或临时绕法，并在必要时继续派发返工任务。
<!-- END:subagent-development-rules -->

<!-- BEGIN:deploy-rules -->
# 部署流程

轻量改动例外：

- 只有当改动不改变运行时行为时，才可以视为轻量改动；典型例子包括纯样式微调、文案修正、原型/说明文档更新，或其他可直接人工查看且不需要上线验证的改动。
- 像可独立验收的 bug 修复、小 feature、交互/路由/数据流变化，或任何会影响线上运行时行为的修改，即使代码量很小，也默认不属于轻量改动；除非用户明确要求“不提交”“不推送”或“先不部署”，否则应按完整流程收口。
- 判断是否跳过提交和部署时，优先看改动是否需要通过提交、构建、重启或线上验证来证明结果；代码量只作为参考。
- 轻量改动默认跳过代码检查、`git add`、`git commit`、`git push`、构建、部署和公网验证。
- 只有当用户明确要求“检查”“提交”“推送”“部署”“这一批好了”等收口动作时，才对轻量改动执行对应流程。
- 如果无法确定改动是否轻量，或改动可能影响运行时行为，继续按完整部署流程执行。

开发服务管理例外：

- 如果任务仅限启动、停止、重启或验证 `npm run dev` / `next dev` 开发服务（例如把 3000 改成开发服务），不属于完整部署，不需要获取 `.deploy.lock`。
- 仅管理开发服务时，不要执行 `git add`、`git commit`、`git push`、Prisma 同步、`.next` 清理、`next build`、队列暂停/恢复、生产服务重启或公网验证。
- 启动开发服务时不要清理 `.next`；Next.js 16 的开发输出位于 `.next/dev`，可以与生产 build 输出分开。
- 重启开发服务时，只能停止当前项目目录下目标端口对应的 `next dev` 进程；不要停止 `next start`、队列 worker、Codex/CodeBuddy 进程或其它 node 进程。
- 在 `mypc` 本机启动开发服务时，用隐藏窗口后台静默启动，不要弹出额外终端窗口：
  ```powershell
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d D:\Luca\Code\MyProject\comfyui-manager && npx next dev -p 3000 > server-dev-3000.log 2> server-dev-3000.err.log" -WindowStyle Hidden
  ```
- 开发服务验证只需要检查本地地址，例如 `http://localhost:3000/login`；不要把开发服务验证升级为公网部署验证。

混合服务任务：

- 如果同一个请求同时包含生产服务和开发服务操作（例如 3001 起生产服务、3000 起开发服务），生产服务相关的构建、`next start`、队列处理和验证仍然必须按完整部署流程执行并获取 `.deploy.lock`。
- 混合任务中的开发服务部分不需要单独获取部署锁，但不得清理 `.next`、不得触发 `next build`，也不得停止或重启生产服务。
- 优先完成生产 build/启动/验证后，再启动或重启开发服务；这样可以避免开发服务操作干扰生产产物诊断。

`mypc` PowerShell 命令规则：

- 从 macOS/zsh 通过 SSH 执行 `mypc` 上的 PowerShell 时，如果命令包含管道、`$`/`$_`、通配符 `*`、括号、SQL、JSON、嵌套引号或多行逻辑，优先使用 `powershell -NoProfile -EncodedCommand`，避免命令被 zsh、ssh、cmd 或 PowerShell 中途错误解析。
- 复杂状态检查要拆成小命令分别执行，避免一个慢查询、进程枚举或网络请求挂住整个部署流程。
- 本地 zsh 下访问包含 `[]` 的路径时必须加引号，例如 `'src/app/assets/preset-groups/[groupId]/preset-group-edit-client.tsx'`。
- 生成 `EncodedCommand` 时使用 UTF-16LE 编码：
  ```bash
  script=$(cat <<'PS'
  Set-Location "D:\Luca\Code\MyProject\comfyui-manager"
  # PowerShell commands here
  PS
  )
  encoded=$(printf '%s' "$script" | iconv -f UTF-8 -t UTF-16LE | base64 | tr -d '\n')
  ssh mypc powershell -NoProfile -EncodedCommand "$encoded"
  ```

除轻量改动例外外，每次代码修改完成后，必须依次执行以下部署步骤：

1. 在执行任何完整部署动作前，必须先获取部署互斥锁，避免多个会话同时执行部署、构建、重启或队列恢复操作。
   - 锁目录固定为当前部署目标项目根目录下的 `.deploy.lock`，在本机 `mypc` 上即 `D:\Luca\Code\MyProject\comfyui-manager\.deploy.lock`。
   - 必须用 PowerShell 的原子目录创建获取锁，不要用 `Test-Path` 先判断再创建：
     ```powershell
     $lockDir = "D:\Luca\Code\MyProject\comfyui-manager\.deploy.lock"
     $lockMeta = Join-Path $lockDir "owner.json"
     $deadline = (Get-Date).AddMinutes(30)
     $sleepSeconds = 5

     while ($true) {
       try {
         New-Item -ItemType Directory -Path $lockDir -ErrorAction Stop | Out-Null

         @{
           owner = "$env:USERNAME@$env:COMPUTERNAME"
           pid = $PID
           startedAt = (Get-Date).ToString("o")
           cwd = (Get-Location).Path
           branch = (git rev-parse --abbrev-ref HEAD 2>$null)
           phase = "acquired"
         } | ConvertTo-Json | Set-Content -Encoding UTF8 $lockMeta
         break
       } catch {
         if ((Get-Date) -ge $deadline) {
           if (Test-Path $lockMeta) {
             Get-Content $lockMeta -Raw
           }
           throw "Deployment lock is still held after waiting 30 minutes. Stop this deployment."
         }

         if (Test-Path $lockMeta) {
           Get-Content $lockMeta -Raw
         }
         Start-Sleep -Seconds $sleepSeconds
         $sleepSeconds = [Math]::Min($sleepSeconds * 2, 120)
       }
     }
     ```
   - 锁必须覆盖后续 `git add`/`commit`/`push`、目标机 `git pull`、队列检查/暂停、Prisma、`.next` 清理、构建、停止/重启服务、公网验证和队列恢复。
   - 如果当前不在 `mypc` 且后续需要 SSH 到 `mypc` 部署，进入目标机项目目录后也必须先用同样规则获取目标目录的 `.deploy.lock`，再执行 `git pull` 或任何会影响服务的动作。
   - 获取锁后，应随着部署阶段更新 `owner.json` 的 `phase`；如果暂停了队列任务，必须把本次接口返回的 `batchId` 和 `runIds` 写入 `owner.json`。
   - 如果锁已经被占用，不要继续执行部署动作；读取 `owner.json` 后按指数退避等待锁释放，初始等待 5 秒、每次翻倍、单次等待最多 120 秒，总等待时间最多 30 分钟。
   - 等待期间每次重试仍必须使用原子目录创建获取锁，不要用 `Test-Path` 先判断再创建。
   - 如果等待 30 分钟后仍然无法获取锁，停止部署；读取 `owner.json` 后向用户报告当前持有者、进程、分支、阶段和开始时间。
   - 正常完成公网验证并恢复本次暂停的任务后，删除 `.deploy.lock` 释放锁；如果部署失败、验证失败、或存在尚未恢复的本次暂停任务，更新 `owner.json` 为失败阶段并保留锁，等待用户确认后再接管或清理。
   - `.deploy.lock/` 是运行时锁目录，不要提交到 git。
2. `git add` + `git commit` + `git push`（提交并推送到远程）。
3. 判断当前执行环境：
   - 如果当前机器的当前项目目录下已经有通过 `npm run dev` / `next dev` 或 `npm run start` / `next start` 启动的服务，无论是开发服务还是生产服务，都不要 SSH 到 `mypc`；直接在当前目录继续执行后续检查、验证或必要的本机服务处理。
   - 如果当前已经在 `mypc` 这台 Windows 设备，且仓库目录是 `D:\Luca\Code\MyProject\comfyui-manager`，不要 SSH，直接在当前目录继续执行后续步骤。
   - 如果当前不在 `mypc`，且当前项目目录下没有正在运行的本项目 dev/start 服务，才 SSH 到 `mypc`，在 `D:\Luca\Code\MyProject\comfyui-manager` 目录下 `git pull` 后继续执行后续步骤。
4. 在准备构建、清理 `.next`、停止或重启服务前，必须先检查当前队列/运行任务状态。
   - 如果这次改动不需要构建、清理 `.next`、停止或重启当前服务，只是在现有服务上做检查或验证，不要暂停当前队列。
   - 如果确实需要执行会影响当前服务的部署动作，且队列里仍有 queued/running 任务，先调用 `POST /api/queue/pause-active` 暂停当前活跃任务，并记录接口返回的 `batchId` 和 `runIds`。
   - 部署完成并验证通过后，再调用 `POST /api/queue/resume-paused`，优先用刚才记录的 `batchId` 或 `runIds` 恢复任务。
   - 恢复时只能恢复本次部署暂停的任务，不能恢复部署前就已经处于 paused 状态的任务。
5. 如果 Prisma schema 有变更，必须先根据当前部署目标和数据库连接选择 Prisma provider，再同步 schema。
   - 如果当前 `.env` 中 `DB_PROVIDER=sqlite`，或 `DATABASE_URL` 是 `file:` URL，本机部署使用 SQLite schema：
     ```powershell
     $env:DB_PROVIDER="sqlite"; npx prisma generate
     $env:DB_PROVIDER="sqlite"; npx prisma db push
     ```
   - 只有当当前部署目标确实使用 PostgreSQL，且 `DATABASE_URL` 以 `postgresql://` 或 `postgres://` 开头时，才执行：
     ```powershell
     $env:DB_PROVIDER="postgresql"; npx prisma generate
     $env:DB_PROVIDER="postgresql"; npx prisma db push
     ```
   - 不要在 SQLite 本机环境里强行执行 PostgreSQL `db push`，也不要为了通过命令临时改写 `.env` 里的数据库连接。
6. 构建前先处理 Next build 竞争，再清理 `.next` 缓存目录。
   - 构建前必须检查当前项目目录下是否已有 `next build` 或 `.next\build` 子进程：
     ```powershell
     Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
       Where-Object { $_.CommandLine -like '*D:\Luca\Code\MyProject\comfyui-manager*' -and ($_.CommandLine -like '*next*build*' -or $_.CommandLine -like '*.next\build*') }
     ```
   - 如果已有活跃 build 进程，不要启动第二个 build；等待该进程完成，或向用户报告当前构建进程信息后停止。
   - 如果 Next 报错 `Another next build process is already running`，先确认没有活跃 build / `.next\build` 进程；只有确认没有活跃构建后，才可以把 `.next\lock` 当作 stale lock 删除并重试。
   - build 失败时，把输出写入专门日志再诊断，例如 `build-prod.log`；先读取日志和 `.next/diagnostics`，不要连续盲目重试。
   - 运行生产 build 前再清理 `.next` 缓存目录，否则增量 build 可能产生过期的 static chunk（浏览器请求旧 chunk hash 时返回 500）：
   ```powershell
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
   ```
   然后执行 `npx next build` 构建项目。
   - 如果当前项目目录下已经有通过 `npm run dev` / `next dev` 启动的开发服务，不要清理 `.next` 缓存目录；清理会破坏正在运行的 dev 服务缓存并导致 500。此时跳过 `.next` 清理，并优先使用当前 dev 服务做验证。
7. 部署完成后必须访问网站验证，确保没有 500 或资源加载错误，直到所有请求正常。
8. 重启服务时，不要执行 `Stop-Process -Name node -Force`，因为这会误杀当前终端里的 CodeBuddy/Codex 进程。只停止当前项目目录下的 `next start` 进程，然后再启动服务：
   ```powershell
   $targets = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
     Where-Object { $_.CommandLine -like '*D:\Luca\Code\MyProject\comfyui-manager*' -and $_.CommandLine -like '*next*start*' }
   $targets | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false }
   ```
   - 如果当前项目目录下已经有通过 `npm run dev` / `next dev` 启动的开发服务，不要停止或重启它；开发服务由正在调试的人手动管理。只有检测到当前项目目录下的 `next start` 生产服务时，才按上面的过滤条件停止并重启。
   - 如果当前已经在 `mypc` 本机工作，必须用 PowerShell 的隐藏窗口后台静默启动，不要弹出额外终端窗口：
     ```powershell
     Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d D:\Luca\Code\MyProject\comfyui-manager && npx next start > server.log 2>&1" -WindowStyle Hidden
     ```
   - 如果当前不是在 `mypc` 本机，而是通过 SSH 在目标机执行，可继续使用：
     ```powershell
     wmic process call create "cmd /c cd /d D:\Luca\Code\MyProject\comfyui-manager && npx next start > server.log 2>&1"
     ```
   - 注意：`wmic` 不继承 PATH，必须用 `npx next start` 而非 `next start`；同时不要按进程名批量杀掉所有 `node.exe`。
9. 部署后验证网站可访问性，确认无 500 错误。
   - 本机生产服务验证检查对应端口，例如 `http://localhost:3001/login`。
   - 公网生产部署才使用 WebFetch 访问 `https://comfy.bgmss.fun/`。
   - 开发服务验证只检查本地开发端口，例如 `http://localhost:3000/login`。

运行时文件：

- `.deploy.lock/`、`server-dev-3000.log`、`server-dev-3000.err.log`、`server-prod-3001.log`、`server-prod-3001.err.log`、`build-prod*.log` 都是运行时文件，不要提交到 git。
<!-- END:deploy-rules -->
