# Deployment Lock

The deployment lock protects production/runtime-affecting deployment actions only. It does not protect local `git add`, `git commit`, or `git push`.

## Scope

The lock must cover target-machine deployment `git pull`, queue check/pause, Prisma sync, `.next` cleanup, build, stopping/restarting service, public verification, and queue recovery.

## Acquire Lock

Before any full deployment action, acquire the mutex with atomic PowerShell directory creation. Do not use `Test-Path` before creation.

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

## When Locked

- If the lock is already held, do not continue deployment actions.
- Read `owner.json`, then wait with exponential backoff: start at 5 seconds, double each time, cap each wait at 120 seconds, and stop after 30 minutes total.
- Every retry must still use atomic directory creation. Do not use `Test-Path` as a pre-check.
- If the lock remains held after 30 minutes, stop deployment and report owner, process, branch, phase, and start time from `owner.json`.

## Metadata

- After acquiring the lock, update `owner.json` as phases change.
- If queue work is paused, record this deployment's returned `batchId` and `runIds` in `owner.json`.
- When updating `owner.json`, prefer rewriting the payload from a fresh hashtable instead of mutating a deserialized object shape.

## Release Or Keep

- After public verification succeeds and this deployment's paused tasks have been resumed, delete `.deploy.lock` to release the lock.
- If deployment fails, verification fails, or this deployment has paused tasks that are not restored yet, update `owner.json` to the failure phase and keep the lock for user confirmation.
- `.deploy.lock/` is runtime state and must not be committed.
