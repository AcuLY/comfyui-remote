import Link from "next/link";
import { ChevronRight, ImageIcon, Plus } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { listProjects } from "@/lib/server-data";
import { ProjectDeleteButton } from "./project-delete-button";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 transition hover:bg-sky-500/20"
        >
          <Plus className="size-4" /> 创建新项目
        </Link>
      </div>
      <SectionCard title="项目" subtitle="点击卡片进入详情页，在详情页中编辑参数和管理小节。">
        <div className="grid grid-cols-1 gap-2.5 justify-items-center md:grid-cols-2">
          {projects.map((project) => (
            <article
              key={project.id}
              className="relative w-full rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.06] md:max-w-[500px]"
            >
              <ProjectDeleteButton projectId={project.id} projectTitle={project.title} />
              <Link href={`/projects/${project.id}`} className="block p-3 pr-12">
              {project.latestImages && project.latestImages.length > 0 ? (
                <div className="mb-3 border-b border-white/5 pb-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <ImageIcon className="size-3" />
                    <span>
                      最近结果 · {project.latestImageCount ?? project.latestImages.length} 张
                    </span>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                    {project.latestImages.slice(0, 6).map((img) => (
                      <div
                        key={img.id}
                        className={`flex h-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[var(--panel-soft)] ${
                          img.status === "kept"
                            ? "border-emerald-500/30"
                            : img.status === "trashed"
                              ? "border-rose-500/20 opacity-45"
                              : "border-white/10"
                        }`}
                      >
                        <img
                          src={img.src}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          className="h-full w-auto object-contain"
                        />
                      </div>
                    ))}
                    {(project.latestImageCount ?? 0) > 6 && (
                      <div className="flex shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] px-3 text-[10px] text-zinc-500">
                        +{(project.latestImageCount ?? 0) - 6}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mb-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] text-[11px] text-zinc-600">
                  <ImageIcon className="mr-1.5 size-3.5" />
                  暂无最近结果
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{project.title}</div>
                  <div className="mt-1 text-xs text-zinc-400">{project.presetNames.join(" · ") || "无预设"}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">{project.status}</span>
                  <ChevronRight className="size-4 text-zinc-500" />
                </div>
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                最近更新：{project.updatedAt} · {project.sectionCount} 个小节
                {project.latestRunAt ? ` · 最近运行：${project.latestRunAt}` : ""}
              </div>
              </Link>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
