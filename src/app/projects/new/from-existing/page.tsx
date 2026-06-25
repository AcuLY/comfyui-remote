import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import {
  getProjectFormOptions,
  listProjectFolders,
  listProjects,
} from "@/lib/server-data";
import { ProjectForm } from "../project-form";

export default async function NewProjectFromExistingPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { folder } = await searchParams;
  const [options, projects, folders] = await Promise.all([
    getProjectFormOptions(),
    listProjects(),
    listProjectFolders(),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-zinc-300">
        <ArrowLeft className="size-4" /> 返回项目
      </Link>

      <SectionCard title="从已有项目创建" subtitle="选择来源项目，并为新项目设置预制与 Checkpoint。">
        <ProjectForm
          categories={options.categories}
          folderId={folder ?? null}
          sourceProjects={projects}
          projectFolders={folders}
        />
      </SectionCard>
    </div>
  );
}
