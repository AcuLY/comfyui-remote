---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: development-operations
  authority:
    subject: operations/local-verification
    kind: operational
  readWhen:
    - 检查本地登录、认证、worker 状态或 ComfyUI 连接时
    - 不修改应用状态而验证本地服务时
  sources:
    - src/proxy.ts
    - src/app/api/auth/verify/route.ts
    - src/app/api/worker/status/route.ts
    - src/app/api/training/worker/status/route.ts
    - src/server/worker/training/scheduler.ts
  verifiedBy:
    - node --import tsx --test tests/test-api-request-json.test.ts tests/test-proxy-dev-internal-paths.test.ts tests/test-training-worker-entrypoints.test.ts tests/test-work-mode-resource-boundary.test.ts
    - powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/runbook-contract-harness.ps1
    - npm run docs:check
  environment:
    - 已运行 Next.js 开发或生产服务的本地 Windows 检出
  risk: 默认验证在认证后只读；不得调用修改路由，也不得输出认证 token 或队列载荷。
  recovery: "#故障处理与恢复"
  verificationState: not-exercised
  lastVerified: null
---

# 本地验证

## 适用场景

本流程用于验证一个已运行的本地服务是否提供公开登录路由、认证合同、Generation worker 状态、Training worker 状态与 ComfyUI 可达性。默认探测集在认证握手后只执行 GET；不会创建项目、入队工作、控制队列、写数据库或重启服务。

控制 `next dev` 进程时使用[开发服务](./dev-service.md)。进行生产验收或公开验证时使用[部署验证](../deployment/verification.md)。

## 前置条件

- 发现目标仓库范围 `next dev` 或 `next start` 进程拥有的真实监听。不得根据熟悉的端口号推断服务类型。
- 只把项目根 `.env` 中的 `AUTH_TOKEN` 读入内存。绝不能硬编码、输出、记录、提交或写入证据。
- 只有当前验证范围明确指定页面时，才允许额外访问受保护页面 GET。除 `/api/auth/verify` 外的任何 POST/PUT/PATCH/DELETE 都需要单独授权。

## 操作步骤

1. 使用所属服务运行手册中的进程树/监听发现，从真实监听构造 `$base`：

   ```powershell
   $port = [int]$serviceListener.LocalPort
   $base = "http://127.0.0.1:$port"
   if ((Invoke-WebRequest -Uri "$base/login" -MaximumRedirection 0).StatusCode -ne 200) {
     throw "本地登录路由没有返回 HTTP 200。"
   }
   ```

2. 从精确 `$repo` 下的 `.env` 加载 token，不输出其值，再通过必需的 `POST` 路由认证。token、序列化请求体、请求参数、响应、Cookie 与会话必须全部位于同一个 `try/finally` 中。响应会在内存网络会话中设置 `auth_token` Cookie；无论成功还是失败，`finally` 都要先替换 Cookie 容器，再清理每个敏感或 token 派生变量：

   ```powershell
   # runbook-contract: local-authentication-verification
   $repo = (Resolve-Path "D:\Luca\Code\MyProject\comfyui-manager").Path
   $envPath = Join-Path $repo ".env"
   $token = $body = $authRequest = $authResponse = $authCookie = $session = $null
   $generation = $training = $null
   try {
     $line = Get-Content -LiteralPath $envPath -Encoding utf8 |
       Where-Object { $_ -match '^\s*AUTH_TOKEN\s*=' } |
       Select-Object -First 1
     if (-not $line) { throw "项目根 .env 未配置 AUTH_TOKEN。" }
     $token = ($line -replace '^\s*AUTH_TOKEN\s*=\s*', '').Trim().Trim('"').Trim("'")
     if (-not $token) { throw "AUTH_TOKEN 为空。" }

     $session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
     $body = @{ token = $token } | ConvertTo-Json -Compress
     $authRequest = @{
       Method = "Post"
       Uri = "$base/api/auth/verify"
       ContentType = "application/json"
       Body = $body
       WebSession = $session
     }
     $authResponse = Invoke-RestMethod @authRequest
     if (-not $authResponse.ok) { throw "本地认证失败。" }
     $authCookie = $session.Cookies.GetCookies([uri]$base)["auth_token"]
     if ($null -eq $authCookie) { throw "认证响应没有设置 session cookie。" }

     $generation = Invoke-RestMethod -Method Get -Uri "$base/api/worker/status" -WebSession $session
     if (-not $generation.ok -or $null -eq $generation.data.queue.queued -or
         $null -eq $generation.data.queue.running) {
       throw "Generation worker 状态合同失败。"
     }

     $training = Invoke-RestMethod -Method Get -Uri "$base/api/training/worker/status" -WebSession $session
     if (-not $training.ok -or $null -eq $training.data.summary.totalActive) {
       throw "Training worker 状态合同失败。"
     }

     if ($generation.data.comfyui.reachable -ne $true) {
       throw "当前 Manager 目标无法访问 ComfyUI。"
     }
   } finally {
     if ($null -ne $session) {
       $session.Cookies = [System.Net.CookieContainer]::new()
     }
     $token = $body = $authRequest = $authResponse = $authCookie = $null
     $generation = $training = $session = $line = $envPath = $null
     Remove-Variable token, body, authRequest, authResponse, authCookie, session,
       generation, training, line, envPath -ErrorAction SilentlyContinue
   }
   ```

3. API 客户端也可以只发送一个受支持请求头：`Authorization: Bearer`、`x-api-token` 或 `x-auth-token`；它们都携带同一个 `.env` token。浏览器式检查优先使用 Cookie 会话，绝不输出已构造请求头。明确要求请求头变体时，在同一个 `try` 内构造 `$headers`，并在同一个 `finally` 中清理；探测结束后不得同时保留请求头与 Cookie 会话。

## 预期结果

已发现本地服务为 `/login` 返回 HTTP 200，接受 `POST /api/auth/verify`，两个 worker-status GET 端点都返回有效响应包，并报告当前 ComfyUI 目标可达。应用与队列状态均不改变。

## 故障处理与恢复

- 遇到 401 时，从 `.env` 重新加载 token 且不显示它，并确认请求使用会话 Cookie 或一个受支持请求头；不得把 token 粘贴到日志。
- worker-status 失败时，只报告端点、HTTP 状态与安全错误文本；不得把临时队列内容复制到文档或提交中。
- ComfyUI 不可达时停止验证。启动、重启或为 ComfyUI 建立隧道属于需要独立授权的操作。
- 没有相应授权，绝不能把失败的只读检查升级为队列控制、数据库修改或服务重启。

## 验证状态

本流程整体尚未实际演练，因此 frontmatter 保持 `verificationState: not-exercised` 与 `lastVerified: null`。当前 `verifiedBy` 证明源码响应合同、测试环境中的认证行为和受控 PowerShell 清理边界，但不证明已对真实服务完整执行 Cookie 会话、请求头变体、两类 worker 状态和 ComfyUI 可达性检查。

## 上级导航

- [返回开发环境运行手册](./README.md)
