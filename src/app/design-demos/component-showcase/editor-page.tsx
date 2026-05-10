"use client";

import { useState } from "react";

import type { DemoData } from "../design-demo-data";
import s from "../styles/showcase.module.css";
import { LoraColumn } from "../section-editor-lora-column";
import { HistoryDiffRow, LoraRow, type LoraRowData } from "../section-editor-lora-history";
import { PresetBindingRow, PresetImportInline, type ImportCategory } from "../section-editor-presets";
import { CompiledPromptPreview, PromptBlockRow } from "../section-editor-prompts";
import { PageHeader } from "../ui/page-header";
import showcaseCss from "./component-showcase.module.css";
import { ShowcaseItem } from "./showcase-item";

export function ComponentShowcaseEditor({ data }: { data: DemoData }) {
  const [openPromptBlock, setOpenPromptBlock] = useState<string | null>(null);
  const [showcaseLoras, setShowcaseLoras] = useState<LoraRowData[]>([
    {
      id: "lora-1",
      fileName: "add_detail.safetensors",
      filePath: "add_detail/add_detail.safetensors",
      weight: 0.8,
      enabled: true,
      kind: "preset" as const,
      presetName: "写实人像",
      categoryName: "人物",
      categoryColor: "158 100% 43%",
      triggerWords: "add detail, highly detailed",
    },
    {
      id: "lora-2",
      fileName: "flat_color.safetensors",
      filePath: "flat_color/flat_color.safetensors",
      weight: 0.5,
      enabled: false,
      kind: "manual" as const,
      triggerWords: "flat color",
    },
  ]);
  const updateShowcaseLora = (id: string, patch: Partial<(typeof showcaseLoras)[number]>) => {
    setShowcaseLoras((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <div className={s.showcasePage}>
      <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="Section Editor 组件" subtitle="8 个小节编辑器专用组件" />

      {/* 5.1 SectionHeader - too large for showcase, just mention */}
      <ShowcaseItem name="SectionHeader" desc="小节编辑器顶部栏（运行控制 + 导航 + 保存状态）">
        <div className={showcaseCss.sectionNote}>
          SectionHeader 是完整的页面级头部组件，请在实际小节编辑器页面中查看。
          <br />
          路由：<code>/design-demos/projects/:projectId/sections/:sectionId</code>
        </div>
      </ShowcaseItem>

      {/* 5.2 PresetBindingRow */}
      <ShowcaseItem name="PresetBindingRow" desc="预制绑定行">
        <PresetBindingRow
          binding={{
            id: "bind-1",
            kind: "preset",
            scope: "section",
            categoryId: "cat-1",
            categoryName: "人物",
            categoryColor: "158 100% 43%",
            name: "写实人像",
            variantName: "高细节",
            blockCount: 2,
            loraCount: 1,
            variants: [
              { id: "v1", name: "默认" },
              { id: "v2", name: "高细节" },
            ],
          }}
        />
        <hr className={s.showcaseDivider} />
        <PresetBindingRow
          binding={{
            id: "bind-2",
            kind: "group",
            scope: "section",
            categoryId: "cat-2",
            categoryName: "风景",
            categoryColor: "200 80% 50%",
            name: "风景写意",
            variantName: "默认",
            blockCount: 1,
            loraCount: 0,
            variants: [
              { id: "v1", name: "默认" },
              { id: "v2", name: "湿润" },
            ],
          }}
        />
      </ShowcaseItem>

      {/* 5.3 PresetImportInline */}
      <ShowcaseItem name="PresetImportInline" desc="行内预制导入面板">
        <PresetImportInline
          open
          categories={data.categories.slice(0, 2).map((cat): ImportCategory => ({
            id: cat.id,
            name: cat.name,
            color: cat.color,
            presets: cat.presets.map((p) => ({
              id: p.id,
              name: p.name,
              variantCount: p.variantCount,
            })),
            groups: cat.groups.map((g) => ({
              id: g.id,
              name: g.name,
              memberCount: g.memberCount,
            })),
          }))}
          selected={null}
          onSelect={() => {}}
        />
      </ShowcaseItem>

      {/* 5.4 PromptBlockRow */}
      <ShowcaseItem name="PromptBlockRow" desc="提示词块行">
        <PromptBlockRow
          block={{
            id: "pb-1",
            label: "主体描述",
            categoryName: "人物",
            categoryColor: "158 100% 43%",
            presetName: "写实人像",
            variantName: "高细节",
            positive: "masterpiece, best quality, 1girl, portrait, detailed face",
            negative: "lowres, bad anatomy, bad hands, blurry",
            kind: "preset",
          }}
          expanded={openPromptBlock === "pb-1"}
          column="positive"
          onToggle={() => setOpenPromptBlock((id) => (id === "pb-1" ? null : "pb-1"))}
        />
        <hr className={s.showcaseDivider} />
        <PromptBlockRow
          block={{
            id: "pb-2",
            label: "负面提示词",
            categoryName: "自定义",
            categoryColor: null,
            positive: "",
            negative: "worst quality, low quality, watermark, text",
            kind: "manual",
          }}
          expanded={openPromptBlock === "pb-2"}
          column="negative"
          onToggle={() => setOpenPromptBlock((id) => (id === "pb-2" ? null : "pb-2"))}
        />
      </ShowcaseItem>

      {/* 5.5 CompiledPromptPreview */}
      <ShowcaseItem name="CompiledPromptPreview" desc="编译后的 Prompt 预览">
        <CompiledPromptPreview
          groups={[
            {
              id: "g1",
              presetName: "写实人像",
              categoryName: "人物",
              positive: ["masterpiece, best quality", "1girl, portrait, detailed face", "studio lighting"],
              negative: ["lowres", "bad anatomy, bad hands"],
            },
            {
              id: "g2",
              presetName: "风格化",
              categoryName: "风格",
              positive: ["anime style", "vibrant colors, dynamic pose"],
              negative: ["photorealistic", "3d render"],
            },
          ]}
        />
      </ShowcaseItem>

      {/* 5.6 LoraRow */}
      <ShowcaseItem name="LoraRow" desc="LoRA 行">
        <LoraRow
          entry={showcaseLoras[0]}
          fileOptions={["add_detail.safetensors", "flat_color.safetensors", "realistic_skin.safetensors"]}
          onWeightChange={(weight) => updateShowcaseLora("lora-1", { weight })}
          onToggle={() => updateShowcaseLora("lora-1", { enabled: !showcaseLoras[0]?.enabled })}
          onPathChange={(filePath) => updateShowcaseLora("lora-1", { filePath })}
          onUnlink={() => {}}
          onDelete={() => {}}
        />
        <hr className={s.showcaseDivider} />
        <LoraRow
          entry={showcaseLoras[1]}
          fileOptions={["add_detail.safetensors", "flat_color.safetensors", "realistic_skin.safetensors"]}
          onWeightChange={(weight) => updateShowcaseLora("lora-2", { weight })}
          onToggle={() => updateShowcaseLora("lora-2", { enabled: !showcaseLoras[1]?.enabled })}
          onPathChange={(filePath) => updateShowcaseLora("lora-2", { filePath })}
          onUnlink={() => {}}
          onDelete={() => {}}
        />
      </ShowcaseItem>

      {/* 5.7 LoraColumn */}
      <ShowcaseItem name="LoraColumn" desc="LoRA 列容器">
        <LoraColumn
          label="Stage 1"
          entries={[
            {
              id: "lora-1",
              fileName: "add_detail.safetensors",
              filePath: "add_detail/add_detail.safetensors",
              weight: 0.8,
              enabled: true,
              kind: "preset" as const,
              presetName: "写实人像",
              categoryName: "人物",
              categoryColor: "158 100% 43%",
              triggerWords: "add detail, highly detailed",
            },
            {
              id: "lora-2",
              fileName: "flat_color.safetensors",
              filePath: "flat_color/flat_color.safetensors",
              weight: 0.5,
              enabled: true,
              kind: "manual" as const,
              triggerWords: "flat color",
            },
          ]}
          onAdd={() => {}}
          onWeight={() => {}}
          onToggle={() => {}}
          onPath={() => {}}
          onUnlink={() => {}}
          onDelete={() => {}}
        />
      </ShowcaseItem>

      {/* 5.8 HistoryDiffRow */}
      <ShowcaseItem name="HistoryDiffRow" desc="变更记录 diff 行">
        <HistoryDiffRow
          change={{
            id: "diff-1",
            timestamp: "2026-05-09 10:30",
            dimension: "ksampler1",
            title: "修改采样参数",
            before: "steps=20, cfg=7",
            after: "steps=30, cfg=8",
            diff: [
              { field: "steps", before: "20", after: "30" },
              { field: "cfg", before: "7", after: "8" },
            ],
          }}
        />
        <hr className={s.showcaseDivider} />
        <HistoryDiffRow
          change={{
            id: "diff-2",
            timestamp: "2026-05-09 11:15",
            dimension: "lora1",
            title: "替换 LoRA",
            before: "add_detail.safetensors (0.8)",
            after: "realistic_skin.safetensors (0.6)",
          }}
        />
      </ShowcaseItem>
    </div>
  );
}
