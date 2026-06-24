import type { DemoData, DemoImage, DemoProject, DemoSection } from "../../../data";
import { demoHref } from "../../../routing";
import type { LoraRowData, PresetBinding, PromptBlockRowData } from "./editor-parts";

const CHECKPOINT_OPTIONS_FALLBACK = [
  "waiIllustriousSDXL_v170.safetensors",
  "realisticVision_v60B1.safetensors",
  "dreamshaper_8.safetensors",
  "animagineXL_v30.safetensors",
];

const LORA_FILE_OPTIONS_FALLBACK = [
  "characters/danya_v2.safetensors",
  "characters/lina_v1.safetensors",
  "styles/anime_base_v3.safetensors",
  "styles/watercolor_v1.safetensors",
  "enhance/detailer_v1.safetensors",
  "enhance/skin_v2.safetensors",
  "concept/bow_tie.safetensors",
];

export function getCheckpointOptions(data: DemoData): string[] {
  const fromData = data.models
    .filter(m => m.modelType === 'checkpoint')
    .map(m => m.fileName || m.name)
    .filter(Boolean);
  return fromData.length > 0 ? fromData : CHECKPOINT_OPTIONS_FALLBACK;
}

export function getLoraFileOptions(data: DemoData): string[] {
  const fromData = data.loras
    .map(m => m.relativePath || m.fileName || m.name)
    .filter(Boolean);
  return fromData.length > 0 ? fromData : LORA_FILE_OPTIONS_FALLBACK;
}

// Keep the old exports for backward compatibility
export const CHECKPOINT_OPTIONS = CHECKPOINT_OPTIONS_FALLBACK;
export const LORA_FILE_OPTIONS = LORA_FILE_OPTIONS_FALLBACK;

export function mockVariants() {
  return [
    { id: "v-default", name: "默认" },
    { id: "v-soft", name: "柔和光线" },
    { id: "v-film", name: "电影感" },
  ];
}

export function buildBindings(section: DemoSection, project: DemoProject): PresetBinding[] {
  const list: PresetBinding[] = [];
  if (section.presetBindings && section.presetBindings.length > 0) {
    for (const b of section.presetBindings) {
      if (b.kind === "group") {
        const members = Array.from({ length: 2 }).map((_, i) => ({
          id: `${b.id}-m${i}`,
          presetName: `${b.name} #${i + 1}`,
          variantId: "v-default",
          variantName: mockVariants()[0]?.name,
          variants: mockVariants(),
          detailHref: demoHref(`/presets/${b.id}-m${i}`),
        }));

        members.forEach((member, i) => {
          list.push({
            ...b,
            id: member.id,
            kind: "group",
            scope: "section",
            name: member.presetName,
            variantId: member.variantId,
            variantName: member.variantName,
            blockCount: Math.max(1, Math.ceil(b.blockCount / members.length)),
            loraCount: i === 0 ? b.loraCount : 0,
            variants: member.variants,
            members: undefined,
            detailHref: member.detailHref,
          });
        });
        continue;
      }

      list.push({
        ...b,
        scope: "section",
        variants: mockVariants(),
        detailHref: demoHref(`/presets/${b.id}`),
      });
    }
  }
  // project-level bindings (always visible so user knows they exist)
  if (project.presetNames && project.presetNames.length > 0) {
    project.presetNames.slice(0, 2).forEach((name, i) => {
      list.unshift({
        id: `project-${i}`,
        kind: "preset",
        scope: "project",
        categoryId: `cat-${i}`,
        categoryName: name,
        categoryColor: i === 0 ? "200 70% 55%" : "330 60% 60%",
        name: `${name} · 项目默认`,
        variantId: "v-default",
        variantName: "默认",
        blockCount: 1,
        loraCount: 1,
        variants: mockVariants(),
        detailHref: demoHref(`/projects/${project.id}`),
      });
    });
  }
  return list;
}

export function initialPromptBlocks(): PromptBlockRowData[] {
  return [
    {
      id: "block-1",
      label: "达妮娅",
      categoryName: "角色",
      categoryColor: "158 100% 43%",
      presetName: "达妮娅",
      variantName: "默认",
      positive: "1girl, danya, solo, pink hair, blue eyes",
      negative: "",
      kind: "preset",
    },
    {
      id: "block-2",
      label: "室内",
      categoryName: "场景",
      categoryColor: "280 65% 60%",
      presetName: "室内灯光组",
      variantName: "暖色调",
      positive: "indoors, warm lighting, soft shadows, window light",
      negative: "outdoors, harsh light",
      kind: "preset",
    },
    {
      id: "block-3",
      label: "embedding lazy",
      categoryName: "基础",
      categoryColor: "220 10% 60%",
      positive: "embedding:lazypos",
      negative: "embedding:lazyneg, embedding:lazyhand",
      kind: "manual",
    },
    {
      id: "block-4",
      label: "细节增强",
      categoryName: "风格",
      categoryColor: "200 70% 50%",
      presetName: "电影感风格",
      variantName: "默认",
      positive: "cinematic, refined detail, depth of field",
      negative: "low quality, blurry",
      kind: "preset",
    },
  ];
}

export const initialLora1: LoraRowData[] = [
  {
    id: "lora1-1",
    presetName: "达妮娅",
    variantName: "默认",
    categoryName: "角色",
    categoryColor: "158 100% 43%",
    fileName: "danya_v2.safetensors",
    filePath: "characters/danya_v2.safetensors",
    weight: 0.8,
    enabled: true,
    triggerWords: "danya, pink hair, twintails",
    kind: "preset",
  },
  {
    id: "lora1-2",
    presetName: "动漫底色",
    variantName: "默认",
    categoryName: "风格",
    categoryColor: "280 65% 60%",
    fileName: "anime_base_v3.safetensors",
    filePath: "styles/anime_base_v3.safetensors",
    weight: 0.6,
    enabled: true,
    kind: "preset",
  },
];

export const initialLora2: LoraRowData[] = [
  {
    id: "lora2-1",
    fileName: "detailer_v1.safetensors",
    filePath: "enhance/detailer_v1.safetensors",
    notes: "用于放大后提亮细节",
    weight: 0.5,
    enabled: true,
    kind: "manual",
  },
];

export function groupImagesByRun(images: DemoImage[], latestRunIndex: number | undefined) {
  if (images.length === 0) return [];
  const base = latestRunIndex ?? 12;
  const groupSize = 4;
  const groups: Array<{
    runIndex: number;
    timestamp: string;
    images: DemoImage[];
  }> = [];
  for (let i = 0; i < images.length; i += groupSize) {
    const slice = images.slice(i, i + groupSize);
    groups.push({
      runIndex: base - Math.floor(i / groupSize),
      timestamp: `2 小时前${i === 0 ? " · 最新" : ""}`,
      images: slice,
    });
  }
  return groups;
}
