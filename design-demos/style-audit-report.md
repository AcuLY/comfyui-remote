# Design Demos 样式审查报告

## 发现的基础样式问题

### 🔴 严重问题（影响可用性）

#### 1. 导航链接 padding 不足
**位置**: `.navLink` (line 272)
- **问题**: `padding: 7px 8px` 导致图标和文字过于拥挤
- **影响**: 点击区域小，视觉上不够舒适
- **建议**: 改为 `padding: 8px 12px`

#### 2. 按钮 padding 不均衡
**位置**: `.button` (line 606)
- **问题**: `padding: 8px 11px` 左右 padding 太小，文字和边框距离不够
- **影响**: 按钮看起来局促
- **建议**: 改为 `padding: 9px 14px`

#### 3. 表格单元格 padding 过小
**位置**: `.table th, .table td` (line 928)
- **问题**: `padding: 10px 8px` 横向 padding 太小
- **影响**: 内容过于拥挤，可读性差
- **建议**: 改为 `padding: 12px 12px`

#### 4. 卡片标题字号过小
**位置**: `.cardTitle` (line 558)
- **问题**: `font-size: 13px` 作为标题太小
- **影响**: 视觉层级不明显
- **建议**: 改为 `font-size: 14px`，字重改为 `font-weight: 640`

#### 5. 面板标题字号过小
**位置**: `.panelHeader h2, h3` (line 483)
- **问题**: `font-size: 14px` 作为面板标题太小
- **影响**: 层级不清晰
- **建议**: 改为 `font-size: 15px`，字重改为 `font-weight: 700`

### 🟡 中等问题（影响美观）

#### 6. 页面标题行高过紧
**位置**: `.pageTitle` (line 406)
- **问题**: `line-height: 1.16` 太紧凑
- **影响**: 标题看起来压抑
- **建议**: 改为 `line-height: 1.25`

#### 7. 卡片内部间距不一致
**位置**: `.card` (line 535)
- **问题**: `gap: 10px` 和 `padding: 12px` 不协调
- **影响**: 视觉节奏不统一
- **建议**: gap 改为 `12px`

#### 8. 徽章 padding 过小
**位置**: `.badge, .status` (line 662)
- **问题**: `padding: 4px 8px` 太小，文字贴边
- **影响**: 看起来局促
- **建议**: 改为 `padding: 5px 10px`

#### 9. 图片标签 padding 不足
**位置**: `.imageTileLabel` (line 776)
- **问题**: `padding: 3px 7px` 太小
- **影响**: 文字和边框距离不够
- **建议**: 改为 `padding: 4px 8px`

#### 10. 导航计数徽章过小
**位置**: `.navCount` (line 313)
- **问题**: `padding: 0 6px` 横向 padding 不够
- **影响**: 数字看起来拥挤
- **建议**: 改为 `padding: 0 7px`，最小宽度改为 `22px`

#### 11. Tab 按钮 padding 不足
**位置**: `.segment, .tab` (line 904)
- **问题**: `padding: 6px 9px` 横向 padding 太小
- **影响**: 文字和边界距离不够
- **建议**: 改为 `padding: 7px 12px`

#### 12. 输入框 padding 不够
**位置**: `.input, .textarea, .select` (line 811)
- **问题**: `padding: 10px` 对于 13px 字号来说稍显不足
- **影响**: 文字和边框距离不够舒适
- **建议**: 改为 `padding: 11px 12px`

#### 13. 开关行 padding 不足
**位置**: `.switchRow` (line 843)
- **问题**: `padding: 10px` 太小
- **影响**: 内容看起来拥挤
- **建议**: 改为 `padding: 12px 14px`

#### 14. 小节导航项 padding 不足
**位置**: `.railItem` (line 995)
- **问题**: `padding: 8px 9px` 太小
- **影响**: 内容拥挤
- **建议**: 改为 `padding: 10px 12px`

#### 15. 代码块 padding 不足
**位置**: `.codeBlock` (line 1056)
- **问题**: `padding: 10px` 太小
- **影响**: 代码贴边
- **建议**: 改为 `padding: 14px 16px`

### 🟢 轻微问题（细节优化）

#### 16. 品牌区域间距
**位置**: `.brand` (line 178)
- **问题**: `margin-bottom: 18px` 和 `gap: 10px` 不协调
- **建议**: gap 改为 `12px`

#### 17. 源信息卡片间距
**位置**: `.sourceCard` (line 222)
- **问题**: `gap: 8px` 和 `padding: 10px` 不协调
- **建议**: gap 改为 `10px`，padding 改为 `12px`

#### 18. 导航区域间距
**位置**: `.navSection` (line 251)
- **问题**: `gap: 6px` 太小，导航项之间过于紧密
- **建议**: 改为 `gap: 4px`（保持紧凑但增加 navLink 自身 padding）

#### 19. 页面标题块间距
**位置**: `.pageTitleBlock` (line 391)
- **问题**: `gap: 6px` 稍小
- **建议**: 改为 `gap: 8px`

#### 20. 指标卡片最小高度
**位置**: `.metric` (line 501)
- **问题**: `min-height: 92px` 和 `padding: 12px` 导致内容垂直居中效果不佳
- **建议**: 改为 `min-height: 100px`，padding 改为 `14px`

#### 21. 图片缩略图尺寸
**位置**: `.thumb` (line 706-708)
- **问题**: `width: 54px; height: 72px` 太小，难以看清细节
- **建议**: 改为 `width: 64px; height: 85px`

#### 22. 图片网格最小宽度
**位置**: `.imageGrid` (line 738)
- **问题**: `minmax(132px, 1fr)` 太小
- **建议**: 改为 `minmax(150px, 1fr)`

#### 23. 字段网格间距
**位置**: `.fieldGrid` (line 782)
- **问题**: `gap: 10px` 稍小
- **建议**: 改为 `gap: 12px`

#### 24. 字段标签和输入框间距
**位置**: `.field, .textAreaField` (line 788)
- **问题**: `gap: 6px` 太小
- **建议**: 改为 `gap: 8px`

#### 25. 空状态 padding
**位置**: `.empty` (line 1070)
- **问题**: `padding: 20px` 对于 `min-height: 160px` 来说不够
- **建议**: 改为 `padding: 32px 24px`

### 📱 移动端特定问题

#### 26. 移动端主区域 padding
**位置**: `.main` mobile (line 1121)
- **问题**: `padding: 12px` 太小，内容贴边
- **建议**: 改为 `padding: 16px 16px calc(82px + env(safe-area-inset-bottom))`

#### 27. 移动端 topbar padding
**位置**: `.topbar` mobile (line 1127)
- **问题**: `padding: 12px` 太小
- **建议**: 改为 `padding: 14px 16px`

#### 28. 移动端小节导航 padding
**位置**: `.railItem` mobile (line 1186)
- **问题**: `padding: 7px` 太小
- **建议**: 改为 `padding: 9px 10px`

#### 29. 移动端底部导航 padding
**位置**: `.mobileBottomNav` (line 1215)
- **问题**: `padding: 7px` 太小
- **建议**: 改为 `padding: 8px 8px calc(8px + env(safe-area-inset-bottom))`

#### 30. 移动端底部导航项最小高度
**位置**: `.mobileBottomItem` (line 1222)
- **问题**: `min-height: 50px` 对于触摸目标来说刚好，但字号 11px 太小
- **建议**: 字号改为 `font-size: 12px`

### 🎨 字体层级问题

#### 31. 字重层级不明显
- **问题**: 多处使用 560, 580, 620, 650, 680 等中间字重，层级不清晰
- **建议**: 统一为 500(normal), 600(semibold), 700(bold) 三个层级

#### 32. 小字号可读性
- **问题**: 多处使用 11px 甚至 10px 字号
- **影响**: 在某些屏幕上可读性差
- **建议**: 最小字号不低于 11px，重要信息不低于 12px

## 优先级修复顺序

### P0 - 立即修复（影响可用性）
1. 导航链接 padding (#1)
2. 按钮 padding (#2)
3. 表格单元格 padding (#3)
4. 卡片标题字号 (#4)
5. 面板标题字号 (#5)

### P1 - 尽快修复（影响美观）
6-15: 所有中等问题

### P2 - 优化改进（细节打磨）
16-30: 所有轻微问题和移动端问题

### P3 - 系统性改进
31-32: 字体层级统一

## 总结

共发现 **32 个基础样式问题**：
- 🔴 严重问题: 5 个
- 🟡 中等问题: 10 个
- 🟢 轻微问题: 10 个
- 📱 移动端问题: 5 个
- 🎨 系统性问题: 2 个

主要问题集中在：
1. **Padding 不足** - 大部分组件的内边距都偏小
2. **字号层级不清晰** - 标题和正文对比度不够
3. **间距不统一** - gap 和 padding 的搭配不协调
4. **移动端适配不够** - 触摸目标和字号需要优化
