"use client";

import { Save } from "lucide-react";
import { useState } from "react";

import { categoryColorValue, categoryItemCount, categoryTypeLabel, type DemoCategory, type DemoData } from "../../data";
import s from "./sort-rules-page.library.module.css";
import { SortableRowShell } from "../../shared/patterns";
import { Button } from "../../shared/primitives/button";
import { PageHeader } from "../../shared/primitives/page-header";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { SortableList, useDemoSortable } from "../../shared/primitives/sortable";
import type { SortRuleDimensionKey } from "../../routing";

export function SortRulesPage({ data }: { data: DemoData }) {
  const dimensions: Array<{ key: SortRuleDimensionKey; title: string; subtitle: string; categories: DemoCategory[] }> = [
    { key: "positive", title: "正向 Prompt", subtitle: "决定导入后正向块的分类顺序。", categories: data.categories },
    { key: "negative", title: "反向 Prompt", subtitle: "反向块使用独立顺序，便于排除项先后稳定。", categories: [...data.categories].reverse() },
    { key: "lora1", title: "LoRA 1", subtitle: "第一阶段 LoRA 绑定的分类排序。", categories: data.categories.slice(1).concat(data.categories.slice(0, 1)) },
    { key: "lora2", title: "LoRA 2", subtitle: "第二阶段 LoRA 绑定的分类排序。", categories: data.categories.slice(2).concat(data.categories.slice(0, 2)) },
  ];

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/presets", label: "返回预设库" }}
        eyebrow="排序规则"
        title="预设排序规则"
        subtitle="每个维度独立拖拽保存，正向、反向与两段 LoRA 不再共用一张摘要表。"
        actions={<Button tone="primary" icon={Save} feedback={{ title: "全部排序规则已保存" }}>保存全部</Button>}
      />
      <div className={s.sortRulesGrid}>
        {dimensions.map((dimension) => (
          <SortRulePanel
            categories={dimension.categories}
            key={dimension.key}
            title={dimension.title}
            subtitle={dimension.subtitle}
          />
        ))}
      </div>
    </div>
  );
}

function SortRulePanel({
  categories,
  title,
  subtitle,
}: {
  categories: DemoCategory[];
  title: string;
  subtitle: string;
}) {
  const [orderedIds, setOrderedIds] = useState(() => categories.map((c) => c.id));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  return (
    <section className={s.sortRulePanel}>
      <div className={s.sortRuleHeader}>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <StatusBadge status="ready" label="已保存" />
      </div>
      <div className={s.sortRuleList}>
        <SortableList items={orderedIds} onReorder={setOrderedIds}>
          {orderedIds.map((id, index) => {
            const category = categoryMap[id];
            if (!category) return null;
            return (
              <SortableCategoryRow key={id} category={category} index={index} />
            );
          })}
        </SortableList>
      </div>
      <div className={s.sortRuleFooter}>
        <span>拖拽排序后保存</span>
        <Button icon={Save} feedback={{ title: `${title} 排序已保存` }}>保存此维度</Button>
      </div>
    </section>
  );
}

function SortableCategoryRow({ category, index }: { category: DemoCategory; index: number }) {
  const { ref, style, handleProps } = useDemoSortable(category.id);
  return (
    <div ref={ref} style={style}>
      <SortableRowShell
        className={s.sortRuleRow}
        contentClassName={s.sortRuleRowContent}
        handleClassName={s.icon}
        handleProps={handleProps}
        index={index}
        indexClassName={s.sortRuleIndex}
        marker={<i style={{ background: categoryColorValue(category.color) }} />}
        markerClassName={s.sortRuleMarker}
      >
        <div className={s.sortRuleRowText}>
          <strong>{category.name}</strong>
          <em>{categoryTypeLabel(category)} · {categoryItemCount(category)} 条目</em>
        </div>
      </SortableRowShell>
    </div>
  );
}
