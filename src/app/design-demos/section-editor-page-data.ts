import type { DemoImage, DemoProject, DemoSection } from "./design-demo-data";
import { demoHref } from "./design-demo-utils";
import type { LoraRowData, PresetBinding, PromptBlockRowData } from "./section-editor-components";

export const CHECKPOINT_OPTIONS = [
  "oneObsession_v19Atypical.safetensors",
  "realisticVision_v60B1.safetensors",
  "dreamshaper_8.safetensors",
  "animagineXL_v30.safetensors",
];

export const LORA_FILE_OPTIONS = [
  "characters/danya_v2.safetensors",
  "characters/lina_v1.safetensors",
  "styles/anime_base_v3.safetensors",
  "styles/watercolor_v1.safetensors",
  "enhance/detailer_v1.safetensors",
  "enhance/skin_v2.safetensors",
  "concept/bow_tie.safetensors",
];

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
      list.push({
        ...b,
        scope: "section",
        variants: b.kind === "preset" ? mockVariants() : undefined,
        members:
          b.kind === "group"
            ? Array.from({ length: 2 }).map((_, i) => ({
                id: `${b.id}-m${i}`,
                presetName: i === 0 ? "主体预制" : "辅助预制",
                variantName: "默认",
                variants: mockVariants(),
                detailHref: demoHref(`/presets/${b.id}-m${i}`),
              }))
            : undefined,
        detailHref: b.kind === "preset" ? demoHref(`/presets/${b.id}`) : undefined,
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
