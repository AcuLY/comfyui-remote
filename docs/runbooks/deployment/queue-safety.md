---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: queue-runtime
  authority:
    subject: operations/deployment-queue-safety
    kind: operational
  readWhen:
    - 构建、清理、停止或重启前检查 worker 活动时
    - 为一次部署暂停或恢复 Generation 工作时
  sources:
    - src/proxy.ts
    - src/lib/actions/run-lifecycle.ts
    - src/lib/api-response.ts
    - src/app/api/worker/status/route.ts
    - src/app/api/training/worker/status/route.ts
    - src/app/api/queue/pause-active/route.ts
    - src/app/api/queue/resume-paused/route.ts
    - src/server/worker/repository.ts
    - src/server/worker/training/scheduler.ts
  verifiedBy:
    - node --import tsx --test tests/test-queue-control-progress-stream.test.ts tests/test-training-worker-entrypoints.test.ts tests/test-work-mode-resource-boundary.test.ts
    - powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/runbook-contract-harness.ps1
    - npm run docs:check
  environment:
    - 已获取部署锁且可访问已认证生产 Manager 端点的环境
  risk: 本部署流程无法暂停 Training；任何活跃 Training 工作都会阻止升级，并且只允许恢复本次部署记录的 Generation 批次。
  recovery: "#故障处理与恢复"
  verificationState: exercised
  lastVerified: "2026-07-13"
---

# 部署队列安全

## 适用场景

在生产构建、清理 `.next`、停止服务或重启服务前使用本流程，并在验证成功后再次使用。Generation 与 Training 是彼此独立的 worker 子系统，两者都必须检查。

如果部署只读取现有服务，不执行构建、清理、停止或重启，就不要暂停 Generation。Training 没有部署专用的暂停/恢复 API。

## 前置条件

- 获取[部署锁](./lock.md)。
- 发现真实 Manager base URL 并完成认证，不记录 token。示例假设 `$base` 与已认证的内存 `$session` 已存在。
- 每次重写元数据前验证锁的责任方与获取令牌。示例假设 `$pausedGenerationBatches` 是[锁流程](./lock.md)已发布到 `.deploy.lock/owner.json` 的内存列表。
- 不记录或持久化完整状态载荷；暂停造成状态变化时，只保留本次部署的 Generation `batchId` 与精确 `runIds`。

## 操作步骤

1. 通过一个门函数读取两类状态，并验证响应包：

   ```powershell
   # runbook-contract: deployment-queue-gate
   function Read-DeploymentWorkerGate {
     $generation = Invoke-RestMethod -Method Get -Uri "$base/api/worker/status" -WebSession $session
     $training = Invoke-RestMethod -Method Get -Uri "$base/api/training/worker/status" -WebSession $session
     if (-not $generation.ok -or -not $training.ok -or
         $null -eq $generation.data.queue.queued -or
         $null -eq $generation.data.queue.running -or
         $null -eq $training.data.summary.totalActive) {
       throw "worker 状态检查失败。"
     }
     [pscustomobject]@{
       GenerationActive = [int]$generation.data.queue.queued + [int]$generation.data.queue.running
       TrainingActive = [int]$training.data.summary.totalActive
     }
   }

   $initialGate = Read-DeploymentWorkerGate
   ```

2. 如果 `$initialGate.TrainingActive` 大于零，立即停止升级。不得暂停 Generation、构建、停止服务或虚构 Training 恢复路径。保留锁，并协调安全的 Training 空闲窗口。

3. 如果不需要影响运行时的操作，保持 Generation 不变。否则，当 `$initialGate.GenerationActive` 大于零时，暂停活跃 Generation 工作。HTTP 500 仍可能表示部分暂停：PowerShell 会在赋值正常响应前抛错，因此要解析 `ErrorDetails.Message`、读取 `error.details`，并在停止前记录任何返回的 `batchId` 与非空 `runIds`。绝不能输出该响应包。

   ```powershell
   # runbook-contract: deployment-queue-pause
   function Add-DeploymentPauseRecord([object]$details) {
     $batchId = [string]$details.batchId
     $runIds = @($details.runIds | Where-Object { $_ -is [string] -and $_ }) |
       Select-Object -Unique
     if (-not $batchId -or $runIds.Count -eq 0) { return $false }
     $script:pausedGenerationBatches += [pscustomobject]@{
       batchId = $batchId
       runIds = @($runIds)
     }
     # 只有验证锁的 owner/token 后，才能用全新 payload 重写 owner.json。
     Write-DeploymentLockState -Phase "generation-paused"
     return $true
   }

   function Pause-DeploymentGeneration {
     try {
       $pause = Invoke-RestMethod -Method Post -Uri "$base/api/queue/pause-active" -WebSession $session
     } catch {
       $errorEnvelope = $null
       if ($_.ErrorDetails.Message) {
         try { $errorEnvelope = $_.ErrorDetails.Message | ConvertFrom-Json } catch { }
       }
       $partialRecorded = Add-DeploymentPauseRecord $errorEnvelope.error.details
       if ($partialRecorded) {
         throw "Generation 暂停失败，但已记录部分批次；停止部署。"
       }
       throw "Generation 暂停失败且没有可恢复批次；停止部署。"
     }

     if (-not $pause.ok) { throw "Generation 暂停返回失败 envelope。" }
     $recorded = Add-DeploymentPauseRecord $pause.data
     if (-not $recorded) { throw "Generation 暂停未返回可恢复批次。" }

     $record = $pausedGenerationBatches[-1]
     if ([int]$pause.data.pausedCount -ne @($record.runIds).Count) {
       throw "Generation 暂停数量与已记录 runIds 不匹配；停止部署。"
     }
   }

   if ($initialGate.GenerationActive -gt 0) {
     Pause-DeploymentGeneration
   }
   ```

4. 任何部分暂停或失败暂停之后都不得继续，即使已记录其可恢复子集。保留锁与该子集，以便有意恢复。没有 `batchId` 或没有发生变化的 `runIds` 的响应不会创建恢复记录，绝不能触发无范围恢复。

5. 按需继续数据库同步与构建。停止旧服务前立即再次运行 `Read-DeploymentWorkerGate`；Training 必须仍为空闲。如果出现新的 Generation 工作，运行相同的暂停并记录函数，创建独立的自有批次。随后再次读取两类状态，并要求两个活跃计数都为零，才能重启服务：

   ```powershell
   $preRestartGate = Read-DeploymentWorkerGate
   if ($preRestartGate.TrainingActive -gt 0) {
     throw "重启前 Training 变为活跃；保留锁且不要停止服务。"
   }
   if ($preRestartGate.GenerationActive -gt 0) {
     Pause-DeploymentGeneration
   }
   $confirmedRestartGate = Read-DeploymentWorkerGate
   if ($confirmedRestartGate.GenerationActive -ne 0 -or
       $confirmedRestartGate.TrainingActive -ne 0) {
     throw "重启前有 worker 变为活跃；保留锁且不要停止服务。"
   }
   ```

6. 必需的 `构建 → 重启 → 验证` 顺序成功后，逐个恢复已记录的 Generation 批次。如果 `$pausedGenerationBatches` 为空，必须完全跳过恢复路由。对每个批次同时提供 `batchId` 与精确 `runIds`；只有 `resumedCount` 和返回的标识集合都匹配后，才能把该记录标记为已恢复：

   ```powershell
   # runbook-contract: deployment-queue-resume
   function Set-DeploymentPauseRecordRestored([string]$BatchId) {
     $script:pausedGenerationBatches = @(
       $pausedGenerationBatches | Where-Object { $_.batchId -ne $BatchId }
     )
     Write-DeploymentLockState -Phase "generation-batch-restored"
   }

   if ($pausedGenerationBatches.Count -gt 0) {
     foreach ($batch in @($pausedGenerationBatches)) {
       $expectedRunIds = @($batch.runIds | Sort-Object -Unique)
       $resumeBody = @{
         batchId = $batch.batchId
         runIds = $expectedRunIds
       } | ConvertTo-Json -Compress
       $resumeRequest = @{
         Method = "Post"
         Uri = "$base/api/queue/resume-paused"
         WebSession = $session
         ContentType = "application/json"
         Body = $resumeBody
       }
       $resume = Invoke-RestMethod @resumeRequest
       $actualRunIds = @($resume.data.runIds | Sort-Object -Unique)
       $difference = @(Compare-Object $expectedRunIds $actualRunIds)
       if (-not $resume.ok -or
           [string]$resume.data.batchId -ne [string]$batch.batchId -or
           [int]$resume.data.resumedCount -ne $expectedRunIds.Count -or
           $actualRunIds.Count -ne $expectedRunIds.Count -or
           $difference.Count -ne 0) {
         throw "已记录的 Generation 批次未被精确恢复；保留锁。"
       }
       # 下一次 owner.json phase 重写只移除这条已验证记录。
       Set-DeploymentPauseRecordRestored -BatchId $batch.batchId
     }
   }
   ```

7. 绝不能调用无范围恢复来恢复本次部署前就已暂停的工作。只有每个记录批次都通过精确计数/集合比较，且锁元数据中没有未恢复记录后，才能释放锁。

## 预期结果

只有两次门禁中的 Training 都为空闲时才继续升级。仅当部署需要影响运行时的操作时暂停 Generation；每个精确批次都记录在锁下，并且只在部署验证成功后恢复这些批次。

## 故障处理与恢复

- 任一状态端点失败时，在修改任何状态前停止并保留锁。
- Training 活跃时等待或协调空闲窗口；不得把终止 Training worker 或修改其记录当作部署捷径。
- Generation 暂停失败或没有返回可持久识别的批次时，停止并保留锁。
- 500 响应包含部分 `error.details` 批次时，在停止前记录它；没有记录批次时跳过恢复，不得扩大恢复范围。
- 暂停后部署或验证失败时，保留锁和记录批次；查明运行服务状态前不得恢复。
- 重启前门禁发现 Training 活跃，或无法确认两个活跃计数均为零时，不得停止服务。
- 有范围恢复失败，或返回的计数/集合不匹配时，保留未恢复标识与锁以便有意恢复；不得扩大到无关暂停运行记录。

## 验证状态

本流程已于 2026-07-13 在生产部署锁内演练双 worker 门：构建前和重启前均通过已认证端点读取 Generation 与 Training，四次活动计数均为零，因此按本手册跳过暂停和恢复，锁中没有写入任何批次。真实暂停、部分失败记录、Training 活跃阻断和有范围恢复分支仍未在生产执行，继续由聚焦测试与受控合同覆盖。脱敏证据见 `openspec/changes/rebuild-documentation-governance/evidence/2026-07-13-workflow-production-migration.md`。

## 上级导航

- [返回生产部署运行手册](./README.md)
