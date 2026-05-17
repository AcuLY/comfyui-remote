"use client";

import { useState } from "react";
import { Copy, GripVertical, History, Plus, Save, Search } from "lucide-react";

import { categoryTypeLabel, presetFolderBreadcrumb, type DemoData, type DemoPreset } from "../../data";
import s from "./preset-edit-page.library.module.css";
import { Button } from "../../shared/primitives/button";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { Field } from "../../shared/primitives/field";
import { PageHeader } from "../../shared/primitives/page-header";
import { FloatingSelect } from "../../shared/primitives/floating-select";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { cx, firstCategory } from "../../routing";

export function PresetEditPage({ data, preset }: { data: DemoData; preset: DemoPreset | undefined }) {
  const [activeVariantId, setActiveVariantId] = useState(preset?.variants[0]?.id ?? "");
  if (!preset) return <EmptyPage title="没有预设数据" />;

  const category = data.categories.find((item) => item.id === preset.categoryId) ?? firstCategory(data);
  const folderPath = category ? presetFolderBreadcrumb(category, preset.folderId).map((folder) => folder.name).join(" / ") || "根目录" : "根目录";
  const variants = preset.variants.length ? preset.variants : [{ id: "default", name: "默认", slug: "default", prompt: "", negativePrompt: "" }];
  const activeVariant = variants.find((variant) => variant.id === activeVariantId) ?? variants[0];
  const linkedVariants = data.categories
    .flatMap((item) => item.presets.map((candidate) => ({ category: item, preset: candidate })))
    .filter((item) => item.preset.id !== preset.id)
    .slice(0, 3);

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/presets?category=${preset.categoryId}&folder=${preset.folderId ?? ""}&preset=${preset.id}`, label: "返回预设库" }}
        eyebrow={categoryTypeLabel(category)}
        title={preset.name}
        subtitle={`${category?.name ?? "未分类"} · ${folderPath} · ${preset.variantCount} 个变体`}
        actions={<Button tone="primary" icon={Save} feedback={{ title: "预设保存已排队", detail: preset.name }}>保存</Button>}
      />
      <div className={s.presetEditorShell}>
        <main className={s.editorSurface}>
          <div className={s.editorStickyHeader}>
            <div className={s.editorIdentity}>
              <span>{category?.name ?? "未分类"} · {folderPath}</span>
              <strong>{activeVariant.name}</strong>
              <em>{preset.variantCount} 个变体</em>
            </div>
            <div className={s.toolbar}>
              <StatusBadge status="ready" label="已保存" />
              <Button icon={Plus} feedback={{ title: "变体草稿已创建", detail: preset.name }}>添加变体</Button>
            </div>
          </div>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>基础信息</strong>
                <span>名称、分类和文件夹。</span>
              </div>
              <StatusBadge status="ready" label="已保存" />
            </div>
            <div className={s.formGrid}>
              <Field label="名称" value={preset.name} />
              <FloatingSelect label="分类" value={category?.name ?? preset.categoryId} />
              <FloatingSelect label="文件夹" value={folderPath} />
            </div>
            <Field multiline features={{ resize: true, clipboard: true }} label="备注" value={preset.notes || "预设说明和维护备注。"} />
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
                {variants.map((variant, index) => (
                  <button
                    aria-pressed={variant.id === activeVariant.id}
                    className={cx(s.presetVariantButton, variant.id === activeVariant.id && s.presetVariantButtonActive)}
                    key={variant.id}
                    type="button"
                    onClick={() => setActiveVariantId(variant.id)}
                  >
                    <GripVertical className={s.icon} />
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{variant.name}</strong>
                  </button>
                ))}
              </div>
              <div className={s.presetVariantEditor}>
                <div className={s.formGrid}>
                  <Field label="变体名称" value={activeVariant.name} />
                </div>
                <div className={s.promptColumns}>
                  <PromptApplyField
                    fieldName="正向 Prompt"
                    value={activeVariant.prompt || "正向提示词"}
                    variantName={activeVariant.name}
                  />
                  <PromptApplyField
                    fieldName="反向 Prompt"
                    value={activeVariant.negativePrompt || "反向提示词"}
                    variantName={activeVariant.name}
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
              <PresetLoraStage title="LoRA 1" preset={preset} variant={activeVariant} stage={1} />
              <PresetLoraStage title="LoRA 2" preset={preset} variant={activeVariant} stage={2} />
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
          <div className={s.editorStatusStrip}>
            <span>自动保存已开启</span>
            <span>{variants.length} 个变体</span>
            <span>{category?.name ?? "未分类"}</span>
          </div>
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
}: {
  fieldName: string;
  value: string;
  variantName: string;
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
          feedback={{
            title: `${fieldName} 将应用到所有变体`,
            detail: `来源变体：${variantName}`,
          }}
        >
          应用到所有变体
        </Button>
      </div>
      <Field multiline features={{ resize: true, clipboard: true }} label={`${fieldName} 内容`} value={value} />
    </div>
  );
}

function PresetLoraStage({
  title,
  preset,
  variant,
  stage,
}: {
  title: string;
  preset: DemoPreset;
  variant: DemoPreset["variants"][number];
  stage: 1 | 2;
}) {
  const rows = [
    {
      name: stage === 1 ? `${preset.name} 主体 LoRA` : `${preset.name} 风格 LoRA`,
      path: stage === 1 ? "ComfyUI 模型库 / 主体 LoRA" : "ComfyUI 模型库 / 风格 LoRA",
      weight: stage === 1 ? "0.82" : "0.56",
      trigger: variant.name,
    },
    {
      name: stage === 1 ? "角色精修 LoRA" : "风格平衡 LoRA",
      path: stage === 1 ? "ComfyUI 模型库 / 角色精修" : "ComfyUI 模型库 / 风格平衡",
      weight: stage === 1 ? "0.35" : "0.48",
      trigger: preset.name,
    },
  ];

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
            feedback={{
              title: `${row.name} 将应用到所有变体`,
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
