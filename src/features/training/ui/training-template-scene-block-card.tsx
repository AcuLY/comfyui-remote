"use client";

import { ArrowDown, ArrowUp, Edit3, Trash2 } from "lucide-react";

import { Button } from "@/components/design-demo-ui/primitives/button";
import { Field } from "@/components/design-demo-ui/primitives/field";
import type { LoraTrainingSectionBlock } from "@/features/training/types";
import s from "./training-resource-pages.module.css";

export type TemplateSceneBlockPatch = Partial<Pick<LoraTrainingSectionBlock, "text" | "title">>;

export function TemplateSceneBlockCard({
  block,
  index,
  isEditing,
  onDelete,
  onEdit,
  onMove,
  onUpdate,
  total,
}: {
  block: LoraTrainingSectionBlock;
  index: number;
  isEditing?: boolean;
  onDelete?: (blockId: string) => void;
  onEdit?: (blockId: string | null) => void;
  onMove?: (index: number, direction: -1 | 1) => void;
  onUpdate?: (blockId: string, patch: TemplateSceneBlockPatch) => void;
  total: number;
}) {
  return (
    <article className={s.templateSceneBlockCard}>
      <div className={s.templateSceneBlockBody}>
        <span>{block.source === "预制" ? "预制块" : "本地块"}</span>
        {isEditing ? (
          <div className={s.templateSceneBlockEditor}>
            <Field label="模板块标题" value={block.title} onChange={(value) => onUpdate?.(block.id, { title: value })} />
            <Field
              multiline
              features={{ clipboard: true, resize: true }}
              label="模板块文本"
              value={block.text}
              onChange={(value) => onUpdate?.(block.id, { text: value })}
            />
          </div>
        ) : (
          <>
            <strong>{block.title}</strong>
            <p>{block.text}</p>
          </>
        )}
      </div>
      <div className={s.templateSceneBlockActions} aria-label={`${block.title} 操作`}>
        <Button size="sm" icon={Edit3} ariaLabel={isEditing ? `收起模板场景块编辑：${block.title}` : `编辑模板场景块：${block.title}`} onClick={() => onEdit?.(isEditing ? null : block.id)}>{isEditing ? "收起" : "编辑"}</Button>
        <Button size="sm" icon={ArrowUp} disabled={index === 0} onClick={() => onMove?.(index, -1)} ariaLabel={`上移模板场景块：${block.title}`} feedback={{ title: "模板块已上移", detail: block.title }}>上移</Button>
        <Button size="sm" icon={ArrowDown} disabled={index === total - 1} onClick={() => onMove?.(index, 1)} ariaLabel={`下移模板场景块：${block.title}`} feedback={{ title: "模板块已下移", detail: block.title }}>下移</Button>
        <Button size="sm" icon={Trash2} tone="danger" onClick={() => onDelete?.(block.id)} ariaLabel={`删除模板场景块：${block.title}`} feedback={{ tone: "warning", title: "模板块已从草稿移除", detail: block.title }}>删除</Button>
      </div>
    </article>
  );
}
