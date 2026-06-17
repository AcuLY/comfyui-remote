import { reorderTrainingTemplates } from "@/server/services/training/template-service";

export class TrainingTemplateOrderServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingTemplateOrderServiceError";
    this.status = status;
    this.details = details;
  }
}

export async function listTrainingTemplateOrderIds(): Promise<string[]> {
  return [] as string[];
}

export async function saveTrainingTemplateOrderIds(templateIds: string[]) {
  const normalized = [...new Set(templateIds.map((templateId) => templateId.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    throw new TrainingTemplateOrderServiceError("At least one template id is required", 400);
  }

  return reorderTrainingTemplates({ orderedTemplateIds: normalized });
}

export function orderTrainingTemplatesByStoredIds<T extends { id: string }>(templates: T[], orderedTemplateIds: string[]) {
  if (orderedTemplateIds.length === 0) {
    return templates;
  }

  const templateMap = new Map(templates.map((template) => [template.id, template]));
  const ordered = orderedTemplateIds
    .map((templateId) => templateMap.get(templateId))
    .filter((template): template is T => Boolean(template));
  const missing = templates.filter((template) => !orderedTemplateIds.includes(template.id));
  return [...ordered, ...missing];
}

export function mapTrainingTemplateOrderError(error: unknown) {
  if (error instanceof TrainingTemplateOrderServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training template order error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
