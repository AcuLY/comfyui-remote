---
version: 1
slug: "docs-design-prototypes-foundations-index-html"
primary_target: "docs/design/prototypes/foundations/index.html"
related_targets: ["docs/design/prototypes/src/main.jsx","docs/design/prototypes/src/prototype.css","docs/design/prototypes/src/tokens.css"]
---

# 基础设计原型

目标：`docs/design/prototypes/**` 中可操作的新版前端基础样本，采用代码制作。用户已于 2026-09-08 确认当前方案无问题，`F-01`～`F-14` 与 `P-03` 已确认，视觉基线源提交为 `7fdf13de`。规则见 [新版前端基础设计规范](../../docs/design/prototypes/design-foundations.md)。后续业务组合、完整页面及生产实现尚未因此通过，不增加新品牌方向。

## 方向约定

主题：让用户通过真实控件查阅已确认基础，并按编号提出后续调整；优先清晰、可操作的基础样本。基础展示页的目录、文案和模拟数据不成为业务需求。

视觉体系：柔和中性表面，按用户后续配置，图像生产采用 `#176E5A` 色相，`LoRA` 训练采用明确选择的 `#A23F5D` 色相，各主题保持原有饱和度、明度和层级；深色为中性黑白灰，焦点跟随模块强调色，柔和强调背景的文字使用 `on-accent-soft`。双模块对等，状态语义独立；中文 `Noto Sans SC`、英文 `Geist`、代码 `IBM Plex Mono`。色值唯一来源为 `src/tokens.css`。

使用路径：切换主题和模块、试用输入与反馈、按 `F-01`～`F-14` 查阅规范或提出调整。

尺寸：全原型按用户后续指示固定标准密度，桌面通用控件高 36px、行垂直内边距 12px；不提供密度切换，不读取或保存密度偏好。手机遵循既有独立尺寸与触摸规则；纯图标按钮保持居中，不保留文字间隙。

首屏：顶部全局切换，桌面左侧目录，中间色板与可操作表单；手机改为单列。

形式：在已确认方向中直接制作基础展示画布；属于明确限定的小范围任务，不进行概念抽签。

完成状态：基础样本已有独立收尾审查和整改复核，并取得用户确认；本次将规范和原型状态同步为已确认。后续业务组合与完整页面需独立设计、验证和审核。此次无交付位图素材，截图仅作验证。
