---
version: 1
slug: "docs-design-prototypes-foundations-index-html"
primary_target: "docs/design/prototypes/foundations/index.html"
related_targets: ["docs/design/prototypes/src/main.jsx","docs/design/prototypes/src/prototype-provider.jsx","docs/design/prototypes/src/prototype-layout.css","docs/design/prototypes/src/tokens.css"]
---

# 基础设计原型

目标：`docs/design/prototypes/**` 中可操作的新版前端基础样本，采用代码制作。基础方向及 `8029fdfb` 批准历史保留；后续统一主题生成版与状态修订仍待用户审核，不能将整个 `F-01`～`F-14` 或 `P-03` 当前版本标为已确认。`R01-01` 的 `30fd53db` 确认历史保留，`R01-02` 暂停，`R02-01/02` 待用户审核。规则见 [新版前端基础设计规范](../../docs/design/prototypes/design-foundations.md)及[基础台账](../../docs/design/prototypes/foundations/README.md)。

## 方向约定

主题：让用户通过真实控件查阅已确认基础，并按编号提出后续调整；优先清晰、可操作的基础样本。基础展示页的目录、文案和模拟数据不成为业务需求。

视觉体系：柔和中性表面，按用户后续配置，图像生产采用 `#176E5A` 色相，`LoRA` 训练采用明确选择的 `#A23F5D` 色相，各主题保持原有饱和度、明度和层级；深色为中性黑白灰，焦点跟随模块强调色，柔和强调背景的文字使用 `on-accent-soft`。双模块对等，状态语义独立；中文 `Noto Sans SC`、英文 `Geist`、代码 `IBM Plex Mono`。色值唯一来源为 `src/tokens.css`。

使用路径：切换主题和模块、试用输入与反馈、按 `F-01`～`F-14` 查阅规范或提出调整。

尺寸：全原型按用户后续指示固定标准密度，桌面通用控件高 36px、行垂直内边距 12px；不提供密度切换，不读取或保存密度偏好。手机／粗指针普通控件40px，可编辑输入保留16px字号；纯图标按钮、关闭及分页动作保留真实44px，通过统一主题配置，不添加透明热区或内部标签补丁。

首屏：顶部全局切换，桌面左侧目录，中间色板与可操作表单；手机改为单列。

形式：在已确认方向中直接制作基础展示画布；属于明确限定的小范围任务，不进行概念抽签。

完成状态：基础旧版确认与后续统一主题待审核分别记录。2026-09-13已修复基础／列表主题恢复边界及共享键盘焦点：鼠标、空格、`Enter` 的系统追上固定色后重选路径均恢复实时跟随；所测焦点为清晰模块色实线。实际范围与宿主尺寸限制写入 `docs/design/prototypes/reviews/R02-02.md` 的复盘 `I09/I10/I14` 验收，不自动批准修订或宣称全矩阵通过。当前普通触控40px／图标44px；历史44px普通输入测量只证明对应旧版本。后续业务组合与完整页面各自设计、验证和审核，无交付位图素材。
