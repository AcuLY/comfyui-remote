"use client";

import { useMemo, useState } from "react";
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

import { PageHeader } from "./ui/page-header";
import { Button } from "./ui/button";
import { createSvgIcon, createSvgIconFromString, type SvgIconComponent } from "./svg-icon";
import s from "./design-demo.module.css";

/* ───────────────────────── data ───────────────────────── */

interface IconEntry {
  icon: LucideIcon;
  name: string;
  desc: string;
  category: string;
  usedIn: string[];
}

const ALL_ICONS: IconEntry[] = [
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

/** 示例：用 createSvgIcon 创建描边风格图标 */
const ComfyuiIcon = createSvgIcon({
  displayName: "ComfyuiIcon",
  children: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8M12 8v8" />
    </>
  ),
});

/** 示例：用 createSvgIcon 创建填充风格图标 */
const HeartFilledIcon = createSvgIcon({
  displayName: "HeartFilledIcon",
  fill: "currentColor",
  defaultStrokeWidth: 0,
  children: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
});

/** 示例：用 createSvgIconFromString 从原始 SVG 字符串创建图标 */
const FlameIcon = createSvgIconFromString({
  displayName: "FlameIcon",
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>`,
});

/** 示例：非 24x24 viewBox 的图标 */
const HexagonIcon = createSvgIcon({
  displayName: "HexagonIcon",
  viewBox: "0 0 100 100",
  children: <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" />,
});

const CUSTOM_ICONS: Array<{ icon: SvgIconComponent; name: string; desc: string; source: string }> = [
  { icon: ComfyuiIcon, name: "ComfyuiIcon", desc: "自定义描边图标（createSvgIcon）", source: "createSvgIcon" },
  { icon: HeartFilledIcon, name: "HeartFilledIcon", desc: "填充风格爱心（createSvgIcon + fill）", source: "createSvgIcon" },
  { icon: FlameIcon, name: "FlameIcon", desc: "火焰图标（createSvgIconFromString）", source: "createSvgIconFromString" },
  { icon: HexagonIcon, name: "HexagonIcon", desc: "六边形（非 24×24 viewBox）", source: "createSvgIcon" },
];

/* ───────────────────────── page ───────────────────────── */

export function IconShowcasePage() {
  const [filter, setFilter] = useState("");

  const groups = useMemo(() => {
    const q = filter.toLowerCase();
    const map = new Map<string, IconEntry[]>();
    for (const item of ALL_ICONS) {
      if (q && !item.name.toLowerCase().includes(q) && !item.desc.includes(q) && !item.category.includes(q) && !item.usedIn.some((u) => u.toLowerCase().includes(q))) {
        continue;
      }
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [filter]);

  return (
    <div className={s.showcasePage}>
      <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="Icons" subtitle={`项目使用的全部 ${ALL_ICONS.length} 个 Lucide 图标`} />

      <div className={s.iconFilterBar}>
        <input
          type="text"
          placeholder="搜索图标名 / 说明 / 分类 / 使用位置…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={s.iconFilterInput}
        />
        {filter && (
          <button type="button" className={s.iconFilterClear} onClick={() => setFilter("")}>✕</button>
        )}
      </div>

      <div className={s.iconListContainer}>
        {/* header */}
        <div className={`${s.iconListRow} ${s.iconListHeader}`}>
          <span className={s.iconListColIcon}>图标</span>
          <span className={s.iconListColName}>名称</span>
          <span className={s.iconListColDesc}>说明</span>
          <span className={s.iconListColUsage}>使用位置</span>
        </div>

        {groups.map(([cat, items]) => (
          <div key={cat}>
            <div className={s.iconListCategory}>{cat}</div>
            {items.map(({ icon: Icon, name, desc, usedIn }) => (
              <div key={name} className={s.iconListRow}>
                <span className={s.iconListColIcon}><Icon size={18} /></span>
                <span className={s.iconListColName}>{name}</span>
                <span className={s.iconListColDesc}>{desc}</span>
                <span className={s.iconListColUsage}>
                  {usedIn.map((u) => (
                    <span key={u} className={s.iconListTag}>{u}</span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <div style={{ color: "var(--demo-muted)", textAlign: "center", padding: 32 }}>
          没有匹配的图标
        </div>
      )}

      {/* ── Custom SVG Icons Demo ── */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--demo-text)" }}>
          自定义 SVG 图标
        </h2>
        <p style={{ fontSize: 12, color: "var(--demo-muted)", marginBottom: 16 }}>
          使用 <code>createSvgIcon</code> / <code>createSvgIconFromString</code> 创建的图标组件，与 Lucide 图标完全兼容，可直接用于 Button 等组件的 <code>icon</code> 属性。
        </p>

        <div className={s.iconListContainer}>
          <div className={`${s.iconListRow} ${s.iconListHeader}`}>
            <span className={s.iconListColIcon}>图标</span>
            <span className={s.iconListColName}>名称</span>
            <span className={s.iconListColDesc}>说明</span>
            <span className={s.iconListColUsage}>创建方式</span>
          </div>
          {CUSTOM_ICONS.map(({ icon: Icon, name, desc, source }) => (
            <div key={name} className={s.iconListRow}>
              <span className={s.iconListColIcon}><Icon size={18} /></span>
              <span className={s.iconListColName}>{name}</span>
              <span className={s.iconListColDesc}>{desc}</span>
              <span className={s.iconListColUsage}>
                <span className={s.iconListTag}>{source}</span>
              </span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--demo-muted)" }}>在 Button 中使用：</span>
          <Button icon={ComfyuiIcon} tone="primary">ComfyUI</Button>
          <Button icon={HeartFilledIcon} tone="pink">收藏</Button>
          <Button icon={FlameIcon}>热门</Button>
          <Button icon={HexagonIcon} tone="subtle">六边形</Button>
          <span style={{ fontSize: 12, color: "var(--demo-muted)" }}>尺寸：</span>
          <ComfyuiIcon size={16} />
          <ComfyuiIcon size={20} />
          <ComfyuiIcon size={24} />
          <ComfyuiIcon size={32} />
          <HeartFilledIcon size={16} style={{ color: "var(--demo-accent)" }} />
          <HeartFilledIcon size={20} style={{ color: "var(--demo-accent)" }} />
          <HeartFilledIcon size={24} style={{ color: "var(--demo-accent)" }} />
        </div>
      </div>
    </div>
  );
}
