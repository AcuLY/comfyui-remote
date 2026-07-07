"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { ImagePreviewFrame } from "@/components/design-demo-ui/media/image-preview-frame";
import { Button } from "@/components/design-demo-ui/primitives/button";

import type { ReferenceCandidate } from "./project-page-utils";
import s from "./training-project-pages.module.css";

export type ReferenceSourceGroup = {
  id: string;
  title: string;
  description: string;
  items: ReferenceCandidate[];
};

export function ReferencePicker({
  onPreviewReference,
  onAddReference,
  onRemoveReference,
  previewReference,
  referenceSourceTree,
  selectedReferenceIds: controlledSelectedReferenceIds,
}: {
  onAddReference?: (candidate: ReferenceCandidate) => void;
  onRemoveReference?: (candidate: ReferenceCandidate) => void;
  onPreviewReference: (candidate: ReferenceCandidate) => void;
  previewReference: ReferenceCandidate | null;
  referenceSourceTree: ReferenceSourceGroup[];
  selectedReferenceIds?: Set<string>;
}) {
  const [localSelectedReferenceIds, setLocalSelectedReferenceIds] = useState<Set<string>>(new Set());
  const selectedReferenceIds = controlledSelectedReferenceIds ?? localSelectedReferenceIds;
  const selectedReferences = referenceSourceTree
    .flatMap((group) => group.items)
    .filter((candidate) => selectedReferenceIds.has(candidate.id));
  const previewAlreadyAdded = previewReference ? selectedReferenceIds.has(previewReference.id) : false;

  function handleAddReference() {
    if (!previewReference || previewAlreadyAdded) return;
    if (onAddReference) {
      onAddReference(previewReference);
      return;
    }
    setLocalSelectedReferenceIds((current) => new Set([...current, previewReference.id]));
  }

  function handleRemoveReference(candidate: ReferenceCandidate) {
    if (onRemoveReference) {
      onRemoveReference(candidate);
      return;
    }
    setLocalSelectedReferenceIds((current) => {
      const next = new Set(current);
      next.delete(candidate.id);
      return next;
    });
  }

  return (
    <div className={s.referencePicker}>
      <div className={s.referenceSourceTree}>
        {referenceSourceTree.map((group) => (
          <section className={s.referenceSourceGroup} key={group.id}>
            <div className={s.referenceSourceGroupHeader}>
              <strong>{group.title}</strong>
              <span>{group.description}</span>
            </div>
            <div className={s.referenceCandidateList}>
              {group.items.map((candidate) => (
                <button
                  className={cx(s.referenceCandidate, previewReference?.id === candidate.id && s.referenceCandidateActive)}
                  key={candidate.id}
                  type="button"
                  onClick={() => onPreviewReference(candidate)}
                >
                  {candidate.image ? <ImagePreviewFrame image={candidate.image} /> : null}
                  <span>
                    <strong>{candidate.title}</strong>
                    <em>{candidate.meta ?? group.title}</em>
                    <small>{candidate.detail}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <aside className={s.referencePreview} aria-label="引用预览">
        {previewReference?.image ? <ImagePreviewFrame image={previewReference.image} /> : null}
        <div>
          <strong>{previewReference?.title ?? "选择一个引用"}</strong>
          <p>{previewReference?.detail ?? "点击左侧候选只会更新预览，不会直接写入任务。确认后再添加引用。"}</p>
        </div>
        <Button
          icon={Plus}
          disabled={!previewReference || previewAlreadyAdded}
          onClick={handleAddReference}
          feedback={{ title: "引用已加入任务草稿", detail: previewReference?.title }}
        >
          {previewAlreadyAdded ? "已添加" : "添加引用"}
        </Button>
        {selectedReferences.length ? (
          <div className={s.selectedReferenceList} aria-label="已添加引用">
            <strong>已添加引用</strong>
            {selectedReferences.map((reference) => (
              <span className={s.selectedReferenceItem} key={reference.id}>
                <span className={s.selectedReferenceItemLabel}>{reference.title}</span>
                <Button
                  size="sm"
                  tone="danger"
                  icon={Trash2}
                  onClick={() => handleRemoveReference(reference)}
                  ariaLabel={`移除引用：${reference.title}`}
                  feedback={{ tone: "warning", title: "已移除引用", detail: reference.title }}
                >
                  移除
                </Button>
              </span>
            ))}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
