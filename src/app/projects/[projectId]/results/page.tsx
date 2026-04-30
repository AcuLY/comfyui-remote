import { notFound } from "next/navigation";

import { getProjectResults } from "@/lib/server-data";
import { ProjectResultsClient } from "./project-results-client";

export const dynamic = "force-dynamic";

export default async function ProjectResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectResults(projectId);

  if (!project) {
    notFound();
  }

  return <ProjectResultsClient project={project} />;
}
