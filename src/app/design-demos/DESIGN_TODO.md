# DESIGN.md 待补充内容

> 由 `DESIGN_GAP_ANALYSIS.md` 中延后的部分整理而来。
> 每次完成一项后，从本文件中划掉或删除对应条目。

---

## 一、布局模式（原报告 Section 3）

`DESIGN.md` Section 5 是高层次规则，以下具体布局类未在文档中体现：

| CSS 类 | 用途 |
|--------|------|
| `.workspace` / `.workspaceCollapsed` | 主工作区网格（含侧边栏折叠状态） |
| `.splitEditor` | 分屏编辑器布局 |
| `.projectSectionShell` | 项目 + 右侧小节导航布局 |
| `.batchCreateWorkspace` | 批量创建工作区 |
| `.presetManagerLayout` | 预设管理器布局 |
| `.editorSplitBlock` | 编辑器分屏块 |
| `.modelsLayout` | 模型页面布局 |
| `.sectionHeader` | 小节编辑器头部布局 |

**行动**：在 `DESIGN.md` Layout Rules 章节补充这些布局模式的说明，或新增"Layout Patterns"子章节。

---

## 二、组件类型系统记录（原报告 Section 4）

`DESIGN.md` Section 6 覆盖了基础组件，但以下具体组件类未在文档中体现。需要系统性过一遍全部组件，按类别记录。

### 图片相关
- `.imageThumbSmall` / `.imageThumbMedium` / `.imageThumbSelect` / `.imageThumbTags`
- `.imagePreviewFrame` / `.imagePreviewFrameInteractive` / `.imagePreviewFrameZoomed`
- `.imageStrip` / `.imageGrid` / `.imageListMedium` / `.imageTile`
- `.reviewImageGrid` / `.reviewTile` / `.reviewSelectButton` / `.reviewMarkers` / `.reviewTileStatus`

### 表单相关
- `.field` / `.fieldGrid` / `.input` / `.textarea` / `.select`
- `.switchRow` / `.switch`
- `.segmented` / `.tabs` / `.tab`
- `.pager*` (分页组件)

### 项目 / 模板 / 预设相关
- `.projectListCard` / `.projectActionStrip` / `.projectSelectionStrip`
- `.sectionCard` / `.sectionCardList` / `.sectionCardCompact`
- `.templateListItem` / `.templateSectionRow`
- `.presetCategoryItem` / `.presetVariantButton` / `.presetItemRow`
- `.groupMemberRow` / `.groupPreviewRow` / `.sortRuleRow`

### 操作状态 / 反馈
- `.operationStateStrip` / `.operationStateItem`
- `.toast` / `.toastStack`
- `.statusGreen` / `.statusPink` / `.statusAmber` / `.statusSky` / `.statusRed`
- `.inlineNotice` / `.inlineToast`

### 弹窗 / 灯箱
- `.lightboxOverlay` / `.lightboxPanel` / `.lightboxChrome` / `.lightboxFooter`
- `.presetMoveBackdrop` / `.presetMoveSheet`

**行动**：将 `DESIGN.md` Section 6 拆分为子章节，按"图片 / 表单 / 数据展示 / 反馈 / 弹窗"分类记录各组件。

---

## 三、响应式 / 移动端（原报告 Section 5）

`DESIGN.md` 只简要提到移动端导航，CSS 中还有：

- `.mobileTopbar` / `.mobileToolsMenu` / `.mobileBottomNav` 类
- `@media (max-width: 639px)` 断点处的图片尺寸和网格覆盖
- `.batchCategoryTabs` 在移动端的横向滚动行为

**行动**：在 `DESIGN.md` Layout Rules 章节补充"Responsive Behavior"子章节。

---

## 四、动效覆盖统一（原报告 Section 6）

`DESIGN.md` Section 7 写的是"Hover: subtle translate up by 1-2px"，实际 CSS 覆盖不一致：

| 组件 | 是否有 hover translateY | 符合文档？ |
|-------|---------------------|-----------|
| `.card` | `translateY(-1px)` | ✓ |
| `.sectionNavLink` | `translateY(-1px)` | ✓ |
| `.button` | 无 translateY | ✗ 文档说了但 CSS 没做 |
| `.imageThumbMedium` | 无 translateY（只有 border-color / box-shadow） | ✗ |

**行动**：统一 hover 动效（给 `.button` 和 `.imageThumbMedium` 补上 `translateY(-1px)`），或更新文档使其与实现一致。

---

## 五、设计令牌数值偏差（原报告 Section 7）

| 令牌 | DESIGN.md 值 | CSS 实际值 | 偏差 |
|--------|----------------|-------------|------|
| `backdrop-filter` (dark) | `blur(20px) saturate(140%)` | `blur(20px) saturate(145%)` | 5% |
| `--demo-glass-soft` (light) | `rgba(255,255,255,0.68-0.78)` | `rgba(255,255,255,0.54)` | 低于下限 |

**行动**：统一数值（修正 CSS 使其符合文档），或更新 `DESIGN.md` 使其反映实际实现。

---

## 六、总结

| 类别 | 缺口严重程度 | 建议行动 |
|-------|-------------|-----------|
| 布局模式未记录 | 中 | 在 Layout Rules 补充具体布局类说明 |
| 组件类型未记录 | 高 | 扩展 Section 6，按类别记录所有组件 |
| 响应式未充分记录 | 中 | 新增 Responsive Behavior 子章节 |
| 动效覆盖缺口 | 低 | 统一 hover 动效或更新文档 |
| 设计令牌数值偏差 | 低 | 统一数值或更新文档 |

