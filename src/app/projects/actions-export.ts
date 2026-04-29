"use server";

import {
  exportProjectImages as exportProjectImagesService,
  type ExportProjectImagesResult,
} from "@/server/services/project-export-service";

export async function exportProjectImages(projectId: string): Promise<ExportProjectImagesResult> {
  return exportProjectImagesService(projectId);
}
