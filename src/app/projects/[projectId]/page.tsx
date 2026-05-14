import { notFound } from "next/navigation";
import { getProjectDetail } from "@/lib/server-data";
import { firstSearchParam } from "@/lib/folder-navigation";
import { ProjectDetailClient } from "./project-detail-client";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ sectionFolder?: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);
  if (!project) notFound();
  const requestedSectionFolderId = firstSearchParam((await searchParams).sectionFolder);
  const initialSectionFolderId =
    requestedSectionFolderId && project.sectionFolders.some((folder) => folder.id === requestedSectionFolderId)
      ? requestedSectionFolderId
      : null;

  return (
    <ProjectDetailClient
      key={initialSectionFolderId ?? "root"}
      projectId={project.id}
      projectTitle={project.title}
      projectFolderId={project.folderId}
      previousProject={project.previousProject}
      nextProject={project.nextProject}
      sectionFolders={project.sectionFolders}
      initialSectionFolderId={initialSectionFolderId}
      sections={project.sections}
    />
  );
}
