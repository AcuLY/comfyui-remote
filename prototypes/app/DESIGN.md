# 新版应用完整原型 · 设计说明

2026-09-16 重建：独立 `Vite` + `React` + `PrimeReact` 原型，位于 `prototypes/app/`，不依赖应用本体。

## 路由

`hash` 路由，页面由 `src/App.tsx` 依据 `src/routes.ts` 匹配：

- `/production/tasks|projects|presets|templates`
- `/training/tasks|projects|presets|templates`
- `/tools/models`、`/tools/settings`、`/tools/monitor`

空地址与未匹配页面分别回到 `/production/tasks` 与 404 页面。监控与日志是全局工具页，入口在设置页内。

## 组件映射

| 用途 | 组件 |
| --- | --- |
| 按钮 | `Button` |
| 状态徽标 | `Tag`（业务语义色用自有 `class` 映射） |
| 面板 | `Panel` |
| 搜索字段 | `InputText` + `p-input-icon-left` |
| 悬浮选择 | `Dropdown` |
| 分段选择（工作模式） | `SelectButton` |
| 复选框 | `Checkbox` |
| 进度 | `ProgressBar` |
| 详情抽屉 | `Sidebar`（右侧） |
| 确认面板 | `ConfirmDialog`（`confirmDialog` 服务） |
| 操作反馈 | `Toast` |
| 移动端导航抽屉 | `Sidebar`（左侧） |
| 图标 | PrimeIcons（`pi pi-*`） |

主题为 `Lara Teal` 深浅两套，由 `index.html` 的 `theme-link` 按 `data-prototype-theme` 切换。

## 业务语义色

青绿用于主要操作、选中、执行与完成；粉色用于训练语义；琥珀用于等待；红色用于错误；排队为天蓝。状态徽标由 `Tag` 承载并同时提供文字。圆角、边框与动效沿用 PrimeReact 主题，本目录只新增上述状态色映射，不新增形状令牌。

## 任务页行为

当前执行面板在列表之外，随后是筛选、等待队列与任务记录。生产支持暂停／恢复，训练不提供暂停；生产重试／恢复从头执行，训练限制最多一个等待或执行运行。删除仅针对生产终态任务并二次确认，素材删除仍受 Q-01 未决边界约束。任务名称为详情入口，复选框与动作独立；错误信息可一键复制。

## 移动端契约

底部导航固定 6 项（任务／项目／预制／模板／模型／设置）+ 模式指示槽；顶部菜单按钮打开左侧导航抽屉（含主题切换）。所有交互在桌面与移动断点保持一致。
