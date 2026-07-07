import { ordinaryPresetCategoryTypeWhere } from "@/lib/preset-resource-scope";
import { prisma } from "@/lib/prisma";
import {
  buildGenerationPresetWhere,
  buildGenerationProjectWhere,
} from "@/server/repositories/generation-resource-boundary";
import { resolveSectionConfigsById } from "@/server/repositories/project-repository/helpers";

// ---------------------------------------------------------------------------
// Project Form Options — 创建/编辑 Project 所需的下拉选项
// ---------------------------------------------------------------------------

export type ProjectFormCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  type: string;
  sortOrder: number;
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    sortOrder: number;
  }>;
  presets: Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    folderId: string | null;
    variants: Array<{
      id: string;
      name: string;
      slug: string;
      prompt: string;
      negativePrompt: string | null;
      isActive: boolean;
    }>;
  }>;
};

export type ProjectFormOptions = {
  categories: ProjectFormCategory[];
};


export async function getProjectFormOptions(): Promise<ProjectFormOptions> {
  const categories = await prisma.presetCategory.findMany({
    where: { type: ordinaryPresetCategoryTypeWhere() },
    orderBy: { sortOrder: "asc" },
    include: {
      folders: {
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, parentId: true, sortOrder: true },
      },
      presets: {
        where: buildGenerationPresetWhere({ isActive: true }),
        orderBy: { sortOrder: "asc" },
        include: {
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, slug: true, prompt: true, negativePrompt: true, isActive: true },
          },
        },
      },
    },
  });

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      color: c.color,
      type: c.type,
      sortOrder: c.sortOrder,
      folders: c.folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        sortOrder: folder.sortOrder,
      })),
      presets: c.presets.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        isActive: p.isActive,
        folderId: p.folderId,
        variants: p.variants,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Project Edit Data — 编辑 Project 时加载完整数据
// ---------------------------------------------------------------------------

export type PresetBinding = { categoryId: string; presetId: string; variantId?: string };

export type ProjectEditData = {
  id: string;
  title: string;
  slug: string;
  checkpointName: string | null;
  presetBindings: PresetBinding[];
  notes: string | null;
  sections: {
    id: string;
    sortOrder: number;
    enabled: boolean;
    positivePrompt: string | null;
    negativePrompt: string | null;
    aspectRatio: string | null;
    batchSize: number | null;
    seedPolicy1: string | null;
    seedPolicy2: string | null;
  }[];
  // 小节默认值
  defaultAspectRatio: string;
  defaultShortSidePx: number;
  defaultBatchSize: number;
  defaultUpscaleFactor: number;
  defaultSeedPolicy1: string;
  defaultSeedPolicy2: string;
  defaultKsampler1: Record<string, unknown>;
  defaultKsampler2: Record<string, unknown>;
};

export async function getProjectEditData(projectId: string): Promise<ProjectEditData | null> {
  const project = await prisma.project.findFirst({
    where: buildGenerationProjectWhere({ id: projectId }),
    include: {
      presetBindingRows: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          categoryId: true,
          presetId: true,
          variantId: true,
        },
      },
      sections: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          sortOrder: true,
          enabled: true,
          aspectRatio: true,
          batchSize: true,
          seedPolicy1: true,
          seedPolicy2: true,
        },
      },
    },
  });

  if (!project) return null;
  const resolvedConfigsBySectionId = await resolveSectionConfigsById(
    project.sections.map((section) => section.id),
  );

  // 解析 projectLevelOverrides
  const overrides = (project.projectLevelOverrides ?? {}) as {
    defaultAspectRatio?: string;
    defaultShortSidePx?: number;
    defaultBatchSize?: number;
    defaultUpscaleFactor?: number;
    defaultSeedPolicy1?: string;
    defaultSeedPolicy2?: string;
    defaultKsampler1?: Record<string, unknown>;
    defaultKsampler2?: Record<string, unknown>;
  };

  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    checkpointName: project.checkpointName,
    presetBindings: project.presetBindingRows.map((binding) => ({
      categoryId: binding.categoryId,
      presetId: binding.presetId,
      ...(binding.variantId ? { variantId: binding.variantId } : {}),
    })),
    notes: project.notes,
    sections: project.sections.map((pos) => {
      const resolvedConfig = resolvedConfigsBySectionId.get(pos.id);
      if (!resolvedConfig) {
        throw new Error("JOB_POSITION_CONFIG_NOT_FOUND");
      }

      return {
        ...pos,
        positivePrompt: resolvedConfig.prompt.positive,
        negativePrompt: resolvedConfig.prompt.negative,
      };
    }),
    // 小节默认值
    defaultAspectRatio: overrides.defaultAspectRatio ?? "2:3",
    defaultShortSidePx: overrides.defaultShortSidePx ?? 512,
    defaultBatchSize: overrides.defaultBatchSize ?? 2,
    defaultUpscaleFactor: overrides.defaultUpscaleFactor ?? 2,
    defaultSeedPolicy1: overrides.defaultSeedPolicy1 ?? "random",
    defaultSeedPolicy2: overrides.defaultSeedPolicy2 ?? "random",
    defaultKsampler1: overrides.defaultKsampler1 ?? {},
    defaultKsampler2: overrides.defaultKsampler2 ?? {},
  };
}

// ---------------------------------------------------------------------------
// PromptBlocks – 某个 Section 的提示词块列表
// ---------------------------------------------------------------------------

export type SectionBlockSummary = {
  id: string;
  type: string;
  label: string;
  positive: string;
  negative: string | null;
  sortOrder: number;
};
