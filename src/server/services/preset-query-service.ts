import { prisma } from "@/lib/prisma";

export type PresetQueryFilters = {
  name?: string;
  slug?: string;
  category?: string;
  categoryId?: string;
  includeInactive?: boolean;
};

function optionalContains(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? { contains: normalized } : undefined;
}

function normalizeBoolean(value?: string | null) {
  if (!value) return false;
  return value === "true" || value === "1";
}

export function parsePresetQuery(searchParams: URLSearchParams): PresetQueryFilters {
  return {
    name: searchParams.get("name") ?? undefined,
    slug: searchParams.get("slug") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    includeInactive: normalizeBoolean(searchParams.get("includeInactive")),
  };
}

export async function listPresets(filters: PresetQueryFilters = {}) {
  const name = optionalContains(filters.name);
  const slug = optionalContains(filters.slug);
  const category = filters.category?.trim();
  const categoryId = filters.categoryId?.trim();

  const presets = await prisma.preset.findMany({
    where: {
      ...(filters.includeInactive ? {} : { isActive: true }),
      ...(name ? { name } : {}),
      ...(slug ? { slug } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(category
        ? {
            category: {
              OR: [
                { id: category },
                { name: { contains: category } },
                { slug: { contains: category } },
              ],
            },
          }
        : {}),
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          icon: true,
          sortOrder: true,
        },
      },
      variants: {
        where: filters.includeInactive ? undefined : { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          presetId: true,
          name: true,
          slug: true,
          prompt: true,
          negativePrompt: true,
          lora1: true,
          lora2: true,
          defaultParams: true,
          linkedVariants: true,
          sortOrder: true,
          isActive: true,
        },
      },
    },
  });

  return presets.map((preset) => ({
    id: preset.id,
    categoryId: preset.categoryId,
    category: preset.category,
    name: preset.name,
    slug: preset.slug,
    notes: preset.notes,
    folderId: preset.folderId,
    sortOrder: preset.sortOrder,
    isActive: preset.isActive,
    variants: preset.variants,
  }));
}

export async function getPresetById(presetId: string, includeInactive = false) {
  const preset = await prisma.preset.findFirst({
    where: {
      id: presetId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          icon: true,
          sortOrder: true,
        },
      },
      variants: {
        where: includeInactive ? undefined : { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          presetId: true,
          name: true,
          slug: true,
          prompt: true,
          negativePrompt: true,
          lora1: true,
          lora2: true,
          defaultParams: true,
          linkedVariants: true,
          sortOrder: true,
          isActive: true,
        },
      },
    },
  });

  if (!preset) return null;

  return {
    id: preset.id,
    categoryId: preset.categoryId,
    category: preset.category,
    name: preset.name,
    slug: preset.slug,
    notes: preset.notes,
    folderId: preset.folderId,
    sortOrder: preset.sortOrder,
    isActive: preset.isActive,
    variants: preset.variants,
  };
}
