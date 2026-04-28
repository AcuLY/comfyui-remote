<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:deploy-rules -->
# 部署流程

每次代码修改完成后，必须依次执行以下部署步骤：

1. `git add` + `git commit` + `git push`（提交并推送到远程）。
2. 判断当前执行环境：
   - 如果当前已经在 `mypc` 这台 Windows 设备，且仓库目录是 `D:\Luca\Code\MyProject\comfyui-manager`，不要 SSH，直接在当前目录继续执行后续步骤。
   - 如果当前不在 `mypc`，必须 SSH 到 `mypc`，在 `D:\Luca\Code\MyProject\comfyui-manager` 目录下 `git pull` 后继续执行后续步骤。
3. 如果 Prisma schema 有变更：`$env:DB_PROVIDER="postgresql"; npx prisma generate` + `npx prisma db push`。
4. 构建前先清理 `.next` 缓存目录，否则增量 build 可能产生过期的 static chunk（浏览器请求旧 chunk hash 时返回 500）：
   ```powershell
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
   ```
   然后执行 `npx next build` 构建项目。
5. 部署完成后必须访问网站验证，确保没有 500 或资源加载错误，直到所有请求正常。
5. 重启服务时，不要执行 `Stop-Process -Name node -Force`，因为这会误杀当前终端里的 CodeBuddy/Codex 进程。只停止当前项目目录下的 `next start` 进程，然后再启动服务：
   ```powershell
   $targets = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
     Where-Object { $_.CommandLine -like '*D:\Luca\Code\MyProject\comfyui-manager*' -and $_.CommandLine -like '*next*start*' }
   $targets | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false }
   ```
   - 如果当前已经在 `mypc` 本机工作，必须用 PowerShell 的隐藏窗口后台静默启动，不要弹出额外终端窗口：
     ```powershell
     Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d D:\Luca\Code\MyProject\comfyui-manager && npx next start > server.log 2>&1" -WindowStyle Hidden
     ```
   - 如果当前不是在 `mypc` 本机，而是通过 SSH 在目标机执行，可继续使用：
     ```powershell
     wmic process call create "cmd /c cd /d D:\Luca\Code\MyProject\comfyui-manager && npx next start > server.log 2>&1"
     ```
   - 注意：`wmic` 不继承 PATH，必须用 `npx next start` 而非 `next start`；同时不要按进程名批量杀掉所有 `node.exe`。
6. 部署后验证网站可访问性（用 WebFetch 访问 `https://comfy.bgmss.fun/`），确认无 500 错误。
<!-- END:deploy-rules -->
