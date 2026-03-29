import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getProjectFormOptions } from "@/lib/server-data";
import { ProjectForm } from "./project-form";

export default async function NewProjectPage() {
  const options = await getProjectFormOptions();

  return (
    <div className="space-y-4">
      <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-zinc-300">
        <ArrowLeft className="size-4" /> 返回项目
      </Link>

      <SectionCard title="创建项目" subtitle="选择各分类的预设模板，创建后在详情页添加小节。">
        <ProjectForm categories={options.categories} />
      </SectionCard>
    </div>
  );
}
