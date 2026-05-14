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

- 当改动量涉及三个以上文件，或预计新增/修改超过一百行，并且不是简单批量替换、重命名、格式化或纯机械迁移时，必须让子代理完成实际代码或文档更改。
- 主代理只负责编排任务、拆分边界、提供上下文、验收结果、打回返工，并保证原计划被完整完成；不要在这种大改动中亲自承担主要实现工作。
- 如果多个改动之间没有明显耦合，优先启用多个子代理并行开发，并为每个子代理明确负责范围、允许修改的目录/文件和验收标准。
- 子代理返回后，主代理必须检查改动是否冲突、是否遗漏计划项、是否引入旧兼容路径或临时绕法，并在必要时继续派发返工任务。
<!-- END:subagent-development-rules -->

<!-- BEGIN:deploy-rules -->
# 部署流程

轻量改动例外：

- 如果改动仅限纯样式调整，或改动量很小且不涉及复杂逻辑、数据结构、接口、数据库、认证、队列、构建配置、依赖或服务启动流程，改完后直接回复用户即可。
- 轻量改动默认跳过代码检查、`git add`、`git commit`、`git push`、构建、部署和公网验证。
- 只有当用户明确要求“检查”“提交”“推送”“部署”“这一批好了”等收口动作时，才对轻量改动执行对应流程。
- 如果无法确定改动是否轻量，或改动可能影响运行时行为，继续按完整部署流程执行。

除轻量改动例外外，每次代码修改完成后，必须依次执行以下部署步骤：

1. `git add` + `git commit` + `git push`（提交并推送到远程）。
2. 判断当前执行环境：
   - 如果当前机器的当前项目目录下已经有通过 `npm run dev` / `next dev` 或 `npm run start` / `next start` 启动的服务，无论是开发服务还是生产服务，都不要 SSH 到 `mypc`；直接在当前目录继续执行后续检查、验证或必要的本机服务处理。
   - 如果当前已经在 `mypc` 这台 Windows 设备，且仓库目录是 `D:\Luca\Code\MyProject\comfyui-manager`，不要 SSH，直接在当前目录继续执行后续步骤。
   - 如果当前不在 `mypc`，且当前项目目录下没有正在运行的本项目 dev/start 服务，才 SSH 到 `mypc`，在 `D:\Luca\Code\MyProject\comfyui-manager` 目录下 `git pull` 后继续执行后续步骤。
3. 在准备构建、清理 `.next`、停止或重启服务前，必须先检查当前队列/运行任务状态；如果发现仍有 queued/running 任务，立刻停止后续部署动作，仅保留第 1 步的提交和推送结果，不要清理 `.next`、不要构建、不要停止或重启现有服务，并在回复里说明因为队列中仍有任务而延后部署。
4. 如果 Prisma schema 有变更：`$env:DB_PROVIDER="postgresql"; npx prisma generate` + `npx prisma db push`。
5. 构建前先清理 `.next` 缓存目录，否则增量 build 可能产生过期的 static chunk（浏览器请求旧 chunk hash 时返回 500）：
   ```powershell
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
   ```
   然后执行 `npx next build` 构建项目。
   - 如果当前项目目录下已经有通过 `npm run dev` / `next dev` 启动的开发服务，不要清理 `.next` 缓存目录；清理会破坏正在运行的 dev 服务缓存并导致 500。此时跳过 `.next` 清理，并优先使用当前 dev 服务做验证。
6. 部署完成后必须访问网站验证，确保没有 500 或资源加载错误，直到所有请求正常。
7. 重启服务时，不要执行 `Stop-Process -Name node -Force`，因为这会误杀当前终端里的 CodeBuddy/Codex 进程。只停止当前项目目录下的 `next start` 进程，然后再启动服务：
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
8. 部署后验证网站可访问性（用 WebFetch 访问 `https://comfy.bgmss.fun/`），确认无 500 错误。
<!-- END:deploy-rules -->
