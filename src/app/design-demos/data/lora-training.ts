import type { DemoData, DemoImage } from "./types";
import type {
  LoraTrainingDatasetRevision,
  LoraTrainingDatasetSample,
  LoraTrainingDemoData,
  LoraTrainingImageResult,
  LoraTrainingPreset,
  LoraTrainingProject,
  LoraTrainingReferenceImage,
  LoraTrainingRun,
  LoraTrainingSection,
  LoraTrainingTemplate,
} from "./lora-training-types";

function imagePool(data: DemoData) {
  const fromImages = data.images.length ? data.images : data.projects.flatMap((project) => project.images);
  return fromImages.length ? fromImages : data.projects.flatMap((project) => project.sections.flatMap((section) => section.images));
}

function pickImages(images: DemoImage[], start: number, count: number) {
  if (images.length === 0) return [];
  return Array.from({ length: count }, (_, index) => images[(start + index) % images.length]);
}

function buildSections(images: DemoImage[], start: number): LoraTrainingSection[] {
  return [
    {
      id: "stage-light",
      title: "舞台灯光",
      enabled: true,
      updatedAt: "16:12",
      blocks: [
        {
          id: "stage-preset",
          source: "预制",
          title: "青色轮廓光",
          text: "冷色舞台灯光，侧后方有清晰青色轮廓光，背景暗部保留少量霓虹反射。",
        },
        {
          id: "stage-local",
          source: "本地",
          title: "服装细节",
          text: "蓝黑色机能外套，面料有轻微反光，角色肩颈和袖口细节清楚。",
        },
      ],
      resolvedScene: "冷色舞台灯光，青色轮廓光，蓝黑色机能外套，半身构图，背景保留霓虹反射。",
      imagePrompt: "1girl, cyan rim light, black and blue techwear jacket, clean face, half body portrait",
      images: pickImages(images, start, 5),
      resultStatus: "kept",
    },
    {
      id: "street-night",
      title: "街角夜景",
      enabled: true,
      updatedAt: "15:46",
      blocks: [
        {
          id: "street-preset",
          source: "预制",
          title: "雨后街角",
          text: "雨后街角，地面有霓虹反射，背景轻微虚化但仍可辨认街道层次。",
        },
      ],
      resolvedScene: "雨后街角夜景，霓虹反射，角色站在街灯旁，保持正面可训练角度。",
      imagePrompt: "rainy neon street, standing pose, wet pavement reflection, clean character details",
      images: pickImages(images, start + 5, 5),
      resultStatus: "pending",
    },
    {
      id: "studio-white",
      title: "白底棚拍",
      enabled: true,
      updatedAt: "15:30",
      blocks: [
        {
          id: "studio-local",
          source: "本地",
          title: "训练净图",
          text: "白底棚拍，少量柔光，移除复杂背景，优先保证角色全身服装和发型稳定。",
        },
      ],
      resolvedScene: "白底棚拍，柔光，全身或半身干净构图，用于数据集稳定样本。",
      imagePrompt: "white studio background, soft lighting, full outfit, stable identity, clean training image",
      images: pickImages(images, start + 10, 5),
      resultStatus: "kept",
    },
  ];
}

function resultStatusFromIndex(index: number) {
  if (index % 7 === 0) return "rejected";
  if (index % 3 === 0) return "pending";
  return "kept";
}

function demoStatusFromReview(status: "pending" | "kept" | "rejected") {
  return status === "rejected" ? "trashed" : status;
}

function buildReferenceImages(images: DemoImage[], start: number, prefix: string): LoraTrainingReferenceImage[] {
  const picked = pickImages(images, start, 3);
  const kinds: LoraTrainingReferenceImage["kind"][] = ["original", "generated", "auxiliary"];
  const labels = ["主参考图", "生成参考图", "补充参考图"];
  const notes = [
    "确认角色身份、发型和默认服装，不锁定构图。",
    "来自训练集生成任务，用于补充光线和服装边缘细节。",
    "辅助说明材质、袖口标签和背面轮廓。",
  ];

  return picked.map((image, index) => ({
    id: `${prefix}-reference-${index + 1}`,
    kind: kinds[index] ?? "auxiliary",
    label: labels[index] ?? "参考图",
    note: notes[index] ?? "自由参考图，可编辑 label 和 note。",
    image,
  }));
}

function buildImageResults(images: DemoImage[], start: number, prefix: string): LoraTrainingImageResult[] {
  const picked = pickImages(images, start, 12);
  const sections = [
    { id: "stage-light", title: "舞台灯光", scene: "stage portrait, cyan rim light, glossy teal cropped jacket" },
    { id: "street-night", title: "街角夜景", scene: "night street, wet pavement, teal jacket reflection" },
    { id: "studio-white", title: "白底棚拍", scene: "clean studio portrait, opaque background, no text, no watermark" },
  ];

  return picked.map((image, index) => {
    const section = sections[index % sections.length];
    const reviewStatus = resultStatusFromIndex(index);
    return {
      id: `${prefix}-result-${index + 1}`,
      sectionId: section.id,
      sectionTitle: section.title,
      image: { ...image, status: demoStatusFromReview(reviewStatus) },
      reviewStatus,
      caption: `${prefix.replaceAll("-", "_")}, ${section.scene}, clean silhouette, 训练样本说明 ${String(index + 1).padStart(3, "0")}`,
      sourceLabel: `${section.title} · run ${String(index + 1).padStart(2, "0")}`,
    };
  });
}

function buildRevisionItems(images: DemoImage[], start: number, prefix: string): LoraTrainingDatasetRevision["samples"] {
  return buildImageResults(images, start, prefix)
    .filter((result) => result.reviewStatus === "kept")
    .slice(0, 6)
    .map((result, index) => ({
      id: `${prefix}-revision-item-${index + 1}`,
      label: String(index + 1).padStart(3, "0"),
      sectionTitle: result.sectionTitle,
      image: result.image,
      captionSnapshot: result.caption,
      filePathSnapshot: `datasets/${prefix}/${String(index + 1).padStart(3, "0")}.png`,
    }));
}

function buildDatasetRevisions(
  latest: string,
  itemCount: number,
  captionMissingCount: number,
  images: DemoImage[],
  start: number,
  prefix: string,
  relatedTrainingRunIds: string[] = [],
): LoraTrainingDatasetRevision[] {
  const currentSamples = buildRevisionItems(images, start, `${prefix}-${latest}`);
  const previousSamples = buildRevisionItems(images, start + 6, `${prefix}-v4`);
  return [
    {
      id: `${latest}-current`,
      version: latest,
      status: captionMissingCount > 0 ? "draft" : "ready",
      createdAt: "16:08",
      itemCount,
      captionMissingCount,
      manifestName: `dataset_${latest}.jsonl`,
      samples: currentSamples,
      manifestRows: currentSamples.slice(0, 4).map((sample) => `${sample.filePathSnapshot} | ${sample.captionSnapshot}`),
      relatedTrainingRunIds,
    },
    {
      id: `${latest}-previous`,
      version: "v4",
      status: "ready",
      createdAt: "昨天",
      itemCount: Math.max(itemCount - 6, 12),
      captionMissingCount: 0,
      manifestName: "dataset_v4.jsonl",
      samples: previousSamples,
      manifestRows: previousSamples.slice(0, 4).map((sample) => `${sample.filePathSnapshot} | ${sample.captionSnapshot}`),
      relatedTrainingRunIds: [],
    },
  ];
}

function buildDatasetSamples(images: DemoImage[], start: number, prefix: string): LoraTrainingDatasetSample[] {
  const picked = pickImages(images, start, 4);
  const captions = [
    {
      sectionTitle: "舞台灯光",
      text: "vela_neon_jacket, stage portrait, cyan rim light, glossy teal cropped jacket, front-facing pose, clean silhouette",
    },
    {
      sectionTitle: "街角夜景",
      text: "vela_neon_jacket, night street, wet pavement, teal jacket reflection, cool rim light, fashion editorial portrait",
    },
    {
      sectionTitle: "白底棚拍",
      text: "vela_neon_jacket, clean studio portrait, opaque background, cool blue eyes, no text, no watermark",
    },
    {
      sectionTitle: "服装补充",
      text: "vela_neon_jacket, side view, blue black techwear sleeve tag, sharp hair silhouette, simple background",
    },
  ];

  return picked.map((image, index) => ({
    id: `${prefix}-sample-${index + 1}`,
    label: String(index + 1).padStart(3, "0"),
    sectionTitle: captions[index]?.sectionTitle ?? "训练样本",
    image,
    caption: captions[index]?.text ?? `${prefix}, 训练样本说明`,
    status: index === 3 ? "pending" : "kept",
  }));
}

const defaultTrainingConfig = [
  { label: "基础模型", value: "sd_xl_base_1.0.safetensors", detail: "SDXL" },
  { label: "网络参数", value: "rank 16 / alpha 16", detail: "LoRA 维度" },
  { label: "训练步数", value: "2400", detail: "批量 2 · 重复 10" },
  { label: "学习率", value: "1e-4", detail: "余弦调度" },
  { label: "分辨率", value: "1024", detail: "启用分桶" },
  { label: "执行方式", value: "本地训练", detail: "本地调度器" },
];

export function buildLoraTrainingDemoData(data: DemoData): LoraTrainingDemoData {
  if (data.loraTraining) {
    return data.loraTraining;
  }

  const images = imagePool(data);

  const projects: LoraTrainingProject[] = [
    {
      id: "vela-neon",
      title: "Vela Neon Jacket",
      status: "ready",
      updatedAt: "16:28",
      sectionCount: 6,
      imageCount: 42,
      datasetVersion: "v5",
      recentTraining: "已完成 · vela_neon_v05.safetensors",
      profileSummary: "蓝黑机能外套、冷色轮廓光、黑发高马尾，训练目标是稳定角色身份和服装。",
      usagePrompt: "vela neon jacket, blue black techwear jacket, cyan rim light",
      detailPrompt: "黑发高马尾，冷调蓝眼，蓝黑色机能夹克，袖口有细小标签，整体是霓虹舞台感。",
      readiness: "完整",
      keptCount: 42,
      captionMissingCount: 0,
      images: pickImages(images, 0, 8),
      referenceImages: buildReferenceImages(images, 0, "vela-neon"),
      resultPool: buildImageResults(images, 0, "vela-neon"),
      sections: buildSections(images, 0),
      datasetRevisions: buildDatasetRevisions("v5", 42, 0, images, 0, "vela-neon", ["train-vela-v5"]),
    },
    {
      id: "azure-idol",
      title: "Azure Idol",
      status: "training",
      updatedAt: "16:17",
      sectionCount: 5,
      imageCount: 33,
      datasetVersion: "v4",
      recentTraining: "进行中 · step 1280 / 2400",
      profileSummary: "舞台偶像风格，蓝白服装和发饰是主要训练对象。",
      usagePrompt: "azure idol outfit, blue white stage costume",
      detailPrompt: "短发偶像角色，蓝白色舞台服装，发饰带有透明材质，姿态偏轻盈。",
      readiness: "完整",
      keptCount: 33,
      captionMissingCount: 3,
      images: pickImages(images, 4, 7),
      referenceImages: buildReferenceImages(images, 4, "azure-idol"),
      resultPool: buildImageResults(images, 4, "azure-idol"),
      sections: buildSections(images, 4),
      datasetRevisions: buildDatasetRevisions("v4", 33, 3, images, 4, "azure-idol", ["train-azure-v4"]),
    },
    {
      id: "noir-runner",
      title: "Noir Runner",
      status: "draft",
      updatedAt: "15:58",
      sectionCount: 4,
      imageCount: 18,
      datasetVersion: "草稿",
      recentTraining: "待冻结数据集",
      profileSummary: "黑色跑者外套和雨夜城市氛围，资料还缺少正面参考。",
      usagePrompt: "noir runner coat, black rain jacket",
      detailPrompt: "黑色短外套，雨夜城市背景，角色轮廓清楚但参考图不足。",
      readiness: "待补",
      keptCount: 18,
      captionMissingCount: 8,
      images: pickImages(images, 8, 6),
      referenceImages: buildReferenceImages(images, 8, "noir-runner"),
      resultPool: buildImageResults(images, 8, "noir-runner"),
      sections: buildSections(images, 8),
      datasetRevisions: buildDatasetRevisions("草稿", 18, 8, images, 8, "noir-runner", ["train-noir-failed"]),
    },
    {
      id: "mika-soft",
      title: "Mika Soft Portrait",
      status: "ready",
      updatedAt: "14:36",
      sectionCount: 7,
      imageCount: 51,
      datasetVersion: "v3",
      recentTraining: "已完成 · mika_soft_v03.safetensors",
      profileSummary: "柔和肖像角色，重点是脸型、发色和针织服装质感。",
      usagePrompt: "mika soft portrait, cream knit cardigan",
      detailPrompt: "浅色短发，柔和表情，奶油色针织开衫，浅景深肖像。",
      readiness: "完整",
      keptCount: 51,
      captionMissingCount: 0,
      images: pickImages(images, 12, 8),
      referenceImages: buildReferenceImages(images, 12, "mika-soft"),
      resultPool: buildImageResults(images, 12, "mika-soft"),
      sections: buildSections(images, 12),
      datasetRevisions: buildDatasetRevisions("v3", 51, 0, images, 12, "mika-soft", ["train-mika-v3"]),
    },
    {
      id: "luna-editorial",
      title: "Luna Editorial",
      status: "archived",
      updatedAt: "昨天",
      sectionCount: 3,
      imageCount: 24,
      datasetVersion: "v2",
      recentTraining: "已归档 · luna_editorial_v02.safetensors",
      profileSummary: "银白短发、月白风衣和冷调杂志编辑风格。",
      usagePrompt: "luna editorial, moon white coat, silver short hair",
      detailPrompt: "银白短发，冷调蓝眼，黑色高领与月白色风衣，整体克制清冷。",
      readiness: "完整",
      keptCount: 24,
      captionMissingCount: 0,
      images: pickImages(images, 16, 6),
      referenceImages: buildReferenceImages(images, 16, "luna-editorial"),
      resultPool: buildImageResults(images, 16, "luna-editorial"),
      sections: buildSections(images, 16),
      datasetRevisions: buildDatasetRevisions("v2", 24, 0, images, 16, "luna-editorial"),
    },
  ];

  const runs: LoraTrainingRun[] = [
    {
      id: "gen-vela-dataset",
      kind: "generation",
      status: "completed",
      projectId: "vela-neon",
      sectionId: "stage-light",
      projectTitle: "Vela Neon Jacket",
      title: "训练集图片生成",
      summary: "图片 · 小节 舞台灯光",
      timestamp: "完成于 15:20",
      outputLabel: "输出 1 张图片",
      inputImages: pickImages(images, 0, 2),
      outputResultIds: ["vela-neon-result-1"],
      provider: "gpt-image-2",
      finalInput: "项目 Vela Neon Jacket，引用角色资料和小节「舞台灯光」，生成 1 张干净可训练图片。",
      outputText: "已生成舞台灯光半身样本，已进入结果池待审。",
    },
    {
      id: "gen-luna-profile",
      kind: "generation",
      status: "completed",
      projectId: "luna-editorial",
      sectionId: "stage-light",
      projectTitle: "Luna Editorial",
      title: "角色描述生成",
      summary: "文本 · 来自角色档案",
      timestamp: "完成于 14:47",
      outputLabel: "已写入角色资料",
      provider: "Qwen2.5-VL",
      finalInput: "根据 Luna Editorial 的参考图生成一段可写入角色资料的外观描述。",
      outputText: "银白短发、冷调蓝眼，穿着黑色高领与月白色风衣，整体是克制、清冷的杂志编辑风。",
    },
    {
      id: "gen-vela-night",
      kind: "generation",
      status: "running",
      projectId: "vela-neon",
      sectionId: "night-corner",
      projectTitle: "Vela Neon Jacket",
      title: "街角夜景图片生成",
      summary: "图片 · gpt-image-2",
      timestamp: "开始于 15:42",
      progress: 48,
      provider: "gpt-image-2",
      inputImages: pickImages(images, 1, 2),
      finalInput: "雨后街角夜景，霓虹反射，角色站在街灯旁，保持正面可训练角度。",
    },
    {
      id: "gen-mika-detail",
      kind: "generation",
      status: "running",
      projectId: "mika-soft",
      sectionId: "portrait-soft",
      projectTitle: "Mika Soft Portrait",
      title: "角色细节补全",
      summary: "文本 · Qwen2.5-VL",
      timestamp: "开始于 15:38",
      progress: 36,
      provider: "Qwen2.5-VL",
      finalInput: "补全 Mika Soft Portrait 的服装、发型和表情描述，用于后续小节生成。",
    },
    {
      id: "gen-nova-queued",
      kind: "generation",
      status: "queued",
      projectId: "noir-runner",
      sectionId: "night-corner",
      projectTitle: "Noir Runner",
      title: "雨夜背光图片生成",
      summary: "图片 · gpt-image-2",
      timestamp: "创建于 15:44",
      provider: "gpt-image-2",
      waitReason: "等待当前生成任务完成",
      inputImages: pickImages(images, 8, 1),
      finalInput: "雨夜背光、黑色跑者外套、干净角色轮廓。",
    },
    {
      id: "gen-vela-queued",
      kind: "generation",
      status: "queued",
      projectId: "vela-neon",
      sectionId: "clean-studio",
      projectTitle: "Vela Neon Jacket",
      title: "白底棚拍图片生成",
      summary: "图片 · gpt-image-2",
      timestamp: "创建于 15:45",
      provider: "gpt-image-2",
      waitReason: "生成队列排队中",
      inputImages: pickImages(images, 0, 1),
      finalInput: "白底棚拍、柔光、角色服装细节清楚。",
    },
    {
      id: "gen-azure-failed",
      kind: "generation",
      status: "failed",
      projectId: "azure-idol",
      sectionId: "portrait-soft",
      projectTitle: "Azure Idol",
      title: "发饰参考图生成",
      summary: "图片 · gpt-image-2",
      timestamp: "失败于 13:12",
      errorMessage: "远端生成服务返回空输出，可以重试或调整引用图。",
      provider: "gpt-image-2",
      inputImages: pickImages(images, 4, 1),
      finalInput: "根据 Azure Idol 的发饰参考生成局部细节图。",
    },
    {
      id: "train-vela-v5",
      kind: "training",
      status: "completed",
      projectId: "vela-neon",
      projectTitle: "Vela Neon Jacket",
      title: "LoRA 训练 v5",
      summary: "数据集 v5 · 42 张图片",
      timestamp: "完成于 16:05",
      outputLabel: "vela_neon_v05.safetensors",
      provider: "本地训练",
      datasetRevisionId: "v5-current",
      artifactName: "vela_neon_v05.safetensors",
      finalLoraArtifactId: "artifact-vela-neon-v05",
      finalInput: "数据集 v5，42 张已保留图片，LoRA rank 16，目标 2400 步。",
      schedulerMessage: "训练已完成，LoRA 文件、配置和日志均已保存。",
      trainingConfig: defaultTrainingConfig,
      trainingLogArtifactName: "training-run-20260610.log",
      trainingLogLines: [
        "[16:02] training started · dataset v5 · 42 images",
        "[16:18] step 1200 / 2400 · loss=0.108 · lr=0.00008",
        "[16:31] step 2400 / 2400 · loss=0.071 · 保存 LoRA 文件",
        "[16:35] saved artifact vela_neon_v05.safetensors · sha256 recorded",
      ],
      datasetSamples: buildDatasetSamples(images, 0, "vela-neon-v5"),
    },
    {
      id: "train-azure-v4",
      kind: "training",
      status: "running",
      projectId: "azure-idol",
      projectTitle: "Azure Idol",
      title: "LoRA 训练 v4",
      summary: "数据集 v4 · 42 张图片",
      timestamp: "开始于 16:17",
      progress: 53,
      provider: "本地训练",
      datasetRevisionId: "v4-current",
      finalInput: "数据集 v4，33 张已保留图片，LoRA rank 16，当前 1280 / 2400 步。",
      schedulerMessage: "训练已开始，正在持续写入日志。",
      trainingConfig: defaultTrainingConfig,
      trainingLogArtifactName: "training-run-azure-v4.log",
      trainingLogLines: [
        "[16:17] training started · dataset v4 · 33 images",
        "[16:33] step 1280 / 2400 · loss=0.094 · ETA 18m",
        "[16:34] saving sample preview checkpoint",
      ],
      datasetSamples: buildDatasetSamples(images, 4, "azure-v4"),
    },
    {
      id: "train-mika-v3",
      kind: "training",
      status: "queued",
      projectId: "mika-soft",
      projectTitle: "Mika Soft Portrait",
      title: "LoRA 训练 v3",
      summary: "数据集 v3 · 51 张图片",
      timestamp: "创建于 16:22",
      provider: "本地训练",
      datasetRevisionId: "v3-current",
      waitReason: "GPU 正在被 Azure Idol 训练占用",
      finalInput: "数据集 v3，51 张已保留图片，等待本地训练资源。",
      schedulerMessage: "当前本地 GPU 正在执行另一个训练任务，完成后自动开始。",
      trainingConfig: defaultTrainingConfig,
      trainingLogArtifactName: "尚未创建",
      trainingLogLines: [],
      datasetSamples: buildDatasetSamples(images, 12, "mika-v3"),
    },
    {
      id: "train-noir-failed",
      kind: "training",
      status: "failed",
      projectId: "noir-runner",
      projectTitle: "Noir Runner",
      title: "LoRA 训练草稿",
      summary: "数据集草稿 · 18 张图片",
      timestamp: "失败于 12:40",
      errorMessage: "训练脚本未找到冻结文件清单，请重新冻结数据集后再启动。",
      provider: "本地训练",
      datasetRevisionId: "草稿-current",
      finalInput: "数据集草稿，18 张已保留图片，文件清单缺失。",
      schedulerMessage: "训练已停止，需先补齐缺失说明文本并重新冻结数据集。",
      trainingConfig: defaultTrainingConfig,
      trainingLogArtifactName: "training-run-noir-failed.log",
      trainingLogLines: [
        "[15:34] training started · dataset draft · 18 images",
        "[15:52] 说明文本校验失败",
        "[15:55] stopped: 3 张图片缺少说明文本",
      ],
      datasetSamples: buildDatasetSamples(images, 8, "noir-draft"),
    },
  ];

  const presets: LoraTrainingPreset[] = [
    {
      id: "cyan-rim-light",
      title: "青色轮廓光",
      category: "光线",
      folder: "舞台",
      status: "active",
      updatedAt: "16:01",
      sceneDescriptionText: "冷色舞台灯光，侧后方有清晰青色轮廓光，背景暗部保留少量霓虹反射。",
      projectUsage: ["Vela Neon Jacket / 舞台灯光"],
      templateUsage: ["角色 LoRA 基础模板 / 舞台肖像"],
    },
    {
      id: "rainy-street",
      title: "雨后街角",
      category: "环境",
      folder: "城市",
      status: "active",
      updatedAt: "15:48",
      sceneDescriptionText: "雨后街角，地面有霓虹反射，背景轻微虚化但仍可辨认街道层次。",
      projectUsage: ["Vela Neon Jacket / 街角夜景", "Noir Runner / 雨夜背光"],
      templateUsage: ["街拍扩展模板 / 夜景"],
    },
    {
      id: "white-studio",
      title: "白底棚拍",
      category: "构图",
      folder: "训练净图",
      status: "active",
      updatedAt: "15:20",
      sceneDescriptionText: "白底棚拍，少量柔光，移除复杂背景，优先保证角色全身服装和发型稳定。",
      projectUsage: ["Vela Neon Jacket / 白底棚拍"],
      templateUsage: ["角色 LoRA 基础模板 / 净图"],
    },
    {
      id: "old-haze",
      title: "旧版薄雾",
      category: "环境",
      folder: "归档",
      status: "inactive",
      updatedAt: "上周",
      sceneDescriptionText: "低对比薄雾背景，旧版项目保留，不建议新项目继续使用。",
      projectUsage: [],
      templateUsage: [],
    },
  ];

  const templates: LoraTrainingTemplate[] = [
    {
      id: "character-lora-base",
      title: "角色 LoRA 基础模板",
      status: "active",
      updatedAt: "16:04",
      description: "用于新角色 LoRA 训练项目的默认模板，包含舞台、街景和白底净图。",
      sectionCount: 6,
      sections: [
        {
          id: "stage",
          title: "舞台肖像",
          enabled: true,
          blockCount: 2,
          scenePreview: "青色轮廓光 + 角色服装细节",
          resolvedScene: "冷色舞台灯光，青色轮廓光，角色服装细节清楚，背景保留少量霓虹反射。",
          blocks: [
            {
              id: "template-stage-rim",
              source: "预制",
              title: "青色轮廓光",
              text: "冷色舞台灯光，侧后方有清晰青色轮廓光，背景暗部保留少量霓虹反射。",
            },
            {
              id: "template-stage-outfit",
              source: "本地",
              title: "角色服装细节",
              text: "保留角色默认服装、袖口和肩颈细节，不引入复杂遮挡。",
            },
          ],
        },
        {
          id: "street",
          title: "街角夜景",
          enabled: true,
          blockCount: 3,
          scenePreview: "雨后街角 + 霓虹反射",
          resolvedScene: "雨后街角夜景，湿润地面带霓虹反射，角色站在街灯旁，构图保持可训练。",
          blocks: [
            {
              id: "template-street-rain",
              source: "预制",
              title: "雨后街角",
              text: "雨后街角，地面有霓虹反射，背景轻微虚化但仍可辨认街道层次。",
            },
            {
              id: "template-street-pose",
              source: "本地",
              title: "正面可训练角度",
              text: "角色保持正面或轻微侧身，脸部和服装主体不被遮挡。",
            },
            {
              id: "template-street-clean",
              source: "本地",
              title: "背景控制",
              text: "避免多人、文字招牌和大面积前景遮挡。",
            },
          ],
        },
        {
          id: "studio",
          title: "白底棚拍",
          enabled: true,
          blockCount: 1,
          scenePreview: "白底柔光训练净图",
          resolvedScene: "白底棚拍，柔光，全身或半身干净构图，用于数据集稳定样本。",
          blocks: [
            {
              id: "template-studio-clean",
              source: "预制",
              title: "训练净图",
              text: "白底棚拍，少量柔光，移除复杂背景，优先保证角色全身服装和发型稳定。",
            },
          ],
        },
      ],
    },
    {
      id: "portrait-soft",
      title: "柔和肖像模板",
      status: "active",
      updatedAt: "15:44",
      description: "偏轻量的人像模板，适合资料较完整的角色快速生成训练集。",
      sectionCount: 4,
      sections: [
        {
          id: "closeup",
          title: "半身特写",
          enabled: true,
          blockCount: 2,
          scenePreview: "柔光半身、脸部细节",
          resolvedScene: "柔光半身肖像，脸部细节清楚，背景简洁且不干扰角色身份。",
          blocks: [
            {
              id: "template-closeup-light",
              source: "预制",
              title: "柔光半身",
              text: "柔和主光，浅景深，半身构图，脸部和发型轮廓清楚。",
            },
            {
              id: "template-closeup-identity",
              source: "本地",
              title: "身份稳定",
              text: "优先保持角色五官、发型和默认配色稳定。",
            },
          ],
        },
        {
          id: "outfit",
          title: "服装补充",
          enabled: true,
          blockCount: 2,
          scenePreview: "全身服装和材质",
          resolvedScene: "全身服装补充，展示材质、袖口和轮廓，背景保持简单。",
          blocks: [
            {
              id: "template-outfit-full",
              source: "预制",
              title: "全身服装",
              text: "全身或七分身构图，服装轮廓完整，材质纹理清晰。",
            },
            {
              id: "template-outfit-material",
              source: "本地",
              title: "材质补充",
              text: "补充袖口、衣摆和配饰，避免复杂道具抢占主体。",
            },
          ],
        },
      ],
    },
  ];

  return { projects, runs, presets, templates };
}
