$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$script:failures = [System.Collections.Generic.List[string]]::new()
$script:runbookRepositoryLiteral = "D:\Luca\Code\MyProject\comfyui-manager"
$script:repositoryResolveMappings = [System.Collections.Generic.List[string]]::new()
$script:repositoryResolveDelegations = [System.Collections.Generic.List[string]]::new()

function Resolve-Path {
  [CmdletBinding(DefaultParameterSetName = "Path")]
  param(
    [Parameter(Mandatory = $true, Position = 0, ParameterSetName = "Path", ValueFromPipeline = $true)]
    [string[]]$Path,

    [Parameter(Mandatory = $true, ParameterSetName = "LiteralPath", ValueFromPipelineByPropertyName = $true)]
    [Alias("PSPath")]
    [string[]]$LiteralPath,

    [switch]$Relative
  )

  process {
    $candidates = if ($PSCmdlet.ParameterSetName -eq "LiteralPath") { $LiteralPath } else { $Path }
    foreach ($candidate in $candidates) {
      $forward = @{}
      if ($Relative) { $forward.Relative = $true }
      if ($PSBoundParameters.ContainsKey("ErrorAction")) {
        $forward.ErrorAction = $PSBoundParameters["ErrorAction"]
      }

      if ([string]::Equals(
          $candidate,
          $script:runbookRepositoryLiteral,
          [System.StringComparison]::OrdinalIgnoreCase
        )) {
        [void]$script:repositoryResolveMappings.Add($candidate)
        Microsoft.PowerShell.Management\Resolve-Path -LiteralPath $repoRoot @forward
      } else {
        [void]$script:repositoryResolveDelegations.Add($candidate)
        if ($PSCmdlet.ParameterSetName -eq "LiteralPath") {
          Microsoft.PowerShell.Management\Resolve-Path -LiteralPath $candidate @forward
        } else {
          Microsoft.PowerShell.Management\Resolve-Path -Path $candidate @forward
        }
      }
    }
  }
}

function Assert-Contract([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Invoke-ContractCase([string]$Name, [scriptblock]$Body) {
  try {
    & $Body
    Write-Output "PASS $Name"
  } catch {
    $script:failures.Add("${Name}: $($_.Exception.Message)")
    Write-Output "FAIL $Name"
  }
}

function Get-PowerShellBlocks([string]$RelativePath) {
  $path = Join-Path $repoRoot $RelativePath
  $source = Get-Content -LiteralPath $path -Raw -Encoding utf8
  return @([regex]::Matches(
      $source,
      '(?ms)^[ \t]*```powershell[ \t]*\r?\n(?<code>.*?)^[ \t]*```[ \t]*\r?$'
    ) |
    ForEach-Object { $_.Groups['code'].Value })
}

function Get-ContractBlock([string]$RelativePath, [string]$Marker) {
  $matches = @(Get-PowerShellBlocks $RelativePath | Where-Object {
    $_ -match "(?m)^\s*# runbook-contract: $([regex]::Escape($Marker))\s*$"
  })
  Assert-Contract ($matches.Count -eq 1) "$RelativePath 必须恰好包含一个合同块 $Marker。"
  return [scriptblock]::Create($matches[0])
}

Invoke-ContractCase "全部现行 runbook PowerShell 示例可解析" {
  $files = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot "docs/runbooks") -Recurse -File -Filter "*.md")
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($repoRoot.Length + 1)
    foreach ($source in @(Get-PowerShellBlocks $relative)) {
      $tokens = $null
      $parseErrors = $null
      [void][System.Management.Automation.Language.Parser]::ParseInput(
        $source,
        [ref]$tokens,
        [ref]$parseErrors
      )
      Assert-Contract (@($parseErrors).Count -eq 0) "$relative 存在 PowerShell 语法错误。"
    }
  }
}

Invoke-ContractCase "锁的非竞争创建错误立即抛出" {
  $block = Get-ContractBlock "docs/runbooks/deployment/lock.md" "deployment-lock-acquire"
  $script:sleepCalls = 0
  $mappedBefore = $script:repositoryResolveMappings.Count
  $delegatedBefore = $script:repositoryResolveDelegations.Count

  function New-Item {
    [CmdletBinding()]
    param([string]$ItemType, [string]$Path)
    throw [System.UnauthorizedAccessException]::new("mock-access-denied")
  }
  function Test-Path {
    [CmdletBinding()]
    param([string]$LiteralPath, [string]$PathType)
    return $false
  }
  function Start-Sleep {
    param([int]$Seconds)
    $script:sleepCalls += 1
  }

  $caught = $null
  try { . $block } catch { $caught = $_ }
  Assert-Contract ($null -ne $caught) "非竞争创建错误必须抛出。"
  Assert-Contract ($caught.Exception.Message -match "mock-access-denied") "必须保留原始创建错误。"
  Assert-Contract ($script:sleepCalls -eq 0) "非竞争错误不得进入等待。"
  Assert-Contract ($repo -eq $repoRoot) "原始 runbook 块必须把固定目标映射到当前 checkout。"
  Assert-Contract ($script:repositoryResolveMappings.Count -eq ($mappedBefore + 1)) "原始块必须只命中一次固定仓库路径映射。"

  $nearMiss = "$($script:runbookRepositoryLiteral)-missing-$([guid]::NewGuid().ToString('N'))"
  $nearMissError = $null
  try { Resolve-Path -LiteralPath $nearMiss -ErrorAction Stop } catch { $nearMissError = $_ }
  Assert-Contract ($null -ne $nearMissError) "非精确路径必须保留真实 Resolve-Path 错误。"
  Assert-Contract ($script:repositoryResolveMappings.Count -eq ($mappedBefore + 1)) "非精确路径不得命中仓库映射。"
  Assert-Contract ($script:repositoryResolveDelegations.Count -eq ($delegatedBefore + 1)) "非精确路径必须委托真实 Resolve-Path。"
  Assert-Contract ($script:repositoryResolveDelegations[-1] -eq $nearMiss) "委托记录必须保留原始非精确路径。"
}

Invoke-ContractCase "确有竞争锁时只重试创建" {
  $block = Get-ContractBlock "docs/runbooks/deployment/lock.md" "deployment-lock-acquire"
  $script:newItemCalls = 0
  $script:sleepCalls = 0

  function New-Item {
    [CmdletBinding()]
    param([string]$ItemType, [string]$Path)
    $script:newItemCalls += 1
    if ($script:newItemCalls -eq 1) {
      throw [System.IO.IOException]::new("mock-directory-exists")
    }
  }
  function Test-Path {
    [CmdletBinding()]
    param([string]$LiteralPath, [string]$PathType)
    if ($LiteralPath -like "*owner.json") { return $false }
    return $true
  }
  function Start-Sleep {
    param([int]$Seconds)
    $script:sleepCalls += 1
  }

  . $block
  Assert-Contract ($lockAcquired -eq $true) "第二次原子创建应获取锁。"
  Assert-Contract ($script:newItemCalls -eq 2) "竞争场景应只重试一次。"
  Assert-Contract ($script:sleepCalls -eq 1) "竞争场景应等待一次。"
}

Invoke-ContractCase "队列暂停覆盖成功、500 部分结果、空结果与计数不匹配" {
  $block = Get-ContractBlock "docs/runbooks/deployment/queue-safety.md" "deployment-queue-pause"
  $initialGate = [pscustomobject]@{ GenerationActive = 0 }
  $script:pausedGenerationBatches = @()
  $script:queueScenario = "success"
  $script:lockPhases = @()

  function Write-DeploymentLockState([string]$Phase) {
    $script:lockPhases += $Phase
  }
  function Invoke-RestMethod {
    [CmdletBinding()]
    param(
      [string]$Method,
      [string]$Uri,
      [object]$WebSession,
      [string]$ContentType,
      [string]$Body
    )
    switch ($script:queueScenario) {
      "success" {
        return [pscustomobject]@{
          ok = $true
          data = [pscustomobject]@{
            batchId = "batch-success"
            runIds = @("run-1", "run-2")
            pausedCount = 2
          }
        }
      }
      "partial-500" {
        $exception = [System.InvalidOperationException]::new("mock-http-500")
        $record = [System.Management.Automation.ErrorRecord]::new(
          $exception,
          "MockHttp500",
          [System.Management.Automation.ErrorCategory]::InvalidOperation,
          $null
        )
        $record.ErrorDetails = [System.Management.Automation.ErrorDetails]::new(
          '{"error":{"details":{"batchId":"batch-partial","runIds":["run-p1"]}}}'
        )
        throw $record
      }
      "empty" {
        return [pscustomobject]@{
          ok = $true
          data = [pscustomobject]@{ batchId = "batch-empty"; runIds = @(); pausedCount = 0 }
        }
      }
      "mismatch" {
        return [pscustomobject]@{
          ok = $true
          data = [pscustomobject]@{
            batchId = "batch-mismatch"
            runIds = @("run-m1", "run-m2")
            pausedCount = 1
          }
        }
      }
      default { throw "未知 mock 场景。" }
    }
  }

  . $block

  Pause-DeploymentGeneration
  Assert-Contract ($script:pausedGenerationBatches.Count -eq 1) "成功暂停必须记录一个批次。"
  Assert-Contract ($script:pausedGenerationBatches[0].runIds.Count -eq 2) "成功暂停必须记录精确 runIds。"

  $script:pausedGenerationBatches = @()
  $script:queueScenario = "partial-500"
  $partialError = $null
  try { Pause-DeploymentGeneration } catch { $partialError = $_ }
  Assert-Contract ($null -ne $partialError) "HTTP 500 部分暂停后必须停止。"
  Assert-Contract ($script:pausedGenerationBatches.Count -eq 1) "HTTP 500 的 error.details 必须先记录。"
  Assert-Contract ($script:pausedGenerationBatches[0].batchId -eq "batch-partial") "部分批次 ID 必须保留。"

  $script:pausedGenerationBatches = @()
  $script:queueScenario = "empty"
  $emptyError = $null
  try { Pause-DeploymentGeneration } catch { $emptyError = $_ }
  Assert-Contract ($null -ne $emptyError) "空 runIds 必须失败。"
  Assert-Contract ($script:pausedGenerationBatches.Count -eq 0) "空结果不得创建恢复记录。"

  $script:pausedGenerationBatches = @()
  $script:queueScenario = "mismatch"
  $mismatchError = $null
  try { Pause-DeploymentGeneration } catch { $mismatchError = $_ }
  Assert-Contract ($null -ne $mismatchError) "暂停计数不匹配必须失败。"
  Assert-Contract ($script:pausedGenerationBatches.Count -eq 1) "计数不匹配时必须保留已改变批次以便恢复。"
}

Invoke-ContractCase "队列恢复跳过空集合并精确核对批次" {
  $block = Get-ContractBlock "docs/runbooks/deployment/queue-safety.md" "deployment-queue-resume"
  $script:resumeCalls = 0
  $script:resumeMode = "success"
  $script:lastResumeBody = $null

  function Write-DeploymentLockState([string]$Phase) { }
  function Invoke-RestMethod {
    [CmdletBinding()]
    param(
      [string]$Method,
      [string]$Uri,
      [object]$WebSession,
      [string]$ContentType,
      [string]$Body
    )
    $script:resumeCalls += 1
    $script:lastResumeBody = $Body | ConvertFrom-Json
    if ($script:resumeMode -eq "mismatch") {
      return [pscustomobject]@{
        ok = $true
        data = [pscustomobject]@{ batchId = "batch-r"; runIds = @("run-r1"); resumedCount = 1 }
      }
    }
    return [pscustomobject]@{
      ok = $true
      data = [pscustomobject]@{
        batchId = "batch-r"
        runIds = @("run-r1", "run-r2")
        resumedCount = 2
      }
    }
  }

  $script:pausedGenerationBatches = @()
  . $block
  Assert-Contract ($script:resumeCalls -eq 0) "没有记录批次时不得调用 resume。"

  $script:pausedGenerationBatches = @(
    [pscustomobject]@{ batchId = "batch-r"; runIds = @("run-r2", "run-r1") }
  )
  . $block
  Assert-Contract ($script:resumeCalls -eq 1) "精确批次应只调用一次 resume。"
  Assert-Contract ($script:lastResumeBody.batchId -eq "batch-r") "resume body 必须携带精确 batchId。"
  Assert-Contract (@($script:lastResumeBody.runIds).Count -eq 2) "resume body 必须携带完整 runIds。"
  Assert-Contract ($script:pausedGenerationBatches.Count -eq 0) "精确恢复后才可移除记录。"

  $script:pausedGenerationBatches = @(
    [pscustomobject]@{ batchId = "batch-r"; runIds = @("run-r1", "run-r2") }
  )
  $script:resumeMode = "mismatch"
  $resumeError = $null
  try { . $block } catch { $resumeError = $_ }
  Assert-Contract ($null -ne $resumeError) "恢复集合不匹配必须失败。"
  Assert-Contract ($script:pausedGenerationBatches.Count -eq 1) "恢复不匹配时必须保留记录。"
}

Invoke-ContractCase "本地认证成功与失败都会清除 token 派生状态" {
  $block = Get-ContractBlock "docs/runbooks/development/local-verification.md" "local-authentication-verification"
  $base = "http://127.0.0.1:3000"
  $script:authMode = "success"
  $script:authSession = $null
  $script:authEnvPath = $null

  function Get-Content {
    [CmdletBinding()]
    param([string]$LiteralPath, [string]$Encoding)
    $script:authEnvPath = $LiteralPath
    return "AUTH_TOKEN=mock-secret"
  }
  function Invoke-RestMethod {
    [CmdletBinding()]
    param(
      [string]$Method,
      [string]$Uri,
      [string]$ContentType,
      [string]$Body,
      [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession
    )
    if ($Uri -like "*/api/auth/verify") {
      $script:authSession = $WebSession
      $WebSession.Cookies.SetCookies([uri]$base, "auth_token=accepted; Path=/")
      if ($script:authMode -eq "failure") { throw "mock-auth-failure" }
      return [pscustomobject]@{ ok = $true }
    }
    if ($Uri -like "*/api/worker/status") {
      return [pscustomobject]@{
        ok = $true
        data = [pscustomobject]@{
          queue = [pscustomobject]@{ queued = 0; running = 0 }
          comfyui = [pscustomobject]@{ reachable = $true }
        }
      }
    }
    if ($Uri -like "*/api/training/worker/status") {
      return [pscustomobject]@{
        ok = $true
        data = [pscustomobject]@{ summary = [pscustomobject]@{ totalActive = 0 } }
      }
    }
    throw "未预期的认证 mock URI。"
  }

  . $block
  $expectedEnvPath = Join-Path $repoRoot ".env"
  Assert-Contract ($script:authEnvPath -eq $expectedEnvPath) "AUTH_TOKEN 必须从精确仓库根 .env 读取。"
  Assert-Contract ($script:authSession.Cookies.Count -eq 0) "成功路径必须清除 cookie container。"
  foreach ($name in @("token", "body", "authRequest", "authResponse", "authCookie", "session")) {
    Assert-Contract ($null -eq (Get-Variable -Name $name -Scope Local -ErrorAction SilentlyContinue)) "成功路径必须移除 $name。"
  }

  $script:authMode = "failure"
  $script:authSession = $null
  $authError = $null
  try { . $block } catch { $authError = $_ }
  Assert-Contract ($null -ne $authError) "认证失败必须向调用方抛出。"
  Assert-Contract ($script:authSession.Cookies.Count -eq 0) "失败路径必须清除 cookie container。"
  foreach ($name in @("token", "body", "authRequest", "authResponse", "authCookie", "session")) {
    Assert-Contract ($null -eq (Get-Variable -Name $name -Scope Local -ErrorAction SilentlyContinue)) "失败路径必须移除 $name。"
  }
}

Invoke-ContractCase "数据库同步固定仓库 cwd 并恢复临时环境" {
  $block = Get-ContractBlock "docs/runbooks/deployment/database-sync.md" "deployment-database-sync"
  $savedProviderExists = Test-Path Env:DB_PROVIDER
  $savedUrlExists = Test-Path Env:DATABASE_URL
  $savedProvider = $env:DB_PROVIDER
  $savedUrl = $env:DATABASE_URL
  $script:databaseEnvPath = $null
  $script:prismaCalls = @()

  function Get-Content {
    [CmdletBinding()]
    param([string]$LiteralPath, [string]$Encoding)
    $script:databaseEnvPath = $LiteralPath
    return @("DB_PROVIDER=sqlite", "DATABASE_URL=file:mock-database.db")
  }
  function npx {
    param([Parameter(ValueFromRemainingArguments = $true)][object[]]$Remaining)
    $script:prismaCalls += [pscustomobject]@{
      Cwd = (Get-Location).Path
      Args = @($Remaining)
    }
    $global:LASTEXITCODE = 0
  }

  try {
    Remove-Item Env:DB_PROVIDER -ErrorAction SilentlyContinue
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    $callerCwd = (Get-Location).Path
    . $block

    Assert-Contract ($script:databaseEnvPath -eq (Join-Path $repoRoot ".env")) "数据库值必须从精确仓库根 .env 读取。"
    Assert-Contract ($script:prismaCalls.Count -eq 2) "必须依次执行 Prisma generate 与 db push。"
    foreach ($call in $script:prismaCalls) {
      Assert-Contract ($call.Cwd -eq $repoRoot) "Prisma 命令必须在精确仓库 cwd 下运行。"
    }
    Assert-Contract (($script:prismaCalls[0].Args -join " ") -eq "prisma generate") "第一个 Prisma 命令必须是 generate。"
    Assert-Contract (($script:prismaCalls[1].Args -join " ") -eq "prisma db push") "第二个 Prisma 命令必须是 db push。"
    Assert-Contract ((Get-Location).Path -eq $callerCwd) "数据库同步后必须恢复调用方 cwd。"
    Assert-Contract (-not (Test-Path Env:DB_PROVIDER)) "调用前不存在的 DB_PROVIDER 必须删除。"
    Assert-Contract (-not (Test-Path Env:DATABASE_URL)) "调用前不存在的 DATABASE_URL 必须删除。"
    Assert-Contract ($null -eq (Get-Variable -Name dbUrl -Scope Local -ErrorAction SilentlyContinue)) "必须移除内存 dbUrl。"
  } finally {
    if ($savedProviderExists) { $env:DB_PROVIDER = $savedProvider }
    else { Remove-Item Env:DB_PROVIDER -ErrorAction SilentlyContinue }
    if ($savedUrlExists) { $env:DATABASE_URL = $savedUrl }
    else { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
  }
}

Invoke-ContractCase "生产重启只停止精确进程树并使用固定日志名" {
  $discover = Get-ContractBlock "docs/runbooks/deployment/service-restart.md" "production-service-discovery"
  $stop = Get-ContractBlock "docs/runbooks/deployment/service-restart.md" "production-service-stop"
  $start = Get-ContractBlock "docs/runbooks/deployment/service-restart.md" "production-service-start"
  $script:processes = @(
    [pscustomobject]@{ ProcessId = 100; ParentProcessId = 1; CreationDate = "20260712010000"; CommandLine = "$repoRoot node_modules/next next start" },
    [pscustomobject]@{ ProcessId = 101; ParentProcessId = 100; CreationDate = "20260712010100"; CommandLine = "node next-server" },
    [pscustomobject]@{ ProcessId = 200; ParentProcessId = 1; CreationDate = "20260712010200"; CommandLine = "$repoRoot node_modules/next next dev" },
    [pscustomobject]@{ ProcessId = 300; ParentProcessId = 1; CreationDate = "20260712010300"; CommandLine = "D:\Other next start" }
  )
  $script:listeners = @(
    [pscustomobject]@{ LocalPort = 3000; OwningProcess = 101 },
    [pscustomobject]@{ LocalPort = 4000; OwningProcess = 200 }
  )
  $script:stoppedPids = @()
  $script:startInvocation = $null

  function Get-CimInstance {
    [CmdletBinding()]
    param([string]$ClassName, [string]$Filter)
    return $script:processes
  }
  function Get-NetTCPConnection {
    [CmdletBinding()]
    param([string]$State)
    return $script:listeners
  }
  function Stop-Process {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([int]$Id, [switch]$Force)
    $script:stoppedPids += $Id
  }
  function Start-Sleep { param([int]$Milliseconds) }
  function Start-Process {
    [CmdletBinding()]
    param([string]$FilePath, [string]$ArgumentList, [string]$WindowStyle)
    $script:startInvocation = [pscustomobject]@{
      FilePath = $FilePath
      ArgumentList = $ArgumentList
      WindowStyle = $WindowStyle
    }
  }

  . $discover
  Assert-Contract ($prodRoots.Count -eq 1 -and $prodRoots[0].ProcessId -eq 100) "只能选中仓库范围 next start 根进程。"
  Assert-Contract ($prodPids.Contains(101)) "必须包含生产根进程的 Node 后代。"
  Assert-Contract (-not $prodPids.Contains(200)) "不得纳入同仓库 next dev。"
  Assert-Contract (-not $prodPids.Contains(300)) "不得纳入其他仓库 next start。"
  Assert-Contract ($oldListeners.Count -eq 1 -and $oldListeners[0].OwningProcess -eq 101) "监听必须属于选中生产树。"

  $script:listeners = @()
  . $stop
  $stopped = @($script:stoppedPids | Sort-Object)
  Assert-Contract (($stopped -join ",") -eq "100,101") "只能停止精确生产树 PID。"

  . $start
  Assert-Contract ($script:startInvocation.FilePath -eq "cmd.exe") "生产服务必须通过 cmd.exe 启动。"
  Assert-Contract ($script:startInvocation.WindowStyle -eq "Hidden") "生产服务必须使用隐藏窗口。"
  Assert-Contract ($script:startInvocation.ArgumentList -match '> server\.log 2> server\.err\.log$') "必须保留 server.log/server.err.log。"
  Assert-Contract ($script:startInvocation.ArgumentList -notmatch 'server-prod') "不得改用未经验证的 server-prod 日志名。"
}

if ($script:failures.Count -gt 0) {
  foreach ($failure in $script:failures) { Write-Error $failure }
  exit 1
}

Write-Output "全部 runbook PowerShell 合同通过。"
exit 0
