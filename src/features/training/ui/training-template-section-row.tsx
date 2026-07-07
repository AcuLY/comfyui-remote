"use client";

import Link from "next/link";
import { CopyPlus, Edit3, GripVertical, Trash2 } from "lucide-react";

import { useRouteHref } from "@/components/design-demo-routing";
import { Button, ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { useDemoSortable } from "@/components/design-demo-ui/primitives/sortable";
import type { LoraTrainingTemplate } from "@/features/training/types";
import s from "./training-resource-pages.module.css";

export type LoraTrainingTemplateSection = LoraTrainingTemplate["sections"][number];

export function TemplateEditorSectionRow({
  index,
  onCopy,
  onDelete,
  section,
  templateId,
}: {
  index: number;
  onCopy?: (section: LoraTrainingTemplateSection) => void;
  onDelete?: (sectionId: string) => void;
  section: LoraTrainingTemplateSection;
  templateId?: string;
}) {
  const hrefForRoute = useRouteHref();
  const href = templateId ? `/training/templates/${templateId}/sections/${index}` : "/training/templates/new";
  const { ref, style, handleProps } = useDemoSortable(section.id);

  return (
    <div ref={ref} style={style}>
      <article className={s.trainingTemplateSectionRow}>
        <button
          type="button"
          className={s.trainingTemplateSectionHandle}
          aria-label={`拖拽排序模板小节：${section.title}`}
          {...handleProps}
        >
          <GripVertical aria-hidden="true" />
        </button>
        <Link className={s.trainingTemplateSectionMain} href={hrefForRoute(href)}>
          <span className={s.trainingTemplateSectionTitleLine}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{section.title}</strong>
          </span>
          <p>{section.scenePreview}</p>
          <div className={s.trainingTemplateSectionMeta}>
            <span>{section.blockCount} 个场景块</span>
            <span>{section.enabled ? "启用" : "停用"}</span>
            <span>创建后独立</span>
          </div>
        </Link>
        <div className={s.trainingTemplateSectionActions}>
          <ButtonLink href={href} icon={Edit3} ariaLabel={`编辑训练模板小节：${section.title}`}>编辑</ButtonLink>
          <Button tone="subtle" icon={CopyPlus} ariaLabel={`复制训练模板小节：${section.title}`} onClick={() => onCopy?.(section)} feedback={{ title: "训练模板小节已复制", detail: section.title }}>复制</Button>
          <Button tone="danger" icon={Trash2} ariaLabel={`删除训练模板小节：${section.title}`} onClick={() => onDelete?.(section.id)} feedback={{ tone: "warning", title: "训练模板小节已从草稿移除", detail: section.title }}>删除</Button>
        </div>
      </article>
    </div>
  );
}
