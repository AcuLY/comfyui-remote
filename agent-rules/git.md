# Git Rules

## Non-Deploy Commit And Push

- "不部署", "先不部署", and "只推送" mean skip build, service restart, deploy, and public verification. They do not mean leaving finished changes local.
- After tracked files are changed, run `git status --short` before the final response.
- If only current-task tracked changes remain, and the user did not explicitly ask for "不提交", "不推送", or "仅本地", stage only current-task files, commit, and push the current branch.
- If unrelated changes are mixed into the worktree, stage only current-task files.
- If the current-task scope cannot be safely distinguished, stop and report the specific files instead of running `git add -A`.
- If commit or push fails, the final response must state the failure reason, current dirty/staged files, and the next required step.

## Deployment Lock Boundary

- Git operations are not protected by `.deploy.lock`.
- `git add`, `git commit`, and `git push` do not require acquiring, waiting for, or releasing the deployment lock.
- An existing `.deploy.lock` does not block local commit and push.
- Target-machine `git pull` is lock-protected only when it is part of deployment or runtime-affecting work. See `deploy/index.md`.

## Files To Exclude Unless Explicitly Confirmed

- Runtime lock directories: `.deploy.lock/`
- Service logs: `server-dev-3000.log`, `server-dev-3000.err.log`, `server-prod-3001.log`, `server-prod-3001.err.log`, `build-prod*.log`
- Runtime/build data: `.next/`, generated caches, databases, and local config
