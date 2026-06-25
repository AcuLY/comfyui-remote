# Development Service Rules

Use this file only for tasks limited to starting, stopping, restarting, or verifying `npm run dev` / `next dev`.

## Boundaries

- Pure dev-service work is not a full deployment and does not require `.deploy.lock`.
- For pure dev-service work, do not run `git add`, `git commit`, `git push`, Prisma sync, `.next` cleanup, `next build`, queue pause/resume, production service restart, or public verification.
- Starting a dev service must not clean `.next`. Next.js 16 dev output is in `.next/dev` and can coexist with production build output.
- Restarting a dev service may stop only the current project directory's target-port `next dev` process.
- Do not stop `next start`, queue workers, Codex/CodeBuddy processes, or unrelated `node` processes.

## Local `mypc` Start Command

When starting the dev service on `mypc`, use a hidden background window:

```powershell
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d D:\Luca\Code\MyProject\comfyui-manager && npx next dev -p 3000 > server-dev-3000.log 2> server-dev-3000.err.log" -WindowStyle Hidden
```

## Verification

- Dev-service verification checks only local addresses such as `http://localhost:3000/login`.
- Do not upgrade dev-service verification into public production verification.
