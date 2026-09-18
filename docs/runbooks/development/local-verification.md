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
    - 判断 worker 状态 GET 是否可能创建本地 SSH 隧道进程时
  sources:
    - .env.example
    - src/proxy.ts
    - src/app/api/auth/verify/route.ts
    - src/app/api/worker/status/route.ts
    - src/app/api/training/worker/status/route.ts
    - src/server/services/comfy-target.ts
    - src/server/services/comfyui-service.ts
    - src/server/services/comfy-ssh.ts
    - src/server/worker/training/scheduler.ts
  verifiedBy:
    - node --import tsx --test tests/test-api-request-json.test.ts tests/test-proxy-dev-internal-paths.test.ts tests/test-training-worker-entrypoints.test.ts tests/test-work-mode-resource-boundary.test.ts
    - powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/runbook-contract-harness.ps1
    - npm run docs:check
  environment:
    - 已运行 Next.js 开发或生产服务的本地 Windows 检出
  risk: 认证后的应用数据探测不写队列或数据库，但 Generation worker 状态 GET 在 SSH 自动隧道目标下可能创建分离式 ssh 操作系统进程；必须事前分类并授权。
  recovery: "#故障处理与恢复"
  verificationState: exercised
  lastVerified: "2026-07-13"
---

# 本地验证

## 适用场景

本流程用于验证一个已运行的本地服务是否提供公开登录路由、认证合同、Generation worker 状态、Training worker 状态与 ComfyUI 可达性。认证握手之后的应用探测只调用 GET，不会创建项目、入队工作、控制队列或写数据库。

但是，`GET /api/worker/status` 不能称为操作系统层面的完全只读：该路由调用 `checkComfyUIReachability()`，随后调用 `ensureActiveComfySshTunnel()`。当活跃目标是启用自动隧道的 SSH 目标，且本地转发尚未可用时，服务端会以 `detached: true` 启动 `ssh` 进程。这个副作用发生在 GET 内部，必须在请求前完成授权，不能等响应返回后再判断。

控制 `next dev` 进程时使用[开发服务](./dev-service.md)。进行生产验收或公开验证时使用[部署验证](../deployment/verification.md)。

## 前置条件

- 发现目标仓库范围 `next dev` 或 `next start` 进程拥有的真实监听。不得根据熟悉的端口号推断服务类型。
- 只把项目根 `.env` 中的 `AUTH_TOKEN` 读入内存。绝不能硬编码、输出、记录、提交或写入证据。
- 只有当前验证范围明确指定页面时，才允许额外访问受保护页面 GET。除 `/api/auth/verify` 外的任何 POST/PUT/PATCH/DELETE 都需要单独授权。
- 在调用 `/api/worker/status` 前，从 `COMFY_TARGET_CONFIG_PATH`、`COMFY_ACTIVE_TARGET`、目标的 `mode`/`tunnelAutoStart` 和 `COMFY_SSH_TUNNEL_AUTO_START` 完成副作用分类，但不得输出私有配置值：

  - 活跃目标为本地目标，或 SSH 目标明确禁用自动隧道时，记录 `$sshTunnelPreflight = "无需创建进程"`。
  - 活跃目标为 SSH 且自动隧道生效时，即使当前本地端口已监听，也必须先获得“本次 GET 可能创建分离式 ssh 进程”的明确授权，再记录 `$sshTunnelPreflight = "已授权可能创建进程"`。现有监听可能在请求前消失，不能据此免除授权。
  - 无法确定目标模式、自动启动配置或授权状态时，不得调用 `/api/worker/status`，也不能声称完成了 ComfyUI 可达性验证。

## 操作步骤

1. 使用所属服务运行手册中的进程树/监听发现，从真实监听构造 `$base`：

   ```powershell
   $port = [int]$serviceListener.LocalPort
   $base = "http://127.0.0.1:$port"
   if ((Invoke-WebRequest -Uri "$base/login" -MaximumRedirection 0).StatusCode -ne 200) {
     throw "本地登录路由没有返回 HTTP 200。"
   }
   ```

2. 在内存中记录请求前已有的 `ssh.exe` PID 与创建时间，只用于请求后识别新增进程；不要输出完整命令行、主机、密钥路径或 token。成功隧道由当前 Manager 服务进程中的 `comfy-ssh` 模块按目标 ID 记录归属，但子进程以分离方式启动且已 `unref`，可能在 HTTP 请求结束后继续存在。

3. 从精确 `$repo` 下的 `.env` 加载 token，不输出其值，再通过必需的 `POST` 路由认证。token、序列化请求体、请求参数、响应、Cookie 与会话必须全部位于同一个 `try/finally` 中。响应会在内存网络会话中设置 `auth_token` Cookie；无论成功还是失败，`finally` 都要先替换 Cookie 容器，再清理每个敏感或 token 派生变量。副作用预检没有得到两个允许值之一时，代码必须在读取 token 和发送请求前失败：

   ```powershell
   # runbook-contract: local-authentication-verification
   if ($sshTunnelPreflight -notin @("无需创建进程", "已授权可能创建进程")) {
     throw "尚未完成 worker 状态 GET 的 SSH 隧道副作用预检与授权。"
   }

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

4. 请求结束后比较 `ssh.exe` PID 基线。如果出现与本次活跃目标和本地转发相符的新进程，只记录脱敏的 PID、创建时间、目标 ID 和本地端口归属，不记录完整命令行。不能仅凭进程名认领或终止其他 SSH 会话。
5. API 客户端也可以只发送一个受支持请求头：`Authorization: Bearer`、`x-api-token` 或 `x-auth-token`；它们都携带同一个 `.env` token。浏览器式检查优先使用 Cookie 会话，绝不输出已构造请求头。明确要求请求头变体时，在同一个 `try` 内构造 `$headers`，并在同一个 `finally` 中清理；探测结束后不得同时保留请求头与 Cookie 会话。

## 预期结果

已发现本地服务为 `/login` 返回 HTTP 200，接受 `POST /api/auth/verify`，两个 worker-status GET 端点都返回有效响应包，并报告当前 ComfyUI 目标可达。应用、数据库与队列状态不改变。若事前授权覆盖了 SSH 自动隧道，操作系统中可能新增一个归属于当前 Manager 目标的分离式 `ssh` 进程；这必须作为验证副作用单独记录，不能写成“所有状态均未改变”。

## 故障处理与恢复

- 遇到 401 时，从 `.env` 重新加载 token 且不显示它，并确认请求使用会话 Cookie 或一个受支持请求头；不得把 token 粘贴到日志。
- worker-status 失败时，只报告端点、HTTP 状态与安全错误文本；不得把临时队列内容复制到文档或提交中。
- 没有 SSH 隧道副作用授权时，跳过 `/api/worker/status`，不要以“只是 GET”为理由发送请求，也不要声称已完成 ComfyUI 可达性验证。
- `ensureSshTunnel()` 只会在启动失败时主动终止刚创建的子进程。成功启动的隧道目前没有公开停止 API；进程归属表只存在于创建它的 Manager Node 进程内，服务重启后不能依赖该内存表恢复归属。因此本流程不能承诺自动撤销成功隧道。
- 如果明确要求关闭本次新增隧道，必须取得单独授权，并用请求前后 PID、创建时间、目标 ID 和本地转发端口证明精确归属；不得使用 `Stop-Process -Name ssh` 或终止未证明归属的 SSH 进程。无法精确归属时保留进程并报告恢复限制。
- ComfyUI 不可达时停止验证。不得把失败检查升级为队列控制、数据库修改、服务重启或额外 SSH/ComfyUI 控制操作。

## 验证状态

本流程已于 2026-07-13 在真实本地生产服务上演练登录路由、Cookie 会话认证、Generation 与 Training 两类 worker 状态，以及 ComfyUI 可达性检查；演练时活跃目标不需要创建 SSH 隧道。当前 `verifiedBy` 继续覆盖源码响应合同、测试环境中的认证行为、SSH 隧道事前门禁和受控 PowerShell 清理边界。启用自动隧道的 SSH 目标、分离式 SSH 隧道创建、精确归属和恢复仍未实际演练，不能从本次状态提升为已验证行为。

## 上级导航

- [返回开发环境运行手册](./README.md)
