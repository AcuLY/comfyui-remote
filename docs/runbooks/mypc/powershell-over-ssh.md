---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: mypc-operations
  authority:
    subject: operations/mypc-powershell-over-ssh
    kind: operational
  readWhen:
    - 从 macOS 或 zsh 通过 SSH 向 mypc 传输复杂 PowerShell 时
  sources:
    - AGENTS.md
  verifiedBy:
    - npm run docs:check
  environment:
    - 带有 ssh、iconv 与 base64 且目标为 Windows 主机 mypc 的 macOS 或 zsh client
  risk: 编码只保护引号语义，不授权远程操作；拆分探测，并在任何修改前遵循对应 Git 或部署运行手册。
  recovery: "#故障处理与恢复"
  verificationState: not-exercised
  lastVerified: null
---

# 通过 SSH 在 `mypc` 上运行 PowerShell

## 适用场景

从 macOS/zsh 通过 SSH 发送的命令包含管道、`$`/`$_`、通配符、括号、SQL、JSON、嵌套引号或多行逻辑时，使用编码 PowerShell。含义无歧义的简单命令可以使用普通 SSH 引号。

本流程只负责传输。远程脚本暂存文件、拉取、写入锁或数据库、控制队列、构建或重启服务前，先阅读 Git 或部署运行手册。

## 前置条件

- 本地 client 已安装 `ssh`、`iconv` 与 `base64`。
- 已配置 `mypc` SSH 主机，并确认目标仓库路径。
- 包含 `[]` 的本地 zsh 路径必须加引号，例如 `'src/app/items/[itemId]/page.tsx'`，防止 zsh 展开。

## 操作步骤

1. 一个原样多行文档中只放一个连贯的远程操作。把 PowerShell 文本编码为 UTF-16LE，移除 base64 换行，再作为 `-EncodedCommand` 传入：

   ```bash
   script=$(cat <<'PS'
   Set-Location "D:\Luca\Code\MyProject\comfyui-manager"
   git status --short
   PS
   )
   encoded=$(printf '%s' "$script" | iconv -f UTF-8 -t UTF-16LE | base64 | tr -d '\n')
   ssh mypc powershell -NoProfile -EncodedCommand "$encoded"
   ```

2. 把慢速或容易失败的状态工作拆成独立 SSH 调用。尤其不要把进程枚举、监听发现、网络请求和数据库探测合并成一个不透明命令，以免挂起后无法识别阶段。

3. 脚本与输出中不得包含秘密。认证材料只在目标端读入变量，并抑制任何可能包含它的响应或 header。

4. 在远程脚本中检查 `$LASTEXITCODE`，或遇错即终止。SSH 传输完成不能证明应用操作成功；必须另行验证所属操作。

## 预期结果

PowerShell 接收到预期脚本，不发生 zsh 插值或嵌套引号漂移，并且每个远程阶段都有可独立观察的退出结果。

## 故障处理与恢复

- 编码或 SSH 在执行前失败时，修复传输并重试同一只读探测；不得换成未经审查的单行引号结构。
- 远程脚本部分执行时，停止并检查所属操作状态，再决定是否重试。部署工作要保留目标锁与已记录 Generation 批次。
- 命令挂起时中断该 SSH 调用，并运行更小的只读探测定位阶段；不得以停止所有远程 Node 进程作为响应。

## 验证状态

本流程尚未实际演练。当前 `verifiedBy` 只静态检查 UTF-16LE 编码方式、引号规则和文档合同，不执行 SSH 命令或远程修改。

## 上级导航

- [返回 `mypc` 运行手册](./README.md)
