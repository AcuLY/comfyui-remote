import { fail, ok } from "@/lib/api-response";
import { deleteSections } from "@/lib/actions";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("Request body must be an object", 400);
  }

  const sectionIds = (body as { sectionIds?: unknown }).sectionIds;
  if (
    !Array.isArray(sectionIds) ||
    sectionIds.length === 0 ||
    sectionIds.some((sectionId) => typeof sectionId !== "string" || !sectionId.trim())
  ) {
    return fail("sectionIds must be a non-empty string array", 400);
  }

  const uniqueSectionIds = [...new Set(sectionIds.map((sectionId) => sectionId.trim()))];
  const sections = await prisma.projectSection.findMany({
    where: { id: { in: uniqueSectionIds }, projectId },
    select: { id: true },
  });

  if (sections.length !== uniqueSectionIds.length) {
    return fail("One or more sections were not found in this project", 404);
  }

  await deleteSections(uniqueSectionIds);
  return ok({ deletedCount: uniqueSectionIds.length });
}
