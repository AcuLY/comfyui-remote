import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { buildGenerationProjectWhere } from "@/server/repositories/legacy-training-resource-boundary";
import { listProjectFolders as listProjectFoldersInRepository } from "@/server/repositories/project-view-repository";
import {
  ServiceValidationError,
  parseRequestBody,
  ensureSupportedFields,
  normalizeRequiredStringField,
} from "@/server/services/validation-utils";

type CreateProjectFolderBody = {
  parentId?: unknown;
  name?: unknown;
};

type RenameProjectFolderBody = {
  name?: unknown;
};

type MoveProjectToFolderBody = {
  projectId?: unknown;
  folderId?: unknown;
};

type ReorderProjectFoldersBody = {
  parentId?: unknown;
  ids?: unknown;
};

const PROJECT_FOLDER_CREATE_FIELDS = ["parentId", "name"] as const;
const PROJECT_FOLDER_RENAME_FIELDS = ["name"] as const;
const PROJECT_FOLDER_MOVE_FIELDS = ["projectId", "folderId"] as const;
const PROJECT_FOLDER_REORDER_FIELDS = ["parentId", "ids"] as const;

class ProjectFolderServiceError extends ServiceValidationError {
  constructor(
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message, status, details);
    this.name = "ProjectFolderServiceError";
  }
}

function normalizeOptionalNullableId(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ProjectFolderServiceError(`${fieldName} must be a string or null`, 400);
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    throw new ProjectFolderServiceError(`${fieldName} must not be empty`, 400);
  }

  return normalizedValue;
}

function normalizeRequiredId(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new ProjectFolderServiceError(`${fieldName} is required`, 400);
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    throw new ProjectFolderServiceError(`${fieldName} is required`, 400);
  }

  return normalizedValue;
}

function normalizeIdArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value)) {
    throw new ProjectFolderServiceError(`${fieldName} must be a string array`, 400);
  }

  const ids = value.map((id) => {
    if (typeof id !== "string") {
      throw new ProjectFolderServiceError(`${fieldName} must be a string array`, 400);
    }
    return id.trim();
  });

  if (ids.some((id) => !id)) {
    throw new ProjectFolderServiceError(`${fieldName} must contain non-empty strings`, 400);
  }

  return ids;
}

async function ensureParentFolderExists(parentId: string | null) {
  if (!parentId) return;

  const parent = await prisma.projectFolder.findUnique({
    where: { id: parentId },
    select: { id: true },
  });

  if (!parent) {
    throw new ProjectFolderServiceError("Project folder parent not found", 404);
  }
}

async function ensureTargetFolderExists(folderId: string | null) {
  if (!folderId) return;

  const folder = await prisma.projectFolder.findUnique({
    where: { id: folderId },
    select: { id: true },
  });

  if (!folder) {
    throw new ProjectFolderServiceError("Project folder not found", 404);
  }
}

async function ensureProjectExists(projectId: string) {
  const project = await prisma.project.findFirst({
    where: buildGenerationProjectWhere({ id: projectId }),
    select: { id: true },
  });

  if (!project) {
    throw new ProjectFolderServiceError("Project not found", 404);
  }
}

export function normalizeCreateProjectFolderBody(body: unknown) {
  const parsedBody = parseRequestBody<CreateProjectFolderBody>(body);
  ensureSupportedFields(parsedBody, PROJECT_FOLDER_CREATE_FIELDS);

  return {
    parentId: normalizeOptionalNullableId(parsedBody.parentId, "parentId"),
    name: normalizeRequiredStringField(parsedBody.name, "name"),
  };
}

export function normalizeRenameProjectFolderBody(body: unknown) {
  const parsedBody = parseRequestBody<RenameProjectFolderBody>(body);
  ensureSupportedFields(parsedBody, PROJECT_FOLDER_RENAME_FIELDS);

  return {
    name: normalizeRequiredStringField(parsedBody.name, "name"),
  };
}

export function normalizeMoveProjectToFolderBody(body: unknown) {
  const parsedBody = parseRequestBody<MoveProjectToFolderBody>(body);
  ensureSupportedFields(parsedBody, PROJECT_FOLDER_MOVE_FIELDS);

  return {
    projectId: normalizeRequiredId(parsedBody.projectId, "projectId"),
    folderId: normalizeOptionalNullableId(parsedBody.folderId, "folderId"),
  };
}

export function normalizeReorderProjectFoldersBody(body: unknown) {
  const parsedBody = parseRequestBody<ReorderProjectFoldersBody>(body);
  ensureSupportedFields(parsedBody, PROJECT_FOLDER_REORDER_FIELDS);

  return {
    parentId: normalizeOptionalNullableId(parsedBody.parentId, "parentId"),
    ids: normalizeIdArray(parsedBody.ids, "ids"),
  };
}

export async function listProjectFolders(parentId?: string | null) {
  const folders = await listProjectFoldersInRepository();

  if (parentId === undefined) {
    return folders;
  }

  return folders.filter((folder) => (folder.parentId ?? null) === parentId);
}

export async function getProjectFolder(folderId: string) {
  const id = normalizeRequiredId(folderId, "folderId");

  const folder = await prisma.projectFolder.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      parentId: true,
      sortOrder: true,
      _count: {
        select: {
          projects: { where: buildGenerationProjectWhere() },
          children: true,
        },
      },
    },
  });

  if (!folder) {
    throw new ProjectFolderServiceError("Project folder not found", 404);
  }

  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    sortOrder: folder.sortOrder,
    projectCount: folder._count.projects,
    childCount: folder._count.children,
  };
}

export async function createProjectFolder(body: unknown) {
  const input = normalizeCreateProjectFolderBody(body);
  await ensureParentFolderExists(input.parentId);

  const maxSort = await prisma.projectFolder.aggregate({
    where: { parentId: input.parentId },
    _max: { sortOrder: true },
  });

  const folder = await prisma.projectFolder.create({
    data: {
      parentId: input.parentId,
      name: input.name,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/projects");
  return folder;
}

export async function renameProjectFolder(folderId: string, body: unknown) {
  const id = normalizeRequiredId(folderId, "folderId");
  const input = normalizeRenameProjectFolderBody(body);

  const folder = await prisma.projectFolder.update({
    where: { id },
    data: { name: input.name },
  });

  revalidatePath("/projects");
  return folder;
}

export async function deleteProjectFolder(folderId: string) {
  const id = normalizeRequiredId(folderId, "folderId");

  const folder = await prisma.projectFolder.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!folder) {
    throw new ProjectFolderServiceError("Project folder not found", 404);
  }

  const [childCount, projectCount] = await Promise.all([
    prisma.projectFolder.count({ where: { parentId: id } }),
    prisma.project.count({ where: buildGenerationProjectWhere({ folderId: id }) }),
  ]);

  if (childCount + projectCount > 0) {
    throw new ProjectFolderServiceError(
      `文件夹不为空，包含 ${childCount} 个子文件夹、${projectCount} 个项目`,
      409,
    );
  }

  await prisma.projectFolder.delete({ where: { id } });
  revalidatePath("/projects");
}

export async function moveProjectToFolder(projectId: string, folderId: string | null) {
  const normalizedProjectId = normalizeRequiredId(projectId, "projectId");
  const normalizedFolderId = normalizeOptionalNullableId(folderId, "folderId");

  await ensureProjectExists(normalizedProjectId);
  await ensureTargetFolderExists(normalizedFolderId);

  await prisma.project.updateMany({
    where: buildGenerationProjectWhere({ id: normalizedProjectId }),
    data: { folderId: normalizedFolderId },
  });

  revalidatePath("/projects");
}

export async function moveProjectToFolderFromBody(body: unknown) {
  const input = normalizeMoveProjectToFolderBody(body);
  await moveProjectToFolder(input.projectId, input.folderId);
}

export async function reorderProjectFolders(body: unknown) {
  const input = normalizeReorderProjectFoldersBody(body);
  await ensureParentFolderExists(input.parentId);

  await prisma.$transaction(
    input.ids.map((id, index) =>
      prisma.projectFolder.updateMany({
        where: {
          id,
          parentId: input.parentId,
        },
        data: { sortOrder: index },
      }),
    ),
  );

  revalidatePath("/projects");
}

export function mapProjectFolderError(error: unknown) {
  if (error instanceof ServiceValidationError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return { message: "Project folder not found", status: 404 };
    }

    if (error.code === "P2003") {
      return {
        message: "Related project or folder not found",
        status: 404,
        details: error.meta?.field_name ?? error.message,
      };
    }

    return {
      message: "Database request failed",
      status: 500,
      details: error.message,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unexpected project folder error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
