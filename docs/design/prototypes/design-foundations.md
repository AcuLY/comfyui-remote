---
schemaVersion: 1
document:
  type: design
  status: current
  owner: product-design
  authority:
    subject: new-frontend-design-foundations
    kind: canonical
  readWhen:
    - 修改新版应用原型或按已确认基础实现新版前端时
    - 核对原型组件用法、审核状态与生产契约的边界时
  sources:
    - prototypes/app/package.json
    - prototypes/app/src/App.tsx
    - prototypes/app/src/preferences.ts
    - prototypes/app/src/shell/Shell.tsx
    - prototypes/app/src/pages/TasksPage.tsx
    - prototypes/app/theme/tokens.css
    - prototypes/app/theme/theme-inputs.mjs
    - prototypes/app/scripts/build-theme.mjs
    - docs/design/prototypes/reviews/F-theme.md
    - docs/design/prototypes/reviews/F-responsive.md
    - docs/design/prototypes/reviews/production-rebuild.md
  verifiedBy:
    - npm --prefix prototypes/app run build
    - npm run docs:check
---

# 新版前端基础规范

## 组件库与定制边界

1. 组件运行库为 `PrimeReact` `10.9.9` `Styled` 与 `PrimeIcons` `7.0.0`。基础组件（按钮、状态徽标、面板、输入框、下拉选择、分段选择、复选框、进度条、抽屉、确认面板、消息提示等）全部来自组件库，不手写基础组件。组件外观通过官方主题源生成：`theme/tokens.css` 是唯一语义令牌来源，`theme/theme-inputs.mjs` 映射官方 v10 `Sass` 参数，`scripts/build-theme.mjs` 使用仓库内固定的官方 `primereact-sass-theme` 快照生成主题文件；原型自带样式只负责外壳与页面布局，不覆盖组件内部样式。
2. **非必要不侵入组件库。** 优先公开属性、统一主题配置和外层布局；不得只为像素对齐修改内部 `DOM`、重排按钮、模拟焦点或添加透明点击层。确有产品或无障碍必要且公开能力不足时，才做最小、局部且可解释的覆盖并记录验证。
3. 选择实现按“现成语义组件 → 公开属性／主题配置／插槽 → 必要组合”的顺序；应用负责路由、数据变更、业务状态和来源关系，不得通过内部 `CSS` 选择器重新实现组件行为。原生 `HTML` 链接和操作按钮仍然合适，不机械地把所有元素换成库组件。

## 模块与状态语义

- 两个对等模块：图像生产与 `LoRA` 训练。成功、失败、警告与信息独立于模块强调色；状态同时提供文字或图标，不把颜色作为唯一状态信号。
- 禁用状态不代替错误说明。

## 主题行为

默认实时跟随系统；仅提供浅色／深色两项。选择与系统当前外观不同的选项时固定该选择，选择与系统当前外观相同的选项时恢复跟随；已固定后系统外观变化不解除固定。偏好持久保存在原型专用 `cm-prototype-preference-v1`，主题与模块选择写入同一记录。密度固定为标准，不作为可选或持久化偏好。

## 导航与页面结构

- 一级模块为生产／训练；两模块均提供任务、项目、预制、模板入口。模型、监控与日志、设置属于全局工具；监控与日志入口放在设置页内。无概览首页与退出登录入口。
- 首次进入或地址失效回到生产任务；模块切换进入对应模块任务范围；刷新保留当前地址。
- 核心以唯一当前执行任务为关注中心：当前执行面板在列表之外且不受筛选隐藏，等待队列解释等待，任务记录负责检索。
- 任务名称为唯一详情入口，复选框与动作独立；详情按执行记录、输入配置、结果文件清单分组，关闭后恢复焦点。
- 页面不出现“原型／示例数据／占位”等制作说明；页头定位一次、当前任务状态一次；不叠加同义导航入口。

## 任务行为

生产支持暂停／恢复；训练不提供暂停。取消与删除需要确认；删除仅针对生产终态任务。生产重试／恢复从头执行；训练恢复遵守全应用最多一个等待或执行训练运行。失败原因可一键复制；停止动作在原型内立即完成，真实异步停止、失败与冲突留给后续接入。

## 验证口径

- 检查覆盖桌面、手机与一个中间宽度，并覆盖深浅主题、生产／训练两模块与关键交互状态；强制视口以实际测量和交互为主。
- 无横向溢出不等于空间使用合理；构建与文档门禁通过不等于视觉、触控或真机验收完成。未验证真机或读屏时明确写出限制。

## 上级路由

- [设计文档](../README.md)
- [新版应用原型契约](README.md)
