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
    - docs/design/prototypes/reviews/R01-02.md
    - docs/design/prototypes/reviews/F-responsive.md
    - docs/design/prototypes/reviews/F-theme.md
    - docs/design/prototypes/.impeccable/design.json
    - docs/design/prototypes/src/main.jsx
    - docs/design/prototypes/src/lists.jsx
    - docs/design/prototypes/src/organization.jsx
    - docs/design/prototypes/src/use-prototype-preference.jsx
    - docs/design/prototypes/src/foundations.css
    - docs/design/prototypes/src/prototype-provider.jsx
    - docs/design/prototypes/src/prototype-layout.css
    - docs/design/prototypes/src/theme/primereact.css
    - docs/design/prototypes/src/theme/theme-inputs.mjs
    - docs/design/prototypes/src/theme/vendor/primereact-sass-theme/UPSTREAM.json
    - docs/design/prototypes/scripts/build-theme.mjs
  verifiedBy:
    - npm --prefix docs/design/prototypes run build
    - npm run docs:check
---

# HTML 设计原型

本目录是新版界面的独立审核工程。用户已将设计审核载体从 `Figma` 改为 HTML，并确认过 `8029fdfb` 基础版本。**基础统一主题版已制作，待用户审核**：[基础入口](http://127.0.0.1:5178/foundations/)已使用固定官方源生成的组件主题与统一提供器，色相、白底、字体和页面布局方向保持。指定四主题、六视口尺寸和交互检查已记录，截图与最终交付结果见[统一主题审核页](reviews/F-theme.md)。

原始基础与后续适配、数字输入局部修订保留在[历史记录](reviews/F-responsive.md)，不代替新生成主题的验证。当前组件内部结构、状态、焦点与真实触控尺寸重新检查；其余浅色中性色去色比较未采纳，不扩大为新业务页面。

用户于2026-09-09确认 [R01-01 列表组合](reviews/R01.md)的 `30fd53db` 版本，并要求继续下一项。当前制作 [R01-02 层级、手动排序与移动到](reviews/R01-02.md)，沿用共享提供器、生成主题和 `prototype-layout.css`；各入口局部样式只负责页面布局。列表确认不扩大为整个 `R01`、`C03` 或业务页面获批。

## 审核范围

| 编号 | 分组 | 当前范围 | 状态 |
| --- | --- | --- | --- |
| P-01 | 审核载体 | 在仓库 `docs/design/prototypes/` 维护可运行 HTML 原型 | 已确认，2026-09-07 |
| P-02 | 推进顺序 | 先基础元素与小组件，再业务组合，最后完整页面及流程 | 已确认，2026-09-07 |
| P-03 | 基础设计 | 官方完整组件主题、统一入口与独立页面布局，保留既有设计方向 | 统一主题版已制作，待用户审核；已测范围和最终门禁分别记录 |
| P-04 | 业务组合 | 筛选工具栏、任务行、图片卡片、参数表单等 | R01-01 已确认（`30fd53db`）；R01-02 待用户审核；其余未开始 |
| P-05 | 完整页面 | 两模块的项目、任务、预制、模板及全局工具页面 | 未开始，按路线依赖逐项推进 |

保留的方向是紧凑、图片优先、两模块同等重要的工作台，状态语义独立，明暗主题支持系统跟随与手动选择。组件运行依赖保持 `PrimeReact 10.9.9 Styled`，主题构建工具按本目录清单单独锁定。新组件主题从 `src/tokens.css` 这一份色值来源生成，具体新呈现和交互以本轮实际审核为准。

## 本地运行

在仓库根目录执行：

```powershell
npm --prefix docs/design/prototypes ci
npm --prefix docs/design/prototypes run dev
```

浏览器访问 [基础设计原型](http://127.0.0.1:5178/foundations/)。开发服务仅监听 `127.0.0.1:5178`，端口已占用时直接退出，不自动改用其他端口。应通过开发服务访问；直接双击源码 HTML 不会执行依赖构建。

当前审核重点为[层级、手动排序与移动到](http://127.0.0.1:5178/components/organization/)，对应 `components/organization/index.html`；范围、验证与批准边界记录在 [R01-02 审核记录](reviews/R01-02.md)。[列表组合](http://127.0.0.1:5178/components/lists/)保留已确认版本，[基础原型](http://127.0.0.1:5178/foundations/)继续作为共同主题与基础组件的参考入口。

构建检查：

```powershell
npm --prefix docs/design/prototypes run build
npm run docs:check
```

前一条命令构建本目录原型，后一条检查仓库文档。原型构建成功不代表应用测试、生产构建或部署完成。

当前脚本定义中，开发启动先生成主题，构建先检查生成主题是否匹配源码。修改主题变量或映射后可显式更新并检查：

```powershell
npm --prefix docs/design/prototypes run theme:build
npm --prefix docs/design/prototypes run theme:check
```

`theme:build` 写入生成CSS，`theme:check` 只比对，不自动修复陈旧产物；本轮实际执行结果记录在统一主题审核页。

## 工程组成

| 位置 | 职责 |
| --- | --- |
| `foundations/index.html` | 基础设计页面的浏览器入口 |
| `foundations/README.md` | 基础编号、保留方向和本轮统一主题审核范围 |
| [design-foundations.md](design-foundations.md) | 基础规则、新主题职责和旧版本边界 |
| [reviews/F-theme.md](reviews/F-theme.md) | 当前官方主题生成方案、入口职责和待测记录 |
| [reviews/F-responsive.md](reviews/F-responsive.md) | 旧适配、局部原生修订及批准历史，不充当新主题验证 |
| [ui-design-roadmap.md](ui-design-roadmap.md) | 覆盖全前端的设计顺序、页面与组件清单、逐项审核状态 |
| `components/lists/index.html` | `R01-01` 已确认列表稿（`30fd53db`） |
| [reviews/R01.md](reviews/R01.md) | 当前列表子项、模拟行为、本轮验证与历史交付 |
| `components/organization/index.html` | `R01-02` 层级、手动排序与移动到原型 |
| [reviews/R01-02.md](reviews/R01-02.md) | 当前组织子项、模拟行为、待测场景与用户审核 |
| [.impeccable/design.json](.impeccable/design.json) | `Impeccable` `schemaVersion 2` 原型扩展 `sidecar`，仅记录元信息及静态组件摘录 |
| `src/main.jsx` | `PrimeReact` 组件样本及本地演示交互 |
| `src/lists.jsx`、`src/lists.css` | 列表组合、模拟数据、桌面表格与手机卡片及其适配样式 |
| `src/organization.jsx`、`src/organization.css` | 文件夹定位、内容多选、排序与移动对话框及其响应式布局 |
| `src/use-prototype-preference.jsx` | 各原型共用的主题及模块偏好；实时系统跟随、手动覆盖与持久保存；密度固定标准，不读写密度偏好 |
| `src/tokens.css` | 唯一色值来源，供页面变量及本轮主题生成读取 |
| `src/theme/theme-inputs.mjs` | 从语义变量映射官方主题参数，并集中定义标准／触控尺寸 |
| `src/theme/vendor/primereact-sass-theme/` | 固定官方纯 `Sass` 快照：88份基础样式及浅／深两份变量文件，保留来源清单与许可，不包含包脚本或 `JavaScript` |
| `scripts/build-theme.mjs` | 只读编译本地快照生成四主题与两种设备变体；支持生成和只读新鲜度检查 |
| `src/theme/primereact.css` | 生成的浅／深×生产／训练组件主题；组件内部结构和焦点由官方源提供 |
| `src/prototype-provider.jsx` | 基础与列表共用的提供器行为、库语言配置、字体及主题导入 |
| `src/prototype-layout.css` | 基础与列表共用的页面布局，不承担组件内部样式定制 |
| `src/foundations.css` | 清理后的基础视口布局，保留页面结构并移除透明热区等内部覆盖 |
| `package.json`、`package-lock.json` | 与根应用分开的依赖及可重复安装记录 |

技术基线为 `React` `19.2.4`、`Vite` `8.2.2`、`PrimeReact` `10.9.9` `Styled` 与 `PrimeIcons` `7.0.0`。字体通过本工程依赖自托管：`@fontsource-variable/geist@5.3.0`、`@fontsource-variable/noto-sans-sc@5.3.0`、`@fontsource/ibm-plex-mono@5.3.0`。实际锁定版本以本目录依赖清单为准。

官方主题源采用仓库内固定纯样式快照，不通过 `npm` 安装 `Git` 主题包；`UPSTREAM.json` 记录来源仓库、完整提交与上游 `10.8.5` 版本，`MIT` 许可保留。主题编译工具锁定 `primereact-theme-sass=npm:sass@1.63.6`，运行组件库仍为10.9.9。来源与兼容性边界详见[统一主题记录](reviews/F-theme.md)，不把快照称为 `10.9.9` 完整源码。

密度保持固定标准，不提供选择器或保存密度偏好。按用户本轮确认，桌面普通控件36px，手机／粗指针普通控件40px，可编辑输入字号16px，纯图标按钮、关闭及分页动作保留真实44px。列表手机工具栏内边距12px、字段间距8px。此前44px基础表单、标签点击和选择操作的实测保留在统一主题审核页；本轮调整与实际验证见[R01审核记录](reviews/R01.md)，不沿用旧40px外观加透明热区的方案。

`Impeccable` 用作项目内的界面设计与审核指导，由智能体按其技能入口使用；它不是浏览器运行框架，也不增加到原型运行时依赖中。

## `Impeccable` 安装与使用

1. 项目级技能已安装在 [.agents/skills/impeccable/SKILL.md](../../../.agents/skills/impeccable/SKILL.md)，技能版本为 `4.2.1`，本地引擎版本为 `0.1.2`。来源、许可和安装命令保存在[安装记录](../../../.impeccable/installation.json)；引擎二进制是被忽略的本机产物，其他机器可由随附启动器下载锁定版本。仓库适配仅为默认提示补充技能名称及清除三个上游参考文件的尾部空白；技能检查已通过。
2. 项目 `hook` 适配器只把 `docs/design/prototypes/` 的界面编辑交给官方检测器，并保留既有文件访问 `hook`。自动执行仍取决于 `Codex` 对项目 `hook` 的启用状态；手工复核基础新版时明确列出自有源码，不递归扫描依赖或把官方生成主题当作手写补丁：

```powershell
.agents/skills/impeccable/scripts/impeccable.cmd detect docs/design/prototypes/src/main.jsx docs/design/prototypes/src/prototype-provider.jsx docs/design/prototypes/src/prototype-layout.css docs/design/prototypes/src/foundations.css docs/design/prototypes/src/tokens.css docs/design/prototypes/foundations/index.html
```

3. [基础规范](design-foundations.md)采用本仓库 `design` 文档元数据；[局部 sidecar](.impeccable/design.json)采用 `Impeccable` 扩展格式，预览宿主需要加载原型变量，不能假定根面板会自动发现局部文件。`src/tokens.css` 始终是已确认色值的唯一来源；两份记录指导新版设计，现有生产样式的生效来源仍由根设计契约界定。
4. 根 `PRODUCT.md` 的旧 `schema` 提示只涉及以后可选的 `Impeccable` `init` 格式适配，不影响本轮有界原型记录；本轮未据此重写产品契约。安装技能、检测通过与用户确认设计是三个独立状态。

## 交付与后续使用

按基础清单中的 `F-01` 等编号记录基础调整；`R01-01` 已由用户确认，当前按 `R01-02-A`～`R01-02-I` 制作和审核组织组合。各入口共用[基础统一主题](reviews/F-theme.md)，每个子项分别记录适配、交互和确认，不能把主题复用或一个组合的批准当作整个前端已迁移或获批。

本工程使用本地模拟数据，不调用生产 API、不读取应用登录令牌、不连接数据库、不控制工作队列。原型 `node_modules/` 和构建产物不提交；正式实施时需要另行完成接口接入、业务状态和应用验证。当前生产设计仍查阅[设计文档](../README.md)及[根设计契约](../../../DESIGN.md)。

## 上级路由

- [设计文档](../README.md)
