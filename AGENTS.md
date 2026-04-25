<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:deploy-rules -->
# 部署流程

每次代码修改完成后，必须依次执行以下部署步骤：
1. `git add` + `git commit` + `git push`（提交并推送到远程）
2. 判断当前执行环境：
   - 如果当前已经在 `mypc` 这台 Windows 设备，且仓库目录是 `D:\Luca\Code\MyProject\comfyui-manager`，不要 SSH，直接在当前目录继续执行后续步骤。
   - 如果当前不在 `mypc`，必须 SSH 到 `mypc`，在 `D:\Luca\Code\MyProject\comfyui-manager` 目录下 `git pull` 后继续执行后续步骤。
3. 如果 Prisma schema 有变更：`$env:DB_PROVIDER="postgresql"; npx prisma generate` + `npx prisma db push`
4. `npx next build` 构建项目
5. 重启服务：不要执行 `Stop-Process -Name node -Force`，因为这会误杀当前终端里的 CodeBuddy 进程。只停止当前项目目录下的 `next start` 进程，然后再用 `wmic process call create` 启动服务：
   ```powershell
   $targets = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
     Where-Object { $_.CommandLine -like '*D:\Luca\Code\MyProject\comfyui-manager*' -and $_.CommandLine -like '*next*start*' }
   $targets | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false }
   wmic process call create "cmd /c cd /d D:\Luca\Code\MyProject\comfyui-manager && npx next start > server.log 2>&1"
   ```
   注意：wmic 不继承 PATH，必须用 `npx next start` 而非 `next start`；同时不要按进程名批量杀掉所有 `node.exe`。
<!-- END:deploy-rules -->
