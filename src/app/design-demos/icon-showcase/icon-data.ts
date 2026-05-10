import {
  Activity, AlertCircle, AlertTriangle, Archive, ArrowLeft, ArrowRight,
  Boxes, Check, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  ClipboardList, Clock3, Copy, Database, Download, Edit3, ExternalLink,
  Eye, EyeOff, FileText, FlaskConical, Folder, FolderInput, FolderPlus,
  FolderTree, Gauge, GripVertical, Grid3X3, History, Home, ImageIcon, Layers,
  Layers3, ListChecks, Lock, Menu, Monitor, Moon, MoreHorizontal, Pencil,
  Play, Plus, Rows3, Save, Search, Settings, Shuffle, SlidersHorizontal,
  Sparkles, Square, Star, Sun, Tags, Trash2, Unlink, Wand2, X, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface IconEntry {
  icon: LucideIcon;
  name: string;
  desc: string;
  category: string;
  usedIn: string[];
}

export const ALL_ICONS: IconEntry[] = [
  // 导航与方向
  { icon: ArrowLeft, name: "ArrowLeft", desc: "左箭头，返回/上一页", category: "导航与方向", usedIn: ["batch-create-page", "ui", "model-pages", "preset-pages", "project-pages", "runs-page", "template-pages"] },
  { icon: ArrowRight, name: "ArrowRight", desc: "右箭头，前进/下一步", category: "导航与方向", usedIn: ["ui", "preset-pages", "runs-page", "system-pages", "template-pages"] },
  { icon: ChevronDown, name: "ChevronDown", desc: "向下折叠/展开", category: "导航与方向", usedIn: ["ui", "project-pages", "runs-page", "section-editor-controls", "section-editor-presets"] },
  { icon: ChevronLeft, name: "ChevronLeft", desc: "向左折叠/收起", category: "导航与方向", usedIn: ["section-editor-header", "section-editor-page"] },
  { icon: ChevronRight, name: "ChevronRight", desc: "向右展开", category: "导航与方向", usedIn: ["model-pages", "project-pages", "section-editor-header"] },
  { icon: ChevronUp, name: "ChevronUp", desc: "向上折叠/收起", category: "导航与方向", usedIn: ["ui", "project-pages"] },
  { icon: Home, name: "Home", desc: "首页/主页", category: "导航与方向", usedIn: ["design-demo-utils", "system-pages"] },
  { icon: ExternalLink, name: "ExternalLink", desc: "外部链接/新窗口打开", category: "导航与方向", usedIn: ["runs-page", "section-editor-header", "section-editor-presets"] },

  // 操作
  { icon: Plus, name: "Plus", desc: "新增/添加", category: "操作", usedIn: ["batch-create-page", "design-demo-utils", "model-pages", "preset-pages", "project-pages", "section-editor-lora-column", "section-editor-page", "section-editor-prompts", "template-pages"] },
  { icon: Check, name: "Check", desc: "确认/勾选", category: "操作", usedIn: ["design-demo-data", "ui", "design-demo-utils", "image-list-components", "model-pages", "preset-pages", "project-pages", "runs-page", "section-editor-controls", "section-editor-header", "section-editor-page", "template-pages"] },
  { icon: CheckSquare, name: "CheckSquare", desc: "方框勾选（选中态）", category: "操作", usedIn: ["ui", "image-list-components", "preset-pages", "project-pages", "runs-page"] },
  { icon: Square, name: "Square", desc: "方框（未选中态）", category: "操作", usedIn: ["ui", "image-list-components", "preset-pages", "project-pages", "runs-page"] },
  { icon: X, name: "X", desc: "关闭/清除/删除", category: "操作", usedIn: ["batch-create-page", "ui", "design-demo-utils", "image-list-components", "model-pages", "preset-pages", "project-pages", "runs-page", "section-editor-lora-history", "section-editor-page-data", "system-pages"] },
  { icon: Copy, name: "Copy", desc: "复制", category: "操作", usedIn: ["project-pages", "runs-page", "section-editor-page", "section-editor-presets", "template-pages"] },
  { icon: Save, name: "Save", desc: "保存", category: "操作", usedIn: ["preset-pages", "project-pages", "section-editor-header", "section-editor-page", "template-pages"] },
  { icon: Download, name: "Download", desc: "下载", category: "操作", usedIn: ["project-pages", "runs-page", "section-editor-header", "section-editor-page", "template-pages"] },
  { icon: Edit3, name: "Edit3", desc: "编辑（铅笔线条）", category: "操作", usedIn: ["design-demo-utils", "preset-pages", "project-pages", "template-pages"] },
  { icon: Pencil, name: "Pencil", desc: "编辑（铅笔实体）", category: "操作", usedIn: ["project-pages", "section-editor-header"] },
  { icon: Trash2, name: "Trash2", desc: "删除/移到回收站", category: "操作", usedIn: ["ui", "image-list-components", "model-pages", "preset-pages", "project-pages", "runs-page", "section-editor-page", "section-editor-presets", "section-editor-prompts", "template-pages"] },
  { icon: Search, name: "Search", desc: "搜索/查找", category: "操作", usedIn: ["batch-create-page", "model-pages", "preset-pages", "section-editor-presets", "system-pages"] },
  { icon: Play, name: "Play", desc: "播放/运行/执行", category: "操作", usedIn: ["project-pages", "system-pages"] },
  { icon: Unlink, name: "Unlink", desc: "取消关联/断开链接", category: "操作", usedIn: ["section-editor-lora-column", "section-editor-lora-history", "section-editor-page", "section-editor-presets", "section-editor-prompts"] },
  { icon: GripVertical, name: "GripVertical", desc: "拖拽排序手柄", category: "操作", usedIn: ["preset-pages", "project-pages", "section-editor-lora-history", "section-editor-prompts", "template-pages"] },

  // 视觉指示
  { icon: Eye, name: "Eye", desc: "查看/可见", category: "视觉指示", usedIn: ["design-demo-shell", "ui", "image-list-components", "project-pages", "section-editor-header"] },
  { icon: EyeOff, name: "EyeOff", desc: "隐藏/不可见", category: "视觉指示", usedIn: ["design-demo-shell"] },
  { icon: Star, name: "Star", desc: "收藏/星标/评分", category: "视觉指示", usedIn: ["batch-create-page", "design-demo-data", "ui", "image-list-components", "preset-pages", "project-pages", "runs-page", "section-editor-page", "system-pages", "template-pages"] },
  { icon: Archive, name: "Archive", desc: "归档/已归档", category: "视觉指示", usedIn: ["ui", "image-list-components", "project-pages"] },
  { icon: AlertCircle, name: "AlertCircle", desc: "圆形警告/错误提示", category: "视觉指示", usedIn: ["section-editor-controls"] },
  { icon: AlertTriangle, name: "AlertTriangle", desc: "三角形警告/注意", category: "视觉指示", usedIn: ["runs-page"] },
  { icon: Zap, name: "Zap", desc: "闪电/快速/高优", category: "视觉指示", usedIn: ["section-editor-lora-history"] },
  { icon: Clock3, name: "Clock3", desc: "时间/耗时", category: "视觉指示", usedIn: ["runs-page"] },

  // 业务对象
  { icon: Activity, name: "Activity", desc: "活动/心跳/运行状态", category: "业务对象", usedIn: ["ui", "system-pages"] },
  { icon: Boxes, name: "Boxes", desc: "批量/组合", category: "业务对象", usedIn: ["batch-create-page", "design-demo-utils"] },
  { icon: ClipboardList, name: "ClipboardList", desc: "任务列表/清单", category: "业务对象", usedIn: ["design-demo-utils", "system-pages"] },
  { icon: Database, name: "Database", desc: "数据库/数据源", category: "业务对象", usedIn: ["design-demo-data", "design-demo-utils"] },
  { icon: FileText, name: "FileText", desc: "文本文件/文档", category: "业务对象", usedIn: ["design-demo-utils"] },
  { icon: FlaskConical, name: "FlaskConical", desc: "实验/测试", category: "业务对象", usedIn: ["component-showcase-page (MetricCard)"] },
  { icon: Folder, name: "Folder", desc: "文件夹/目录", category: "业务对象", usedIn: ["batch-create-page", "design-demo-data", "design-demo-utils", "model-pages", "preset-pages", "project-pages", "system-pages"] },
  { icon: FolderInput, name: "FolderInput", desc: "文件夹导入/输入目录", category: "业务对象", usedIn: ["project-pages"] },
  { icon: FolderPlus, name: "FolderPlus", desc: "新建文件夹", category: "业务对象", usedIn: ["project-pages"] },
  { icon: FolderTree, name: "FolderTree", desc: "文件夹树/目录结构", category: "业务对象", usedIn: ["batch-create-page", "design-demo-utils", "preset-pages"] },
  { icon: Gauge, name: "Gauge", desc: "仪表盘/性能指标", category: "业务对象", usedIn: ["system-pages"] },
  { icon: Grid3X3, name: "Grid3X3", desc: "网格视图/九宫格", category: "业务对象", usedIn: ["design-demo-utils"] },
  { icon: History, name: "History", desc: "历史记录", category: "业务对象", usedIn: ["design-demo-data", "design-demo-utils", "preset-pages", "section-editor-lora-history", "section-editor-page", "system-pages"] },
  { icon: ImageIcon, name: "ImageIcon", desc: "图片/图像", category: "业务对象", usedIn: ["ui", "design-demo-utils", "project-pages", "runs-page", "section-editor-page"] },
  { icon: Layers, name: "Layers", desc: "图层/模板层叠", category: "业务对象", usedIn: ["design-demo-utils", "template-pages"] },
  { icon: Layers3, name: "Layers3", desc: "多层/深层图层", category: "业务对象", usedIn: ["template-pages"] },
  { icon: ListChecks, name: "ListChecks", desc: "待办清单/检查列表", category: "业务对象", usedIn: ["design-demo-utils", "project-pages"] },
  { icon: Lock, name: "Lock", desc: "锁定/安全", category: "业务对象", usedIn: ["design-demo-utils", "system-pages"] },
  { icon: Monitor, name: "Monitor", desc: "显示器/监控", category: "业务对象", usedIn: ["design-demo-client", "design-demo-utils", "system-pages"] },
  { icon: Rows3, name: "Rows3", desc: "列表视图/行布局", category: "业务对象", usedIn: ["design-demo-utils", "project-pages", "template-pages"] },
  { icon: Settings, name: "Settings", desc: "设置/配置", category: "业务对象", usedIn: ["design-demo-client", "design-demo-utils", "system-pages"] },
  { icon: SlidersHorizontal, name: "SlidersHorizontal", desc: "参数调节/滑块组", category: "业务对象", usedIn: ["design-demo-utils", "template-pages"] },
  { icon: Sparkles, name: "Sparkles", desc: "AI/魔法/智能生成", category: "业务对象", usedIn: ["design-demo-utils"] },
  { icon: Tags, name: "Tags", desc: "标签/分类", category: "业务对象", usedIn: ["ui", "design-demo-utils"] },
  { icon: Wand2, name: "Wand2", desc: "魔法棒/AI 辅助", category: "业务对象", usedIn: ["batch-create-page", "design-demo-utils", "section-editor-controls"] },
  { icon: Shuffle, name: "Shuffle", desc: "随机/打乱/洗牌", category: "业务对象", usedIn: ["design-demo-utils", "preset-pages"] },

  // UI 控制
  { icon: Menu, name: "Menu", desc: "菜单/汉堡按钮", category: "UI 控制", usedIn: ["design-demo-shell", "project-pages", "section-editor-controls"] },
  { icon: Moon, name: "Moon", desc: "深色模式/夜间", category: "UI 控制", usedIn: ["design-demo-shell"] },
  { icon: Sun, name: "Sun", desc: "浅色模式/日间", category: "UI 控制", usedIn: ["design-demo-shell"] },
  { icon: MoreHorizontal, name: "MoreHorizontal", desc: "更多操作（横向三点）", category: "UI 控制", usedIn: ["design-demo-shell"] },
];

/* ───────────────────────── custom SVG icons ───────────────────────── */
