# Deployment Rules

Use this file for production deploys, production builds, `next start` restarts, target-machine `git pull`, Prisma sync, queue pause/resume, `.next` cleanup, or public verification.

## Default Runtime Status Gate

- After code changes, check the current project runtime status before final close-out, even when the user did not explicitly say "deploy".
- If this machine has only a local `npm run dev` / `next dev` deployment for this repo, skip production deployment by default and keep verification local to the dev service.
- If this machine has a production `npm run start` / `next start` deployment for this repo, continue with the normal deployment flow in this checkout.
- If this machine does not have the repo running locally, check `mypc` for this repo's production deployment; when `mypc` has it, continue with the normal target-machine deployment flow.
- An explicit local-only, no-deploy, or push-only user instruction overrides this default runtime-status gate for deployment, but not the Git submission rules in `../git.md`.

## Lightweight Change Exception

- A change is lightweight only when it does not change runtime behavior, for example pure style tweaks, copy changes, prototype/documentation updates, or other changes that can be checked manually without deployment verification.
- Independent bug fixes, small features, interaction changes, route/data-flow changes, and anything that can affect production runtime behavior are not lightweight by default, even if the code diff is small.
- When deciding whether to skip build, restart, deploy, or public verification, prioritize what is needed to prove the result. Code size is only a secondary signal.
- Lightweight changes skip code checks, build, deployment, and public verification by default, but do not skip commit and push by default. See `../git.md`.
- Run checks, build, deployment, or public verification for lightweight changes only when the user explicitly asks for actions such as "检查", "部署", or "这一批好了".
- If you cannot determine whether a change is lightweight, or the change may affect runtime behavior, continue with the full deployment flow.

## Mixed Service Tasks

- If one request includes both production service and development service operations, production build, `next start`, queue handling, and verification must follow this deployment flow and use `.deploy.lock`.
- Dev-service parts of a mixed request do not separately require the deployment lock, but must not clean `.next`, trigger `next build`, or stop/restart production service.
- Complete production build/start/verification first, then start or restart the dev service, to avoid dev-service actions interfering with production artifact diagnosis.

## Full Deployment Flow

1. Commit and push current-task files using `../git.md`.
   - `git add`, `git commit`, and `git push` are not protected by `.deploy.lock`.
   - Do not wait for an existing `.deploy.lock` before local commit and push.
2. Acquire the deployment mutex before any runtime-affecting deployment action. Read `lock.md`.
3. Determine execution environment:
   - If the current project directory already has a dev or production service started with `npm run dev`, `next dev`, `npm run start`, or `next start`, do not SSH to `mypc`; continue in the current directory.
   - If already on `mypc` in `D:\Luca\Code\MyProject\comfyui-manager`, do not SSH; continue in the current directory.
   - If not on `mypc`, and no current-project dev/start service is running locally, SSH to `mypc`, enter `D:\Luca\Code\MyProject\comfyui-manager`, acquire the target directory's `.deploy.lock`, then perform deployment `git pull` and continue.
4. Before build, `.next` cleanup, stop, or restart, check queue/running task state. Read `queue.md`.
5. If Prisma schema changed, choose provider from the actual deployment target and database connection, then sync schema. Read `prisma.md`.
6. Before build, handle Next build competition and preserve `.next/cache`. Read `next-build.md`.
7. After deployment, verify site access and resource loading. Read `verification.md`.
8. When restarting service, stop only the current project's `next start` process and start it with the approved command. Read `service-restart.md`.
9. After successful verification and restoring only this deployment's paused work, release `.deploy.lock` as described in `lock.md`.

## Runtime Files

Do not commit runtime files listed in `../git.md`.
