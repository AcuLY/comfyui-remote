"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Save, Trash2 } from "lucide-react";

import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { OperationStateStrip } from "@/components/design-demo-ui/feedback/operation-state-strip";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Field } from "@/components/design-demo-ui/primitives/field";
import { FloatingSelect } from "@/components/design-demo-ui/primitives/floating-select";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { EditorBlock, UnitRowShell, WorkbenchSurface } from "@/components/design-demo-ui/patterns";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingPreset } from "@/features/training/types";
import {
  createDraftTrainingPreset,
  findPreset,
  isProductionTrainingPath,
  readNewPresetHints,
  type NewPresetHints,
} from "./training-resource-page-utils";
import { presetStatus } from "./training-preset-library-primitives";
export { LoraTrainingPresetsPage } from "./training-presets-page";
export { LoraTrainingPresetSortRulesPage } from "./training-preset-sort-rules-page";
export { LoraTrainingTemplateFormPage } from "./training-template-form-page";
export { LoraTrainingTemplateSectionPage } from "./training-template-section-page";
export { LoraTrainingTemplatesPage } from "./training-templates-page";
import { useResourceUrlSearch } from "./use-resource-url-search";
import s from "./training-resource-pages.module.css";

export function LoraTrainingPresetDetailPage({ data, mode = "edit", presetId }: { data: TrainingAppData; mode?: "new" | "edit"; presetId?: string }) {
  const urlSearch = useResourceUrlSearch();
  const newPresetHints = mode === "new" ? readNewPresetHints(urlSearch) : { artifact: "", category: "", folder: "", project: "", sourceRun: "" };
  const preset = mode === "new" ? createDraftTrainingPreset(newPresetHints) : findPreset(data, presetId);
  if (!preset) return <EmptyPage title="没有训练预制数据" />;
  return <LoraTrainingPresetDetailContent isNew={mode === "new"} newPresetHints={newPresetHints} preset={preset} />;
}

function LoraTrainingPresetDetailContent({
  isNew,
  newPresetHints,
  preset,
}: {
  isNew: boolean;
  newPresetHints: NewPresetHints;
  preset: LoraTrainingPreset;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const usages = [...preset.projectUsage, ...preset.templateUsage];
  const presetFormContextId = [
    isNew ? "new" : preset.id,
    isNew ? newPresetHints.sourceRun : "",
    isNew ? newPresetHints.artifact : "",
    isNew ? newPresetHints.category : preset.category,
    isNew ? newPresetHints.folder : preset.folder,
  ].join(":");
  const initialPresetForm = {
    category: preset.category,
    folder: preset.folder,
    sceneDescriptionText: preset.sceneDescriptionText,
    title: preset.title,
  };
  const [presetFormState, setPresetFormState] = useState(() => ({
    contextId: presetFormContextId,
    form: initialPresetForm,
  }));
  const [presetDraftState, setPresetDraftState] = useState<{
    contextId: string;
    draft: typeof initialPresetForm & { usageCount: number } | null;
  }>(() => ({
    contextId: presetFormContextId,
    draft: null,
  }));
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [isDeletingPreset, setIsDeletingPreset] = useState(false);
  const presetForm = presetFormState.contextId === presetFormContextId ? presetFormState.form : initialPresetForm;
  const presetDraft = presetDraftState.contextId === presetFormContextId ? presetDraftState.draft : null;
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  function setPresetForm(updater: (current: typeof initialPresetForm) => typeof initialPresetForm) {
    setPresetFormState((current) => ({
      contextId: presetFormContextId,
      form: updater(current.contextId === presetFormContextId ? current.form : initialPresetForm),
    }));
  }

  function setPresetDraft(draft: typeof initialPresetForm & { usageCount: number }) {
    setPresetDraftState({
      contextId: presetFormContextId,
      draft,
    });
  }

  function handleUpdatePresetForm(field: keyof typeof presetForm, value: string) {
    setPresetForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSavePreset() {
    const nextDraft = {
      ...presetForm,
      usageCount: usages.length,
    };

    if (!isProductionTrainingRoute) {
      setPresetDraft(nextDraft);
      pushToast({
        tone: "success",
        title: presetDraft ? "预制保存草稿已更新" : "预制保存草稿已记录",
        detail: presetForm.title,
      });
      return;
    }

    if (isSavingPreset) return;

    setIsSavingPreset(true);
    try {
      const response = await fetch(isNew ? "/api/training/presets" : `/api/training/presets/${preset.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: presetForm.title,
          category: presetForm.category,
          folder: presetForm.folder,
          sceneDescriptionText: presetForm.sceneDescriptionText,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: isNew ? "训练预制创建失败" : "训练预制保存失败",
          detail: payload?.error?.message ?? "训练预制保存请求失败",
        });
        return;
      }

      setPresetDraft(nextDraft);
      pushToast({
        tone: "success",
        title: isNew ? "训练预制已创建" : "训练预制已保存",
        detail: presetForm.title,
      });
      router.push(`/training/presets/${payload.data.id}`);
    } catch (error) {
      pushToast({
        tone: "error",
        title: isNew ? "训练预制创建失败" : "训练预制保存失败",
        detail: error instanceof Error ? error.message : "训练预制保存请求失败",
      });
    } finally {
      setIsSavingPreset(false);
    }
  }

  async function handleDeletePreset() {
    if (isNew) return;

    if (!isProductionTrainingRoute) {
      pushToast({
        tone: "warning",
        title: "训练预制已从列表移除",
        detail: preset.title,
      });
      router.push("/training/presets");
      return;
    }

    if (isDeletingPreset) return;

    setIsDeletingPreset(true);
    try {
      const response = await fetch(`/api/training/scene-description/presets/${preset.id}/cascade`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirm: true,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "训练预制删除失败",
          detail: payload?.error?.message ?? "训练预制删除请求失败",
        });
        return;
      }

      pushToast({
        tone: "warning",
        title: "训练预制已从列表移除",
        detail: preset.title,
      });
      router.push("/training/presets");
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练预制删除失败",
        detail: error instanceof Error ? error.message : "训练预制删除请求失败",
      });
    } finally {
      setIsDeletingPreset(false);
    }
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/presets", label: "返回训练预制" }}
        eyebrow="训练预制"
        title={isNew ? "新建训练预制" : presetForm.title}
        subtitle={isNew ? `${presetForm.category} / ${presetForm.folder} · 本地草稿` : `${presetForm.category} / ${presetForm.folder} · 更新 ${preset.updatedAt}`}
        actions={(
          <>
            {!isNew ? (
              <Button
                tone="danger"
                icon={Trash2}
                pending={isDeletingPreset}
                onClick={handleDeletePreset}
              >
                删除
              </Button>
            ) : null}
            <Button
              tone="primary"
              icon={Save}
              pending={isSavingPreset}
              onClick={handleSavePreset}
            >
              {presetDraft ? "更新草稿" : isNew ? "创建预制" : "保存"}
            </Button>
          </>
        )}
      />
      <WorkbenchSurface className={s.trainingPresetEditorSurface}>
        <EditorBlock
          actions={isNew ? <StatusBadge status="queued" label="草稿" /> : presetStatus(preset)}
          className={s.trainingPresetEditorBlock}
          contentClassName={s.trainingPresetFormGrid}
          description="训练预制只维护一段可复用场景描述。"
          headerClassName={s.trainingPresetEditorHeader}
          title="预制内容"
        >
          <Field label="名称" value={presetForm.title} onChange={(value) => handleUpdatePresetForm("title", value)} />
          <FloatingSelect label="分类" value={presetForm.category} options={[preset.category, "光线", "环境", "构图"]} onChange={(value) => handleUpdatePresetForm("category", value)} />
          <FloatingSelect label="文件夹" value={presetForm.folder} options={[preset.folder, "舞台", "城市", "训练净图"]} onChange={(value) => handleUpdatePresetForm("folder", value)} />
          {isNew && newPresetHints.artifact ? (
            <Field readOnly label="来源训练产物" value={`${newPresetHints.project || "训练项目"} · ${newPresetHints.artifact}`} />
          ) : null}
          <Field multiline features={{ resize: true, clipboard: true }} label="场景描述" value={presetForm.sceneDescriptionText} onChange={(value) => handleUpdatePresetForm("sceneDescriptionText", value)} />
        </EditorBlock>
        <EditorBlock
          actions={<StatusBadge status={usages.length ? "pending" : "ready"} label={`${usages.length} 处引用`} />}
          className={s.trainingPresetEditorBlock}
          contentClassName={s.trainingPresetUsageList}
          description="删除前展示项目侧和模板侧引用，确认后只移除当前预制关联。"
          headerClassName={s.trainingPresetEditorHeader}
          title="引用影响"
        >
          {usages.map((usage) => (
            <UnitRowShell
              className={s.trainingPresetUsageRow}
              description="引用当前场景块"
              key={usage}
              meta={<StatusBadge status="template" label={usage.startsWith("模板") ? "模板" : "项目"} />}
              title={usage}
            />
          ))}
          {usages.length === 0 ? <div className={s.emptyInline}>没有引用</div> : null}
          <OperationStateStrip
            items={[
              { label: "保存", value: isNew ? "待创建" : "本地草稿", tone: isNew ? "warning" : "info" },
              { label: "删除影响", value: `${usages.length} 处`, tone: usages.length ? "warning" : "success" },
              { label: "校验", value: "通过", tone: "success" },
            ]}
          />
        </EditorBlock>
        {presetDraft ? (
          <EditorBlock
            actions={<StatusBadge status="ready" label={isNew ? "待创建" : "本地草稿"} />}
            className={s.trainingPresetEditorBlock}
            description="页面内记录当前场景描述草稿，可继续调整分类、文件夹和引用影响。"
            headerClassName={s.trainingPresetEditorHeader}
            title="预制保存草稿"
          >
            <dl className={s.trainingPresetDraft}>
              <div><dt>名称</dt><dd>{presetDraft.title}</dd></div>
              <div><dt>分类</dt><dd>{presetDraft.category}</dd></div>
              <div><dt>文件夹</dt><dd>{presetDraft.folder}</dd></div>
              <div><dt>引用影响</dt><dd>{presetDraft.usageCount} 处</dd></div>
              <div className={s.trainingPresetDraftWide}><dt>场景描述</dt><dd>{presetDraft.sceneDescriptionText}</dd></div>
            </dl>
          </EditorBlock>
        ) : null}
      </WorkbenchSurface>
    </div>
  );
}
