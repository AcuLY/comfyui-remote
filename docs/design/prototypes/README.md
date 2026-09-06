---
schemaVersion: 1
document:
  type: router
  status: current
  owner: product-design
  authority:
    subject: html-design-prototypes
    kind: router
  readWhen:
    - 启动或审核新版 HTML 设计原型时
    - 判断设计候选、审核结果与生产实现的边界时
  sources:
    - docs/design/prototypes/package.json
    - docs/design/prototypes/foundations/README.md
    - docs/design/prototypes/design-foundations.md
    - docs/design/prototypes/.impeccable/design.json
    - docs/design/prototypes/src/main.jsx
  verifiedBy:
    - npm --prefix docs/design/prototypes run build
    - npm run docs:check
---

# HTML 设计原型

本目录是新版界面的独立审核工程。2026-09-07 已确认将设计审核载体从 `Figma` 改为浏览器中的 HTML 原型，并先完成色彩、字体、尺寸和基础组件。当前阶段的可操作样本见[基础设计说明](foundations/README.md)和[页面入口](foundations/index.html)。

这里记录原型实际提供的候选与审核方式，不代表候选已经获得用户确认，也不代表生产代码已经实现。完整业务页面在基础设计审核之后逐步扩展。

## 审核范围

| 编号 | 分组 | 当前范围 | 状态 |
| --- | --- | --- | --- |
| P-01 | 审核载体 | 在仓库 `docs/design/prototypes/` 维护可运行 HTML 原型 | 本轮已确认 |
| P-02 | 推进顺序 | 先基础元素与小组件，再业务组合，最后完整页面及流程 | 本轮已确认 |
| P-03 | 基础设计 | 明暗主题、模块色与状态色、字体、间距、圆角、尺寸和基础控件样本 | 本轮审核候选，数值及呈现待确认 |
| P-04 | 业务组合 | 筛选工具栏、任务行、图片卡片、参数表单等 | 后续阶段，本轮未绘制完整组合 |
| P-05 | 完整页面 | 两模块的项目、任务、预制、模板及全局工具页面 | 后续阶段，本轮未开始 |

已有新版方向继续作为原型的约束：紧凑、图片优先的工作台；图像生产使用青绿色，`LoRA` 训练使用品红色，两个模块同等重要；状态语义独立；明暗主题支持实时系统跟随、持久手动选择及明确重置。沿用已选择的 `PrimeReact v10 Styled` 及 `PrimeIcons`，不复制旧 `Demo` 组件体系。具体色值、字体文件、字号、尺寸和控件表现仍需本轮审核。

## 本地运行

在仓库根目录执行：

```powershell
npm --prefix docs/design/prototypes ci
npm --prefix docs/design/prototypes run dev
```

浏览器访问 [基础设计原型](http://127.0.0.1:5178/foundations/)。开发服务仅监听 `127.0.0.1:5178`，端口已占用时直接退出，不自动改用其他端口。应通过开发服务访问；直接双击源码 HTML 不会执行依赖构建。

构建检查：

```powershell
npm --prefix docs/design/prototypes run build
npm run docs:check
```

前一条命令构建本目录原型，后一条检查仓库文档。原型构建成功不代表应用测试、生产构建或部署完成。

## 工程组成

| 位置 | 职责 |
| --- | --- |
| `foundations/index.html` | 基础设计页面的浏览器入口 |
| `foundations/README.md` | 基础候选编号、数值说明和审核顺序 |
| [design-foundations.md](design-foundations.md) | 从实际样本提取的原型基准、组件来源及已验证范围；具体设计仍待审核 |
| [.impeccable/design.json](.impeccable/design.json) | `Impeccable` `schemaVersion 2` 原型扩展 `sidecar`，仅记录元信息及静态组件摘录 |
| `src/main.jsx` | `PrimeReact` 组件样本及本地演示交互 |
| `src/tokens.css` | 原型的基础、模块与语义变量 |
| `src/prototype.css` | 原型布局、组件呈现与响应式样式 |
| `package.json`、`package-lock.json` | 与根应用分开的依赖及可重复安装记录 |

技术基线为 `React` `19.2.4`、`Vite` `8.2.2`、`PrimeReact` `10.9.9` `Styled` 与 `PrimeIcons` `7.0.0`。字体通过本工程依赖自托管：`@fontsource-variable/geist@5.3.0`、`@fontsource-variable/noto-sans-sc@5.3.0`、`@fontsource/ibm-plex-mono@5.3.0`。实际锁定版本以本目录依赖清单为准。

`Impeccable` 用作项目内的界面设计与审核指导，由智能体按其技能入口使用；它不是浏览器运行框架，也不增加到原型运行时依赖中。

## `Impeccable` 安装与使用

1. 项目级技能已安装在 [.agents/skills/impeccable/SKILL.md](../../../.agents/skills/impeccable/SKILL.md)，技能版本为 `4.2.1`，本地引擎版本为 `0.1.2`。来源、许可和安装命令保存在[安装记录](../../../.impeccable/installation.json)；引擎二进制是被忽略的本机产物，其他机器可由随附启动器下载锁定版本。仓库适配仅为默认提示补充技能名称及清除三个上游参考文件的尾部空白；技能检查已通过。
2. 项目 `hook` 适配器只把 `docs/design/prototypes/` 的界面编辑交给官方检测器，并保留既有文件访问 `hook`。自动执行仍取决于 `Codex` 对项目 `hook` 的启用状态；需要手动复核时，在仓库根目录明确列出四个源码目标，避免递归扫描依赖目录：

```powershell
.agents/skills/impeccable/scripts/impeccable.cmd detect docs/design/prototypes/src/main.jsx docs/design/prototypes/src/prototype.css docs/design/prototypes/src/tokens.css docs/design/prototypes/foundations/index.html
```

3. [原型基准](design-foundations.md)采用本仓库 `design` 文档元数据；[局部 sidecar](.impeccable/design.json)采用 `Impeccable` 扩展格式，预览宿主需要加载原型变量，不能假定根面板会自动发现局部文件。`src/tokens.css` 始终是候选色值唯一来源，两份记录都不会把候选提升为生产规范。
4. 根 `PRODUCT.md` 的旧 `schema` 提示只涉及以后可选的 `Impeccable` `init` 格式适配，不影响本轮有界原型记录；本轮未据此重写产品契约。安装技能、检测通过与用户确认设计是三个独立状态。

## 交付与后续使用

按基础说明中的 `F-01` 等编号记录修改意见或确认结果。修改候选时同步页面、变量和说明；未确认的候选保持待审核身份，不自动变成新版生产契约。基础方向确认后，下一阶段将复用这些元素做业务组合，再检查完整流程。

本工程使用本地模拟数据，不调用生产 API、不读取应用登录令牌、不连接数据库、不控制工作队列。原型 `node_modules/` 和构建产物不提交；正式实施时需要另行完成接口接入、业务状态和应用验证。当前生产设计仍查阅[设计文档](../README.md)及[根设计契约](../../../DESIGN.md)。

## 上级路由

- [设计文档](../README.md)
