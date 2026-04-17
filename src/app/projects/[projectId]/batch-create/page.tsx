import { getPromptLibraryV2, getProjectEditData } from "@/lib/server-data";
import { BatchCreateClient } from "./batch-create-client";

export default async function BatchCreatePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [library, project] = await Promise.all([
    getPromptLibraryV2(),
    getProjectEditData(projectId),
  ]);

  if (!project) {
    return <div className="p-6 text-sm text-zinc-400">项目不存在</div>;
  }

  return (
    <BatchCreateClient
      projectId={projectId}
      projectTitle={project.title}
      presetBindings={project.presetBindings}
      defaultAspectRatio={project.defaultAspectRatio}
      defaultShortSidePx={project.defaultShortSidePx}
      library={library}
    />
  );
}
