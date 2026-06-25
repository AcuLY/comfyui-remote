# Production Service Restart

When restarting service, never run `Stop-Process -Name node -Force`. That can kill Codex/CodeBuddy or unrelated Node processes.

## Stop Only Current Project `next start`

```powershell
$targets = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*D:\Luca\Code\MyProject\comfyui-manager*' -and $_.CommandLine -like '*next*start*' }
$targets | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false }
```

- If a current-project `npm run dev` / `next dev` service exists, do not stop or restart it.
- Dev service is controlled by the person debugging it.
- Only stop and restart a current-project `next start` production service.

## Start On Local `mypc`

When already working on local `mypc`, start production service in a hidden background window:

```powershell
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d D:\Luca\Code\MyProject\comfyui-manager && npx next start > server.log 2>&1" -WindowStyle Hidden
```

## Start Through SSH

When executing remotely through SSH on the target machine:

```powershell
wmic process call create "cmd /c cd /d D:\Luca\Code\MyProject\comfyui-manager && npx next start > server.log 2>&1"
```

`wmic` does not inherit `PATH`; use `npx next start`, not `next start`.
