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
  { icon: ArrowLeft, name: "ArrowLeft", desc: "左箭头，返回/上一页", category: "导航与方向", usedIn: ["batch-create", "ui", "models-feature", "presets-feature", "projects-feature", "runs-feature", "templates-feature"] },
  { icon: ArrowRight, name: "ArrowRight", desc: "右箭头，前进/下一步", category: "导航与方向", usedIn: ["ui", "presets-feature", "runs-feature", "settings-feature", "templates-feature"] },
  { icon: ChevronDown, name: "ChevronDown", desc: "向下折叠/展开", category: "导航与方向", usedIn: ["ui", "projects-feature", "runs-feature", "editor-controls", "editor-presets"] },
  { icon: ChevronLeft, name: "ChevronLeft", desc: "向左折叠/收起", category: "导航与方向", usedIn: ["editor-header", "editor-page"] },
  { icon: ChevronRight, name: "ChevronRight", desc: "向右展开", category: "导航与方向", usedIn: ["models-feature", "projects-feature", "editor-header"] },
  { icon: ChevronUp, name: "ChevronUp", desc: "向上折叠/收起", category: "导航与方向", usedIn: ["ui", "projects-feature"] },
  { icon: Home, name: "Home", desc: "首页/主页", category: "导航与方向", usedIn: ["routing", "settings-feature"] },
  { icon: ExternalLink, name: "ExternalLink", desc: "外部链接/新窗口打开", category: "导航与方向", usedIn: ["runs-feature", "editor-header", "editor-presets"] },

  // 操作
  { icon: Plus, name: "Plus", desc: "新增/添加", category: "操作", usedIn: ["batch-create", "routing", "models-feature", "presets-feature", "projects-feature", "editor-lora-column", "editor-page", "editor-prompts", "templates-feature"] },
  { icon: Check, name: "Check", desc: "确认/勾选", category: "操作", usedIn: ["demo-data", "ui", "routing", "component-showcase-images", "models-feature", "presets-feature", "projects-feature", "runs-feature", "editor-controls", "editor-header", "editor-page", "templates-feature"] },
  { icon: CheckSquare, name: "CheckSquare", desc: "方框勾选（选中态）", category: "操作", usedIn: ["ui", "component-showcase-images", "presets-feature", "projects-feature", "runs-feature"] },
  { icon: Square, name: "Square", desc: "方框（未选中态）", category: "操作", usedIn: ["ui", "component-showcase-images", "presets-feature", "projects-feature", "runs-feature"] },
  { icon: X, name: "X", desc: "关闭/清除/删除", category: "操作", usedIn: ["batch-create", "ui", "routing", "component-showcase-images", "models-feature", "presets-feature", "projects-feature", "runs-feature", "editor-lora-history", "editor-page-data", "settings-feature"] },
  { icon: Copy, name: "Copy", desc: "复制", category: "操作", usedIn: ["projects-feature", "runs-feature", "editor-page", "editor-presets", "templates-feature"] },
  { icon: Save, name: "Save", desc: "保存", category: "操作", usedIn: ["presets-feature", "projects-feature", "editor-header", "editor-page", "templates-feature"] },
  { icon: Download, name: "Download", desc: "下载", category: "操作", usedIn: ["projects-feature", "runs-feature", "editor-header", "editor-page", "templates-feature"] },
  { icon: Edit3, name: "Edit3", desc: "编辑（铅笔线条）", category: "操作", usedIn: ["routing", "presets-feature", "projects-feature", "templates-feature"] },
  { icon: Pencil, name: "Pencil", desc: "编辑（铅笔实体）", category: "操作", usedIn: ["projects-feature", "editor-header"] },
  { icon: Trash2, name: "Trash2", desc: "删除/移到回收站", category: "操作", usedIn: ["ui", "component-showcase-images", "models-feature", "presets-feature", "projects-feature", "runs-feature", "editor-page", "editor-presets", "editor-prompts", "templates-feature"] },
  { icon: Search, name: "Search", desc: "搜索/查找", category: "操作", usedIn: ["batch-create", "models-feature", "presets-feature", "editor-presets", "settings-feature"] },
  { icon: Play, name: "Play", desc: "播放/运行/执行", category: "操作", usedIn: ["projects-feature", "settings-feature"] },
  { icon: Unlink, name: "Unlink", desc: "取消关联/断开链接", category: "操作", usedIn: ["editor-lora-column", "editor-lora-history", "editor-page", "editor-presets", "editor-prompts"] },
  { icon: GripVertical, name: "GripVertical", desc: "拖拽排序手柄", category: "操作", usedIn: ["presets-feature", "projects-feature", "editor-lora-history", "editor-prompts", "templates-feature"] },

  // 视觉指示
  { icon: Eye, name: "Eye", desc: "查看/可见", category: "视觉指示", usedIn: ["app-shell", "ui", "component-showcase-images", "projects-feature", "editor-header"] },
  { icon: EyeOff, name: "EyeOff", desc: "隐藏/不可见", category: "视觉指示", usedIn: ["app-shell"] },
  { icon: Star, name: "Star", desc: "收藏/星标/评分", category: "视觉指示", usedIn: ["batch-create", "demo-data", "ui", "component-showcase-images", "presets-feature", "projects-feature", "runs-feature", "editor-page", "settings-feature", "templates-feature"] },
  { icon: Archive, name: "Archive", desc: "归档/已归档", category: "视觉指示", usedIn: ["ui", "component-showcase-images", "projects-feature"] },
  { icon: AlertCircle, name: "AlertCircle", desc: "圆形警告/错误提示", category: "视觉指示", usedIn: ["editor-controls"] },
  { icon: AlertTriangle, name: "AlertTriangle", desc: "三角形警告/注意", category: "视觉指示", usedIn: ["runs-feature"] },
  { icon: Zap, name: "Zap", desc: "闪电/快速/高优", category: "视觉指示", usedIn: ["editor-lora-history"] },
  { icon: Clock3, name: "Clock3", desc: "时间/耗时", category: "视觉指示", usedIn: ["runs-feature"] },

  // 业务对象
  { icon: Activity, name: "Activity", desc: "活动/心跳/运行状态", category: "业务对象", usedIn: ["ui", "settings-feature"] },
  { icon: Boxes, name: "Boxes", desc: "批量/组合", category: "业务对象", usedIn: ["batch-create", "routing"] },
  { icon: ClipboardList, name: "ClipboardList", desc: "任务列表/清单", category: "业务对象", usedIn: ["routing", "settings-feature"] },
  { icon: Database, name: "Database", desc: "数据库/数据源", category: "业务对象", usedIn: ["demo-data", "routing"] },
  { icon: FileText, name: "FileText", desc: "文本文件/文档", category: "业务对象", usedIn: ["routing"] },
  { icon: FlaskConical, name: "FlaskConical", desc: "实验/测试", category: "业务对象", usedIn: ["showcase/pages component previews (MetricCard)"] },
  { icon: Folder, name: "Folder", desc: "文件夹/目录", category: "业务对象", usedIn: ["batch-create", "demo-data", "routing", "models-feature", "presets-feature", "projects-feature", "settings-feature"] },
  { icon: FolderInput, name: "FolderInput", desc: "文件夹导入/输入目录", category: "业务对象", usedIn: ["projects-feature"] },
  { icon: FolderPlus, name: "FolderPlus", desc: "新建文件夹", category: "业务对象", usedIn: ["projects-feature"] },
  { icon: FolderTree, name: "FolderTree", desc: "文件夹树/目录结构", category: "业务对象", usedIn: ["batch-create", "routing", "presets-feature"] },
  { icon: Gauge, name: "Gauge", desc: "仪表盘/性能指标", category: "业务对象", usedIn: ["settings-feature"] },
  { icon: Grid3X3, name: "Grid3X3", desc: "网格视图/九宫格", category: "业务对象", usedIn: ["routing"] },
  { icon: History, name: "History", desc: "历史记录", category: "业务对象", usedIn: ["demo-data", "routing", "presets-feature", "editor-lora-history", "editor-page", "settings-feature"] },
  { icon: ImageIcon, name: "ImageIcon", desc: "图片/图像", category: "业务对象", usedIn: ["ui", "routing", "projects-feature", "runs-feature", "editor-page"] },
  { icon: Layers, name: "Layers", desc: "图层/模板层叠", category: "业务对象", usedIn: ["routing", "templates-feature"] },
  { icon: Layers3, name: "Layers3", desc: "多层/深层图层", category: "业务对象", usedIn: ["templates-feature"] },
  { icon: ListChecks, name: "ListChecks", desc: "待办清单/检查列表", category: "业务对象", usedIn: ["routing", "projects-feature"] },
  { icon: Lock, name: "Lock", desc: "锁定/安全", category: "业务对象", usedIn: ["routing", "settings-feature"] },
  { icon: Monitor, name: "Monitor", desc: "显示器/监控", category: "业务对象", usedIn: ["app-client", "routing", "settings-feature"] },
  { icon: Rows3, name: "Rows3", desc: "列表视图/行布局", category: "业务对象", usedIn: ["routing", "projects-feature", "templates-feature"] },
  { icon: Settings, name: "Settings", desc: "设置/配置", category: "业务对象", usedIn: ["app-client", "routing", "settings-feature"] },
  { icon: SlidersHorizontal, name: "SlidersHorizontal", desc: "参数调节/滑块组", category: "业务对象", usedIn: ["routing", "templates-feature"] },
  { icon: Sparkles, name: "Sparkles", desc: "AI/魔法/智能生成", category: "业务对象", usedIn: ["routing"] },
  { icon: Tags, name: "Tags", desc: "标签/分类", category: "业务对象", usedIn: ["ui", "routing"] },
  { icon: Wand2, name: "Wand2", desc: "魔法棒/AI 辅助", category: "业务对象", usedIn: ["batch-create", "routing", "editor-controls"] },
  { icon: Shuffle, name: "Shuffle", desc: "随机/打乱/洗牌", category: "业务对象", usedIn: ["routing", "presets-feature"] },

  // UI 控制
  { icon: Menu, name: "Menu", desc: "菜单/汉堡按钮", category: "UI 控制", usedIn: ["app-shell", "projects-feature", "editor-controls"] },
  { icon: Moon, name: "Moon", desc: "深色模式/夜间", category: "UI 控制", usedIn: ["app-shell"] },
  { icon: Sun, name: "Sun", desc: "浅色模式/日间", category: "UI 控制", usedIn: ["app-shell"] },
  { icon: MoreHorizontal, name: "MoreHorizontal", desc: "更多操作（横向三点）", category: "UI 控制", usedIn: ["app-shell"] },
];

/* ───────────────────────── custom SVG icons ───────────────────────── */
