# ComfyUI Manager 页面清单

## 核心页面（优先复现）

### 1. 首页 / 审核队列
- **路径**: `/` → 重定向到 `/queue`
- **文件**: `src/app/page.tsx`, `src/app/queue/page.tsx`
- **布局**: 统计卡片 + 队列列表（带缩略图条）
- **状态**: ⏳ 待复现

### 2. 项目列表
- **路径**: `/projects`
- **文件**: `src/app/projects/page.tsx`
- **布局**: 项目卡片网格
- **状态**: ⏳ 待复现

### 3. 宫格审图
- **路径**: `/queue/:runId`
- **文件**: `src/app/queue/[runId]/page.tsx`
- **布局**: 信息卡片 + 图片网格 + 底部操作栏
- **状态**: ⏳ 待复现

### 4. 项目详情
- **路径**: `/projects/:projectId`
- **文件**: `src/app/projects/[projectId]/page.tsx`
- **布局**: 项目信息 + Section 列表 + 缩略图条
- **状态**: ⏳ 待复现

## 项目管理页面

### 5. 创建新项目
- **路径**: `/projects/new`
- **文件**: `src/app/projects/new/page.tsx`
- **布局**: 表单（选择各分类预设）
- **状态**: ⏳ 待复现

### 6. 编辑项目
- **路径**: `/projects/:projectId/edit`
- **文件**: `src/app/projects/[projectId]/edit/page.tsx`
- **布局**: 编辑表单
- **状态**: ⏳ 待复现

### 7. Section 编辑
- **路径**: `/projects/:projectId/sections/:sectionId`
- **文件**: `src/app/projects/[projectId]/sections/[sectionId]/page.tsx`
- **布局**: 参数表单 + Prompt Block 编辑器 + LoRA 编辑器
- **状态**: ⏳ 待复现

### 8. Section 结果页
- **路径**: `/projects/:projectId/sections/:sectionId/results`
- **文件**: `src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx`
- **布局**: 图片 Gallery + Lightbox
- **状态**: ⏳ 待复现

## 资源管理页面

### 9. 模型管理（LoRA + Checkpoints）
- **路径**: `/assets/models`
- **文件**: `src/app/assets/models/page.tsx`
- **布局**: 文件管理器（目录树 + 文件列表）
- **状态**: ⏳ 待复现

### 10. 提示词预设
- **路径**: `/assets/presets`
- **文件**: `src/app/assets/presets/page.tsx`
- **布局**: 分类列表 + 预设管理
- **状态**: ⏳ 待复现

### 11. 项目模板
- **路径**: `/assets/templates`
- **文件**: `src/app/assets/templates/page.tsx`
- **布局**: 模板列表 + 新建按钮
- **状态**: ⏳ 待复现

### 12. 新建模板
- **路径**: `/assets/templates/new`
- **文件**: `src/app/assets/templates/new/page.tsx`
- **布局**: 模板创建表单
- **状态**: ⏳ 待复现

### 13. 编辑模板
- **路径**: `/assets/templates/:templateId/edit`
- **文件**: `src/app/assets/templates/[templateId]/edit/page.tsx`
- **布局**: 模板编辑表单
- **状态**: ⏳ 待复现

## 设置页面

### 14. 设置首页
- **路径**: `/settings`
- **文件**: `src/app/settings/page.tsx`
- **布局**: 快捷入口卡片 + 设置项列表
- **状态**: ⏳ 待复现

### 15. 日志监控
- **路径**: `/settings/logs`
- **文件**: `src/app/settings/logs/page.tsx`
- **布局**: 日志列表
- **状态**: ⏳ 待复现

### 16. Worker 监控
- **路径**: `/settings/monitor`
- **文件**: `src/app/settings/monitor/page.tsx`
- **布局**: Worker 状态监控
- **状态**: ⏳ 待复现

## 其他页面

### 17. 登录页
- **路径**: `/login`
- **文件**: `src/app/login/page.tsx`
- **布局**: 登录表单
- **状态**: ⏳ 待复现

### 18. 预设详情
- **路径**: `/assets/presets/:presetId`
- **文件**: `src/app/assets/presets/[presetId]/page.tsx`
- **布局**: 预设详情 + 变体管理
- **状态**: ⏳ 待复现

### 19. 预设组详情
- **路径**: `/assets/preset-groups/:groupId`
- **文件**: `src/app/assets/preset-groups/[groupId]/page.tsx`
- **布局**: 预设组管理
- **状态**: ⏳ 待复现

### 20. 排序规则
- **路径**: `/assets/presets/sort-rules`
- **文件**: `src/app/assets/presets/sort-rules/page.tsx`
- **布局**: 排序规则配置
- **状态**: ⏳ 待复现

### 21. 批量创建
- **路径**: `/projects/:projectId/batch-create`
- **文件**: `src/app/projects/[projectId]/batch-create/page.tsx`
- **布局**: 批量创建表单
- **状态**: ⏳ 待复现

---

## 复现优先级

### 第一批（核心流程）
1. ✅ 审核队列 (`/queue`)
2. ✅ 项目列表 (`/projects`)
3. ✅ 宫格审图 (`/queue/:runId`)
4. ✅ 设置页 (`/settings`)

### 第二批（项目管理）
5. 项目详情 (`/projects/:projectId`)
6. 创建新项目 (`/projects/new`)
7. 编辑项目 (`/projects/:projectId/edit`)
8. Section 编辑 (`/projects/:projectId/sections/:sectionId`)

### 第三批（资源管理）
9. 模型管理 (`/assets/models`)
10. 提示词预设 (`/assets/presets`)
11. 项目模板 (`/assets/templates`)

### 第四批（其他）
12. 其余页面

---

**更新时间**: 2026-04-30
