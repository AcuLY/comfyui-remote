"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { Play, Trash2, Upload } from "lucide-react";

import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { ImagePreviewFrame } from "@/components/design-demo-ui/media/image-preview-frame";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Field } from "@/components/design-demo-ui/primitives/field";
import { FloatingSelect } from "@/components/design-demo-ui/primitives/floating-select";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import type { TrainingAppData } from "@/features/training/data";

import {
  buildUploadedSupplementalImage,
  findProject,
  findSection,
  isProductionTrainingPath,
  normalizeGenerationDraftReferenceId,
  referenceKindLabel,
  reviewStatusLabel,
  type SupplementalImageAttachment,
} from "./project-page-utils";
import { ProjectHeader } from "./project-page-shell";
import { ReferencePicker, type ReferenceSourceGroup } from "./reference-picker";
import s from "./training-project-pages.module.css";
import { useGenerationComposeForm } from "./use-generation-compose-form";
import { useGenerationComposeReferenceSelection } from "./use-generation-compose-reference-selection";
import { useGenerationSupplementalImages } from "./use-generation-supplemental-images";
import { useGenerationTaskDraft } from "./use-generation-task-draft";

export function LoraTrainingGenerationComposePage({ data, projectId, sectionId }: { data: TrainingAppData; projectId?: string; sectionId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const supplementalImageInputRef = useRef<HTMLInputElement | null>(null);
  const project = findProject(data, projectId);
  const section = findSection(project, sectionId);
  const referenceSourceTree: ReferenceSourceGroup[] = project && section ? [
    {
      id: "profile",
      title: "角色资料",
      description: "文本源",
      items: [
        { id: "profile-usage", title: "使用提示词", detail: project.usagePrompt, meta: "默认选入" },
        { id: "profile-detail", title: "角色细节", detail: project.detailPrompt, meta: "默认选入" },
      ],
    },
    {
      id: "section",
      title: "小节场景",
      description: "当前小节",
      items: [
        { id: "section-scene", title: section.title, detail: section.resolvedScene, meta: "合成场景" },
        { id: "section-prompt", title: "图片提示词", detail: section.imagePrompt, meta: "生成提示词" },
      ],
    },
    {
      id: "references",
      title: "参考图",
      description: "自由候选",
      items: project.referenceImages.map((reference) => ({
        id: reference.id,
        title: reference.label,
        detail: reference.note,
        image: reference.image,
        meta: referenceKindLabel(reference.kind),
      })),
    },
    {
      id: "result-pool",
      title: "结果池",
      description: "最近产物",
      items: project.resultPool.slice(0, 4).map((result) => ({
        id: result.id,
        title: result.sourceLabel,
        detail: result.caption,
        image: result.image,
        meta: reviewStatusLabel(result.reviewStatus),
      })),
    },
  ] : [];
  const fallbackTaskReference = referenceSourceTree[0]?.items[0] ?? null;
  const {
    activePreviewReference,
    addTaskReference: handleAddTaskReference,
    previewTaskReference: handlePreviewTaskReference,
    removeTaskReference: handleRemoveTaskReference,
    selectedReferenceIds,
  } = useGenerationComposeReferenceSelection(project?.id ?? null, section?.id ?? null, fallbackTaskReference);
  const { generationForm, handleUpdateGenerationForm } = useGenerationComposeForm(project?.id ?? null, section?.id ?? null);
  const {
    addSupplementalImage: handleAddSupplementalImage,
    removeLocalSupplementalImage,
    supplementalImageAttachments,
  } = useGenerationSupplementalImages(project?.id ?? null, section?.id ?? null);
  const {
    draftTaskId,
    rememberGenerationDraftTaskId,
    setGenerationTaskDraft,
    visibleGenerationTaskDraft,
  } = useGenerationTaskDraft(project?.id ?? null, section?.id ?? null);
  const [isQueueingGenerationTask, setIsQueueingGenerationTask] = useState(false);
  const [isUploadingSupplementalImage, setIsUploadingSupplementalImage] = useState(false);
  const [isRemovingSupplementalImage, setIsRemovingSupplementalImage] = useState(false);
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  if (!project || !section) return <EmptyPage title="没有生成任务上下文" />;
  const activeProject = project;
  const activeSection = section;
  const supplementalImageCandidates: SupplementalImageAttachment[] = [
    ...activeProject.referenceImages.slice(0, 3).map((reference) => ({
      detail: reference.note,
      id: `reference-${reference.id}`,
      image: reference.image,
      source: referenceKindLabel(reference.kind),
      title: reference.label,
    })),
    ...activeProject.resultPool.slice(0, 3).map((result) => ({
      detail: result.caption,
      id: `result-${result.id}`,
      image: result.image,
      source: reviewStatusLabel(result.reviewStatus),
      title: result.sourceLabel,
    })),
  ];
  const sectionTitle = activeSection.title;
  const selectedReferences = referenceSourceTree
    .flatMap((group) => group.items)
    .filter((candidate) => selectedReferenceIds.has(candidate.id));
  const selectedReferenceTitles = selectedReferences.map((reference) => reference.title);
  const selectedReferenceDetails = selectedReferences
    .map((reference) => `- ${reference.title}: ${reference.detail}`)
    .join("\n");
  const supplementalImageDetails = supplementalImageAttachments
    .map((attachment) => `- ${attachment.title}: ${attachment.detail}`)
    .join("\n");
  const finalInputText = [
    activeProject.usagePrompt,
    activeSection.resolvedScene,
    selectedReferenceDetails ? `显式引用\n${selectedReferenceDetails}` : "",
    supplementalImageDetails ? `补充图片附件\n${supplementalImageDetails}` : "",
    generationForm.supplementalPrompt,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");

  async function ensureGenerationDraftTaskId() {
    if (draftTaskId) {
      const patchResponse = await fetch(`/api/training/generation-tasks/${draftTaskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplementalPrompt: generationForm.supplementalPrompt,
          taskType: generationForm.taskType,
        }),
      });
      const patchPayload = await patchResponse.json().catch(() => null);
      if (!patchResponse.ok || !patchPayload?.ok) {
        throw new Error(patchPayload?.error?.message ?? "生成任务草稿更新失败");
      }
      return draftTaskId;
    }

    const createDraftResponse = await fetch(`/api/training/projects/${activeProject.id}/generation-tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sectionId: activeSection.id,
        supplementalPrompt: generationForm.supplementalPrompt,
        taskType: generationForm.taskType,
      }),
    });
    const createDraftPayload = await createDraftResponse.json().catch(() => null);

    if (!createDraftResponse.ok || !createDraftPayload?.ok || !createDraftPayload?.data?.id) {
      throw new Error(createDraftPayload?.error?.message ?? "生成任务草稿创建失败");
    }

    const nextTaskId = createDraftPayload.data.id as string;
    rememberGenerationDraftTaskId(nextTaskId);
    return nextTaskId;
  }

  async function handleRemoveSupplementalImage(attachmentId: string) {
    const attachment = supplementalImageAttachments.find((item) => item.id === attachmentId);
    if (!attachment) return;

    const isUploadedSupplementalImage = attachment.source === "上传";

    if (!isProductionTrainingRoute || !isUploadedSupplementalImage) {
      removeLocalSupplementalImage(attachmentId);
      pushToast({
        tone: "warning",
        title: "已移除补充图片",
        detail: attachment.title,
      });
      return;
    }

    if (isRemovingSupplementalImage) return;

    setIsRemovingSupplementalImage(true);
    try {
      const response = await fetch(`/api/training/generation-inputs/${attachmentId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "补充图片移除失败",
          detail: payload?.error?.message ?? "补充图片删除请求失败",
        });
        return;
      }

      removeLocalSupplementalImage(attachmentId);
      pushToast({
        tone: "warning",
        title: "已移除补充图片",
        detail: attachment.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "补充图片移除失败",
        detail: error instanceof Error ? error.message : "补充图片删除请求失败",
      });
    } finally {
      setIsRemovingSupplementalImage(false);
    }
  }

  function handleUploadSupplementalImage() {
    supplementalImageInputRef.current?.click();
  }

  async function handleSupplementalImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (isUploadingSupplementalImage) return;

    if (!isProductionTrainingRoute) {
      const previewImage = activeProject.referenceImages[0]?.image ?? activeProject.resultPool[0]?.image ?? activeProject.images[0];
      if (previewImage) {
        handleAddSupplementalImage({
          detail: "页面内本地上传草稿，可继续作为补充图片使用。",
          id: `uploaded-supplemental-${Date.now()}`,
          image: previewImage,
          source: "上传",
          title: file.name.replace(/\.[^.]+$/, "") || "补充图片",
        });
      }
      event.currentTarget.value = "";
      return;
    }

    setIsUploadingSupplementalImage(true);
    try {
      const ensuredDraftTaskId = await ensureGenerationDraftTaskId();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^.]+$/, "") || "补充图片");
      formData.append("detail", "上传补充图片");

      const response = await fetch(`/api/training/generation-tasks/${ensuredDraftTaskId}/supplemental-images`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id || !payload?.data?.relativePath) {
        pushToast({
          tone: "error",
          title: "补充图片上传失败",
          detail: payload?.error?.message ?? "补充图片上传请求失败",
        });
        return;
      }

      const uploadedAttachment = buildUploadedSupplementalImage({
        detail: payload.data.detail ?? "上传补充图片",
        id: payload.data.id,
        relativePath: payload.data.relativePath,
        title: payload.data.title ?? (file.name.replace(/\.[^.]+$/, "") || "补充图片"),
      });

      if (!uploadedAttachment) {
        pushToast({
          tone: "error",
          title: "补充图片上传失败",
          detail: "上传成功，但无法解析补充图片地址。",
        });
        return;
      }

      handleAddSupplementalImage(uploadedAttachment);
      pushToast({
        tone: "success",
        title: "补充图片已上传",
        detail: uploadedAttachment.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "补充图片上传失败",
        detail: error instanceof Error ? error.message : "补充图片上传请求失败",
      });
    } finally {
      setIsUploadingSupplementalImage(false);
      event.currentTarget.value = "";
    }
  }

  async function handleQueueGenerationTask() {
    const nextDraft = {
      finalInput: finalInputText,
      projectId: activeProject.id,
      selectedReferenceTitles,
      sectionId: activeSection.id,
      sectionTitle,
      supplementalImageCount: supplementalImageAttachments.length,
      supplementalImageTitles: supplementalImageAttachments.map((attachment) => attachment.title),
      supplementalPrompt: generationForm.supplementalPrompt,
      taskType: generationForm.taskType,
    };

    if (!isProductionTrainingRoute) {
      setGenerationTaskDraft(nextDraft);
      pushToast({
        tone: "success",
        title: visibleGenerationTaskDraft ? "生成任务草稿已更新" : "生成任务草稿已排队",
        detail: activeSection.title,
      });
      return;
    }

    if (isQueueingGenerationTask) return;
    const explicitReferenceIds = [...new Set([...selectedReferenceIds].map(normalizeGenerationDraftReferenceId))];
    const supplementalDraftReferenceIds = [...new Set(
      supplementalImageAttachments
        .filter((attachment) => attachment.source !== "上传")
        .map((attachment) => normalizeGenerationDraftReferenceId(attachment.id)),
    )];

    setIsQueueingGenerationTask(true);
    try {
      const draftTaskId = await ensureGenerationDraftTaskId();

      for (const referenceId of explicitReferenceIds) {
        const inputResponse = await fetch(`/api/training/generation-tasks/${draftTaskId}/inputs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            referenceId,
            role: "reference",
          }),
        });
        const inputPayload = await inputResponse.json().catch(() => null);
        if (!inputResponse.ok || !inputPayload?.ok) {
          pushToast({
            tone: "error",
            title: "生成任务创建失败",
            detail: inputPayload?.error?.message ?? "生成任务引用写入失败",
          });
          return;
        }
      }

      for (const referenceId of supplementalDraftReferenceIds) {
        const inputResponse = await fetch(`/api/training/generation-tasks/${draftTaskId}/inputs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            referenceId,
            role: "supplemental_image",
          }),
        });
        const inputPayload = await inputResponse.json().catch(() => null);
        if (!inputResponse.ok || !inputPayload?.ok) {
          pushToast({
            tone: "error",
            title: "生成任务创建失败",
            detail: inputPayload?.error?.message ?? "补充图片写入失败",
          });
          return;
        }
      }

      const previewResponse = await fetch(`/api/training/generation-tasks/${draftTaskId}/preview`, {
        method: "POST",
      });
      const previewPayload = await previewResponse.json().catch(() => null);
      if (!previewResponse.ok || !previewPayload?.ok || typeof previewPayload?.data?.finalInput !== "string") {
        pushToast({
          tone: "error",
          title: "生成任务创建失败",
          detail: previewPayload?.error?.message ?? "生成任务预览请求失败",
        });
        return;
      }

      const response = await fetch(`/api/training/generation-tasks/${draftTaskId}/run`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: "生成任务创建失败",
          detail: payload?.error?.message ?? "生成任务执行请求失败",
        });
        return;
      }

      setGenerationTaskDraft(nextDraft);
      setGenerationTaskDraft({
        ...nextDraft,
        finalInput: previewPayload.data.finalInput,
      });
      rememberGenerationDraftTaskId(null);
      pushToast({
        tone: "success",
        title: "生成任务已创建",
        detail: activeSection.title,
      });
      router.push(`/training/runs/generation/${payload.data.id}`);
    } catch (error) {
      pushToast({
        tone: "error",
        title: "生成任务创建失败",
        detail: error instanceof Error ? error.message : "生成任务创建请求失败",
      });
    } finally {
      setIsQueueingGenerationTask(false);
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="sections"
        project={project}
        title={`${section.title} / 新建生成任务`}
        subtitle="显式选择引用，补充提示词和图片附件，预览最终输入后再运行。"
        actions={(
          <Button
            tone="primary"
            icon={Play}
            pending={isQueueingGenerationTask}
            onClick={handleQueueGenerationTask}
          >
            {visibleGenerationTaskDraft ? "更新任务草稿" : "运行生成"}
          </Button>
        )}
      />
      <div className={s.twoCol}>
        <Panel title="引用源">
          <ReferencePicker
            referenceSourceTree={referenceSourceTree}
            previewReference={activePreviewReference}
            onPreviewReference={handlePreviewTaskReference}
            onAddReference={handleAddTaskReference}
            onRemoveReference={handleRemoveTaskReference}
            selectedReferenceIds={selectedReferenceIds}
          />
        </Panel>
        <Panel title="任务内容">
          <div className={s.formStack}>
            <FloatingSelect label="任务类型" value={generationForm.taskType} options={["训练集图片生成", "角色描述生成", "说明文本补全"]} onChange={(value) => handleUpdateGenerationForm("taskType", value)} />
            <Field multiline features={{ resize: true, clipboard: true }} label="补充提示词" value={generationForm.supplementalPrompt} onChange={(value) => handleUpdateGenerationForm("supplementalPrompt", value)} />
            <section className={s.supplementalImageBlock} aria-label="补充图片附件">
              <div className={s.supplementalImageHeader}>
                <div>
                  <strong>补充图片附件</strong>
                  <span>{supplementalImageAttachments.length ? `${supplementalImageAttachments.length} 张已附加` : "点击下方参考图或结果池图片附加"}</span>
                </div>
                <Button size="sm" icon={Upload} pending={isUploadingSupplementalImage} onClick={handleUploadSupplementalImage}>上传图片</Button>
              </div>
              <input
                ref={supplementalImageInputRef}
                hidden
                accept="image/png,image/jpeg,image/webp"
                type="file"
                onChange={handleSupplementalImageFileChange}
              />
              <div className={s.supplementalImageCandidateList}>
                {supplementalImageCandidates.map((candidate) => {
                  const alreadyAttached = supplementalImageAttachments.some((attachment) => attachment.id === candidate.id);
                  return (
                    <button
                      className={cx(s.supplementalImageCandidate, alreadyAttached && s.supplementalImageCandidateAttached)}
                      disabled={alreadyAttached}
                      key={candidate.id}
                      type="button"
                      onClick={() => handleAddSupplementalImage(candidate)}
                    >
                      <ImagePreviewFrame image={candidate.image} />
                      <span>
                        <strong>{candidate.title}</strong>
                        <em>{alreadyAttached ? "已附加" : candidate.source}</em>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className={s.supplementalImageList}>
                {supplementalImageAttachments.length ? supplementalImageAttachments.map((attachment) => (
                  <article className={s.supplementalImageAttachment} key={attachment.id}>
                    <ImagePreviewFrame image={attachment.image} />
                    <span>
                      <strong>{attachment.title}</strong>
                      <small>{attachment.source} · {attachment.detail}</small>
                    </span>
                    <Button
                      size="sm"
                      tone="danger"
                      icon={Trash2}
                      pending={isRemovingSupplementalImage}
                      onClick={() => handleRemoveSupplementalImage(attachment.id)}
                    >
                      移除
                    </Button>
                  </article>
                )) : (
                  <p>还没有补充图片，最终输入会先使用资料、小节场景和已选引用。</p>
                )}
              </div>
            </section>
            <Field readOnly multiline features={{ clipboard: true }} label="最终输入预览" value={finalInputText} />
          </div>
        </Panel>
      </div>
      {visibleGenerationTaskDraft ? (
        <Panel title="生成任务草稿" subtitle="页面内已记录本次生成请求，可继续调整引用和最终输入后更新。">
          <dl className={s.generationTaskDraft}>
            <div><dt>任务类型</dt><dd>{visibleGenerationTaskDraft.taskType}</dd></div>
            <div><dt>小节</dt><dd>{visibleGenerationTaskDraft.sectionTitle}</dd></div>
            <div><dt>已选引用</dt><dd>{visibleGenerationTaskDraft.selectedReferenceTitles.join("、") || "未添加引用"}</dd></div>
            <div><dt>补充图片</dt><dd>{visibleGenerationTaskDraft.supplementalImageCount ? `${visibleGenerationTaskDraft.supplementalImageCount} 张 · ${visibleGenerationTaskDraft.supplementalImageTitles.join("、")}` : "未附加图片"}</dd></div>
            <div><dt>补充提示词</dt><dd>{visibleGenerationTaskDraft.supplementalPrompt || "未填写"}</dd></div>
            <div><dt>最终输入</dt><dd>{visibleGenerationTaskDraft.finalInput.split("\n")[0]}</dd></div>
          </dl>
        </Panel>
      ) : null}
    </div>
  );
}
