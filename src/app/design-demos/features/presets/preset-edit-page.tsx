"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, GripVertical, History, Link2, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";

import { categoryTypeLabel, presetFolderBreadcrumb, type DemoData, type DemoPreset } from "../../data";
import s from "./preset-edit-page.library.module.css";
import { Button } from "../../shared/primitives/button";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { Field } from "../../shared/primitives/field";
import { PageHeader } from "../../shared/primitives/page-header";
import { FloatingSelect } from "../../shared/primitives/floating-select";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { cx, firstCategory } from "../../routing";
import { SortableList, useDemoSortable } from "../../shared/primitives/sortable";

type SaveState = "saved" | "queued" | "saving" | "failed";
type LoraStageId = 1 | 2;

type LoraDraftRow = {
  id: string;
  name: string;
  path: string;
  weight: string;
  trigger: string;
};

type VariantDraft = DemoPreset["variants"][number] & {
  civitaiLinks: string[];
  loraStages: Record<LoraStageId, LoraDraftRow[]>;
};

export function PresetEditPage({ data, preset }: { data: DemoData; preset: DemoPreset | undefined }) {
  if (!preset) return <EmptyPage title="没有预设数据" />;

  return <PresetEditPageContent data={data} preset={preset} key={preset.id} />;
}

function PresetEditPageContent({ data, preset }: { data: DemoData; preset: DemoPreset }) {
  const initialVariants = useMemo(() => createVariantDrafts(preset), [preset]);
  const [activeVariantId, setActiveVariantId] = useState(initialVariants[0]?.id ?? "");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastSavedAction, setLastSavedAction] = useState("初始数据已载入");
  const [civitaiUrlDraft, setCivitaiUrlDraft] = useState("");
  const [civitaiUrlError, setCivitaiUrlError] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>(initialVariants);

  useEffect(() => {
    if (saveState !== "queued") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveState("saving"), 900);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [saveState, variants]);

  useEffect(() => {
    if (saveState !== "saving") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveState("saved");
      setLastSavedAction("本地草稿已保存");
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [saveState]);

  const category = data.categories.find((item) => item.id === preset.categoryId) ?? firstCategory(data);
  const folderPath = category ? presetFolderBreadcrumb(category, preset.folderId).map((folder) => folder.name).join(" / ") || "根目录" : "根目录";
  const activeVariant = variants.find((variant) => variant.id === activeVariantId) ?? variants[0];
  const linkedVariants = data.categories
    .flatMap((item) => item.presets.map((candidate) => ({ category: item, preset: candidate })))
    .filter((item) => item.preset.id !== preset.id)
    .slice(0, 3);

  function markDraftChanged(action: string) {
    setLastSavedAction(action);
    setSaveState("queued");
  }

  function updateActiveVariant(updater: (variant: VariantDraft) => VariantDraft, action: string) {
    setVariants((current) => current.map((variant) => (variant.id === activeVariant.id ? updater(variant) : variant)));
    markDraftChanged(action);
  }

  function updateActiveVariantField(field: "name" | "prompt" | "negativePrompt", value: string) {
    updateActiveVariant((variant) => ({ ...variant, [field]: value }), `${field === "name" ? "变体名称" : field === "prompt" ? "正向 Prompt" : "反向 Prompt"}已修改`);
  }

  function applyPromptToAll(field: "prompt" | "negativePrompt") {
    const value = activeVariant[field] || "";
    setVariants((current) => current.map((variant) => ({ ...variant, [field]: value })));
    markDraftChanged(`${field === "prompt" ? "正向 Prompt" : "反向 Prompt"}已应用到所有变体`);
  }

  function applyLoraToAll(stage: LoraStageId, row: LoraDraftRow) {
    setVariants((current) =>
      current.map((variant) => ({
        ...variant,
        loraStages: {
          ...variant.loraStages,
          [stage]: upsertLoraRow(variant.loraStages[stage], row, activeVariant.name),
        },
      })),
    );
    markDraftChanged(`${row.name} 已应用到所有变体`);
  }

  function addCivitaiLink() {
    const value = civitaiUrlDraft.trim();
    const validationError = validateCivitaiUrl(value);
    if (validationError) {
      setCivitaiUrlError(validationError);
      setSaveState("failed");
      setLastSavedAction("Civitai 链接校验失败");
      return;
    }

    if (activeVariant.civitaiLinks.includes(value)) {
      setCivitaiUrlError("这个链接已经在当前变体中。");
      return;
    }

    updateActiveVariant(
      (variant) => ({
        ...variant,
        civitaiLinks: [...variant.civitaiLinks, value],
      }),
      "Civitai 链接已添加",
    );
    setCivitaiUrlDraft("");
    setCivitaiUrlError("");
  }

  function removeCivitaiLink(link: string) {
    updateActiveVariant(
      (variant) => ({
        ...variant,
        civitaiLinks: variant.civitaiLinks.filter((item) => item !== link),
      }),
      "Civitai 链接已移除",
    );
  }

  function retrySave() {
    setCivitaiUrlError("");
    setLastSavedAction("正在重试本地保存");
    setSaveState("saving");
  }

  function saveNow() {
    setLastSavedAction("手动保存已触发");
    setSaveState("saving");
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/presets?category=${preset.categoryId}&folder=${preset.folderId ?? ""}&preset=${preset.id}`, label: "返回预设库" }}
        eyebrow={categoryTypeLabel(category)}
        title={preset.name}
        subtitle={`${category?.name ?? "未分类"} · ${folderPath} · ${preset.variantCount} 个变体`}
        actions={<Button tone="primary" icon={Save} pending={saveState === "saving"} onClick={saveNow}>保存</Button>}
      />
      <div className={s.presetEditorShell}>
        <main className={s.editorSurface}>
          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>基础信息</strong>
                <span>名称、分类和文件夹。</span>
              </div>
              <StatusBadge status={saveStateToStatus(saveState)} label={saveStateLabel(saveState)} />
            </div>
            <div className={s.formGrid}>
              <Field label="名称" value={preset.name} readOnly />
              <FloatingSelect label="分类" value={category?.name ?? preset.categoryId} />
              <FloatingSelect label="文件夹" value={folderPath} />
            </div>
            <Field multiline features={{ resize: true, clipboard: true }} label="备注" placeholder="预设说明和维护备注。" value={preset.notes ?? ""} readOnly />
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>变体</strong>
                <span>每个变体保留独立 prompt、LoRA 和关联变体。</span>
              </div>
              <Button icon={GripVertical} feedback={{ title: "变体顺序已保存" }}>保存顺序</Button>
            </div>
            <div className={s.presetVariantWorkbench}>
              <div className={s.presetVariantRail}>
                <SortableList items={variants.map((v) => v.id)} onReorder={(ids) => {
                  setVariants((current) => ids.map((id) => current.find((v) => v.id === id)!).filter(Boolean));
                  markDraftChanged("变体顺序已调整");
                }}>
                  {variants.map((variant, index) => (
                    <SortableVariantButton
                      key={variant.id}
                      variant={variant}
                      index={index}
                      isActive={variant.id === activeVariant.id}
                      onSelect={() => setActiveVariantId(variant.id)}
                    />
                  ))}
                </SortableList>
              </div>
              <div className={s.presetVariantEditor}>
                <div className={s.formGrid}>
                  <Field label="变体名称" value={activeVariant.name} onChange={(value) => updateActiveVariantField("name", value)} />
                </div>
                <div className={s.promptColumns}>
                  <PromptApplyField
                    fieldName="正向 Prompt"
                    value={activeVariant.prompt || "正向提示词"}
                    variantName={activeVariant.name}
                    onApply={() => applyPromptToAll("prompt")}
                    onChange={(value) => updateActiveVariantField("prompt", value)}
                  />
                  <PromptApplyField
                    fieldName="反向 Prompt"
                    value={activeVariant.negativePrompt || "反向提示词"}
                    variantName={activeVariant.name}
                    onApply={() => applyPromptToAll("negativePrompt")}
                    onChange={(value) => updateActiveVariantField("negativePrompt", value)}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>LoRA 绑定</strong>
                <span>阶段 1 和阶段 2 对应真实编辑器的两个 LoRA 列表，保留权重、触发词和来源表达。</span>
              </div>
              <Button icon={Plus} feedback={{ title: "LoRA 行已添加", detail: activeVariant.name }}>添加 LoRA</Button>
            </div>
            <div className={s.loraStageGrid}>
              <PresetLoraStage title="LoRA 1" rows={activeVariant.loraStages[1]} stage={1} onApplyToAll={applyLoraToAll} />
              <PresetLoraStage title="LoRA 2" rows={activeVariant.loraStages[2]} stage={2} onApplyToAll={applyLoraToAll} />
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>Civitai 链接</strong>
                <span>维护当前变体关联的模型页面，保存为本地草稿。</span>
              </div>
              <StatusBadge status={activeVariant.civitaiLinks.length ? "ready" : "pending"} label={`${activeVariant.civitaiLinks.length} 个链接`} />
            </div>
            <div className={s.civitaiLinkPanel}>
              <div className={s.civitaiLinkInputRow}>
                <Field label="Civitai URL" value={civitaiUrlDraft} onChange={(value) => {
                  setCivitaiUrlDraft(value);
                  setCivitaiUrlError("");
                }} />
                <Button icon={Plus} onClick={addCivitaiLink}>添加链接</Button>
              </div>
              {civitaiUrlError ? <p className={s.civitaiLinkError}>{civitaiUrlError}</p> : null}
              <div className={s.civitaiLinkList}>
                {activeVariant.civitaiLinks.length ? activeVariant.civitaiLinks.map((link) => (
                  <div className={s.civitaiLinkRow} key={link}>
                    <Link2 className={s.icon} />
                    <span title={link}>{link}</span>
                    <Button icon={Trash2} iconOnly ariaLabel="移除 Civitai 链接" size="sm" tone="subtle" onClick={() => removeCivitaiLink(link)} />
                  </div>
                )) : (
                  <div className={s.civitaiLinkEmpty}>当前变体还没有 Civitai 链接。</div>
                )}
              </div>
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>关联变体</strong>
                <span>用于级联复用其他预设变体的 prompt 与 LoRA 内容。</span>
              </div>
              <Button icon={Search} feedback={{ title: "变体选择面板已准备" }}>选择变体</Button>
            </div>
            <div className={s.presetLinkedList}>
              {linkedVariants.map(({ category: sourceCategory, preset: sourcePreset }, index) => {
                const variant = sourcePreset.variants[index % Math.max(sourcePreset.variants.length, 1)];
                return (
                  <div className={s.presetLinkedRow} key={sourcePreset.id}>
                    <div>
                      <strong>{sourcePreset.name}</strong>
                      <span>{sourceCategory.name} · {variant?.name ?? "默认"}</span>
                    </div>
                    <StatusBadge status={index === 0 ? "ready" : "monitor"} label={index === 0 ? "级联" : "候选"} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>变更历史</strong>
                <span>按基础信息、变体内容和 LoRA 绑定展示差异。</span>
              </div>
              <Button icon={History} feedback={{ title: "历史筛选已应用" }}>筛选历史</Button>
            </div>
            <div className={s.historyDiffList}>
              <div className={s.historyDiffRow}>
                <strong>变体内容更新</strong>
                <span>正向 Prompt 增加 {activeVariant.name} 的主体描述，反向 Prompt 同步排除项。</span>
              </div>
              <div className={s.historyDiffRow}>
                <strong>LoRA 绑定调整</strong>
                <span>LoRA 1 权重从 0.75 调整为 0.82，LoRA 2 保持继承。</span>
              </div>
            </div>
          </section>
        </main>

        <aside className={s.editorAside}>
          <strong>保存状态</strong>
          <SaveStateStrip state={saveState} detail={lastSavedAction} variantCount={variants.length} onRetry={retrySave} />
          <div className={s.presetCascadeState}>
            <div>
              <strong>级联同步</strong>
              <span>当前变体的 prompt 与 LoRA 可同步到绑定它的小节。</span>
            </div>
            <StatusBadge status="pending" label="待确认" />
          </div>
          <div className={s.presetCascadeState}>
            <div>
              <strong>删除保护</strong>
              <span>被项目或小节引用时需要先解除绑定。</span>
            </div>
            <StatusBadge status="monitor" label="受保护" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PromptApplyField({
  fieldName,
  value,
  variantName,
  onApply,
  onChange,
}: {
  fieldName: string;
  value: string;
  variantName: string;
  onApply: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className={s.promptField}>
      <div className={s.promptFieldHeader}>
        <span>{fieldName}</span>
        <Button
          className={s.promptApplyButton}
          icon={Copy}
          size="sm"
          tone="subtle"
          onClick={onApply}
          feedback={{
            title: `${fieldName} 已应用到所有变体`,
            detail: `来源变体：${variantName}`,
          }}
        >
          应用到所有变体
        </Button>
      </div>
      <Field multiline features={{ resize: true, clipboard: true }} label={`${fieldName} 内容`} value={value} onChange={onChange} />
    </div>
  );
}

function PresetLoraStage({
  title,
  stage,
  rows,
  onApplyToAll,
}: {
  title: string;
  stage: 1 | 2;
  rows: LoraDraftRow[];
  onApplyToAll: (stage: LoraStageId, row: LoraDraftRow) => void;
}) {
  return (
    <div className={s.loraStage}>
      <div className={s.loraStageHeader}>
        <strong>{title}</strong>
        <span>{rows.length} 行</span>
      </div>
      {rows.map((row) => (
        <div className={s.loraRow} key={`${title}-${row.name}`}>
          <GripVertical className={s.icon} />
          <div className={s.loraMain}>
            <strong className={s.loraName}>{row.name}</strong>
            <span className={s.loraPath}>{row.path}</span>
          </div>
          <em className={s.loraWeight}>w {row.weight}</em>
          <span className={s.loraTrigger} title={row.trigger}>
            {row.trigger}
          </span>
          <Button
            className={s.loraApplyButton}
            icon={Copy}
            size="sm"
            tone="subtle"
            onClick={() => onApplyToAll(stage, row)}
            feedback={{
              title: `${row.name} 已应用到所有变体`,
              detail: "真实流程会为缺失变体创建 LoRA 行",
            }}
          >
            应用
          </Button>
        </div>
      ))}
    </div>
  );
}

function SaveStateStrip({
  state,
  detail,
  variantCount,
  onRetry,
}: {
  state: SaveState;
  detail: string;
  variantCount: number;
  onRetry: () => void;
}) {
  return (
    <div className={cx(s.editorStatusStrip, s.saveStateStrip)} data-state={state}>
      <StatusBadge status={saveStateToStatus(state)} label={saveStateLabel(state)} />
      <span>{detail}</span>
      <span>{variantCount} 个变体</span>
      {state === "failed" ? (
        <Button icon={RefreshCw} size="sm" tone="subtle" onClick={onRetry}>
          重试
        </Button>
      ) : null}
    </div>
  );
}

function SortableVariantButton({
  variant,
  index,
  isActive,
  onSelect,
}: {
  variant: VariantDraft;
  index: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { ref, style, handleProps } = useDemoSortable(variant.id);

  return (
    <button
      ref={ref}
      style={style}
      aria-pressed={isActive}
      className={cx(s.presetVariantButton, isActive && s.presetVariantButtonActive)}
      type="button"
      onClick={onSelect}
    >
      <GripVertical className={s.icon} {...handleProps} />
      <span>{String(index + 1).padStart(2, "0")}</span>
      <strong>{variant.name}</strong>
    </button>
  );
}

function createVariantDrafts(preset: DemoPreset): VariantDraft[] {
  const sourceVariants = preset.variants.length
    ? preset.variants
    : [{ id: "default", name: "默认", slug: "default", prompt: "", negativePrompt: "", lora1: [], lora2: [], linkedVariants: [] }];

  return sourceVariants.map((variant) => ({
    ...variant,
    prompt: variant.prompt || "",
    negativePrompt: variant.negativePrompt || "",
    civitaiLinks: readCivitaiLinks(preset, variant),
    loraStages: {
      1: readLoraRows(preset, variant, 1),
      2: readLoraRows(preset, variant, 2),
    },
  }));
}

function readCivitaiLinks(preset: DemoPreset, variant: DemoPreset["variants"][number]) {
  const candidate = variant as DemoPreset["variants"][number] & {
    civitaiLinks?: unknown;
    civitaiUrls?: unknown;
    civitaiUrl?: unknown;
  };
  const links = Array.isArray(candidate.civitaiLinks)
    ? candidate.civitaiLinks
    : Array.isArray(candidate.civitaiUrls)
      ? candidate.civitaiUrls
      : candidate.civitaiUrl
        ? [candidate.civitaiUrl]
        : preset.civitaiLinks;

  return links.filter((link): link is string => typeof link === "string" && link.trim().length > 0);
}

function readLoraRows(preset: DemoPreset, variant: DemoPreset["variants"][number], stage: LoraStageId): LoraDraftRow[] {
  const candidate = variant as DemoPreset["variants"][number] & {
    loraStages?: Partial<Record<LoraStageId, unknown>>;
    loras?: unknown;
  };
  const stageRows = candidate.loraStages?.[stage];
  const sourceRows = stage === 1 ? variant.lora1 : variant.lora2;
  const rows = Array.isArray(stageRows) ? stageRows : Array.isArray(sourceRows) && sourceRows.length ? sourceRows : Array.isArray(candidate.loras) ? candidate.loras : [];
  const normalizedRows = rows
    .map((row, index) => normalizeLoraRow(row, stage, index))
    .filter((row): row is LoraDraftRow => Boolean(row));

  if (normalizedRows.length) return normalizedRows;

  return [
    {
      id: `${variant.id}-${stage}-primary`,
      name: stage === 1 ? `${preset.name} 主体 LoRA` : `${preset.name} 风格 LoRA`,
      path: stage === 1 ? "ComfyUI 模型库 / 主体 LoRA" : "ComfyUI 模型库 / 风格 LoRA",
      weight: stage === 1 ? "0.82" : "0.56",
      trigger: variant.name,
    },
    {
      id: `${variant.id}-${stage}-refine`,
      name: stage === 1 ? "角色精修 LoRA" : "风格平衡 LoRA",
      path: stage === 1 ? "ComfyUI 模型库 / 角色精修" : "ComfyUI 模型库 / 风格平衡",
      weight: stage === 1 ? "0.35" : "0.48",
      trigger: preset.name,
    },
  ];
}

function normalizeLoraRow(row: unknown, stage: LoraStageId, index: number): LoraDraftRow | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const path = stringValue(value.path ?? value.modelPath ?? value.source) || "ComfyUI 模型库";
  const name = stringValue(value.name ?? value.modelName ?? value.filename) || loraNameFromPath(path);
  if (!name) return null;

  return {
    id: stringValue(value.id ?? value.bindingId) || `${stage}-${name}-${index}`,
    name,
    path,
    weight: stringValue(value.weight ?? value.strength) || "1.00",
    trigger: stringValue(value.trigger ?? value.triggerWords) || "继承触发词",
  };
}

function upsertLoraRow(rows: LoraDraftRow[], sourceRow: LoraDraftRow, sourceVariantName: string) {
  const nextRow = { ...sourceRow, trigger: sourceRow.trigger || sourceVariantName };
  const existingIndex = rows.findIndex((row) => row.id === sourceRow.id || row.name === sourceRow.name);
  if (existingIndex === -1) return [...rows, nextRow];
  return rows.map((row, index) => (index === existingIndex ? nextRow : row));
}

function validateCivitaiUrl(value: string) {
  if (!value) return "请输入 Civitai 链接。";

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "链接必须使用 http 或 https。";
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "civitai.com" && !hostname.endsWith(".civitai.com")) return "请输入 civitai.com 的链接。";
    return "";
  } catch {
    return "请输入有效 URL。";
  }
}

function saveStateLabel(state: SaveState) {
  if (state === "saving") return "保存中";
  if (state === "queued") return "还有修改待保存";
  if (state === "failed") return "保存失败";
  return "已保存";
}

function saveStateToStatus(state: SaveState) {
  if (state === "failed") return "failed";
  if (state === "saving") return "running";
  if (state === "queued") return "pending";
  return "ready";
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function loraNameFromPath(path: string) {
  return path.split("/").pop()?.replace(/\.safetensors$/i, "") ?? "";
}
