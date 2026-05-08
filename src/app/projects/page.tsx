import { listProjectFolders, listProjects } from "@/lib/server-data";
import { ProjectsClient } from "./projects-client";

export default async function ProjectsPage() {
  const [projects, folders] = await Promise.all([
    listProjects(),
    listProjectFolders(),
  ]);

  return <ProjectsClient initialProjects={projects} folders={folders} />;
}
