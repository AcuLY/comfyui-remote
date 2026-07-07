"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, Save } from "lucide-react";

import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { ImagePreviewLarge } from "@/components/design-demo-ui/media/image-preview-large";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Field } from "@/components/design-demo-ui/primitives/field";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingReferenceImage } from "@/features/training/types";

import {
  PROFILE_REVISION_FIELDS,
  PROFILE_REVISION_REASON_LABELS,
  buildUploadedReferenceImage,
  findProject,
  formatProfileRevisionTime,
  isTrainingTextRevisionItem,
  profileRevisionFieldConfig,
  type TrainingProfileRevisionField,
  type TrainingTextRevisionItem,
} from "./project-page-utils";
import { ProjectHeader } from "./project-page-shell";
import { TrainingProjectReferenceImagePanel } from "./training-project-reference-image-panel";
import s from "./training-project-pages.module.css";

export function LoraTrainingProjectProfilePage({ data, projectId }: { data: TrainingAppData; projectId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const referenceUploadInputRef = useRef<HTMLInputElement | null>(null);
  const project = findProject(data, projectId);
  const [referenceImageState, setLocalReferenceImages] = useState(() => ({
    images: project?.referenceImages ?? [],
    projectId: project?.id ?? null,
  }));
  const [profileFormState, setProfileForm] = useState(() => ({
    detailPrompt: project?.detailPrompt ?? "",
    profileSummary: project?.profileSummary ?? "",
    projectId: project?.id ?? null,
    usagePrompt: project?.usagePrompt ?? "",
  }));
  const [profileDraft, setProfileDraft] = useState<{
    detailPrompt: string;
    profileSummary: string;
    projectId: string;
    referenceImageCount: number;
    usagePrompt: string;
  } | null>(null);
  const [referenceResultState, setReferenceResultState] = useState(() => ({
    addedReferenceResultIds: new Set<string>(),
    projectId: project?.id ?? null,
  }));
  const [referenceResultRequestState, setReferenceResultRequestState] = useState(() => ({
    pendingReferenceIds: new Set<string>(),
    projectId: project?.id ?? null,
  }));
  const [editingReferenceImageId, setEditingReferenceImageId] = useState<string | null>(null);
  const [activeReferenceImageId, setActiveReferenceImageId] = useState<string | null>(null);
  const [savingReferenceImageIds, setSavingReferenceImageIds] = useState<Set<string>>(new Set());
  const [deletingReferenceImageIds, setDeletingReferenceImageIds] = useState<Set<string>>(new Set());
  const [profileRevisionField, setProfileRevisionField] = useState<TrainingProfileRevisionField | null>(null);
  const [profileRevisionState, setProfileRevisionState] = useState<{
    fieldName: TrainingProfileRevisionField | null;
    projectId: string | null;
    revisions: TrainingTextRevisionItem[];
  }>(() => ({
    fieldName: null,
    projectId: project?.id ?? null,
    revisions: [],
  }));
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingReferenceImage, setIsUploadingReferenceImage] = useState(false);
  const [isLoadingProfileRevisions, setIsLoadingProfileRevisions] = useState(false);
  const [restoringProfileRevisionId, setRestoringProfileRevisionId] = useState<string | null>(null);
  if (!project) return <EmptyPage title="没有角色资料数据" />;
  const activeProject = project;
  const localReferenceImages = referenceImageState.projectId === activeProject.id ? referenceImageState.images : activeProject.referenceImages;
  const profileForm = profileFormState.projectId === activeProject.id ? profileFormState : {
    detailPrompt: activeProject.detailPrompt,
    profileSummary: activeProject.profileSummary,
    projectId: activeProject.id,
    usagePrompt: activeProject.usagePrompt,
  };
  const visibleProfileDraft = profileDraft?.projectId === activeProject.id ? profileDraft : null;
  const isProductionTrainingRoute = pathname === "/training" || pathname.startsWith("/training/");
  const addedReferenceResultIds = referenceResultState.projectId === activeProject.id ? referenceResultState.addedReferenceResultIds : new Set<string>();
  const pendingReferenceIds = referenceResultRequestState.projectId === activeProject.id ? referenceResultRequestState.pendingReferenceIds : new Set<string>();
  const selectedProfileRevisionField = profileRevisionField ? profileRevisionFieldConfig(profileRevisionField) : null;
  const visibleProfileRevisions = profileRevisionState.projectId === activeProject.id && profileRevisionState.fieldName === profileRevisionField
    ? profileRevisionState.revisions
    : [];
  const activeReferenceImage = activeReferenceImageId
    ? localReferenceImages.find((reference) => reference.id === activeReferenceImageId) ?? null
    : null;
  const activeReferenceImageIndex = activeReferenceImage
    ? localReferenceImages.findIndex((reference) => reference.id === activeReferenceImage.id)
    : -1;

  function moveActiveReferenceImage(offset: number) {
    if (localReferenceImages.length === 0) return;
    setActiveReferenceImageId((current) => {
      const currentIndex = current ? localReferenceImages.findIndex((reference) => reference.id === current) : -1;
      const nextIndex = ((currentIndex >= 0 ? currentIndex : 0) + offset + localReferenceImages.length) % localReferenceImages.length;
      return localReferenceImages[nextIndex]?.id ?? null;
    });
  }

  async function handleSaveProfile() {
    const nextDraft = {
      detailPrompt: profileForm.detailPrompt,
      profileSummary: profileForm.profileSummary,
      projectId: activeProject.id,
      referenceImageCount: localReferenceImages.length,
      usagePrompt: profileForm.usagePrompt,
    };

    if (!isProductionTrainingRoute) {
      setProfileDraft(nextDraft);
      pushToast({ tone: "success", title: visibleProfileDraft ? "资料保存草稿已更新" : "资料保存草稿已记录", detail: activeProject.title });
      return;
    }

    if (isSavingProfile) return;

    setIsSavingProfile(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loraUsagePrompt: profileForm.usagePrompt,
          characterDetailPrompt: profileForm.detailPrompt,
          profileSummary: profileForm.profileSummary,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "资料保存失败",
          detail: payload?.error?.message ?? "训练资料保存请求失败",
        });
        return;
      }

      setProfileDraft(nextDraft);
      pushToast({
        tone: "success",
        title: visibleProfileDraft ? "资料已更新" : "资料已保存",
        detail: activeProject.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "资料保存失败",
        detail: error instanceof Error ? error.message : "训练资料保存请求失败",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleUpdateProfileForm(field: "detailPrompt" | "profileSummary" | "usagePrompt", value: string) {
    setProfileForm((current) => {
      const active = current.projectId === activeProject.id ? current : {
        detailPrompt: activeProject.detailPrompt,
        profileSummary: activeProject.profileSummary,
        projectId: activeProject.id,
        usagePrompt: activeProject.usagePrompt,
      };
      return {
        ...active,
        [field]: value,
        projectId: activeProject.id,
      };
    });
  }

  async function handleOpenProfileRevisionHistory(fieldName: TrainingProfileRevisionField) {
    setProfileRevisionField(fieldName);

    if (!isProductionTrainingRoute) {
      setProfileRevisionState({ fieldName, projectId: activeProject.id, revisions: [] });
      pushToast({
        tone: "info",
        title: "文本历史",
        detail: "原型模式不会写入服务端文本历史。",
      });
      return;
    }

    if (isLoadingProfileRevisions) return;

    setIsLoadingProfileRevisions(true);
    try {
      const params = new URLSearchParams();
      params.set("entityType", "profile");
      params.set("entityId", activeProject.id);
      params.set("fieldName", fieldName);
      const response = await fetch(`/api/training/projects/${activeProject.id}/text-revisions?${params.toString()}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !Array.isArray(payload.data)) {
        pushToast({
          tone: "error",
          title: "文本历史加载失败",
          detail: payload?.error?.message ?? "文本历史请求失败",
        });
        return;
      }

      setProfileRevisionState({
        fieldName,
        projectId: activeProject.id,
        revisions: payload.data.filter(isTrainingTextRevisionItem),
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "文本历史加载失败",
        detail: error instanceof Error ? error.message : "文本历史请求失败",
      });
    } finally {
      setIsLoadingProfileRevisions(false);
    }
  }

  async function handleRestoreProfileRevision(revisionId: string) {
    if (!isProductionTrainingRoute || restoringProfileRevisionId) return;

    setRestoringProfileRevisionId(revisionId);
    try {
      const response = await fetch(`/api/training/text-revisions/${revisionId}/restore`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "恢复文本失败",
          detail: payload?.error?.message ?? "文本恢复请求失败",
        });
        return;
      }

      const restoredField = payload.data?.fieldName;
      const restoredValue = payload.data?.textValue;
      if (typeof restoredField === "string" && typeof restoredValue === "string") {
        const config = PROFILE_REVISION_FIELDS.find((field) => field.fieldName === restoredField);
        if (config) {
          setProfileForm((current) => {
            const active = current.projectId === activeProject.id ? current : {
              detailPrompt: activeProject.detailPrompt,
              profileSummary: activeProject.profileSummary,
              projectId: activeProject.id,
              usagePrompt: activeProject.usagePrompt,
            };
            return {
              ...active,
              [config.formField]: restoredValue,
              projectId: activeProject.id,
            };
          });
        }
      }

      router.refresh();
      pushToast({
        tone: "success",
        title: "文本已恢复",
        detail: selectedProfileRevisionField?.label ?? activeProject.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "恢复文本失败",
        detail: error instanceof Error ? error.message : "文本恢复请求失败",
      });
    } finally {
      setRestoringProfileRevisionId(null);
    }
  }

  function handleUploadReferenceImage() {
    if (isProductionTrainingRoute) {
      referenceUploadInputRef.current?.click();
      return;
    }

    setLocalReferenceImages((current) => {
      const currentImages = current.projectId === activeProject.id ? current.images : activeProject.referenceImages;
      const draftIndex = currentImages.length + 1;
      const image = activeProject.images[currentImages.length % activeProject.images.length] ?? currentImages[0]?.image;
      if (!image) return { images: currentImages, projectId: activeProject.id };
      return {
        images: [
          ...currentImages,
          {
            id: `${activeProject.id}-uploaded-reference-${draftIndex}`,
            image,
            kind: "auxiliary",
            label: `上传参考图 ${draftIndex}`,
            note: "页面内本地上传草稿，可继续作为角色辅助参考图管理。",
          },
        ],
        projectId: activeProject.id,
      };
    });
  }

  function handleUpdateReferenceImageDraft(
    referenceId: string,
    patch: Partial<Pick<LoraTrainingReferenceImage, "label" | "note">>,
  ) {
    setLocalReferenceImages((current) => {
      const currentImages = current.projectId === activeProject.id ? current.images : activeProject.referenceImages;
      return {
        images: currentImages.map((reference) => reference.id === referenceId ? { ...reference, ...patch } : reference),
        projectId: activeProject.id,
      };
    });
  }

  async function handleSaveReferenceImage(reference: LoraTrainingReferenceImage) {
    if (!isProductionTrainingRoute) {
      setEditingReferenceImageId(null);
      pushToast({
        tone: "success",
        title: "参考图已保存",
        detail: reference.label,
      });
      return;
    }

    if (savingReferenceImageIds.has(reference.id) || deletingReferenceImageIds.has(reference.id)) return;

    setSavingReferenceImageIds((current) => new Set([...current, reference.id]));
    try {
      const response = await fetch(`/api/training/reference-images/${reference.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: reference.label,
          note: reference.note,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "参考图保存失败",
          detail: payload?.error?.message ?? "参考图保存请求失败",
        });
        return;
      }

      setEditingReferenceImageId(null);
      router.refresh();
      pushToast({
        tone: "success",
        title: "参考图已保存",
        detail: reference.label,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "参考图保存失败",
        detail: error instanceof Error ? error.message : "参考图保存请求失败",
      });
    } finally {
      setSavingReferenceImageIds((current) => {
        const next = new Set(current);
        next.delete(reference.id);
        return next;
      });
    }
  }

  async function handleDeleteReferenceImage(referenceId: string, label: string) {
    const removeLocalReference = () => {
      setLocalReferenceImages((current) => {
        const currentImages = current.projectId === activeProject.id ? current.images : activeProject.referenceImages;
        return {
          images: currentImages.filter((reference) => reference.id !== referenceId),
          projectId: activeProject.id,
        };
      });
      setReferenceResultState((current) => {
        const nextAdded = new Set(current.projectId === activeProject.id ? current.addedReferenceResultIds : new Set<string>());
        nextAdded.delete(referenceId);
        return {
          addedReferenceResultIds: nextAdded,
          projectId: activeProject.id,
        };
      });
      setEditingReferenceImageId((current) => current === referenceId ? null : current);
    };

    if (!isProductionTrainingRoute) {
      removeLocalReference();
      pushToast({
        tone: "warning",
        title: "参考图已删除",
        detail: label,
      });
      return;
    }

    if (savingReferenceImageIds.has(referenceId) || deletingReferenceImageIds.has(referenceId)) return;

    setDeletingReferenceImageIds((current) => new Set([...current, referenceId]));
    try {
      const response = await fetch(`/api/training/reference-images/${referenceId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "参考图删除失败",
          detail: payload?.error?.message ?? "参考图删除请求失败",
        });
        return;
      }

      removeLocalReference();
      router.refresh();
      pushToast({
        tone: "warning",
        title: "参考图已删除",
        detail: label,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "参考图删除失败",
        detail: error instanceof Error ? error.message : "参考图删除请求失败",
      });
    } finally {
      setDeletingReferenceImageIds((current) => {
        const next = new Set(current);
        next.delete(referenceId);
        return next;
      });
    }
  }

  async function handleReferenceImageFileChange() {
    const input = referenceUploadInputRef.current;
    const file = input?.files?.[0];
    if (!file) return;
    if (isUploadingReferenceImage) return;

    setIsUploadingReferenceImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("role", "source");
      formData.append("sortOrder", String(localReferenceImages.length));
      formData.append("provenance", JSON.stringify({ origin: "training_profile_upload" }));

      const response = await fetch(`/api/training/projects/${activeProject.id}/reference-images`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id || !payload?.data?.relativePath) {
        pushToast({
          tone: "error",
          title: "参考图上传失败",
          detail: payload?.error?.message ?? "参考图上传请求失败",
        });
        return;
      }

      const nextIndex = localReferenceImages.length;
      const uploadedReference = buildUploadedReferenceImage({
        id: payload.data.id,
        index: nextIndex,
        label: payload.data.provenance?.originalName ?? `参考图 ${nextIndex + 1}`,
        note: typeof payload.data.role === "string" ? payload.data.role : "source",
        relativePath: payload.data.relativePath,
      });

      if (!uploadedReference) {
        pushToast({
          tone: "error",
          title: "参考图上传失败",
          detail: "上传成功，但无法解析参考图地址。",
        });
        return;
      }

      setLocalReferenceImages((current) => {
        const currentImages = current.projectId === activeProject.id ? current.images : activeProject.referenceImages;
        return {
          images: [...currentImages, uploadedReference],
          projectId: activeProject.id,
        };
      });
      pushToast({
        tone: "success",
        title: "参考图已上传",
        detail: uploadedReference.label,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "参考图上传失败",
        detail: error instanceof Error ? error.message : "参考图上传请求失败",
      });
    } finally {
      if (input) {
        input.value = "";
      }
      setIsUploadingReferenceImage(false);
    }
  }

  async function handleAddReferenceImageToResults(referenceId: string, label: string) {
    const applyLocalAddedState = () => {
      setReferenceResultState((current) => ({
        addedReferenceResultIds: new Set([
          ...(current.projectId === activeProject.id ? current.addedReferenceResultIds : new Set<string>()),
          referenceId,
        ]),
        projectId: activeProject.id,
      }));
    };

    if (addedReferenceResultIds.has(referenceId) || pendingReferenceIds.has(referenceId)) {
      return;
    }

    if (!isProductionTrainingRoute) {
      applyLocalAddedState();
      pushToast({
        tone: "success",
        title: "参考图已加入结果池",
        detail: label,
      });
      return;
    }

    setReferenceResultRequestState((current) => ({
      pendingReferenceIds: new Set([
        ...(current.projectId === activeProject.id ? current.pendingReferenceIds : new Set<string>()),
        referenceId,
      ]),
      projectId: activeProject.id,
    }));
    try {
      const response = await fetch(`/api/training/reference-images/${referenceId}/add-to-results`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewStatus: "pending",
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "加入结果池失败",
          detail: payload?.error?.message ?? "参考图入池请求失败",
        });
        return;
      }

      applyLocalAddedState();
      pushToast({
        tone: "success",
        title: "参考图已加入结果池",
        detail: label,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "加入结果池失败",
        detail: error instanceof Error ? error.message : "参考图入池请求失败",
      });
    } finally {
      setReferenceResultRequestState((current) => {
        const nextPending = new Set(current.projectId === activeProject.id ? current.pendingReferenceIds : new Set<string>());
        nextPending.delete(referenceId);
        return {
          pendingReferenceIds: nextPending,
          projectId: activeProject.id,
        };
      });
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="profile"
        project={activeProject}
        actions={(
          <Button
            tone="primary"
            icon={Save}
            pending={isSavingProfile}
            onClick={handleSaveProfile}
          >
            {visibleProfileDraft ? "更新资料" : "保存资料"}
          </Button>
        )}
      />
      <div className={s.twoCol}>
        <TrainingProjectReferenceImagePanel
          addedReferenceResultIds={addedReferenceResultIds}
          deletingReferenceImageIds={deletingReferenceImageIds}
          editingReferenceImageId={editingReferenceImageId}
          isUploadingReferenceImage={isUploadingReferenceImage}
          onAddReferenceImageToResults={handleAddReferenceImageToResults}
          onDeleteReferenceImage={handleDeleteReferenceImage}
          onOpenReferenceImage={setActiveReferenceImageId}
          onReferenceImageFileChange={handleReferenceImageFileChange}
          onSaveReferenceImage={handleSaveReferenceImage}
          onToggleReferenceImageEdit={(referenceId) => setEditingReferenceImageId(editingReferenceImageId === referenceId ? null : referenceId)}
          onUpdateReferenceImageDraft={handleUpdateReferenceImageDraft}
          onUploadReferenceImage={handleUploadReferenceImage}
          pendingReferenceIds={pendingReferenceIds}
          referenceUploadInputRef={referenceUploadInputRef}
          references={localReferenceImages}
          savingReferenceImageIds={savingReferenceImageIds}
        />
        <Panel title="角色文本">
          <div className={cx(s.formStack, s.profileTextFields)}>
            <div className={s.profileFieldShell}>
              <Field
                multiline
                features={{ clipboard: true }}
                label="LoRA 使用提示词"
                value={profileForm.usagePrompt}
                onChange={(value) => handleUpdateProfileForm("usagePrompt", value)}
                actions={(
                  <Button
                    size="sm"
                    tone="subtle"
                    icon={FileText}
                    pending={isLoadingProfileRevisions && profileRevisionField === "loraUsagePrompt"}
                    ariaLabel="查看资料历史：LoRA 使用提示词"
                    onClick={() => handleOpenProfileRevisionHistory("loraUsagePrompt")}
                  >
                    历史
                  </Button>
                )}
              />
            </div>
            <div className={s.profileFieldShell}>
              <Field
                multiline
                features={{ clipboard: true }}
                label="角色细节描述"
                value={profileForm.detailPrompt}
                onChange={(value) => handleUpdateProfileForm("detailPrompt", value)}
                actions={(
                  <Button
                    size="sm"
                    tone="subtle"
                    icon={FileText}
                    pending={isLoadingProfileRevisions && profileRevisionField === "characterDetailPrompt"}
                    ariaLabel="查看资料历史：角色细节描述"
                    onClick={() => handleOpenProfileRevisionHistory("characterDetailPrompt")}
                  >
                    历史
                  </Button>
                )}
              />
            </div>
            <div className={s.profileFieldShell}>
              <Field
                multiline
                features={{ clipboard: true }}
                label="资料备注"
                value={profileForm.profileSummary}
                onChange={(value) => handleUpdateProfileForm("profileSummary", value)}
                actions={(
                  <Button
                    size="sm"
                    tone="subtle"
                    icon={FileText}
                    pending={isLoadingProfileRevisions && profileRevisionField === "profileSummary"}
                    ariaLabel="查看资料历史：资料备注"
                    onClick={() => handleOpenProfileRevisionHistory("profileSummary")}
                  >
                    历史
                  </Button>
                )}
              />
            </div>
          </div>
        </Panel>
      </div>
      {activeReferenceImage ? (
        <ImagePreviewLarge
          image={activeReferenceImage.image}
          title={activeReferenceImage.label}
          meta={activeReferenceImage.note}
          onClose={() => setActiveReferenceImageId(null)}
          onNext={activeReferenceImageIndex >= 0 ? () => moveActiveReferenceImage(1) : undefined}
          onPrevious={activeReferenceImageIndex >= 0 ? () => moveActiveReferenceImage(-1) : undefined}
        />
      ) : null}
      {selectedProfileRevisionField ? (
        <Panel title="文本历史" subtitle={`${selectedProfileRevisionField.label} · 可恢复到任一历史版本`}>
          <div className={s.textRevisionPanel}>
            {isLoadingProfileRevisions ? (
              <p className={s.bodyText}>正在读取文本历史...</p>
            ) : visibleProfileRevisions.length > 0 ? (
              visibleProfileRevisions.map((revision) => (
                <article className={s.textRevisionCard} key={revision.id}>
                  <div className={s.textRevisionMeta}>
                    <strong>{PROFILE_REVISION_REASON_LABELS[revision.reason] ?? revision.reason}</strong>
                    <span>{formatProfileRevisionTime(revision.createdAt)}</span>
                  </div>
                  <p>{revision.textValue || "空文本"}</p>
                  <Button
                    size="sm"
                    tone="subtle"
                    pending={restoringProfileRevisionId === revision.id}
                    onClick={() => handleRestoreProfileRevision(revision.id)}
                  >
                    恢复此版本
                  </Button>
                </article>
              ))
            ) : (
              <p className={s.bodyText}>暂无历史版本。保存、覆盖或训练流程产生快照后会显示在这里。</p>
            )}
          </div>
        </Panel>
      ) : null}
      {visibleProfileDraft ? (
        <Panel title="资料保存草稿" subtitle="页面内已记录当前资料状态，可继续调整后再创建训练任务。">
          <dl className={s.profileDraft}>
            <div><dt>使用提示词</dt><dd>{visibleProfileDraft.usagePrompt}</dd></div>
            <div><dt>角色细节</dt><dd>{visibleProfileDraft.detailPrompt}</dd></div>
            <div><dt>资料备注</dt><dd>{visibleProfileDraft.profileSummary}</dd></div>
            <div><dt>参考图</dt><dd>{visibleProfileDraft.referenceImageCount} 张</dd></div>
          </dl>
        </Panel>
      ) : null}
    </div>
  );
}
