"use client";

import { Archive, Grid3X3, Layers, Palette, Rows3, SlidersHorizontal } from "lucide-react";

import type { DemoData } from "../design-demo-data";
import s from "../styles/showcase.module.css";
import { PageHeader } from "../ui/page-header";
import showcaseCss from "./component-showcase.module.css";

export function ComponentShowcaseIndex({ data: _data }: { data: DemoData }) {
  void _data;
  const categories = [
    { href: "/component-showcase-atoms", title: "原子 / 小组件", desc: "Button、PageHeaderBack、StatusBadge、Field、Switch、SelectLike、StepperInput 等", icon: Layers, count: 18 },
    { href: "/component-showcase-mid", title: "中组件", desc: "PageHeader、Panel、RouteTable、Toast、EmptyPage、QueueMetrics、CurrentRunningProgressCard 等", icon: Grid3X3, count: 8 },
    { href: "/component-showcase-images", title: "图片组件", desc: "ImageThumb、ImageStrip、ImageList、ImageGrid、ReviewBoard、Lightbox", icon: Palette, count: 9 },
    { href: "/component-showcase-editor", title: "Section Editor 组件", desc: "SectionHeader、PresetBindingRow、PromptBlockRow、LoraRow、LoraColumn 等", icon: SlidersHorizontal, count: 8 },
    { href: "/component-showcase-projects", title: "项目卡片和列表", desc: "ProjectDetailHeader、ProjectListItem、ProjectSectionCard、ProjectFolderRow、BatchSizeSelector 等", icon: Archive, count: 10 },
    { href: "/component-showcase-icons", title: "Icons 图标", desc: "Lucide 图标全览 + 自定义 SVG 图标", icon: Palette, count: 57 },
    { href: "/image-list-components", title: "图片列表组件检查", desc: "已有的图片列表专项检查页", icon: Rows3, count: 3 },
  ];

  return (
    <div className={s.showcasePage}>
      <PageHeader
        eyebrow="临时页面"
        title="组件展示总览"
        subtitle="选择分类查看各组件。调整浏览器窗口宽度查看响应式表现。"
      />
      <div className={s.showcaseIndexGrid}>
        {categories.map((cat) => (
          <a key={cat.href} href={`/design-demos${cat.href}`} className={s.showcaseIndexCard}>
            <cat.icon className={showcaseCss.categoryIcon} size={24} />
            <div className={s.showcaseIndexCardTitle}>{cat.title}</div>
            <div className={s.showcaseIndexCardDesc}>{cat.desc}</div>
            <div className={s.showcaseIndexCardCount}>{cat.count} 个组件</div>
          </a>
        ))}
      </div>
    </div>
  );
}
