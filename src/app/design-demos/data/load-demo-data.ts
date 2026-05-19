import type {
  DemoAsset,
  DemoAuditLog,
  DemoCategory,
  DemoData,
  DemoImage,
  DemoPreset,
  DemoPresetFolder,
  DemoPresetGroup,
  DemoPresetLinkedVariant,
  DemoPresetVariant,
  DemoPresetVariantLoraBinding,
  DemoProject,
  DemoProjectFolder,
  DemoRun,
  DemoSection,
  DemoTemplate,
} from "./types";
import type { SqlRow } from "./sql-types";
import { fallbackData } from "./fallback-data";
import { fallbackImages } from "./fallback-images";
import { modelAssetsFromEnv } from "./model-assets";
import { bool, buildProjectImages, formatSize, imageFromRow, int, parseJson, placeholders, shortDate, text } from "./row-shaping";
import { resolveSqlitePath } from "./sqlite-source";
import { sourceSummary } from "./source-summary";

function parsePresetLoras(value: SqlRow[string]) {
  const parsed = parseJson<DemoPresetVariantLoraBinding[]>(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function parseLinkedVariants(value: SqlRow[string]) {
  const parsed = parseJson<DemoPresetLinkedVariant[]>(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function parseCivitaiLinks(value: SqlRow[string]) {
  const parsed = parseJson<string[]>(value, []);
  return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
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
           case when i.id = p.coverImageId then 1 else 0 end as cover,
           r.id as runId, r.projectId, r.projectSectionId
         from ImageResult i
         join Run r on r.id = i.runId
         left join Project p on p.id = r.projectId
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
           p.id, p.title, p.slug, p.folderId, p.status, p.updatedAt, p.notes, p.checkpointName, p.presetBindings,
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
        folderId: row.folderId === null ? null : text(row.folderId),
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

    const projectFolders = (db
      .prepare(
        `select
           f.id, f.name, f.parentId, f.sortOrder,
           (select count(*) from Project p where p.folderId = f.id) as projectCount,
           (select count(*) from ProjectFolder c where c.parentId = f.id) as childCount
         from ProjectFolder f
         order by coalesce(f.parentId, ''), f.sortOrder asc
         limit 160`,
      )
      .all() as SqlRow[]).map((row) => ({
      id: text(row.id),
      name: text(row.name, "未命名文件夹"),
      parentId: row.parentId === null ? null : text(row.parentId),
      sortOrder: int(row.sortOrder),
      projectCount: int(row.projectCount),
      childCount: int(row.childCount),
    } satisfies DemoProjectFolder));

    const projectIds = projects.map((project) => project.id);
    const sectionRows = projectIds.length
      ? (db
          .prepare(
            `select
               id, projectId, name, sortOrder, enabled, aspectRatio, batchSize, shortSidePx,
               seedPolicy1, seedPolicy2, positivePrompt, negativePrompt, checkpointName, loraConfig,
               upscaleFactor, ksampler1, ksampler2,
               (select count(*) from PromptBlock b where b.projectSectionId = ProjectSection.id) as promptBlockCount,
               (select max(r.createdAt) from Run r where r.projectSectionId = ProjectSection.id) as latestRunAt
             from ProjectSection
             where projectId in (${projectIds.map(() => "?").join(",")})
             order by projectId asc, sortOrder asc`,
          )
          .all(...projectIds) as SqlRow[])
      : [];

    const sections: DemoSection[] = sectionRows.map((row): DemoSection => {
      const loraConfig = parseJson<{ lora1?: unknown[]; lora2?: unknown[] }>(row.loraConfig, {});
      const rawId = text(row.id);
      const ksampler1 = parseJson<{ steps?: number; cfg?: number; sampler_name?: string; scheduler?: string }>(row.ksampler1, {});
      const ksampler2 = parseJson<{ steps?: number; cfg?: number; sampler_name?: string; scheduler?: string }>(row.ksampler2, {});
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
        projectCheckpointName: null,
        upscaleFactor: int(row.upscaleFactor, 2),
        ksampler1: {
          steps: int(ksampler1.steps, 28),
          cfg: Number(ksampler1.cfg ?? 7),
          sampler_name: text(ksampler1.sampler_name, "euler_ancestral"),
          scheduler: text(ksampler1.scheduler, "normal"),
        },
        ksampler2: {
          steps: int(ksampler2.steps, 18),
          cfg: Number(ksampler2.cfg ?? 5.5),
          sampler_name: text(ksampler2.sampler_name, "dpmpp_2m_sde"),
          scheduler: text(ksampler2.scheduler, "karras"),
        },
        promptBlockCount: int(row.promptBlockCount),
        loraCount: (Array.isArray(loraConfig.lora1) ? loraConfig.lora1.length : 0) + (Array.isArray(loraConfig.lora2) ? loraConfig.lora2.length : 0),
        lora1: Array.isArray(loraConfig.lora1) ? loraConfig.lora1 : [],
        lora2: Array.isArray(loraConfig.lora2) ? loraConfig.lora2 : [],
        images: [],
        latestRunAt: row.latestRunAt ? shortDate(row.latestRunAt) : undefined,
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
           r.id, r.projectId, r.projectSectionId, r.status, r.runIndex, r.createdAt, r.startedAt, r.finishedAt, r.errorMessage, r.executionMeta,
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
        executionMeta: parseJson<Record<string, unknown> | null>(row.executionMeta, null),
        images: runImages.length ? runImages : placeholders(8, fallback),
      } satisfies DemoRun;
    });

    const variantsByPreset = new Map<string, DemoPresetVariant[]>();
    for (const row of db
      .prepare(
        `select id, presetId, name, slug, prompt, negativePrompt, lora1, lora2, linkedVariants
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
        lora1: parsePresetLoras(row.lora1),
        lora2: parsePresetLoras(row.lora2),
        linkedVariants: parseLinkedVariants(row.linkedVariants),
      });
    }

    const foldersByCategory = new Map<string, DemoPresetFolder[]>();
    for (const row of db
      .prepare(
        `select id, categoryId, name, parentId, sortOrder
         from PresetFolder
         order by categoryId asc, parentId asc, sortOrder asc
         limit 160`,
      )
      .all() as SqlRow[]) {
      const categoryId = text(row.categoryId);
      if (!foldersByCategory.has(categoryId)) foldersByCategory.set(categoryId, []);
      foldersByCategory.get(categoryId)!.push({
        id: text(row.id),
        categoryId,
        name: text(row.name),
        parentId: row.parentId === null ? null : text(row.parentId),
        sortOrder: int(row.sortOrder),
      });
    }

    const presetsByCategory = new Map<string, DemoPreset[]>();
    for (const row of db
      .prepare(
        `select id, categoryId, folderId, name, slug, notes, civitaiLinks
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
        folderId: row.folderId === null ? null : text(row.folderId),
        name: text(row.name),
        slug: text(row.slug),
        notes: text(row.notes),
        civitaiLinks: parseCivitaiLinks(row.civitaiLinks),
        variantCount: variants.length,
        variants: variants.slice(0, 6),
      });
    }

    const groupsByCategory = new Map<string, DemoPresetGroup[]>();
    for (const row of db
      .prepare(
        `select
           g.id, g.categoryId, g.folderId, g.name, g.slug,
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
        folderId: row.folderId === null ? null : text(row.folderId),
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
      const folders = foldersByCategory.get(categoryId) ?? [];
      return {
        id: categoryId,
        name: text(row.name),
        slug: text(row.slug),
        type: text(row.type, "preset"),
        color: row.color === null ? null : text(row.color),
        presetCount: presets.length,
        groupCount: groups.length,
        folders,
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
      projectFolders,
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
    return fallbackData(error instanceof Error ? error.message : "读取本地 SQLite 数据失败。");
  }
}
