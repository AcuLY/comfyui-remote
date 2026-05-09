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

import { PageHeader } from "./design-demo-ui";
import s from "./design-demo-styles";

/* ───────────────────────── data ───────────────────────── */

interface IconEntry {
  icon: LucideIcon;
  name: string;
  category: string;
  usedIn: string[];
}

const ALL_ICONS: IconEntry[] = [
  // 导航与方向
  { icon: ArrowLeft, name: "ArrowLeft", category: "导航与方向", usedIn: ["batch-create-page", "design-demo-ui", "model-pages", "preset-pages", "project-pages", "runs-page", "template-pages"] },
  { icon: ArrowRight, name: "ArrowRight", category: "导航与方向", usedIn: ["design-demo-ui", "preset-pages", "runs-page", "system-pages", "template-pages"] },
  { icon: ChevronDown, name: "ChevronDown", category: "导航与方向", usedIn: ["design-demo-ui", "project-pages", "runs-page", "section-editor-controls", "section-editor-presets"] },
  { icon: ChevronLeft, name: "ChevronLeft", category: "导航与方向", usedIn: ["section-editor-header", "section-editor-page"] },
  { icon: ChevronRight, name: "ChevronRight", category: "导航与方向", usedIn: ["model-pages", "project-pages", "section-editor-header"] },
  { icon: ChevronUp, name: "ChevronUp", category: "导航与方向", usedIn: ["design-demo-ui", "project-pages"] },
  { icon: Home, name: "Home", category: "导航与方向", usedIn: ["design-demo-utils", "system-pages"] },
  { icon: ExternalLink, name: "ExternalLink", category: "导航与方向", usedIn: ["runs-page", "section-editor-header", "section-editor-presets"] },

  // 操作
  { icon: Plus, name: "Plus", category: "操作", usedIn: ["batch-create-page", "design-demo-utils", "model-pages", "preset-pages", "project-pages", "section-editor-lora-column", "section-editor-page", "section-editor-prompts", "template-pages"] },
  { icon: Check, name: "Check", category: "操作", usedIn: ["design-demo-data", "design-demo-ui", "design-demo-utils", "image-list-components", "model-pages", "preset-pages", "project-pages", "runs-page", "section-editor-controls", "section-editor-header", "section-editor-page", "template-pages"] },
  { icon: CheckSquare, name: "CheckSquare", category: "操作", usedIn: ["design-demo-ui", "image-list-components", "preset-pages", "project-pages", "runs-page"] },
  { icon: Square, name: "Square", category: "操作", usedIn: ["design-demo-ui", "image-list-components", "preset-pages", "project-pages", "runs-page"] },
  { icon: X, name: "X", category: "操作", usedIn: ["batch-create-page", "design-demo-ui", "design-demo-utils", "image-list-components", "model-pages", "preset-pages", "project-pages", "runs-page", "section-editor-lora-history", "section-editor-page-data", "system-pages"] },
  { icon: Copy, name: "Copy", category: "操作", usedIn: ["project-pages", "runs-page", "section-editor-page", "section-editor-presets", "template-pages"] },
  { icon: Save, name: "Save", category: "操作", usedIn: ["preset-pages", "project-pages", "section-editor-header", "section-editor-page", "template-pages"] },
  { icon: Download, name: "Download", category: "操作", usedIn: ["project-pages", "runs-page", "section-editor-header", "section-editor-page", "template-pages"] },
  { icon: Edit3, name: "Edit3", category: "操作", usedIn: ["design-demo-utils", "preset-pages", "project-pages", "template-pages"] },
  { icon: Pencil, name: "Pencil", category: "操作", usedIn: ["project-pages", "section-editor-header"] },
  { icon: Trash2, name: "Trash2", category: "操作", usedIn: ["design-demo-ui", "image-list-components", "model-pages", "preset-pages", "project-pages", "runs-page", "section-editor-page", "section-editor-presets", "section-editor-prompts", "template-pages"] },
  { icon: Search, name: "Search", category: "操作", usedIn: ["batch-create-page", "model-pages", "preset-pages", "section-editor-presets", "system-pages"] },
  { icon: Play, name: "Play", category: "操作", usedIn: ["project-pages", "system-pages"] },
  { icon: Unlink, name: "Unlink", category: "操作", usedIn: ["section-editor-lora-column", "section-editor-lora-history", "section-editor-page", "section-editor-presets", "section-editor-prompts"] },
  { icon: GripVertical, name: "GripVertical", category: "操作", usedIn: ["preset-pages", "project-pages", "section-editor-lora-history", "section-editor-prompts", "template-pages"] },

  // 视觉指示
  { icon: Eye, name: "Eye", category: "视觉指示", usedIn: ["design-demo-shell", "design-demo-ui", "image-list-components", "project-pages", "section-editor-header"] },
  { icon: EyeOff, name: "EyeOff", category: "视觉指示", usedIn: ["design-demo-shell"] },
  { icon: Star, name: "Star", category: "视觉指示", usedIn: ["batch-create-page", "design-demo-data", "design-demo-ui", "image-list-components", "preset-pages", "project-pages", "runs-page", "section-editor-page", "system-pages", "template-pages"] },
  { icon: Archive, name: "Archive", category: "视觉指示", usedIn: ["design-demo-ui", "image-list-components", "project-pages"] },
  { icon: AlertCircle, name: "AlertCircle", category: "视觉指示", usedIn: ["section-editor-controls"] },
  { icon: AlertTriangle, name: "AlertTriangle", category: "视觉指示", usedIn: ["runs-page"] },
  { icon: Zap, name: "Zap", category: "视觉指示", usedIn: ["section-editor-lora-history"] },
  { icon: Clock3, name: "Clock3", category: "视觉指示", usedIn: ["runs-page"] },

  // 业务对象
  { icon: Activity, name: "Activity", category: "业务对象", usedIn: ["design-demo-ui", "system-pages"] },
  { icon: Boxes, name: "Boxes", category: "业务对象", usedIn: ["batch-create-page", "design-demo-utils"] },
  { icon: ClipboardList, name: "ClipboardList", category: "业务对象", usedIn: ["design-demo-utils", "system-pages"] },
  { icon: Database, name: "Database", category: "业务对象", usedIn: ["design-demo-data", "design-demo-utils"] },
  { icon: FileText, name: "FileText", category: "业务对象", usedIn: ["design-demo-utils"] },
  { icon: FlaskConical, name: "FlaskConical", category: "业务对象", usedIn: ["component-showcase-page (MetricCard)"] },
  { icon: Folder, name: "Folder", category: "业务对象", usedIn: ["batch-create-page", "design-demo-data", "design-demo-utils", "model-pages", "preset-pages", "project-pages", "system-pages"] },
  { icon: FolderInput, name: "FolderInput", category: "业务对象", usedIn: ["project-pages"] },
  { icon: FolderPlus, name: "FolderPlus", category: "业务对象", usedIn: ["project-pages"] },
  { icon: FolderTree, name: "FolderTree", category: "业务对象", usedIn: ["batch-create-page", "design-demo-utils", "preset-pages"] },
  { icon: Gauge, name: "Gauge", category: "业务对象", usedIn: ["system-pages"] },
  { icon: Grid3X3, name: "Grid3X3", category: "业务对象", usedIn: ["design-demo-utils"] },
  { icon: History, name: "History", category: "业务对象", usedIn: ["design-demo-data", "design-demo-utils", "preset-pages", "section-editor-lora-history", "section-editor-page", "system-pages"] },
  { icon: ImageIcon, name: "ImageIcon", category: "业务对象", usedIn: ["design-demo-ui", "design-demo-utils", "project-pages", "runs-page", "section-editor-page"] },
  { icon: Layers, name: "Layers", category: "业务对象", usedIn: ["design-demo-utils", "template-pages"] },
  { icon: Layers3, name: "Layers3", category: "业务对象", usedIn: ["template-pages"] },
  { icon: ListChecks, name: "ListChecks", category: "业务对象", usedIn: ["design-demo-utils", "project-pages"] },
  { icon: Lock, name: "Lock", category: "业务对象", usedIn: ["design-demo-utils", "system-pages"] },
  { icon: Monitor, name: "Monitor", category: "业务对象", usedIn: ["design-demo-client", "design-demo-utils", "system-pages"] },
  { icon: Rows3, name: "Rows3", category: "业务对象", usedIn: ["design-demo-utils", "project-pages", "template-pages"] },
  { icon: Settings, name: "Settings", category: "业务对象", usedIn: ["design-demo-client", "design-demo-utils", "system-pages"] },
  { icon: SlidersHorizontal, name: "SlidersHorizontal", category: "业务对象", usedIn: ["design-demo-utils", "template-pages"] },
  { icon: Sparkles, name: "Sparkles", category: "业务对象", usedIn: ["design-demo-utils"] },
  { icon: Tags, name: "Tags", category: "业务对象", usedIn: ["design-demo-ui", "design-demo-utils"] },
  { icon: Wand2, name: "Wand2", category: "业务对象", usedIn: ["batch-create-page", "design-demo-utils", "section-editor-controls"] },
  { icon: Shuffle, name: "Shuffle", category: "业务对象", usedIn: ["design-demo-utils", "preset-pages"] },

  // UI 控制
  { icon: Menu, name: "Menu", category: "UI 控制", usedIn: ["design-demo-shell", "project-pages", "section-editor-controls"] },
  { icon: Moon, name: "Moon", category: "UI 控制", usedIn: ["design-demo-shell"] },
  { icon: Sun, name: "Sun", category: "UI 控制", usedIn: ["design-demo-shell"] },
  { icon: MoreHorizontal, name: "MoreHorizontal", category: "UI 控制", usedIn: ["design-demo-shell"] },
];

/* ───────────────────────── page ───────────────────────── */

export function IconShowcasePage() {
  const [filter, setFilter] = useState("");

  const groups = useMemo(() => {
    const q = filter.toLowerCase();
    const map = new Map<string, IconEntry[]>();
    for (const item of ALL_ICONS) {
      if (q && !item.name.toLowerCase().includes(q) && !item.category.includes(q) && !item.usedIn.some((u) => u.toLowerCase().includes(q))) {
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
      <PageHeader eyebrow="组件展示" title="Icons" subtitle={`项目使用的全部 ${ALL_ICONS.length} 个 Lucide 图标，含使用位置`} />

      <div className={s.iconFilterBar}>
        <input
          type="text"
          placeholder="搜索图标名 / 分类 / 使用位置…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={s.iconFilterInput}
        />
        {filter && (
          <button type="button" className={s.iconFilterClear} onClick={() => setFilter("")}>✕</button>
        )}
      </div>

      <div className={s.showcaseIconGrid}>
        {groups.map(([cat, items]) => (
          <div key={cat}>
            <div className={s.showcaseGroupTitle}>{cat}</div>
            <div className={s.showcaseIconRow}>
              {items.map(({ icon: Icon, name, usedIn }) => (
                <div key={name} className={s.showcaseIconCell} title={usedIn.join("\n")}>
                  <Icon size={20} />
                  <span className={s.iconCellName}>{name}</span>
                  <span className={s.iconCellUsage}>{usedIn.length} 处</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <div style={{ color: "var(--demo-muted)", textAlign: "center", padding: 32 }}>
          没有匹配的图标
        </div>
      )}
    </div>
  );
}
