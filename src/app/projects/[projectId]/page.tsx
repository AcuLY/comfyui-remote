import { notFound } from "next/navigation";
import { getProjectDetail } from "@/lib/server-data";
import { ProjectDetailClient } from "./project-detail-client";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);
  if (!project) notFound();

  return (
    <ProjectDetailClient
      projectId={project.id}
      projectTitle={project.title}
      previousProject={project.previousProject}
      nextProject={project.nextProject}
      sections={project.sections}
    />
  );
}
