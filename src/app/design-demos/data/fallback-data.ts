import type { DemoData, DemoProject, DemoProjectFolder, DemoRun, DemoSection } from "./types";
import { fallbackImages } from "./fallback-images";
import { modelAssetsFromEnv } from "./model-assets";
import { shortDate } from "./row-shaping";
import { sourceSummary } from "./source-summary";

export function fallbackData(warning: string | null): DemoData {
  const images = fallbackImages();
  const demoImages = images.length
    ? images
    : Array.from({ length: 12 }, (_, index) => ({
        id: `placeholder-${index}`,
        src: "",
        full: "",
        label: String(index + 1).padStart(2, "0"),
        status: "pending" as const,
        featured: index === 0,
        featured2: false,
        cover: index === 0,
        width: null,
        height: null,
      }));

  const sections: DemoSection[] = ["角色草图", "场景光影", "最终组选"].map((name, index) => ({
    id: `section-${index + 1}`,
    name,
    sortOrder: index,
    enabled: true,
    aspectRatio: index === 1 ? "16:9" : "2:3",
    batchSize: index === 2 ? 4 : 2,
    shortSidePx: 768,
    seedPolicy1: "random",
    seedPolicy2: "reuse",
    positivePrompt: "cinematic portrait, soft lighting, refined detail",
    negativePrompt: "low quality, blurry, extra fingers",
    checkpointName: "default-checkpoint.safetensors",
    projectCheckpointName: "default-checkpoint.safetensors",
    upscaleFactor: 2,
    ksampler1: {
      steps: 28,
      cfg: 7,
      sampler_name: "euler_ancestral",
      scheduler: "normal",
    },
    ksampler2: {
      steps: 18,
      cfg: 5.5,
      sampler_name: "dpmpp_2m_sde",
      scheduler: "karras",
    },
    promptBlockCount: 4 + index,
    loraCount: 2,
    images: demoImages.slice(index * 4, index * 4 + 6),
    latestRunIndex: 12 + index,
    presetBindings: [
      {
        id: `binding-${index}-1`,
        kind: "preset",
        categoryId: "category-character",
        categoryName: "角色",
        categoryColor: "158 100% 43%",
        name: index === 0 ? "达妮娅" : index === 1 ? "莉娜" : "塞西尔",
        variantId: `variant-${index}-default`,
        variantName: "默认",
        blockCount: 2,
        loraCount: 1,
      },
      {
        id: `binding-${index}-2`,
        kind: "group",
        categoryId: "category-scene",
        categoryName: "场景",
        categoryColor: "280 65% 60%",
        name: index === 1 ? "户外光线组" : "室内灯光组",
        blockCount: 2,
        loraCount: 1,
      },
    ],
    changeHistory: [
      {
        id: `change-${index}-1`,
        timestamp: shortDate(new Date(Date.now() - 3600000).toISOString()),
        dimension: "params",
        title: "更新运行参数",
        before: JSON.stringify({ batchSize: 2, upscaleFactor: 1.5 }),
        after: JSON.stringify({ batchSize: index === 2 ? 4 : 2, upscaleFactor: 2 }),
        diff: [
          { field: "batchSize", before: "2", after: String(index === 2 ? 4 : 2) },
          { field: "upscaleFactor", before: "1.5", after: "2" },
        ],
      },
      {
        id: `change-${index}-2`,
        timestamp: shortDate(new Date(Date.now() - 7200000).toISOString()),
        dimension: "lora",
        title: "更新 LoRA 配置",
        before: JSON.stringify({ lora1: [], lora2: [] }),
        after: JSON.stringify({ lora1: [{ path: "character.safetensors", weight: 0.8 }], lora2: [] }),
        diff: [
          { field: "lora1[0].path", before: "—", after: "character.safetensors" },
          { field: "lora1[0].weight", before: "—", after: "0.8" },
        ],
      },
      {
        id: `change-${index}-3`,
        timestamp: shortDate(new Date(Date.now() - 10800000).toISOString()),
        dimension: "prompt",
        title: "调整正向提示词",
        before: JSON.stringify({ positive: "cinematic portrait" }),
        after: JSON.stringify({ positive: "cinematic portrait, soft lighting, refined detail" }),
        diff: [
          {
            field: "block[0].positive",
            before: "cinematic portrait",
            after: "cinematic portrait, soft lighting, refined detail",
          },
        ],
      },
    ],
  }));

  const envAssets = modelAssetsFromEnv();
  const projects: DemoProject[] = [
    {
      id: "project-demo",
      title: "示例图像项目",
      slug: "sample-project",
      folderId: "project-folder-active",
      status: "active",
      updatedAt: shortDate(new Date().toISOString()),
      notes: "默认项目会在本地数据不可用时展示基础工作流。",
      checkpointName: "default-checkpoint.safetensors",
      presetNames: ["角色", "场景", "风格"],
      sectionCount: sections.length,
      sections,
      images: demoImages.slice(0, 8),
    },
    {
      id: "project-archive",
      title: "归档风格探索",
      slug: "archive-style-study",
      folderId: "project-folder-archive",
      status: "draft",
      updatedAt: shortDate(new Date(Date.now() - 86400000).toISOString()),
      notes: "用于展示文件夹内项目和根目录项目的混排状态。",
      checkpointName: "style-checkpoint.safetensors",
      presetNames: ["风格", "场景"],
      sectionCount: sections.length,
      sections,
      images: demoImages.slice(2, 10),
    },
  ];

  const projectFolders: DemoProjectFolder[] = [
    {
      id: "project-folder-active",
      name: "正在制作",
      parentId: null,
      sortOrder: 0,
      projectCount: projects.filter((project) => project.folderId === "project-folder-active").length,
      childCount: 1,
    },
    {
      id: "project-folder-archive",
      name: "归档",
      parentId: null,
      sortOrder: 1,
      projectCount: projects.filter((project) => project.folderId === "project-folder-archive").length,
      childCount: 0,
    },
    {
      id: "project-folder-active-client",
      name: "客户 A",
      parentId: "project-folder-active",
      sortOrder: 0,
      projectCount: 0,
      childCount: 0,
    },
  ];

  const runs: DemoRun[] = [
    {
      id: "run-demo",
      projectId: projects[0].id,
      sectionId: sections[0].id,
      projectTitle: projects[0].title,
      sectionName: sections[0].name,
      status: "done",
      runIndex: 1,
      createdAt: projects[0].updatedAt,
      startedAt: null,
      finishedAt: projects[0].updatedAt,
      errorMessage: null,
      imageCount: demoImages.length,
      pendingCount: demoImages.filter((image) => image.status === "pending").length,
      executionMeta: {
        ks1Seed: 304179226,
        ks1Steps: 24,
        ks1Cfg: 6.5,
        ks1Sampler: "euler_ancestral",
        ks1Denoise: 1,
        ks2Seed: 918204733,
        ks2Steps: 18,
        ks2Cfg: 5.5,
        ks2Sampler: "dpmpp_2m_sde",
        ks2Denoise: 0.35,
        aspectRatio: sections[0].aspectRatio,
        shortSidePx: sections[0].shortSidePx,
        batchSize: sections[0].batchSize,
        upscaleFactor: 2,
        checkpointName: sections[0].checkpointName,
        workflowId: projects[0].slug,
        lora1: [{ path: "characters/default-character.safetensors", weight: 0.75, enabled: true }],
        lora2: [{ path: "detail/refiner.safetensors", weight: 0.45, enabled: true }],
        positivePrompt: sections[0].positivePrompt,
        negativePrompt: sections[0].negativePrompt,
      },
      images: demoImages,
    },
  ];

  return {
    source: sourceSummary(false, "未加载 SQLite", warning),
    metrics: {
      projects: projects.length,
      sections: sections.length,
      runs: runs.length,
      pendingImages: runs[0].pendingCount,
      presets: 4,
      templates: 1,
      loras: envAssets.filter((asset) => asset.modelType === "lora").length,
    },
    projectFolders,
    projects,
    runs,
    categories: [
      {
        id: "category-demo",
        name: "角色",
        slug: "character",
        type: "preset",
        color: "#34d399",
        presetCount: 2,
        groupCount: 1,
        folders: [
          { id: "folder-demo-root-a", categoryId: "category-demo", name: "角色核心", parentId: null, sortOrder: 0 },
          { id: "folder-demo-root-b", categoryId: "category-demo", name: "风格补充", parentId: null, sortOrder: 1 },
        ],
        presets: [
          {
            id: "preset-demo",
            categoryId: "category-demo",
            folderId: "folder-demo-root-a",
            name: "默认角色",
            slug: "default-character",
            notes: "Fallback preset",
            variantCount: 2,
            variants: [
              {
                id: "variant-demo-a",
                name: "柔和",
                slug: "soft",
                prompt: "soft light, warm expression",
                negativePrompt: "low quality",
              },
              {
                id: "variant-demo-b",
                name: "电影感",
                slug: "cinematic",
                prompt: "cinematic light, deep focus",
                negativePrompt: "flat color",
              },
            ],
          },
        ],
        groups: [
          {
            id: "group-demo",
            categoryId: "category-demo",
            folderId: null,
            name: "角色组合",
            slug: "character-group",
            memberCount: 2,
            members: ["默认角色 / 柔和", "默认角色 / 电影感"],
          },
        ],
      },
    ],
    templates: [
      {
        id: "template-demo",
        name: "三段式出图模板",
        description: "角色、场景、精修三段流程。",
        sectionCount: sections.length,
        updatedAt: projects[0].updatedAt,
        sections: sections.map((section) => ({
          id: section.id,
          name: section.name,
          sortOrder: section.sortOrder,
          aspectRatio: section.aspectRatio,
          batchSize: section.batchSize,
          notes: section.positivePrompt,
        })),
      },
    ],
    loras: envAssets.filter((asset) => asset.modelType === "lora"),
    models: envAssets,
    auditLogs: [],
    images: demoImages,
  };
}
