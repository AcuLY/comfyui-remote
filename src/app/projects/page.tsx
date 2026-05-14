import { listProjectFolders, listProjects } from "@/lib/server-data";
import { firstSearchParam } from "@/lib/folder-navigation";
import { ProjectsClient } from "./projects-client";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string | string[] | undefined }>;
}) {
  const [projects, folders] = await Promise.all([
    listProjects(),
    listProjectFolders(),
  ]);
  const requestedFolderId = firstSearchParam((await searchParams).folder);
  const initialFolderId =
    requestedFolderId && folders.some((folder) => folder.id === requestedFolderId)
      ? requestedFolderId
      : null;

  return (
    <ProjectsClient
      key={initialFolderId ?? "root"}
      initialProjects={projects}
      folders={folders}
      initialFolderId={initialFolderId}
    />
  );
}
