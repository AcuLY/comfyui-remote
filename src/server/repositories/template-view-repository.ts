import { prisma } from "@/lib/prisma";
import { formatDate } from "@/server/repositories/queue-data-repository";

// ---------------------------------------------------------------------------
// Project Templates
// ---------------------------------------------------------------------------

export type ProjectTemplateSectionData = {
  id: string;
  sortOrder: number;
  name: string | null;
  aspectRatio: string | null;
  shortSidePx: number | null;
  batchSize: number | null;
  seedPolicy1: string | null;
  seedPolicy2: string | null;
  ksampler1: Record<string, unknown> | null;
  ksampler2: Record<string, unknown> | null;
  upscaleFactor: number | null;
  loraConfig: Record<string, unknown> | null;
  extraParams: Record<string, unknown> | null;
  promptBlocks: Array<{
    label: string;
    positive: string;
    negative?: string | null;
    sortOrder: number;
    type?: string | null;
    sourceId?: string | null;
    variantId?: string | null;
    categoryId?: string | null;
    bindingId?: string | null;
    groupBindingId?: string | null;
  }>;
};

export type ProjectTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  sectionCount: number;
  createdAt: string;
  updatedAt: string;
};

export async function listProjectTemplates(filters: { name?: string } = {}): Promise<ProjectTemplateListItem[]> {
  const name = filters.name?.trim();
  const templates = await prisma.projectTemplate.findMany({
    where: name ? { name: { contains: name } } : undefined,
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { sections: true } } },
  });
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    sectionCount: t._count.sections,
    createdAt: formatDate(t.createdAt),
    updatedAt: formatDate(t.updatedAt),
  }));
}

export type ProjectTemplateDetail = {
  id: string;
  name: string;
  description: string | null;
  sections: ProjectTemplateSectionData[];
};

export async function getProjectTemplateDetail(
  templateId: string,
): Promise<ProjectTemplateDetail | null> {
  const template = await prisma.projectTemplate.findUnique({
    where: { id: templateId },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) return null;

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    sections: template.sections.map((s) => ({
      id: s.id,
      sortOrder: s.sortOrder,
      name: s.name,
      aspectRatio: s.aspectRatio,
      shortSidePx: s.shortSidePx,
      batchSize: s.batchSize,
      seedPolicy1: s.seedPolicy1,
      seedPolicy2: s.seedPolicy2,
      ksampler1: s.ksampler1 as Record<string, unknown> | null,
      ksampler2: s.ksampler2 as Record<string, unknown> | null,
      upscaleFactor: s.upscaleFactor,
      loraConfig: s.loraConfig as Record<string, unknown> | null,
      extraParams: s.extraParams as Record<string, unknown> | null,
      promptBlocks: (Array.isArray(s.promptBlocks) ? s.promptBlocks : []) as ProjectTemplateSectionData["promptBlocks"],
    })),
  };
}
