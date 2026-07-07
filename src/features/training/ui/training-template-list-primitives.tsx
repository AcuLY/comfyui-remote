"use client";

import Link from "next/link";
import { CopyPlus, Edit3, GripVertical, Trash2 } from "lucide-react";

import { useRouteHref } from "@/components/design-demo-routing";
import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { Button, ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { Checkbox } from "@/components/design-demo-ui/primitives/checkbox";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { useDemoSortable } from "@/components/design-demo-ui/primitives/sortable";
import type { LoraTrainingTemplate } from "@/features/training/types";
import s from "./training-resource-pages.module.css";

function templateStatus(template: LoraTrainingTemplate) {
  return template.status === "active" ? <StatusBadge status="ready" label="可用" /> : <StatusBadge status="archived" label="归档" />;
}

const TRAINING_TEMPLATE_SCROLL_KEY = "comfyui-manager:training:templates:list-anchor";

export function readAndClearTrainingTemplateListAnchor() {
  if (typeof window === "undefined") return undefined;
  try {
    const value = sessionStorage.getItem(TRAINING_TEMPLATE_SCROLL_KEY);
    if (!value) return undefined;
    sessionStorage.removeItem(TRAINING_TEMPLATE_SCROLL_KEY);
    return value;
  } catch {
    return undefined;
  }
}

function rememberTrainingTemplateListAnchor(templateId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TRAINING_TEMPLATE_SCROLL_KEY, templateId);
  } catch {}
}

export function TrainingTemplateListItem({
  createProjectHref,
  onDelete,
  onToggleSelected,
  selected,
  template,
}: {
  createProjectHref: string;
  onDelete?: () => void;
  onToggleSelected: () => void;
  selected: boolean;
  template: LoraTrainingTemplate;
}) {
  const hrefForRoute = useRouteHref();
  const { ref, style, handleProps } = useDemoSortable(template.id);

  return (
    <div ref={ref} style={style}>
      <article className={cx(s.trainingTemplateListItem, selected && s.trainingTemplateListItemSelected)} data-training-template-id={template.id}>
        <div className={s.trainingTemplateListControls}>
          <Checkbox
            checked={selected}
            label={selected ? `取消选择训练模板：${template.title}` : `选择训练模板：${template.title}`}
            onCheckedChange={() => onToggleSelected()}
            stopPropagation
            variant="compact"
          />
          <button
            type="button"
            className={s.trainingTemplateListHandle}
            aria-label={`拖拽排序训练模板：${template.title}`}
            {...handleProps}
          >
            <GripVertical aria-hidden="true" />
          </button>
        </div>
        <div className={s.trainingTemplateListMain}>
          <div className={s.trainingTemplateListTitle}>
            <Link href={hrefForRoute(`/training/templates/${template.id}/edit`)} onClick={() => rememberTrainingTemplateListAnchor(template.id)}>
              <strong>{template.title}</strong>
            </Link>
            <span>{template.description}</span>
          </div>
          <div className={s.trainingTemplateSectionSummary}>
            {template.sections.slice(0, 5).map((section, index) => (
              <Link
                href={hrefForRoute(`/training/templates/${template.id}/sections/${index}`)}
                key={section.id}
                onClick={() => rememberTrainingTemplateListAnchor(template.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </Link>
            ))}
            {template.sections.length > 5 ? <em>+{template.sections.length - 5}</em> : null}
          </div>
        </div>
        <div className={s.trainingTemplateListMeta}>
          {templateStatus(template)}
          <StatusBadge status="template" label={`${template.sectionCount} 小节`} />
          <div className={s.trainingTemplateListActions}>
            <ButtonLink
              className={s.trainingTemplateListCreateButton}
              href={createProjectHref}
              icon={CopyPlus}
              tone="primary"
              ariaLabel={`用训练模板创建项目：${template.title}`}
            >
              创建项目
            </ButtonLink>
            <div className={s.trainingTemplateListSecondaryActions}>
              <ButtonLink
                href={`/training/templates/${template.id}/edit`}
                icon={Edit3}
                iconOnly
                ariaLabel={`编辑训练模板：${template.title}`}
              >
                编辑
              </ButtonLink>
              <Button
                className={s.trainingTemplateListDeleteButton}
                tone="danger"
                icon={Trash2}
                iconOnly
                ariaLabel={`删除训练模板：${template.title}`}
                onClick={onDelete}
                feedback={{ tone: "warning", title: "训练模板已移除", detail: template.title }}
              >
                删除
              </Button>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
