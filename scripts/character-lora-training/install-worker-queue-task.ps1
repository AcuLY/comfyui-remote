[CmdletBinding()]
param(
  [string]$TaskName = "ComfyUI Manager Character LoRA Workers",

  [ValidateSet("real", "mock")]
  [string]$Mode = "real",

  [switch]$StartNow
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $scriptDir "start-worker-queue.ps1"
if (-not (Test-Path $startScript)) {
  throw "Missing worker queue start script: $startScript"
}

$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-WindowStyle", "Hidden",
  "-File", "`"$startScript`"",
  "-Mode", $Mode
) -join " "

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Days 365) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Starts the ComfyUI Manager Character LoRA worker queue supervisor at user logon." `
  -Force | Out-Null

if ($StartNow) {
  Start-ScheduledTask -TaskName $TaskName
}

$task = Get-ScheduledTask -TaskName $TaskName
[pscustomobject]@{
  installed = $true
  taskName = $TaskName
  mode = $Mode
  state = $task.State
  startNow = [bool]$StartNow
  startScript = $startScript
} | ConvertTo-Json -Depth 4
