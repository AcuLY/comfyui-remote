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
    - 判断已确认基础、后续设计与生产实现的边界时
  sources:
    - docs/design/prototypes/package.json
    - docs/design/prototypes/foundations/README.md
    - docs/design/prototypes/design-foundations.md
    - docs/design/prototypes/ui-design-roadmap.md
    - docs/design/prototypes/reviews/R01.md
    - docs/design/prototypes/reviews/F-responsive.md
    - docs/design/prototypes/.impeccable/design.json
    - docs/design/prototypes/src/main.jsx
    - docs/design/prototypes/src/lists.jsx
    - docs/design/prototypes/src/use-prototype-preference.jsx
    - docs/design/prototypes/src/foundations.css
  verifiedBy:
    - npm --prefix docs/design/prototypes run build
    - npm run docs:check
---

# HTML 设计原型

本目录是新版界面的独立审核工程。2026-09-07 已确认将设计审核载体从 `Figma` 改为浏览器中的 HTML 原型；2026-09-08 用户确认了原始基础方案。当前[基础原型](http://127.0.0.1:5178/foundations/)的各视口修订稿已具备，待用户复审；改前审计、八视口矩阵、实际检查、独立审查及验证限制见[基础适配审核记录](reviews/F-responsive.md)。规则保留及复审范围分别见[基础规范](design-foundations.md)与[基础清单](foundations/README.md)。

原始基础确认覆盖 `P-03` 与 `F-01`～`F-14`，基线源提交为 `7fdf13de`；当前仅重新审核 `F-07` 设备尺寸、`F-08`～`F-12` 设备呈现及 `F-14` 响应式适配。已明确的色相、字体、语义规则和固定标准密度保持。设备呈现重新审核不取消全部基础，也不代表后续页面或生产实现完成。

用户已同意按[全前端界面设计路线](ui-design-roadmap.md)逐项推进，但当前明确暂停继续扩展列表、后续组件组合和完整页面，先完成基础适配并取得用户确认。`R01-01` 已有列表稿和历史验证保留在 [R01 审核记录](reviews/R01.md)，不删除、不继续扩展，也不据其通过记录代替本轮基础审核。

## 审核范围

| 编号 | 分组 | 当前范围 | 状态 |
| --- | --- | --- | --- |
| P-01 | 审核载体 | 在仓库 `docs/design/prototypes/` 维护可运行 HTML 原型 | 已确认，2026-09-07 |
| P-02 | 推进顺序 | 先基础元素与小组件，再业务组合，最后完整页面及流程 | 已确认，2026-09-07 |
| P-03 | 基础设计 | 保留已确认原则，基础页设备尺寸、组件呈现与响应式已形成修订稿 | `F-07`、`F-08`～`F-12` 设备呈现和 `F-14` 待用户复审；最终审查结果见审核记录 |
| P-04 | 业务组合 | 筛选工具栏、任务行、图片卡片、参数表单等 | 暂停继续扩展；R01-01 已有稿保留，未获组合确认 |
| P-05 | 完整页面 | 两模块的项目、任务、预制、模板及全局工具页面 | 未开始，待基础适配获用户确认后恢复路线 |

已确认的新版基础是紧凑、图片优先的工作台：图像生产使用绿色，`LoRA` 训练使用玫瑰粉，两个模块同等重要；状态语义独立；明暗主题支持实时系统跟随、持久手动选择及明确重置。沿用已选择的 `PrimeReact v10 Styled` 及 `PrimeIcons`，不复制旧 `Demo` 组件体系。具体色值、字体文件、字号、尺寸和控件表现以已确认规范及其源码为准，后续调整按原编号记录。

## 本地运行

在仓库根目录执行：

```powershell
npm --prefix docs/design/prototypes ci
npm --prefix docs/design/prototypes run dev
```

浏览器访问 [基础设计原型](http://127.0.0.1:5178/foundations/)。开发服务仅监听 `127.0.0.1:5178`，端口已占用时直接退出，不自动改用其他端口。应通过开发服务访问；直接双击源码 HTML 不会执行依赖构建。

当前审核重点为[基础原型](http://127.0.0.1:5178/foundations/)。[列表组合](http://127.0.0.1:5178/components/lists/)继续保留供回查，对应 `components/lists/index.html`；历史范围、验证与暂停边界记录在 [R01 审核记录](reviews/R01.md)，本轮不继续扩展。

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
| `foundations/README.md` | 基础编号、保留规则、重新审核的设备呈现范围 |
| [design-foundations.md](design-foundations.md) | 基础规范、重新审核边界及后续复用条件 |
| [reviews/F-responsive.md](reviews/F-responsive.md) | 当前基础页各视口审计、整改计划、同轮验证和恢复条件 |
| [ui-design-roadmap.md](ui-design-roadmap.md) | 覆盖全前端的设计顺序、页面与组件清单、逐项审核状态 |
| `components/lists/index.html` | `R01-01` 已有列表稿，保留并暂停继续扩展 |
| [reviews/R01.md](reviews/R01.md) | 已有列表子项、模拟行为、历史验证与暂停说明 |
| [.impeccable/design.json](.impeccable/design.json) | `Impeccable` `schemaVersion 2` 原型扩展 `sidecar`，仅记录元信息及静态组件摘录 |
| `src/main.jsx` | `PrimeReact` 组件样本及本地演示交互 |
| `src/lists.jsx`、`src/lists.css` | 列表组合、模拟数据、桌面表格与手机卡片及其适配样式 |
| `src/use-prototype-preference.jsx` | 基础和列表两原型共用的主题及模块偏好；实时系统跟随、手动覆盖与持久保存；密度固定标准，不读写密度偏好 |
| `src/tokens.css` | 原型的基础、模块与语义变量 |
| `src/prototype.css` | 原型布局、组件呈现与响应式样式 |
| `src/foundations.css` | 基础页专属设备适配；由基础入口的 `data-prototype="foundations"` 启用，不在列表入口加载 |
| `package.json`、`package-lock.json` | 与根应用分开的依赖及可重复安装记录 |

技术基线为 `React` `19.2.4`、`Vite` `8.2.2`、`PrimeReact` `10.9.9` `Styled` 与 `PrimeIcons` `7.0.0`。字体通过本工程依赖自托管：`@fontsource-variable/geist@5.3.0`、`@fontsource-variable/noto-sans-sc@5.3.0`、`@fontsource/ibm-plex-mono@5.3.0`。实际锁定版本以本目录依赖清单为准。

全原型按用户指示固定标准密度：桌面通用控件高 `36px`、行垂直内边距 `12px`，手机继续使用独立尺寸。当前不提供密度选择器，也不读取或保存旧密度偏好；历史审核记录中的密度比较仅说明当时的检查，不代表当前能力。

`Impeccable` 用作项目内的界面设计与审核指导，由智能体按其技能入口使用；它不是浏览器运行框架，也不增加到原型运行时依赖中。

## `Impeccable` 安装与使用

1. 项目级技能已安装在 [.agents/skills/impeccable/SKILL.md](../../../.agents/skills/impeccable/SKILL.md)，技能版本为 `4.2.1`，本地引擎版本为 `0.1.2`。来源、许可和安装命令保存在[安装记录](../../../.impeccable/installation.json)；引擎二进制是被忽略的本机产物，其他机器可由随附启动器下载锁定版本。仓库适配仅为默认提示补充技能名称及清除三个上游参考文件的尾部空白；技能检查已通过。
2. 项目 `hook` 适配器只把 `docs/design/prototypes/` 的界面编辑交给官方检测器，并保留既有文件访问 `hook`。自动执行仍取决于 `Codex` 对项目 `hook` 的启用状态；需要手动复核时，在仓库根目录明确列出四个源码目标，避免递归扫描依赖目录：

```powershell
.agents/skills/impeccable/scripts/impeccable.cmd detect docs/design/prototypes/src/main.jsx docs/design/prototypes/src/prototype.css docs/design/prototypes/src/tokens.css docs/design/prototypes/foundations/index.html
```

3. [基础规范](design-foundations.md)采用本仓库 `design` 文档元数据；[局部 sidecar](.impeccable/design.json)采用 `Impeccable` 扩展格式，预览宿主需要加载原型变量，不能假定根面板会自动发现局部文件。`src/tokens.css` 始终是已确认色值的唯一来源；两份记录指导新版设计，现有生产样式的生效来源仍由根设计契约界定。
4. 根 `PRODUCT.md` 的旧 `schema` 提示只涉及以后可选的 `Impeccable` `init` 格式适配，不影响本轮有界原型记录；本轮未据此重写产品契约。安装技能、检测通过与用户确认设计是三个独立状态。

## 交付与后续使用

按基础清单中的 `F-01` 等编号记录调整。当前先完成[基础适配审核](reviews/F-responsive.md)：保留已明确的色相、字体和标准密度，重新审核指定设备呈现。用户确认基础适配后，再恢复后续组合和页面设计；已有列表稿按实际受影响范围复核，不自动获得确认。

本工程使用本地模拟数据，不调用生产 API、不读取应用登录令牌、不连接数据库、不控制工作队列。原型 `node_modules/` 和构建产物不提交；正式实施时需要另行完成接口接入、业务状态和应用验证。当前生产设计仍查阅[设计文档](../README.md)及[根设计契约](../../../DESIGN.md)。

## 上级路由

- [设计文档](../README.md)
