# Agent Rule Index

This file is the required entrypoint for this repository. Keep it short. Read `agent-rules/git.md` and `agent-rules/deploy/index.md` proactively on every task, then read other linked rule files when their trigger applies.

<!-- BEGIN:nextjs-agent-rules -->
## Next.js

- This is not the Next.js you know. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`.
- Full rule: `agent-rules/nextjs.md`.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:auth-debug-rules -->
## UI Auth

- For local UI verification that redirects to `/login`, read the login token from project-root `.env`; never hard-code, print, or commit token values.
- Full rule: `agent-rules/ui-auth.md`.
<!-- END:auth-debug-rules -->

<!-- BEGIN:subagent-development-rules -->
## Subagents

- For planned work with independent modules or tasks suitable for subagents, read `agent-rules/subagents.md`.
<!-- END:subagent-development-rules -->

<!-- BEGIN:deploy-rules -->
## Always-Read Workflow Rules

- At the start of every task, read `agent-rules/git.md` and `agent-rules/deploy/index.md` so commit, push, deploy, and no-deploy boundaries are understood before work begins.
- Reading these files does not mean running Git operations, acquiring `.deploy.lock`, building, restarting, deploying, or public verification. It only establishes the workflow boundaries.

## Rule Triggers

- Git commit or push, including "不部署", "先不部署", or "只推送": follow `agent-rules/git.md`.
- Pure `npm run dev` / `next dev` start, stop, restart, or verification: read `agent-rules/dev-service.md`.
- Production deploy, production build, `next start` restart, target-machine `git pull`, Prisma sync, queue pause/resume, `.next` cleanup, or public verification: follow `agent-rules/deploy/index.md`.
- Mixed production and dev service work: read `agent-rules/deploy/index.md` for production parts and `agent-rules/dev-service.md` for dev parts.
- Complex PowerShell through SSH to `mypc`: read `agent-rules/mypc-powershell.md`.

## Hard Boundaries

- Preserve unrelated dirty worktree changes. Stage only files in the current task scope.
- Runtime files, logs, databases, `.next/`, `.deploy.lock/`, generated caches, and local config must not be committed unless the user explicitly confirms that exact scope.
- Git operations are not protected by `.deploy.lock`. `git add`, `git commit`, and `git push` do not require acquiring, waiting for, or releasing the deployment lock.
- Target-machine `git pull` is deployment-protected only when it is part of deploy or runtime-affecting work.
- Pure dev-service management does not require `.deploy.lock`, Prisma sync, `.next` cleanup, production build, queue pause/resume, production restart, public verification, or Git operations.
- Do not stop all `node.exe` processes. Never use `Stop-Process -Name node -Force`; stop only the current project process that matches the exact service rule.
- If a task is ambiguous between dev-only and production deploy, classify it before touching `.deploy.lock` or runtime services.
<!-- END:deploy-rules -->
