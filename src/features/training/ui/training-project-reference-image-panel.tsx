"use client";

import type { RefObject } from "react";
import { Edit3, ImagePlus, Save, Trash2 } from "lucide-react";

import { ImageThumbMedium } from "@/components/design-demo-ui/media/image-thumb-medium";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { Field } from "@/components/design-demo-ui/primitives/field";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import type { LoraTrainingReferenceImage } from "@/features/training/types";

import { referenceKindLabel } from "./project-page-utils";
import s from "./training-project-pages.module.css";

type ReferenceImagePatch = Partial<Pick<LoraTrainingReferenceImage, "label" | "note">>;

export function TrainingProjectReferenceImagePanel({
  addedReferenceResultIds,
  deletingReferenceImageIds,
  editingReferenceImageId,
  isUploadingReferenceImage,
  onAddReferenceImageToResults,
  onDeleteReferenceImage,
  onOpenReferenceImage,
  onReferenceImageFileChange,
  onSaveReferenceImage,
  onToggleReferenceImageEdit,
  onUpdateReferenceImageDraft,
  onUploadReferenceImage,
  pendingReferenceIds,
  referenceUploadInputRef,
  references,
  savingReferenceImageIds,
}: {
  addedReferenceResultIds: Set<string>;
  deletingReferenceImageIds: Set<string>;
  editingReferenceImageId: string | null;
  isUploadingReferenceImage: boolean;
  onAddReferenceImageToResults: (referenceId: string, label: string) => void;
  onDeleteReferenceImage: (referenceId: string, label: string) => void;
  onOpenReferenceImage: (referenceId: string) => void;
  onReferenceImageFileChange: () => void;
  onSaveReferenceImage: (reference: LoraTrainingReferenceImage) => void;
  onToggleReferenceImageEdit: (referenceId: string) => void;
  onUpdateReferenceImageDraft: (referenceId: string, patch: ReferenceImagePatch) => void;
  onUploadReferenceImage: () => void;
  pendingReferenceIds: Set<string>;
  referenceUploadInputRef: RefObject<HTMLInputElement | null>;
  references: LoraTrainingReferenceImage[];
  savingReferenceImageIds: Set<string>;
}) {
  return (
    <Panel title="参考图" subtitle="original / generated / auxiliary 都作为自由参考图管理，不做 fixed slots。">
      <div className={s.stack}>
        <div className={s.referenceImageGrid}>
          {references.map((reference) => (
            <article className={s.referenceImageCard} key={reference.id}>
              <div className={s.referenceImageThumb}>
                <ImageThumbMedium
                  image={reference.image}
                  onOpen={() => onOpenReferenceImage(reference.id)}
                  showStatus={false}
                  tags={[referenceKindLabel(reference.kind)]}
                />
              </div>
              <div>
                {editingReferenceImageId === reference.id ? (
                  <div className={s.referenceImageEditFields}>
                    <Field
                      label="参考图名称"
                      value={reference.label}
                      onChange={(value) => onUpdateReferenceImageDraft(reference.id, { label: value })}
                    />
                    <Field
                      multiline
                      features={{ resize: true, clipboard: true }}
                      label="参考图备注"
                      value={reference.note}
                      onChange={(value) => onUpdateReferenceImageDraft(reference.id, { note: value })}
                    />
                  </div>
                ) : (
                  <>
                    <strong>{reference.label}</strong>
                    <p>{reference.note}</p>
                  </>
                )}
                {addedReferenceResultIds.has(reference.id) ? <StatusBadge status="pending" label="已加入结果池" /> : null}
                <div className={s.referenceImageActions}>
                  <Button
                    className={s.referenceImageResultAction}
                    size="sm"
                    tone="primary"
                    pending={pendingReferenceIds.has(reference.id)}
                    disabled={addedReferenceResultIds.has(reference.id)}
                    onClick={() => onAddReferenceImageToResults(reference.id, reference.label)}
                  >
                    {addedReferenceResultIds.has(reference.id) ? "已加入结果池" : "加入结果池"}
                  </Button>
                  <div className={s.referenceImageSecondaryActions}>
                    <Button
                      size="sm"
                      tone="subtle"
                      icon={Edit3}
                      iconOnly
                      ariaLabel={editingReferenceImageId === reference.id ? `收起参考图编辑：${reference.label}` : `编辑参考图：${reference.label}`}
                      onClick={() => onToggleReferenceImageEdit(reference.id)}
                    >
                      {editingReferenceImageId === reference.id ? "收起" : "编辑"}
                    </Button>
                    {editingReferenceImageId === reference.id ? (
                      <Button
                        size="sm"
                        tone="primary"
                        icon={Save}
                        iconOnly
                        pending={savingReferenceImageIds.has(reference.id)}
                        ariaLabel={`保存参考图：${reference.label}`}
                        onClick={() => onSaveReferenceImage(reference)}
                      >
                        保存
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      tone="danger"
                      icon={Trash2}
                      iconOnly
                      pending={deletingReferenceImageIds.has(reference.id)}
                      ariaLabel={`删除参考图：${reference.label}`}
                      onClick={() => onDeleteReferenceImage(reference.id, reference.label)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
        <input
          ref={referenceUploadInputRef}
          hidden
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onReferenceImageFileChange}
        />
        <Button icon={ImagePlus} pending={isUploadingReferenceImage} onClick={onUploadReferenceImage}>上传参考图</Button>
      </div>
    </Panel>
  );
}
