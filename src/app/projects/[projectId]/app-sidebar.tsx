"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  SlidersHorizontal,
  Download,
  Save,
  LayoutList,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  runProject,
  saveProjectAsTemplate,
} from "@/lib/actions";
import { exportProjectImages } from "@/app/projects/actions-export";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";
import {
  SidebarSectionNav,
  useSyncedSidebarContent,
} from "@/components/section-sidebar-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

type Section = {
  id: string;
  name: string;
  batchSize: number | null;
  aspectRatio: string | null;
  seedPolicy1: string | null;
  seedPolicy2: string | null;
  latestRunStatus: string | null;
  latestRunId: string | null;
  promptBlockCount: number;
  positiveBlockCount: number;
  negativeBlockCount: number;
  latestImages: { id: string; src: string; status: string }[];
};

type AppSidebarProps = {
  projectId: string;
  projectTitle: string;
  previousProject: { id: string; title: string } | null;
  nextProject: { id: string; title: string } | null;
  sections: Section[];
  compact: boolean;
  onToggleCompact: () => void;
  activeSectionId: string | null;
  onNavigateToSection: (id: string) => void;
};

export function AppSidebar({
  projectId,
  projectTitle,
  previousProject,
  nextProject,
  sections,
  compact,
  onToggleCompact,
  activeSectionId,
  onNavigateToSection,
}: AppSidebarProps) {
  const [isPending, startTransition] = useTransition();
  const [batchSize, setBatchSize] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const { state: sidebarState } = useSidebar();
  const sidebarContentRef = useSyncedSidebarContent({
    activeSectionId,
    itemCount: sections.length,
  });

  const parsedBatchSize = batchSize.trim() ? parseInt(batchSize, 10) : null;

  function handleRun() {
    const parsed = batchSize.trim() ? parseInt(batchSize, 10) : undefined;
    const overrideBatchSize =
      parsed && Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
    startTransition(async () => {
      try {
        await runProject(projectId, overrideBatchSize);
        toast.success("已提交运行");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "运行失败");
      }
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const result = await exportProjectImages(projectId);
      toast[result.success ? "success" : "error"](result.message);
    } catch {
      toast.error("导出失败");
    } finally {
      setExporting(false);
    }
  }

  function handleSaveTemplate() {
    const name = prompt("模板名称：", projectTitle || "");
    if (!name) return;
    startTransition(async () => {
      try {
        await saveProjectAsTemplate(projectId, name);
        toast.success(`已保存为模板「${name}」`);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  const isExpanded = sidebarState === "expanded";

  return (
    <Sidebar
      collapsible="icon"
      mobileBehavior="sidebar"
      className="border-r border-white/5"
    >
      <SidebarHeader className="gap-1.5 px-3.5 py-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 group-data-[collapsible=icon]:justify-center"
        >
          <ArrowLeft className="size-3.5" />
          {isExpanded && <span>返回项目列表</span>}
        </Link>
        {isExpanded && (
          <div className="mt-1 space-y-2 rounded-xl border border-sky-500/15 bg-sky-500/[0.06] px-3 py-2 shadow-inner shadow-sky-500/5">
            <h1 className="truncate text-[15px] font-semibold leading-5 text-sky-50">
              {projectTitle}
            </h1>
            <div className="grid grid-cols-2 gap-1.5">
              {previousProject ? (
                <Link
                  href={`/projects/${previousProject.id}`}
                  title={`上一个项目：${previousProject.title}`}
                  aria-label={`上一个项目：${previousProject.title}`}
                  className="inline-flex h-8 min-w-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <ChevronLeft className="size-4 shrink-0" />
                </Link>
              ) : (
                <span
                  title="没有上一个项目"
                  aria-label="没有上一个项目"
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-white/5 text-zinc-600"
                >
                  <ChevronLeft className="size-4" />
                </span>
              )}
              {nextProject ? (
                <Link
                  href={`/projects/${nextProject.id}`}
                  title={`下一个项目：${nextProject.title}`}
                  aria-label={`下一个项目：${nextProject.title}`}
                  className="inline-flex h-8 min-w-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <ChevronRight className="size-4 shrink-0" />
                </Link>
              ) : (
                <span
                  title="没有下一个项目"
                  aria-label="没有下一个项目"
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-white/5 text-zinc-600"
                >
                  <ChevronRight className="size-4" />
                </span>
              )}
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent ref={sidebarContentRef} className="overflow-x-hidden">
        {/* ── 操作 ── */}
        <SidebarGroup>
          <SidebarGroupLabel>操作</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* 运行整组 */}
              <SidebarMenuItem>
                {isExpanded && (
                  <div className="px-1 pb-0.5 mx-1 my-2">
                    <BatchSizeQuickFill
                      onSelect={(val) => setBatchSize(String(val))}
                      currentValue={parsedBatchSize}
                      disabled={isPending}
                      showClear
                      onClear={() => setBatchSize("")}
                      size="sm"
                    />
                  </div>
                )}
                <SidebarMenuButton
                  tooltip="运行整组"
                  onClick={handleRun}
                  disabled={isPending}
                  className="text-sky-300 hover:bg-sky-500/10 hover:text-sky-200 text-[11px] sm:text-sm"
                >
                  <Play className="size-4" />
                  <span className="text-[11px] sm:inherit">
                    {isPending ? "提交中…" : "运行整组"}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* 编辑项目参数 */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href={`/projects/${projectId}/edit`} />}
                  tooltip="编辑项目参数"
                >
                  <SlidersHorizontal className="size-4" />
                  <span className="text-[11px] sm:inherit">编辑项目参数</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href={`/projects/${projectId}/results`} />}
                  tooltip="项目结果"
                  className="text-violet-300 hover:bg-violet-500/10 hover:text-violet-200 text-[11px] sm:text-sm"
                >
                  <ImageIcon className="size-4" />
                  <span className="text-[11px] sm:inherit">项目结果</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* 图片整合 */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="图片整合"
                  onClick={handleExport}
                  disabled={exporting}
                  className="text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 text-[11px] sm:text-sm"
                >
                  <Download className="size-4" />
                  <span className="text-[11px] sm:inherit">
                    {exporting ? "导出中…" : "图片整合"}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* 保存为模板 */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="保存为模板"
                  onClick={handleSaveTemplate}
                  disabled={isPending}
                  className="text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 text-[11px] sm:text-sm"
                >
                  <Save className="size-4" />
                  <span className="text-[11px] sm:inherit">
                    {isPending ? "保存中…" : "保存为模板"}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarSectionNav
          label="小节"
          sections={sections}
          activeSectionId={activeSectionId}
          onNavigateToSection={onNavigateToSection}
          menuClassName="gap-2 md:gap-1"
          labelAction={
            <button
              onClick={onToggleCompact}
              className="text-zinc-500 hover:text-zinc-300 transition"
              title={compact ? "展开视图" : "紧凑视图"}
            >
              {compact ? (
                <LayoutGrid className="size-3.5" />
              ) : (
                <LayoutList className="size-3.5" />
              )}
            </button>
          }
          buttonClassName={(_, __, isActive) =>
            isActive
              ? "min-h-10 text-sky-300 md:min-h-8"
              : "min-h-10 md:min-h-8"
          }
        />
      </SidebarContent>

      <SidebarFooter className="px-3 py-3" />

      <SidebarRail />
    </Sidebar>
  );
}
