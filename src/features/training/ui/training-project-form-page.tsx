"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Save, Trash2, Upload } from "lucide-react";

import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { Field } from "@/components/design-demo-ui/primitives/field";
import { FloatingSelect } from "@/components/design-demo-ui/primitives/floating-select";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { SwitchRow } from "@/components/design-demo-ui/primitives/switch-row";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData, TrainingModelOption } from "@/features/training/data";

import {
  buildSeedSectionCopy,
  buildTrainingProjectTriggerToken,
  isTrainingModelOption,
  nextSeedSectionCopyNumber,
  readNewProjectTemplateHints,
  type LoraTrainingTemplateSeedSection,
} from "./project-page-utils";
import { ReferencePicker, type ReferenceSourceGroup } from "./reference-picker";
import s from "./training-project-pages.module.css";
import { useProjectCreateForm } from "./use-project-create-form";
import { useProjectCreateTrainingDefaults } from "./use-project-create-training-defaults";
import { useProjectCreatedDraft } from "./use-project-created-draft";
import { useProjectSectionSeeds } from "./use-project-section-seeds";
import { useProjectReferenceUploadDrafts } from "./use-project-reference-upload-drafts";
import { useProjectReferenceSelection } from "./use-project-reference-selection";
import { useUrlSearch } from "./use-url-search";

function useTraining(data: TrainingAppData) {
  return buildLoraTrainingData(data);
}

export function LoraTrainingProjectFormPage({ data }: { data: TrainingAppData }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const projectReferenceUploadInputRef = useRef<HTMLInputElement | null>(null);
  const isProductionTrainingRoute = pathname === "/training" || pathname.startsWith("/training/");
  const training = useTraining(data);
  const urlSearch = useUrlSearch();
  const newProjectTemplateHints = readNewProjectTemplateHints(urlSearch);
  const sourceTemplate = training.templates.find((template) => template.id === newProjectTemplateHints.templateId)
    ?? training.templates.find((template) => template.title === newProjectTemplateHints.templateTitle);
  const initialTemplate = sourceTemplate;
  const initialSectionSeeds = sourceTemplate?.sections ?? [];
  const projectTemplateContextId = initialTemplate?.id ?? "no-template";
  const fallbackCheckpointModels = data.models.filter((model) => model.modelType === "checkpoint");
  const [availableCheckpointModels, setAvailableCheckpointModels] = useState<TrainingModelOption[]>(fallbackCheckpointModels);
  const baseModelOptions = availableCheckpointModels.map((model) => model.name);
  const { projectForm, handleUpdateProjectForm } = useProjectCreateForm(
    projectTemplateContextId,
    sourceTemplate?.title ?? "不使用模板",
    baseModelOptions,
  );
  const { stagedProjectReferenceUploads, stageProjectReferenceUploadFiles } = useProjectReferenceUploadDrafts(projectTemplateContextId);
  const referenceSourceTree: ReferenceSourceGroup[] = [
    {
      id: "existing-training-projects",
      title: "已有训练项目",
      description: "可复用资料",
      items: training.projects.slice(0, 3).map((project) => ({
        id: `project-${project.id}`,
        title: project.title,
        detail: project.profileSummary,
        image: project.referenceImages[0]?.image,
        meta: `${project.sectionCount} 小节`,
      })),
    },
    {
      id: "recent-training-results",
      title: "结果池样本",
      description: "最近已保留图",
      items: training.projects.flatMap((project) => project.resultPool.filter((result) => result.reviewStatus === "kept").slice(0, 2).map((result) => ({
        id: `result-${result.id}`,
        title: `${project.title} / ${result.sectionTitle}`,
        detail: result.caption,
        image: result.image,
        meta: "已保留",
      }))).slice(0, 4),
    },
    {
      id: "local-image-library",
      title: "本地图库",
      description: "资料候选",
      items: isProductionTrainingRoute ? [] : data.images.slice(0, 4).map((image) => ({
        id: `image-${image.id}`,
        title: image.label,
        detail: "作为新训练项目的原始参考图，确认后加入角色资料。",
        image,
        meta: image.status,
      })),
    },
    {
      id: "staged-uploaded-images",
      title: "本地上传",
      description: "创建后自动导入",
      items: stagedProjectReferenceUploads.map((upload) => upload.previewReference),
    },
  ].filter((group) => group.items.length > 0);
  const fallbackProjectReference = referenceSourceTree[0]?.items[0] ?? null;
  const {
    activePreviewReference,
    addProjectReference,
    previewProjectReference,
    selectedReferenceIds,
  } = useProjectReferenceSelection(projectTemplateContextId, fallbackProjectReference);
  const { sectionSeeds, setSectionSeeds } = useProjectSectionSeeds(projectTemplateContextId, initialSectionSeeds);
  const { setTrainingDefaults, trainingDefaults } = useProjectCreateTrainingDefaults(projectTemplateContextId);
  const { createdProjectDraft, setCreatedProjectDraft } = useProjectCreatedDraft(projectTemplateContextId);
  const selectedProjectReferences = referenceSourceTree
    .flatMap((group) => group.items)
    .filter((candidate) => selectedReferenceIds.has(candidate.id));
  const stagedProjectReferenceUploadIds = new Set(stagedProjectReferenceUploads.map((upload) => upload.id));
  const selectedStagedProjectReferenceUploads = stagedProjectReferenceUploads.filter((upload) => selectedReferenceIds.has(upload.id));
  const selectedReferenceTitles = selectedProjectReferences.map((reference) => reference.title);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  useEffect(() => {
    if (!isProductionTrainingRoute) return;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/models?kind=checkpoint");
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !Array.isArray(payload.data)) return;

        const nextModels = (payload.data as unknown[])
          .filter(isTrainingModelOption)
          .map((item) => ({
            modelType: item.modelType,
            name: item.name,
            relativePath: item.relativePath,
          }));

        if (!cancelled && nextModels.length > 0) {
          setAvailableCheckpointModels(nextModels);
        }
      } catch {
        // Keep the build-time fallback model list when the training model catalog is unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isProductionTrainingRoute]);

  function handleSelectTemplate(templateTitle: string) {
    handleUpdateProjectForm("templateTitle", templateTitle);
    const template = training.templates.find((item) => item.title === templateTitle);
    setSectionSeeds(template?.sections ?? []);
  }

  function handleCopySeedSection(section: LoraTrainingTemplateSeedSection) {
    setSectionSeeds((current) => {
      const copyNumber = nextSeedSectionCopyNumber(current, section.id);
      const copy = buildSeedSectionCopy(section, copyNumber);
      const sourceIndex = current.findIndex((item) => item.id === section.id);
      if (sourceIndex === -1) return [...current, copy];
      return [
        ...current.slice(0, sourceIndex + 1),
        copy,
        ...current.slice(sourceIndex + 1),
      ];
    });
  }

  function handleDeleteSeedSection(sectionId: string) {
    setSectionSeeds((current) => current.filter((section) => section.id !== sectionId));
  }

  function handleToggleSeedSection(sectionId: string) {
    setSectionSeeds((current) => current.map((section) => (
      section.id === sectionId ? { ...section, enabled: !section.enabled } : section
    )));
  }

  function handleUploadProjectReference() {
    projectReferenceUploadInputRef.current?.click();
  }

  function handleProjectReferenceFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length === 0) return;

    const nextUploads = stageProjectReferenceUploadFiles(files);

    if (nextUploads[0]) {
      previewProjectReference(nextUploads[0].previewReference);
      pushToast({
        tone: "success",
        title: "本地图片已加入候选",
        detail: nextUploads.length > 1 ? `${nextUploads.length} 张图片可加入新项目资料` : nextUploads[0].title,
      });
    } else {
      pushToast({
        tone: "warning",
        title: "没有新的本地图片加入候选",
        detail: "相同文件不会重复加入。",
      });
    }
    event.currentTarget.value = "";
  }

  async function uploadSelectedProjectReferenceDrafts(projectId: string) {
    const uploadedTitles: string[] = [];
    const failedTitles: string[] = [];

    for (const [index, upload] of selectedStagedProjectReferenceUploads.entries()) {
      const formData = new FormData();
      formData.append("file", upload.file);
      formData.append("role", "source");
      formData.append("sortOrder", String(index));

      try {
        const uploadResponse = await fetch(`/api/training/projects/${projectId}/reference-images`, {
          method: "POST",
          body: formData,
        });
        const uploadPayload = await uploadResponse.json().catch(() => null);
        if (!uploadResponse.ok || !uploadPayload?.ok || !uploadPayload?.data?.id) {
          failedTitles.push(upload.title);
          continue;
        }

        uploadedTitles.push(upload.title);
        await fetch(`/api/training/reference-images/${uploadPayload.data.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            label: upload.title,
            note: "创建项目时本地上传的参考图",
            sortOrder: index,
          }),
        }).catch(() => null);
      } catch {
        failedTitles.push(upload.title);
      }
    }

    return {
      failedTitles,
      uploadedTitles,
    };
  }

  async function handleCreateProjectDraft() {
    const nextDraft = {
      autoFreezeDataset: trainingDefaults.autoFreezeDataset,
      autoGenerateSamples: trainingDefaults.autoGenerateSamples,
      baseModel: projectForm.baseModel,
      captionStrategy: projectForm.captionStrategy,
      detailPrompt: projectForm.detailPrompt,
      enabledSectionCount: sectionSeeds.filter((section) => section.enabled).length,
      perSectionImageCount: projectForm.perSectionImageCount,
      selectedReferenceCount: selectedProjectReferences.length,
      selectedReferenceTitles,
      sectionCount: sectionSeeds.length,
      templateTitle: projectForm.templateTitle,
      title: projectForm.title,
      trainingSteps: projectForm.trainingSteps,
      usagePrompt: projectForm.usagePrompt,
    };

    if (!isProductionTrainingRoute) {
      setCreatedProjectDraft(nextDraft);
      pushToast({
        tone: "success",
        title: createdProjectDraft ? "项目草稿已更新" : "训练项目草稿已创建",
        detail: projectForm.title,
      });
      return;
    }

    const checkpointAsset = availableCheckpointModels.find((model) => (
      model.modelType === "checkpoint"
      && (projectForm.baseModel === "继承训练默认模型" || model.name === projectForm.baseModel)
    ));

    if (!checkpointAsset) {
      pushToast({
        tone: "error",
        title: "训练项目创建失败",
        detail: "没有可用的 checkpoint 路径，请先选择基础模型。",
      });
      return;
    }

    if (isCreatingProject) return;

    setIsCreatingProject(true);
    try {
      const persistedSelectedReferenceIds = [...selectedReferenceIds].filter((referenceId) => !stagedProjectReferenceUploadIds.has(referenceId));
      const createProjectEndpoint = sourceTemplate ? `/api/training/templates/${sourceTemplate.id}/projects` : "/api/training/projects";
      const response = await fetch(createProjectEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: projectForm.title.trim(),
          characterName: projectForm.title.trim(),
          projectName: projectForm.title.trim(),
          triggerToken: buildTrainingProjectTriggerToken(projectForm.title),
          checkpointRelativePath: checkpointAsset.relativePath,
          baseModel: projectForm.baseModel,
          captionStrategy: projectForm.captionStrategy,
          usagePrompt: projectForm.usagePrompt,
          detailPrompt: projectForm.detailPrompt,
          perSectionImageCount: projectForm.perSectionImageCount,
          trainingSteps: projectForm.trainingSteps,
          selectedReferenceIds: persistedSelectedReferenceIds,
          sections: sectionSeeds,
          trainingDefaults: {
            autoGenerateSamples: trainingDefaults.autoGenerateSamples,
            autoFreezeDataset: trainingDefaults.autoFreezeDataset,
          },
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: "训练项目创建失败",
          detail: payload?.error?.message ?? "训练项目创建请求失败",
        });
        return;
      }

        pushToast({
          tone: "success",
          title: "训练项目已创建",
          detail: projectForm.title,
        });

      if (selectedStagedProjectReferenceUploads.length > 0) {
        const stagedUploadResult = await uploadSelectedProjectReferenceDrafts(payload.data.id);
        if (stagedUploadResult.failedTitles.length > 0) {
          pushToast({
            tone: "warning",
            title: "训练项目已创建，部分参考图未上传",
            detail: stagedUploadResult.failedTitles.join("、"),
          });
        } else if (stagedUploadResult.uploadedTitles.length > 0) {
          pushToast({
            tone: "success",
            title: "本地参考图已同步到角色资料",
            detail: `${stagedUploadResult.uploadedTitles.length} 张`,
          });
        }
      }
      router.push(`/training/projects/${payload.data.id}`);
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练项目创建失败",
        detail: error instanceof Error ? error.message : "训练项目创建请求失败",
      });
    } finally {
      setIsCreatingProject(false);
    }
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/projects", label: "返回训练项目" }}
        eyebrow="LoRA 训练"
        title="新建训练项目"
        subtitle="选择模板、填写角色资料，并创建初始小节。模板只作为创建时初始配置，创建后不会自动回写。"
        actions={(
          <Button
            tone="primary"
            icon={Save}
            pending={isCreatingProject}
            onClick={handleCreateProjectDraft}
          >
            {createdProjectDraft ? "更新项目草稿" : "创建项目"}
          </Button>
        )}
      />
      <div className={s.projectCreateWorkspace}>
        <div className={s.projectCreateMain}>
          <Panel title="项目基础信息" subtitle="沿用项目表单骨架，这里记录训练项目的初始配置。">
            <div className={s.formStack}>
              <Field label="项目名称" value={projectForm.title} onChange={(value) => handleUpdateProjectForm("title", value)} />
              <FloatingSelect label="从模板创建" value={projectForm.templateTitle} options={["不使用模板", ...training.templates.map((template) => template.title)]} onChange={handleSelectTemplate} />
              {sourceTemplate ? (
                <Field readOnly label="来源训练模板" value={`${sourceTemplate.title}${newProjectTemplateHints.sections ? ` · ${newProjectTemplateHints.sections} 个小节` : ""}`} />
              ) : null}
              <FloatingSelect label="基础模型" value={projectForm.baseModel} options={["继承训练默认模型", ...baseModelOptions]} onChange={(value) => handleUpdateProjectForm("baseModel", value)} />
              <Field multiline features={{ resize: true, clipboard: true }} label="角色使用提示词" value={projectForm.usagePrompt} onChange={(value) => handleUpdateProjectForm("usagePrompt", value)} />
              <Field multiline features={{ resize: true, clipboard: true }} label="角色细节描述" value={projectForm.detailPrompt} onChange={(value) => handleUpdateProjectForm("detailPrompt", value)} />
            </div>
          </Panel>
          <Panel
            title="参考资料"
            subtitle="先预览引用来源，再显式加入新项目资料。"
            actions={(
              <Button size="sm" icon={Upload} onClick={handleUploadProjectReference}>
                上传图片
              </Button>
            )}
          >
            <input
              ref={projectReferenceUploadInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={handleProjectReferenceFileChange}
            />
            <ReferencePicker
                referenceSourceTree={referenceSourceTree}
                previewReference={activePreviewReference}
                onPreviewReference={previewProjectReference}
                onAddReference={addProjectReference}
                selectedReferenceIds={selectedReferenceIds}
              />
            </Panel>
        </div>
        <aside className={s.projectCreateAside}>
          <Panel title="初始小节" subtitle="模板小节只作为创建时初始小节，创建后独立管理。">
            <div className={s.sectionSeedList}>
              {sectionSeeds.length === 0 ? (
                <div className={s.emptyInline}>没有初始小节。选择一个训练模板后，会在这里生成可调整的小节种子。</div>
              ) : null}
              {sectionSeeds.map((section, index) => (
                <article className={s.sectionSeedCard} key={section.id}>
                  <div className={s.sectionSeedHeader}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{section.title}</strong>
                    <StatusBadge status={section.enabled ? "ready" : "draft"} label={section.enabled ? "启用" : "停用"} />
                  </div>
                  <p>{section.blockCount} 个场景块 · {section.scenePreview}</p>
                  <div className={s.sectionSeedActions}>
                    <Button size="sm" icon={Check} ariaLabel={section.enabled ? `停用初始小节：${section.title}` : `启用初始小节：${section.title}`} onClick={() => handleToggleSeedSection(section.id)} feedback={{ title: section.enabled ? "初始小节已停用" : "初始小节已启用", detail: section.title }}>{section.enabled ? "停用" : "启用"}</Button>
                    <Button size="sm" icon={Copy} ariaLabel={`复制初始小节：${section.title}`} onClick={() => handleCopySeedSection(section)} feedback={{ title: "初始小节已复制", detail: section.title }}>复制</Button>
                    <Button size="sm" tone="danger" icon={Trash2} ariaLabel={`删除初始小节：${section.title}`} onClick={() => handleDeleteSeedSection(section.id)} feedback={{ tone: "warning", title: "初始小节已移除", detail: section.title }}>删除</Button>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
          <Panel title="数据集与训练默认" subtitle="创建后用于首批图片生成、说明文本和训练任务草稿。">
            <div className={s.formStack}>
              <SwitchRow
                checked={trainingDefaults.autoGenerateSamples}
                onCheckedChange={(checked) => setTrainingDefaults((current) => ({ ...current, autoGenerateSamples: checked }))}
                title="创建后自动生成首批训练样本"
                subtitle="使用每个启用小节创建一轮训练集图片任务。"
              />
              <SwitchRow
                checked={trainingDefaults.autoFreezeDataset}
                onCheckedChange={(checked) => setTrainingDefaults((current) => ({ ...current, autoFreezeDataset: checked }))}
                title="说明文本完成后自动冻结数据集"
                subtitle="只冻结已保留图片；后续编辑不会回写冻结版本。"
              />
              <FloatingSelect label="说明文本策略" value={projectForm.captionStrategy} options={["先触发词后描述", "只补全缺失说明文本", "人工确认后写入"]} onChange={(value) => handleUpdateProjectForm("captionStrategy", value)} />
              <Field label="每小节初始图片数" value={projectForm.perSectionImageCount} onChange={(value) => handleUpdateProjectForm("perSectionImageCount", value)} />
              <Field label="训练步数草稿" value={projectForm.trainingSteps} onChange={(value) => handleUpdateProjectForm("trainingSteps", value)} />
            </div>
          </Panel>
          {createdProjectDraft ? (
            <Panel title="创建结果" subtitle="页面内已生成训练项目草稿，可继续调整后更新。">
              <dl className={s.createdProjectDraft}>
                <div><dt>项目</dt><dd>{createdProjectDraft.title}</dd></div>
                <div><dt>模板</dt><dd>{createdProjectDraft.templateTitle}</dd></div>
                <div><dt>基础模型</dt><dd>{createdProjectDraft.baseModel}</dd></div>
                <div><dt>参考资料</dt><dd>{createdProjectDraft.selectedReferenceCount} 个</dd></div>
                <div><dt>初始小节</dt><dd>{createdProjectDraft.enabledSectionCount} / {createdProjectDraft.sectionCount} 启用</dd></div>
                <div><dt>每小节图片</dt><dd>{createdProjectDraft.perSectionImageCount}</dd></div>
                <div><dt>训练步数</dt><dd>{createdProjectDraft.trainingSteps}</dd></div>
                <div><dt>说明文本策略</dt><dd>{createdProjectDraft.captionStrategy}</dd></div>
                <div><dt>自动生成样本</dt><dd>{createdProjectDraft.autoGenerateSamples ? "开启" : "关闭"}</dd></div>
                <div><dt>自动冻结数据集</dt><dd>{createdProjectDraft.autoFreezeDataset ? "开启" : "关闭"}</dd></div>
                <div className={s.createdProjectDraftWide}><dt>已选资料</dt><dd>{createdProjectDraft.selectedReferenceTitles.join("、") || "未添加资料"}</dd></div>
                <div className={s.createdProjectDraftWide}><dt>使用提示词</dt><dd>{createdProjectDraft.usagePrompt}</dd></div>
                <div className={s.createdProjectDraftWide}><dt>角色细节</dt><dd>{createdProjectDraft.detailPrompt}</dd></div>
              </dl>
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
