[CmdletBinding()]
param(
  [ValidateSet("real", "mock")]
  [string]$Mode = "real",

  [string[]]$ExtraArgs = @(),

  [string]$LogPath = "",

  [string]$PidPath = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
$logsDir = Join-Path $repoRoot "logs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

if (-not $LogPath) {
  $LogPath = Join-Path $logsDir "character-lora-worker-queue.log"
}
if (-not $PidPath) {
  $PidPath = Join-Path $logsDir "character-lora-worker-queue.pid"
}

function Get-ConfiguredValue {
  param([Parameter(Mandatory = $true)][string]$Name)

  foreach ($scope in @("Process", "User", "Machine")) {
    $value = [Environment]::GetEnvironmentVariable($Name, $scope)
    if ($value -and $value.Trim()) {
      return $true
    }
  }

  $envPath = Join-Path $repoRoot ".env"
  if (Test-Path $envPath) {
    return [bool](Select-String -Path $envPath -Pattern "^$([regex]::Escape($Name))\s*=\s*.+$" -Quiet)
  }

  return $false
}

function Get-ExistingWorkerQueueProcess {
  $escapedRoot = $repoRoot.Replace("\", "\\")
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object {
      $_.CommandLine -like "*$repoRoot*" -and
      $_.CommandLine -like "*character-lora-training*" -and
      $_.CommandLine -like "*worker-queue.ts*"
    }
}

$existing = @(Get-ExistingWorkerQueueProcess)
if ($existing.Count -gt 0) {
  [pscustomobject]@{
    started = $false
    reason = "already_running"
    pids = @($existing | ForEach-Object { $_.ProcessId })
    logPath = $LogPath
    pidPath = $PidPath
  } | ConvertTo-Json -Depth 4
  return
}

$warnings = @()
if ($Mode -eq "real") {
  $hasCodexAuth =
    (Get-ConfiguredValue "CHARACTER_LORA_CODEX_BEARER_TOKEN") -or
    (Get-ConfiguredValue "CODEX_OAUTH_TOKEN") -or
    (Get-ConfiguredValue "CHARACTER_LORA_CODEX_AUTH_FILE")
  if (-not $hasCodexAuth) {
    $warnings += "No Codex image provider auth is configured; openai-codex image tasks will fail until auth is provided."
  }
  if (-not (Get-ConfiguredValue "CHARACTER_LORA_TRAINING_COMMAND")) {
    $warnings += "No CHARACTER_LORA_TRAINING_COMMAND is configured; real training tasks will fail until the trainer command is provided."
  }
}

$npmScript = if ($Mode -eq "mock") { "character-lora:workers:mock" } else { "character-lora:workers" }
$extra = if ($ExtraArgs.Count -gt 0) { " -- " + ($ExtraArgs -join " ") } else { "" }
$command = "cd /d `"$repoRoot`" && npm run $npmScript$extra >> `"$LogPath`" 2>&1"

$launchRecord = [pscustomobject]@{
  startedAt = (Get-Date).ToString("o")
  mode = $Mode
  npmScript = $npmScript
  extraArgs = $ExtraArgs
  warnings = $warnings
}
Add-Content -Path $LogPath -Value ("[character-lora worker-queue launcher] " + ($launchRecord | ConvertTo-Json -Compress -Depth 4))

$process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $command -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
Set-Content -Path $PidPath -Value $process.Id

[pscustomobject]@{
  started = $true
  pid = $process.Id
  mode = $Mode
  logPath = $LogPath
  pidPath = $PidPath
  warnings = $warnings
} | ConvertTo-Json -Depth 4
