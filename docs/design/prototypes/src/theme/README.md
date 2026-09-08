---
schemaVersion: 1
document:
  type: router
  status: current
  owner: product-design
  authority:
    subject: prototype-primereact-theme-build
    kind: reference
  readWhen:
    - 调整或重新生成原型统一组件主题时
  sources:
    - docs/design/prototypes/src/tokens.css
    - docs/design/prototypes/src/theme/theme-inputs.mjs
    - docs/design/prototypes/scripts/build-theme.mjs
    - docs/design/prototypes/package.json
    - docs/design/prototypes/package-lock.json
  verifiedBy:
    - npm --prefix docs/design/prototypes run theme:check
    - npm --prefix docs/design/prototypes run build
---

# PrimeReact 统一主题构建

本原型继续使用 `PrimeReact 10.9.9`，组件结构与各状态样式由官方 `Sass` 主题生成。`primereact.css` 是生成产物，不手工编辑。页面布局不在此主题中；组件配色的已确认角色值只从上一级 `tokens.css` 读取。

## 来源与版本

- 官方源：[主题源码仓库](https://github.com/primefaces/primereact-sass-theme/tree/0b17cdc8d1a5c89b2e7cf65b8431b85996385a41)。`vendor/primereact-sass-theme/` 保存 `10.8.5` 的提交 `0b17cdc8d1a5c89b2e7cf65b8431b85996385a41` 中的纯 `Sass` 快照：`theme-base` 全部 88 个 `.scss` 文件，以及 `Lara` 明暗主题的两个 `_variables.scss`。不包含上游包脚本或 `JavaScript`，保留[许可证](LICENSE.primereact-sass-theme)。[来源清单](vendor/primereact-sass-theme/UPSTREAM.json)记录完整提交、版本及文件；生成前将行尾规范化为 `LF`，再用 `SHA-256` 验证源文件，避免 Windows 行尾转换误报。公共仓库没有 `10.9.9` 标签，因此不把该来源写成“10.9.9 精确源码”。
- [PrimeReact 10.9.9 定制文档](https://github.com/primefaces/primereact/blob/10.9.9/components/doc/theming/customthemedoc.js)仍指向这个公开 `Sass` 仓库。2026-09-08 核对 `PrimeReact 10.8.5` 和 `10.9.9` 的文件树，以下预设 CSS 的文件对象标识逐一相同。这是当前使用该源的版本对应证据，不替代项目本身的渲染验证。
- 官方主题源锁定文件中的 `Dart Sass` 是 `1.63.6`。本项目通过 `primereact-theme-sass: npm:sass@1.63.6` 精确锁定编译器；命名别名避开 `Vite 8.2.2` 对其可选 `Sass` 预处理器 `^1.70.0` 的版本要求。`Vite` 只读取生成 CSS，不使用该旧版编译器预处理其他样式文件。
- 原先以 Git 安装官方 `10.8.5` 时，`npm audit` 将同名包匹配到恶意软件告警，且下载地址被规范化为 `Git SSH`。[漏洞记录](https://osv.dev/vulnerability/MAL-2025-4574)中的受影响对象是同名 npm 包 `>=100.0.0`，与此处锁定的官方 Git `10.8.5` 来源不同。当前已移除同名包依赖，构建只读上述纯 `Sass` 快照，避免包名歧义及 SSH 安装要求；此说明不代表忽略其他依赖审计结果。

| PrimeReact 仓库文件 | 两版本一致的文件对象标识 |
| --- | --- |
| `public/themes/lara-light-teal/theme.css` | `d99c3f527f9ddb26fdb660eb3fb1f785ec528b3c` |
| `public/themes/lara-light-pink/theme.css` | `03dace0d01a11b166f7635e03023100be70b705e` |
| `public/themes/lara-dark-teal/theme.css` | `40b3c05c1362f99c4e85d068306e54959263fbc5` |
| `public/themes/lara-dark-pink/theme.css` | `df254dff4e04421f6694accb09444022eb4797a3` |

## 输入与生成方式

`theme-inputs.mjs` 将语义角色映射到官方 `Sass API`：中性表面、主次文字、模块色、语义状态、输入边界、选中、焦点、遮罩和浮层阴影。选中且聚焦、语义按钮悬停与按下颜色由同组已确认颜色派生，不新增另一套手写色板。

生成器读取 `tokens.css` 的顶层 `:root` 及明暗／模块属性规则，按 CSS 特异性和源顺序解析角色引用。设备尺寸由下表的统一主题输入控制；输入文件的媒体查询不作为 `Sass` 静态色值输入。

每个明暗／模块组合独立编译，避免 `!default` 参数互相污染。内存导入器提供官方 `Lara _variables.scss` 的声明段，排除文件末尾的根变量／字体导出块；随后令 `$colors: ()`，在对应的零优先级根范围下导入快照中未修改的 `theme-base/_components.scss`。不修改官方组件文件、不引入官方字体文件，也不再叠加可选 `_extensions.scss`。组件的焦点、选中、悬停、无效与禁用等状态选择器继续来自官方源，统一焦点通过其 `Sass` 参数定义。

项目根变量与字体加载继续负责 `--font-family`、`--font-feature-settings` 和 `--maskbg`；官方组件直接消费这些接口。主题通过 `:where(:root[data-theme][data-module])` 匹配上下文，不增加组件选择器的优先级，因此库原生复合结构规则仍然有效；挂到 `body` 下的浮层也会接收当前主题。

| 尺寸 | 桌面／精细指针 | 宽度小于 768px 或粗指针 |
| --- | --- | --- |
| 组件和输入文字 | 14px | 16px |
| 统一行高 | 1.5 | 1.5 |
| 输入、按钮内边距 | 6.5px 12px | 9px 12px |
| 带 1px 边框的输入／按钮 | 36px | 44px |
| 纯图标按钮 | 36px | 44px |
| 关闭等动作图标 | 36px | 44px |
| 无边框菜单项 | 36px | 44px |

表中数值以浏览器 16px 根字号为基准。官方源会将尺寸与固定 `rem` 相加，`Sass` 输入因此使用等值数值 `rem`，允许用户根字号缩放；不能直接把这些参与乘法、`nth()` 和颜色运算的输入改成 CSS `var()`。主题入口为按钮、实际输入、下拉和多选根节点统一设置 36/44px 最小高度，补偿浏览器缩放时的边框量化；不向下拉内部标签重复设置高度。进度条通过官方 `$progressBarHeight` 设为 6px，文字在条外呈现。复选框、单选框与开关保留官方结构及标记尺寸，关联标签的操作行由组件组合负责。

生成文件包括四套配色的桌面与触控完整规则。此原型选择一次加载全库状态，便于切换及后续组件复用；CSS 体积和 `gzip` 体积由每次构建实际报告。

## 命令

在原型目录执行 `npm run theme:build` 更新产物；`npm run theme:check` 只校验，缺失或过期时非零退出。`npm run build` 先校验再构建，`npm run dev` 启动前生成。修改 `tokens.css` 或参数映射后应重新生成；生成器不会在每次热更新时自动重跑。

上级入口：[基础设计规范](../../design-foundations.md)。

- [返回设计文档](../../../README.md)
