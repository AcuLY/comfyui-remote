---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: deployment-operations
  authority:
    subject: operations/deployment-verification
    kind: operational
  readWhen:
    - 验证已重启的本地生产服务时
    - 队列恢复前执行公开部署验收时
  sources:
    - src/proxy.ts
    - src/app/api/auth/verify/route.ts
    - src/app/api/worker/status/route.ts
    - src/app/api/training/worker/status/route.ts
  verifiedBy:
    - node --import tsx --test tests/test-api-request-json.test.ts tests/test-proxy-dev-internal-paths.test.ts tests/test-training-worker-entrypoints.test.ts tests/test-work-mode-resource-boundary.test.ts
    - npm run docs:check
  environment:
    - 已重启的 Windows Next.js 生产目标，以及公开部署时对应的 HTTPS 表面
  risk: 验证必须使用真实监听；只有通过验证后才能恢复已记录 Generation 批次或释放部署锁。
  recovery: "#故障处理与恢复"
  verificationState: exercised
  lastVerified: "2026-07-13"
---

# 部署验证

## 适用场景

成功完成生产构建与重启后使用本流程。先验证本地生产监听；目标公开部署时，再验证公开 HTTPS 表面。仅开发环境检查归[本地验证](../development/local-verification.md)负责。

## 前置条件

- 保留部署锁和所有已记录 Generation 批次。
- 发现精确的新 `next start` 进程树，不得假设常规端口。
- 只把目标 `AUTH_TOKEN` 读入内存，不输出或持久化。

## 操作步骤

1. 按[服务重启](./service-restart.md)所述扩展仓库范围 `next start` 进程树，再发现其真实监听端口：

   ```powershell
   $listeners = @(Get-NetTCPConnection -State Listen | Where-Object {
     $prodPids.Contains([int]$_.OwningProcess)
   })
   $ports = @($listeners.LocalPort | Sort-Object -Unique)
   if ($ports.Count -ne 1) { throw "必须恰好找到一个生产监听端口。" }
   $base = "http://127.0.0.1:$($ports[0])"
   ```

2. 验证公开登录文档及其引用的每个 Next 静态资源。不得忽略静态资源 404 或 500：

   ```powershell
   $login = Invoke-WebRequest -Method Get -Uri "$base/login" -MaximumRedirection 0
   if ($login.StatusCode -ne 200) { throw "本地生产登录页验证失败。" }
   $assetPaths = [regex]::Matches($login.Content, '(?:src|href)="([^"?]*\/_next\/static\/[^"?]+)') |
     ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
   if (@($assetPaths).Count -eq 0) { throw "登录文档没有暴露 Next 静态资源。" }
   foreach ($path in $assetPaths) {
     $asset = Invoke-WebRequest -Method Get -Uri ([uri]::new([uri]$base, $path))
     if ($asset.StatusCode -ge 400) { throw "Next 静态资源验证失败。" }
   }
   ```

3. 使用[本地验证](../development/local-verification.md)中的 `try/finally` 会话模式，通过 `POST /api/auth/verify` 认证。其余受保护页面和 worker 检查必须留在同一个 `try` 中；不得在辅助函数结束、`finally` 已清除 Cookie 后尝试复用会话。验证部署所需受保护页面（例如 `/projects`）时，不记录 Cookie 或 token：

   ```powershell
   $protected = Invoke-WebRequest -Method Get -Uri "$base/projects" -WebSession $session -MaximumRedirection 0
   if ($protected.StatusCode -ne 200) { throw "已认证受保护页面验证失败。" }
   ```

4. 仍在同一认证 `try` 内验证两个 worker 子系统与 ComfyUI，不输出载荷。无论这些检查成功还是失败，随后都必须运行对应 `finally`：

   ```powershell
   $generation = Invoke-RestMethod -Method Get -Uri "$base/api/worker/status" -WebSession $session
   $training = Invoke-RestMethod -Method Get -Uri "$base/api/training/worker/status" -WebSession $session
   if (-not $generation.ok -or -not $training.ok) { throw "worker 状态端点失败。" }
   if ($generation.data.comfyui.reachable -ne $true) { throw "ComfyUI 不可达。" }
   ```

5. 对公开部署使用新的有界会话，针对 `https://comfy.bgmss.fun/` 重复登录、静态资源、认证、受保护页面、worker 状态与 ComfyUI 检查，并使用相同 `finally` 清理。使用正常 TLS 校验；绝不能绕过证书错误来宣告成功。

6. 只有全部必需的本地与公开检查通过后，才能使用[队列安全](./queue-safety.md)恢复本次部署记录的 Generation 批次。仅在有范围恢复成功后释放锁。

## 预期结果

已发现生产监听与所需公开 URL 能提供登录页、Next 静态资源、已认证受保护页面、两类 worker 状态与可达 ComfyUI，且没有 500 级或 TLS 错误。只有满足这些条件后，才能进行有范围 Generation 恢复与锁释放。

## 故障处理与恢复

- 报告精确失败 URL、HTTP 状态或安全错误字符串；不得包含认证材料或队列载荷。
- 任一本地或公开检查失败时停止验收、保留部署锁，并保留已记录 Generation 批次以便有意恢复。
- 考虑窄范围非缓存清理前，先根据新的 `BUILD_ID`、`.next` 输出与服务日志诊断静态资源失败。
- TLS 失败就是验证失败；不得使用不安全 client 选项把结果改成通过。

## 验证状态

完整部署验证流程已于 2026-07-13 在获授权生产切换中演练。本地 `http://127.0.0.1:3000` 与公开 `https://comfy.bgmss.fun` 均通过登录页、13 个静态资源、认证、受保护页面、Generation/Training 状态和 ComfyUI 可达性检查，公开证书使用正常校验且链验证成功。删除旧工作流兼容副本后，只读工作流下载和公开登录再次返回 `200`。TLS 失败、静态资源失败、认证失败及验证后回滚分支本次未触发，继续由故障规则和测试覆盖。脱敏证据见 `openspec/changes/rebuild-documentation-governance/evidence/2026-07-13-workflow-production-migration.md`。

## 上级导航

- [返回生产部署运行手册](./README.md)
