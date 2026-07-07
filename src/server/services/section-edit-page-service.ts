import { getPresetLibraryV2 } from "@/server/repositories/preset-view-repository";
import { getProjectSectionEditData } from "@/server/repositories/project-view-repository";
import { getSectionChangeHistory } from "@/server/services/section-change-history-service";

export async function getProjectSectionEditPageData(projectId: string, sectionId: string) {
  const sectionEditData = await getProjectSectionEditData(projectId, sectionId);
  if (!sectionEditData) return null;

  const [libraryV2, changeHistory] = await Promise.all([
    getPresetLibraryV2(),
    getSectionChangeHistory(sectionId),
  ]);

  return {
    ...sectionEditData,
    libraryV2,
    changeHistory,
  };
}
