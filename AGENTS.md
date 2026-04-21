<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:deploy-rules -->
# 部署流程

每次代码修改完成后，必须依次执行以下部署步骤：
1. `git add` + `git commit` + `git push`（提交并推送到远程）
2. SSH 到 mypc，在 `D:\Luca\Code\MyProject\comfyui-manager` 目录下 `git pull`
3. 如果 Prisma schema 有变更：`$env:DB_PROVIDER="postgresql"; npx prisma generate` + `npx prisma db push`
4. `npx next build` 构建项目
5. 重启服务：`Stop-Process -Name node -Force`，然后用 `wmic process call create` 启动服务：
   ```
   wmic process call create "cmd /c cd /d D:\Luca\Code\MyProject\comfyui-manager && npx next start > server.log 2>&1"
   ```
   注意：wmic 不继承 PATH，必须用 `npx next start` 而非 `next start`
<!-- END:deploy-rules -->
