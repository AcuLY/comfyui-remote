---
schemaVersion: 1
document:
  type: router
  status: current
  owner: mypc-operations
  authority:
    subject: operations/mypc
    kind: router
  readWhen:
    - 从 macOS 或 zsh 通过 SSH 向 mypc 发送复杂 PowerShell 时
    - 跨远程命令行边界保留 PowerShell 引号语义时
  sources:
    - AGENTS.md
  verifiedBy:
    - npm run docs:check
---

# `mypc` 运行手册

## 目的与权威边界

本区域负责通过 SSH 向 Windows 主机 `mypc` 安全传输 PowerShell 调用。它不授权被传输命令产生的 Git、数据库、队列、构建、服务或部署影响；执行这些操作前必须先阅读对应运行手册。

## 何时阅读

- 远程 PowerShell 命令包含管道、变量、通配符、括号、SQL、JSON、嵌套引号或多行逻辑。
- 包含 `[]` 的路径跨越本地 zsh 边界。

## 导航

| 任务 | 阅读 | 原因 |
| --- | --- | --- |
| 编码并运行远程 PowerShell | [通过 SSH 运行 PowerShell](./powershell-over-ssh.md) | 使用 UTF-16LE 编码命令，并拆分慢速探测。 |

## 上级导航

- [返回运行手册](../README.md)
