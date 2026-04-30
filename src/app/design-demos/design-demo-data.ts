import fs from "node:fs";
import path from "node:path";

import { toImageUrl } from "@/lib/image-url";

type SqlValue = string | number | bigint | boolean | null;
type SqlRow = Record<string, SqlValue>;

export type DemoImage = {
  id: string;
  src: string;
  full: string;
  label: string;
  status: "pending" | "kept" | "trashed";
  featured: boolean;
  featured2: boolean;
  width: number | null;
  height: number | null;
};

export type DemoSection = {
  id: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  aspectRatio: string;
  batchSize: number;
  shortSidePx: number;
  seedPolicy1: string;
  seedPolicy2: string;
  positivePrompt: string;
  negativePrompt: string;
  checkpointName: string;
  promptBlockCount: number;
  loraCount: number;
  images: DemoImage[];
};

export type DemoProject = {
  id: string;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
  notes: string;
  checkpointName: string;
  presetNames: string[];
  sectionCount: number;
  sections: DemoSection[];
  images: DemoImage[];
};

export type DemoRun = {
  id: string;
  projectId: string;
  sectionId: string;
  projectTitle: string;
  sectionName: string;
  status: string;
  runIndex: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  imageCount: number;
  pendingCount: number;
  images: DemoImage[];
};

export type DemoPresetVariant = {
  id: string;
  name: string;
  slug: string;
  prompt: string;
  negativePrompt: string;
};

export type DemoPreset = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  notes: string;
  variantCount: number;
  variants: DemoPresetVariant[];
};

export type DemoPresetGroup = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  memberCount: number;
  members: string[];
};

export type DemoCategory = {
  id: string;
  name: string;
  slug: string;
  type: string;
  color: string | null;
  presetCount: number;
  groupCount: number;
  presets: DemoPreset[];
  groups: DemoPresetGroup[];
};

export type DemoTemplate = {
  id: string;
  name: string;
  description: string;
  sectionCount: number;
  updatedAt: string;
  sections: Array<{
    id: string;
    name: string;
    sortOrder: number;
    aspectRatio: string;
    batchSize: number;
    notes: string;
  }>;
};

export type DemoAsset = {
  id: string;
  name: string;
  modelType: string;
  category: string;
  fileName: string;
  relativePath: string;
  sizeLabel: string;
  source: string;
  notes: string;
  triggerWords: string;
};

export type DemoAuditLog = {
  id: string;
  entityType: string;
  action: string;
  actorType: string;
  createdAt: string;
};

export type DemoData = {
  source: {
    loadedFromSqlite: boolean;
    databaseLabel: string;
    imageSourceLabel: string;
    modelBaseLabel: string;
    comfyApiLabel: string;
    warning: string | null;
  };
  metrics: {
    projects: number;
    sections: number;
    runs: number;
    pendingImages: number;
    presets: number;
    templates: number;
    loras: number;
  };
  projects: DemoProject[];
  runs: DemoRun[];
  categories: DemoCategory[];
  templates: DemoTemplate[];
  loras: DemoAsset[];
  models: DemoAsset[];
  auditLogs: DemoAuditLog[];
  images: DemoImage[];
};

function text(value: SqlValue | undefined, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function int(value: SqlValue | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: SqlValue | undefined) {
  return value === true || value === 1 || value === "1";
}

function shortDate(value: SqlValue | undefined) {
  const raw = text(value);
  if (!raw) return "未记录";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 16);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  const h = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

function parseJson<T>(value: SqlValue | undefined, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function formatSize(value: SqlValue | undefined) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "未知";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function resolveSqlitePath() {
  const rawUrl = process.env.DATABASE_URL?.trim() ?? "";
  const candidates: string[] = [];

  if (rawUrl.startsWith("file:")) {
    const rawPath = rawUrl.slice("file:".length);
    const normalized = rawPath.replace(/^\/([A-Za-z]:)/, "$1");
    if (path.isAbsolute(normalized)) {
      candidates.push(normalized);
    } else {
      candidates.push(path.resolve(process.cwd(), normalized));
      candidates.push(path.resolve(process.cwd(), "prisma", normalized));
    }
  }

  candidates.push(path.resolve(process.cwd(), "prisma", "data", "comfyui.db"));

  const found = candidates.find((candidate) => {
    try {
      return fs.existsSync(/* turbopackIgnore: true */ candidate);
    } catch {
      return false;
    }
  });

  return {
    path: found ?? null,
    label: found ? path.basename(found) : rawUrl ? "DATABASE_URL 非本地 SQLite" : "未配置 DATABASE_URL",
  };
}

function imageFromRow(row: SqlRow, index: number): DemoImage | null {
  const sourcePath = text(row.thumbPath) || text(row.filePath);
  const fullPath = text(row.filePath) || sourcePath;
  const src = toImageUrl(sourcePath);
  const full = toImageUrl(fullPath);
  if (!src || !full) return null;

  const status = text(row.reviewStatus, "pending");
  return {
    id: text(row.id, `image-${index}`),
    src,
    full,
    label: String(index + 1).padStart(2, "0"),
    status: status === "kept" || status === "trashed" ? status : "pending",
    featured: bool(row.featured),
    featured2: bool(row.featured2),
    width: row.width === null || row.width === undefined ? null : int(row.width),
    height: row.height === null || row.height === undefined ? null : int(row.height),
  };
}

function fallbackImages(): DemoImage[] {
  const imageRoot = path.resolve(process.cwd(), "data", "images");
  const files: string[] = [];

  function walk(dir: string) {
    if (files.length >= 24) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(/* turbopackIgnore: true */ dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= 24) break;
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(png|jpe?g|webp|gif)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(imageRoot);

  return files
    .map((file, index): DemoImage | null => {
      const relative = path.relative(path.resolve(process.cwd(), "data", "images"), file).replace(/\\/g, "/");
      const url = toImageUrl(relative);
      if (!url) return null;
      return {
        id: `local-image-${index}`,
        src: url,
        full: url,
        label: String(index + 1).padStart(2, "0"),
        status: "pending" as const,
        featured: index % 7 === 0,
        featured2: index % 11 === 0,
        width: null,
        height: null,
      };
    })
    .filter((image): image is DemoImage => Boolean(image));
}

function modelAssetsFromEnv(): DemoAsset[] {
  const baseDir = process.env.MODEL_BASE_DIR;
  if (!baseDir) return [];

  const roots = [
    { dir: path.join(baseDir, "checkpoints"), modelType: "checkpoint", category: "checkpoints" },
    { dir: path.join(baseDir, "loras"), modelType: "lora", category: "loras" },
  ];
  const assets: DemoAsset[] = [];

  function walk(root: string, current: string, modelType: string, category: string, depth: number) {
    if (assets.length >= 80 || depth > 3) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(/* turbopackIgnore: true */ current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (assets.length >= 80) break;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(root, fullPath, modelType, category, depth + 1);
      } else if (/\.(safetensors|ckpt|pt|pth)$/i.test(entry.name)) {
        let size: number | null = null;
        try {
          size = fs.statSync(/* turbopackIgnore: true */ fullPath).size;
        } catch {
          size = null;
        }
        assets.push({
          id: `${modelType}-${assets.length}`,
          name: path.basename(entry.name, path.extname(entry.name)),
          modelType,
          category,
          fileName: entry.name,
          relativePath: path.relative(root, fullPath).replace(/\\/g, "/"),
          sizeLabel: formatSize(size),
          source: "MODEL_BASE_DIR",
          notes: "",
          triggerWords: "",
        });
      }
    }
  }

  for (const root of roots) {
    walk(root.dir, root.dir, root.modelType, root.category, 0);
  }
  return assets;
}

function fallbackData(warning: string | null): DemoData {
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
    checkpointName: "mock-checkpoint.safetensors",
    promptBlockCount: 4 + index,
    loraCount: 2,
    images: demoImages.slice(index * 4, index * 4 + 6),
  }));

  const envAssets = modelAssetsFromEnv();
  const projects: DemoProject[] = [
    {
      id: "project-demo",
      title: "示例图像项目",
      slug: "demo-project",
      status: "active",
      updatedAt: shortDate(new Date().toISOString()),
      notes: "用于设计 demo 的默认项目。",
      checkpointName: "mock-checkpoint.safetensors",
      presetNames: ["角色", "场景", "风格"],
      sectionCount: sections.length,
      sections,
      images: demoImages.slice(0, 8),
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
        presets: [
          {
            id: "preset-demo",
            categoryId: "category-demo",
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

function sourceSummary(loadedFromSqlite: boolean, databaseLabel: string, warning: string | null) {
  const modelBase = process.env.MODEL_BASE_DIR ? path.basename(process.env.MODEL_BASE_DIR) : "未配置 MODEL_BASE_DIR";
  let comfyApiLabel = "未配置 COMFY_API_URL";
  try {
    const raw = process.env.COMFY_API_URL;
    comfyApiLabel = raw ? new URL(raw).host : comfyApiLabel;
  } catch {
    comfyApiLabel = "COMFY_API_URL 格式异常";
  }

  return {
    loadedFromSqlite,
    databaseLabel,
    imageSourceLabel: "ImageResult.filePath / data/images",
    modelBaseLabel: modelBase,
    comfyApiLabel,
    warning,
  };
}

function placeholders(length: number, images: DemoImage[]) {
  return Array.from({ length }, (_, index) => images[index % Math.max(images.length, 1)]).filter(Boolean);
}

function buildProjectImages(projects: DemoProject[], sections: DemoSection[], fallback: DemoImage[]) {
  for (const project of projects) {
    project.sections = sections.filter((section) => section.id.startsWith(`${project.id}:`));
    project.images = project.sections.flatMap((section) => section.images).slice(0, 8);
    if (project.images.length === 0) {
      project.images = placeholders(6, fallback);
    }
    project.sectionCount = project.sections.length || project.sectionCount;
  }
}

export async function loadDesignDemoData(): Promise<DemoData> {
  const sqlite = resolveSqlitePath();
  if (!sqlite.path) {
    return fallbackData("没有找到可读取的本地 SQLite 文件，已使用文件夹图片和静态样例。");
  }

  try {
    const { default: Database } = await import("better-sqlite3");
    const db = new Database(sqlite.path, { readonly: true, fileMustExist: true });

    const allImages = db
      .prepare(
        `select id, filePath, thumbPath, width, height, reviewStatus, featured, featured2
         from ImageResult
         where reviewStatus != 'trashed'
         order by datetime(createdAt) desc
         limit 80`,
      )
      .all()
      .map((row, index) => imageFromRow(row as SqlRow, index))
      .filter((image): image is DemoImage => Boolean(image));

    const fallback = allImages.length ? allImages : fallbackImages();

    const imageRows = db
      .prepare(
        `select
           i.id, i.filePath, i.thumbPath, i.width, i.height, i.reviewStatus, i.featured, i.featured2,
           r.id as runId, r.projectId, r.projectSectionId
         from ImageResult i
         join Run r on r.id = i.runId
         where i.reviewStatus != 'trashed'
         order by datetime(i.createdAt) desc
         limit 160`,
      )
      .all() as SqlRow[];

    const imagesByRun = new Map<string, DemoImage[]>();
    const imagesBySection = new Map<string, DemoImage[]>();
    for (const row of imageRows) {
      const image = imageFromRow(row, imagesByRun.size);
      if (!image) continue;
      const runId = text(row.runId);
      const sectionId = text(row.projectSectionId);
      if (runId) {
        if (!imagesByRun.has(runId)) imagesByRun.set(runId, []);
        imagesByRun.get(runId)!.push(image);
      }
      if (sectionId) {
        if (!imagesBySection.has(sectionId)) imagesBySection.set(sectionId, []);
        imagesBySection.get(sectionId)!.push(image);
      }
    }

    const presetRows = db
      .prepare(`select id, name from Preset order by sortOrder asc`)
      .all() as SqlRow[];
    const presetNameById = new Map(presetRows.map((row) => [text(row.id), text(row.name)]));

    const projects = (db
      .prepare(
        `select
           p.id, p.title, p.slug, p.status, p.updatedAt, p.notes, p.checkpointName, p.presetBindings,
           (select count(*) from ProjectSection s where s.projectId = p.id) as sectionCount
         from Project p
         order by datetime(p.updatedAt) desc
         limit 8`,
      )
      .all() as SqlRow[]).map((row) => {
      const bindings = parseJson<Array<{ presetId?: string }>>(row.presetBindings, []);
      const presetNames = bindings
        .map((binding) => (binding.presetId ? presetNameById.get(binding.presetId) : null))
        .filter((name): name is string => Boolean(name));
      return {
        id: text(row.id),
        title: text(row.title, "未命名项目"),
        slug: text(row.slug),
        status: text(row.status, "draft"),
        updatedAt: shortDate(row.updatedAt),
        notes: text(row.notes),
        checkpointName: text(row.checkpointName, "未指定 checkpoint"),
        presetNames,
        sectionCount: int(row.sectionCount),
        sections: [],
        images: [],
      } satisfies DemoProject;
    });

    const projectIds = projects.map((project) => project.id);
    const sectionRows = projectIds.length
      ? (db
          .prepare(
            `select
               id, projectId, name, sortOrder, enabled, aspectRatio, batchSize, shortSidePx,
               seedPolicy1, seedPolicy2, positivePrompt, negativePrompt, checkpointName, loraConfig,
               (select count(*) from PromptBlock b where b.projectSectionId = ProjectSection.id) as promptBlockCount
             from ProjectSection
             where projectId in (${projectIds.map(() => "?").join(",")})
             order by projectId asc, sortOrder asc`,
          )
          .all(...projectIds) as SqlRow[])
      : [];

    const sections: DemoSection[] = sectionRows.map((row): DemoSection => {
      const loraConfig = parseJson<{ lora1?: unknown[]; lora2?: unknown[] }>(row.loraConfig, {});
      const rawId = text(row.id);
      return {
        id: `${text(row.projectId)}:${rawId}`,
        name: text(row.name, `小节 ${int(row.sortOrder) + 1}`),
        sortOrder: int(row.sortOrder),
        enabled: bool(row.enabled),
        aspectRatio: text(row.aspectRatio, "2:3"),
        batchSize: int(row.batchSize, 2),
        shortSidePx: int(row.shortSidePx, 768),
        seedPolicy1: text(row.seedPolicy1, "random"),
        seedPolicy2: text(row.seedPolicy2, "reuse"),
        positivePrompt: text(row.positivePrompt, "由 Prompt Block 组合生成"),
        negativePrompt: text(row.negativePrompt, "low quality, bad anatomy"),
        checkpointName: text(row.checkpointName, "继承项目设置"),
        promptBlockCount: int(row.promptBlockCount),
        loraCount: (Array.isArray(loraConfig.lora1) ? loraConfig.lora1.length : 0) + (Array.isArray(loraConfig.lora2) ? loraConfig.lora2.length : 0),
        images: [],
      } satisfies DemoSection;
    });
    for (const section of sections) {
      const rawSectionId = section.id.split(":")[1];
      section.images = (imagesBySection.get(rawSectionId) ?? []).slice(0, 8);
      if (section.images.length === 0) {
        section.images = placeholders(4, fallback);
      }
    }
    buildProjectImages(projects, sections, fallback);

    const runs = (db
      .prepare(
        `select
           r.id, r.projectId, r.projectSectionId, r.status, r.runIndex, r.createdAt, r.startedAt, r.finishedAt, r.errorMessage,
           p.title as projectTitle, s.name as sectionName,
           count(i.id) as imageCount,
           sum(case when i.reviewStatus = 'pending' then 1 else 0 end) as pendingCount
         from Run r
         left join Project p on p.id = r.projectId
         left join ProjectSection s on s.id = r.projectSectionId
         left join ImageResult i on i.runId = r.id and i.reviewStatus != 'trashed'
         group by r.id
         order by datetime(r.createdAt) desc
         limit 16`,
      )
      .all() as SqlRow[]).map((row) => {
      const runImages = (imagesByRun.get(text(row.id)) ?? []).slice(0, 18);
      return {
        id: text(row.id),
        projectId: text(row.projectId),
        sectionId: text(row.projectSectionId),
        projectTitle: text(row.projectTitle, "未命名项目"),
        sectionName: text(row.sectionName, "未命名小节"),
        status: text(row.status, "queued"),
        runIndex: int(row.runIndex, 1),
        createdAt: shortDate(row.createdAt),
        startedAt: row.startedAt ? shortDate(row.startedAt) : null,
        finishedAt: row.finishedAt ? shortDate(row.finishedAt) : null,
        errorMessage: text(row.errorMessage) || null,
        imageCount: int(row.imageCount),
        pendingCount: int(row.pendingCount),
        images: runImages.length ? runImages : placeholders(8, fallback),
      } satisfies DemoRun;
    });

    const variantsByPreset = new Map<string, DemoPresetVariant[]>();
    for (const row of db
      .prepare(
        `select id, presetId, name, slug, prompt, negativePrompt
         from PresetVariant
         where isActive = 1
         order by presetId asc, sortOrder asc
         limit 320`,
      )
      .all() as SqlRow[]) {
      const presetId = text(row.presetId);
      if (!variantsByPreset.has(presetId)) variantsByPreset.set(presetId, []);
      variantsByPreset.get(presetId)!.push({
        id: text(row.id),
        name: text(row.name, "默认"),
        slug: text(row.slug),
        prompt: text(row.prompt, "positive prompt"),
        negativePrompt: text(row.negativePrompt, "negative prompt"),
      });
    }

    const presetsByCategory = new Map<string, DemoPreset[]>();
    for (const row of db
      .prepare(
        `select id, categoryId, name, slug, notes
         from Preset
         where isActive = 1
         order by categoryId asc, sortOrder asc
         limit 180`,
      )
      .all() as SqlRow[]) {
      const categoryId = text(row.categoryId);
      const variants = variantsByPreset.get(text(row.id)) ?? [];
      if (!presetsByCategory.has(categoryId)) presetsByCategory.set(categoryId, []);
      presetsByCategory.get(categoryId)!.push({
        id: text(row.id),
        categoryId,
        name: text(row.name),
        slug: text(row.slug),
        notes: text(row.notes),
        variantCount: variants.length,
        variants: variants.slice(0, 6),
      });
    }

    const groupsByCategory = new Map<string, DemoPresetGroup[]>();
    for (const row of db
      .prepare(
        `select
           g.id, g.categoryId, g.name, g.slug,
           count(m.id) as memberCount
         from PresetGroup g
         left join PresetGroupMember m on m.groupId = g.id
         where g.isActive = 1
         group by g.id
         order by g.categoryId asc, g.sortOrder asc
         limit 120`,
      )
      .all() as SqlRow[]) {
      const categoryId = text(row.categoryId);
      if (!groupsByCategory.has(categoryId)) groupsByCategory.set(categoryId, []);
      groupsByCategory.get(categoryId)!.push({
        id: text(row.id),
        categoryId,
        name: text(row.name),
        slug: text(row.slug),
        memberCount: int(row.memberCount),
        members: [],
      });
    }

    const categories = (db
      .prepare(
        `select id, name, slug, type, color
         from PresetCategory
         order by sortOrder asc
         limit 16`,
      )
      .all() as SqlRow[]).map((row) => {
      const categoryId = text(row.id);
      const presets = presetsByCategory.get(categoryId) ?? [];
      const groups = groupsByCategory.get(categoryId) ?? [];
      return {
        id: categoryId,
        name: text(row.name),
        slug: text(row.slug),
        type: text(row.type, "preset"),
        color: row.color === null ? null : text(row.color),
        presetCount: presets.length,
        groupCount: groups.length,
        presets: presets.slice(0, 10),
        groups: groups.slice(0, 10),
      } satisfies DemoCategory;
    });

    const templateSectionsByTemplate = new Map<string, DemoTemplate["sections"]>();
    for (const row of db
      .prepare(
        `select id, projectTemplateId, name, sortOrder, aspectRatio, batchSize, notes
         from ProjectTemplateSection
         order by projectTemplateId asc, sortOrder asc`,
      )
      .all() as SqlRow[]) {
      const templateId = text(row.projectTemplateId);
      if (!templateSectionsByTemplate.has(templateId)) templateSectionsByTemplate.set(templateId, []);
      templateSectionsByTemplate.get(templateId)!.push({
        id: text(row.id),
        name: text(row.name, `模板小节 ${int(row.sortOrder) + 1}`),
        sortOrder: int(row.sortOrder),
        aspectRatio: text(row.aspectRatio, "2:3"),
        batchSize: int(row.batchSize, 2),
        notes: text(row.notes),
      });
    }

    const templates = (db
      .prepare(
        `select id, name, description, updatedAt
         from ProjectTemplate
         order by datetime(updatedAt) desc
         limit 12`,
      )
      .all() as SqlRow[]).map((row) => {
      const sectionsForTemplate = templateSectionsByTemplate.get(text(row.id)) ?? [];
      return {
        id: text(row.id),
        name: text(row.name, "未命名模板"),
        description: text(row.description),
        sectionCount: sectionsForTemplate.length,
        updatedAt: shortDate(row.updatedAt),
        sections: sectionsForTemplate,
      } satisfies DemoTemplate;
    });

    const assets = (db
      .prepare(
        `select id, name, modelType, category, fileName, relativePath, size, source, notes, triggerWords
         from LoraAsset
         order by datetime(updatedAt) desc
         limit 80`,
      )
      .all() as SqlRow[]).map((row) => ({
      id: text(row.id),
      name: text(row.name),
      modelType: text(row.modelType, "lora"),
      category: text(row.category, "uncategorized"),
      fileName: text(row.fileName),
      relativePath: text(row.relativePath),
      sizeLabel: formatSize(row.size),
      source: text(row.source, "local"),
      notes: text(row.notes),
      triggerWords: text(row.triggerWords),
    } satisfies DemoAsset));

    const auditLogs = (db
      .prepare(
        `select id, entityType, action, actorType, createdAt
         from AuditLog
         order by datetime(createdAt) desc
         limit 24`,
      )
      .all() as SqlRow[]).map((row) => ({
      id: text(row.id),
      entityType: text(row.entityType),
      action: text(row.action),
      actorType: text(row.actorType),
      createdAt: shortDate(row.createdAt),
    } satisfies DemoAuditLog));

    const counts = db
      .prepare(
        `select
           (select count(*) from Project) as projects,
           (select count(*) from ProjectSection) as sections,
           (select count(*) from Run) as runs,
           (select count(*) from ImageResult where reviewStatus = 'pending') as pendingImages,
           (select count(*) from Preset) as presets,
           (select count(*) from ProjectTemplate) as templates,
           (select count(*) from LoraAsset) as loras`,
      )
      .get() as SqlRow;

    db.close();

    return {
      source: sourceSummary(true, sqlite.label, null),
      metrics: {
        projects: int(counts.projects),
        sections: int(counts.sections),
        runs: int(counts.runs),
        pendingImages: int(counts.pendingImages),
        presets: int(counts.presets),
        templates: int(counts.templates),
        loras: int(counts.loras),
      },
      projects: projects.length ? projects : fallbackData(null).projects,
      runs: runs.length ? runs : fallbackData(null).runs,
      categories: categories.length ? categories : fallbackData(null).categories,
      templates: templates.length ? templates : fallbackData(null).templates,
      loras: assets.filter((asset) => asset.modelType === "lora" || asset.category.toLowerCase().includes("lora")),
      models: assets.length ? assets : modelAssetsFromEnv(),
      auditLogs,
      images: fallback,
    };
  } catch (error) {
    return fallbackData(error instanceof Error ? error.message : "读取 SQLite mock 数据失败。");
  }
}
