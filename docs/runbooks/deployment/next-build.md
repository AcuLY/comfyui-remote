---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: deployment-operations
  authority:
    subject: operations/deployment-next-build
    kind: operational
  readWhen:
    - 部署期间生成生产 Next.js 构建时
    - 诊断竞争构建或失败的生产构建时
  sources:
    - AGENTS.md
    - package.json
    - next.config.ts
    - .gitignore
  verifiedBy:
    - npm run docs:check
  environment:
    - 已获取部署锁的 Windows 生产检出
  risk: 绝不与其他构建竞争，也不删除整个 .next；保留 .next/cache 且不得干扰活跃的 Next.js 开发服务。
  recovery: "#故障处理与恢复"
  verificationState: not-exercised
  lastVerified: null
---

# Next.js 生产构建

## 适用场景

完成目标选择、两次 worker 状态门、所有必要 Generation 暂停和数据库同步后使用本流程。构建成功后必须先[重启服务](./service-restart.md)，再进行[部署验证](./verification.md)。

不得只为验证仅开发或仅文档变更而运行生产构建。

## 前置条件

- 持有目标检出的部署锁。
- 确认 Training 空闲，并记录本次部署暂停的所有 Generation 批次。
- 如果该检出正在运行 `next dev`，不得清理 `.next` 或 `.next/dev`。除非另行协调并授权生产构建位置，否则优先对该开发服务做验证。

## 操作步骤

1. 检查本仓库范围内是否已有构建进程：

   ```powershell
   $repo = "D:\Luca\Code\MyProject\comfyui-manager"
   $builds = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
     Where-Object {
       $_.CommandLine -like "*$repo*" -and
       ($_.CommandLine -like '*next*build*' -or $_.CommandLine -like '*.next\build*')
     })
   if ($builds.Count -gt 0) {
     $builds | Select-Object ProcessId, ParentProcessId, CreationDate
     throw "本仓库范围内已有活跃 Next 构建。"
   }
   ```

2. 保留 `.next/cache`。不得运行 `Remove-Item -Recurse -Force .next`，也不得删除 `.next/cache`。正常 Next 构建清理与新的 `BUILD_ID` 会替换生产输出，同时保留缓存。

3. 如果 Next 报告 `Another next build process is already running`，重复进程检查。只有证明不存在 `next build` 或 `.next\build` 进程后，才能把孤立 `.next/lock` 视为过期并删除。

4. 在精确 `$repo` 下运行仓库要求的 webpack 构建，并把输出写入已忽略的构建专用日志。无论成功或失败都必须恢复调用方原工作目录：

   ```powershell
   # runbook-contract: deployment-next-build
   Push-Location -LiteralPath $repo
   try {
     & npx next build --webpack *> build-prod.log
     if ($LASTEXITCODE -ne 0) { throw "生产构建失败；检查 build-prod.log。" }
   } finally {
     Pop-Location
   }
   ```

5. 检查 `build-prod.log` 与 `.next/diagnostics` 中的成功证据及意外警告。随后直接进入服务重启；替换旧生产进程前，新构建尚未生效。

## 预期结果

目标检出恰好完成一个 webpack 生产构建，`.next/cache` 得到保留，构建诊断可供审查，并且部署进入重启而不是直接进入验收。

## 故障处理与恢复

- 另一个构建活跃时等待或与其 owner 协调；不得启动第二个构建，也不得删除其锁。
- 构建失败时，在重试前检查专用日志与 `.next/diagnostics`。保留部署锁和所有已记录 Generation 批次。
- 只有重启并验证资源后才能诊断过期分块导致的 500。只清理已证明的非缓存工件区域，例如 `.next/static`、`.next/server`、`.next/types`、清单或跟踪文件；没有新授权绝不能把清理扩大到 `.next/cache`。
- 构建失败后不得重启生产服务。

## 验证状态

本流程尚未实际演练。当前 `verifiedBy` 只静态检查构建命令、进程过滤器、缓存边界、Next.js 配置和受控清理合同，不执行生产构建、工件清理或过期锁删除。

## 上级导航

- [返回生产部署运行手册](./README.md)
