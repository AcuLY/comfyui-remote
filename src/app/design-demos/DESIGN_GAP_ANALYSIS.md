# DESIGN.md 设计系统对标报告

生成时间：2026-05-08
对标文件：`DESIGN.md` vs `design-demo-styles/*.css`

---

## 一、颜色令牌缺失

`DESIGN.md` 只记录了 green / rose 两种强调色，CSS 中还有以下语义颜色未记入文档：

| CSS 变量 | 用途 | 建议 |
|-----------|------|------|
| `--demo-amber` / `--demo-amber-soft` | 警告状态（如 pager 信息） | 补充到 Color Tokens 章节 |
| `--demo-sky` / `--demo-sky-soft` | 封面标记状态 | 同上 |
| `--demo-red` / `--demo-red-soft` | 错误 / 危险操作 | 同上 |
| `--demo-panel-2` / `--demo-panel-3` | 面板嵌套背景 | 补充到 Background And Material |
| `--demo-surface` / `--demo-surface-soft` / `--demo-surface-hover` | 通用表面变体 | 同上 |
| `--demo-field-bg` | 输入框 / 字段背景 | 同上 |
| `--demo-code-bg` / `--demo-code-text` | 代码展示（日志页面） | 补充到 Components 或新增 Primitives 章节 |
| `--demo-image-label-border` / `--demo-image-label-bg` / `--demo-image-label-text` | 图片标签 | 补充到 Components - Image 部分 |
| `--demo-lightbox-image-bg` / `--demo-lightbox-image-border` | 灯箱图片 | 同上 |

---

## 二、字体堆栈未记录

`DESIGN.md` 写的是"Use the app's existing sans stack"，但 CSS 定义了具体字体变量：

```css
--demo-font-cjk: "HarmonyOS Sans SC";
--demo-font-geist: "geistSans";
--demo-font-sans: var(--demo-font-geist), var(--demo-font-cjk), system-ui, sans-serif;
--demo-font-mono: var(--font-demo-maple-mono), "Cascadia Code", ui-monospace, monospace;
```

**建议**：在 Typography 章节补充字体堆栈说明，或明确这些是 demo 专用字体。

---

## 三、布局模式未记录

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

**建议**：在 Layout Rules 章节补充这些布局模式的说明，或新增"Layout Patterns"子章节。

---

## 四、组件类型未记录

`DESIGN.md` Section 6 覆盖了基础组件，但以下具体组件类未在文档中体现：

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

**建议**：将 Section 6 拆分为子章节，按"图片 / 表单 / 数据展示 / 反馈 / 弹窗"分类记录各组件。

---

## 五、响应式 / 移动端未充分记录

`DESIGN.md` 只简要提到移动端导航，CSS 中还有：

- `.mobileTopbar` / `.mobileToolsMenu` / `.mobileBottomNav` 类
- `@media (max-width: 639px)` 断点处的图片尺寸和网格覆盖
- `.batchCategoryTabs` 在移动端的横向滚动行为

**建议**：在 Layout Rules 章节补充"Responsive Behavior"子章节。

---

## 六、动效覆盖缺口

`DESIGN.md` Section 7 写的是"Hover: subtle translate up by 1-2px"，实际 CSS 覆盖不一致：

| 组件 | 是否有 hover translateY | 符合文档？ |
|-------|---------------------|-----------|
| `.card` | `translateY(-1px)` | ✓ |
| `.sectionNavLink` | `translateY(-1px)` | ✓ |
| `.button` | 无 translateY | ✗ 文档说了但 CSS 没做 |
| `.imageThumbMedium` | 无 translateY（只有 border-color / box-shadow） | ✗ |

**建议**：统一 hover 动效，或更新文档使其与实现一致。

---

## 七、设计令牌数值偏差

| 令牌 | DESIGN.md 值 | CSS 实际值 | 偏差 |
|--------|----------------|-------------|------|
| `backdrop-filter` (dark) | `blur(20px) saturate(140%)` | `blur(20px) saturate(145%)` | 5% |
| `--demo-glass-soft` (light) | `rgba(255,255,255,0.68-0.78)` | `rgba(255,255,255,0.54)` | 低于下限 |

**建议**：统一数值，或更新文档使其反映实际实现。

---

## 八、总结

| 类别 | 缺口严重程度 | 建议行动 |
|-------|-------------|-----------|
| 颜色令牌缺失 | 高 | 补充 amber/sky/red 语义色到 DESIGN.md |
| 组件类型未记录 | 高 | 扩展 Section 6，按类别记录所有组件 |
| 布局模式未记录 | 中 | 在 Layout Rules 补充具体布局类说明 |
| 字体堆栈 | 中 | 明确 demo 字体与产品字体的关系 |
| 响应式未充分记录 | 中 | 新增 Responsive Behavior 子章节 |
| 动效覆盖缺口 | 低 | 统一 hover 动效或更新文档 |
| 设计令牌数值偏差 | 低 | 统一数值或更新文档 |

---

## 九、下一步建议

1. **先补全 DESIGN.md**（按本章节的缺口列表），确保文档覆盖所有 CSS 令牌和组件
2. **再统一 CSS**（按 DESIGN.md 修正数值偏差、补齐缺失的 hover 动效）
3. **最后清理死代码**（移除 CSS 中未使用的类、同步 `design-demo-styles.ts` 与实际类名）
