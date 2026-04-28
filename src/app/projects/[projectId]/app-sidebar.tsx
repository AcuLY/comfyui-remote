"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  SlidersHorizontal,
  Download,
  Save,
  Trash2,
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";

import { runProject, deleteProject, saveProjectAsTemplate } from "@/lib/actions";
import { exportProjectImages } from "@/app/projects/actions-export";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
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
  sections: Section[];
  compact: boolean;
  onToggleCompact: () => void;
};

export function AppSidebar({
  projectId,
  projectTitle,
  sections,
  compact,
  onToggleCompact,
}: AppSidebarProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [batchSize, setBatchSize] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const { state: sidebarState } = useSidebar();

  const activeSectionId = useScrollSpy(sections.map((s) => s.id), {
    rootSelector: '[data-slot="sidebar-inset"]',
  });

  // Auto-scroll sidebar to keep the active section nav item visible
  useEffect(() => {
    if (!activeSectionId) return;
    const sidebarContent = document.querySelector('[data-slot="sidebar-content"]');
    if (!sidebarContent) return;
    const btn = sidebarContent.querySelector(`[data-nav-section-id="${activeSectionId}"]`);
    if (!btn) return;
    const containerRect = sidebarContent.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    if (btnRect.top < containerRect.top || btnRect.bottom > containerRect.bottom) {
      btn.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeSectionId]);

  const parsedBatchSize = batchSize.trim() ? parseInt(batchSize, 10) : null;

  function handleRun() {
    const parsed = batchSize.trim() ? parseInt(batchSize, 10) : undefined;
    const overrideBatchSize = parsed && Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
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

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    startTransition(async () => {
      try {
        await deleteProject(projectId);
        toast.success("项目已删除");
        router.push("/projects");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  function scrollToSection(id: string) {
    const element = document.getElementById(`section-${id}`);
    if (!element) return;
    // Find the scrollable SidebarInset container
    const inset = document.querySelector('[data-slot="sidebar-inset"]');
    if (inset) {
      const y = element.getBoundingClientRect().top - inset.getBoundingClientRect().top + inset.scrollTop - 16;
      inset.scrollTo({ top: y, behavior: "smooth" });
    } else {
      const y = element.getBoundingClientRect().top + window.scrollY - 16;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
    window.history.replaceState(null, "", `#section-${id}`);
  }

  const isExpanded = sidebarState === "expanded";

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5">
      <SidebarHeader className="px-3 py-3">
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-[11px] text-zinc-400 transition hover:text-zinc-200 group-data-[collapsible=icon]:justify-center"
        >
          <span className="text-base leading-none">&larr;</span>
          {isExpanded && <span>返回项目列表</span>}
        </Link>
        {isExpanded && (
          <h1 className="mt-1 truncate text-sm font-semibold text-zinc-100">
            {projectTitle}
          </h1>
        )}
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {/* ── 操作 ── */}
        <SidebarGroup>
          <SidebarGroupLabel>操作</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* 运行整组 */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="运行整组"
                  onClick={handleRun}
                  disabled={isPending}
                  className="text-sky-300 hover:bg-sky-500/10 hover:text-sky-200"
                >
                  <Play className="size-4" />
                  <span>{isPending ? "提交中…" : "运行整组"}</span>
                </SidebarMenuButton>
                {isExpanded && (
                  <div className="ml-2 mt-1 px-2 pb-1">
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
              </SidebarMenuItem>

              {/* 编辑项目参数 */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href={`/projects/${projectId}/edit`} />}
                  tooltip="编辑项目参数"
                >
                  <SlidersHorizontal className="size-4" />
                  <span>编辑项目参数</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* 图片整合 */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="图片整合"
                  onClick={handleExport}
                  disabled={exporting}
                  className="text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
                >
                  <Download className="size-4" />
                  <span>{exporting ? "导出中…" : "图片整合"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* 保存为模板 */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="保存为模板"
                  onClick={handleSaveTemplate}
                  disabled={isPending}
                  className="text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
                >
                  <Save className="size-4" />
                  <span>{isPending ? "保存中…" : "保存为模板"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* 删除项目 */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="删除项目"
                  onClick={handleDelete}
                  disabled={isPending}
                  className={
                    deleteConfirm
                      ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                      : "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  }
                >
                  <Trash2 className="size-4" />
                  <span>{deleteConfirm ? "确认删除？" : "删除项目"}</span>
                </SidebarMenuButton>
                {deleteConfirm && isExpanded && (
                  <div className="ml-2 mt-1 flex gap-1.5 px-2 pb-1">
                    <button
                      onClick={handleDelete}
                      disabled={isPending}
                      className="rounded-md border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[11px] text-red-300 transition hover:bg-red-500/25 disabled:opacity-50"
                    >
                      {isPending ? "删除中…" : "确认"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-400 transition hover:bg-white/[0.08]"
                    >
                      取消
                    </button>
                  </div>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* ── 小节 ── */}
        {sections.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>小节</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sections.map((section, index) => (
                  <SidebarMenuItem key={section.id} data-nav-section-id={section.id}>
                    <SidebarMenuButton
                      tooltip={`${index + 1}. ${section.name}`}
                      isActive={activeSectionId === section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={
                        activeSectionId === section.id
                          ? "text-sky-300"
                          : ""
                      }
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center text-[11px] text-zinc-500">
                        {index + 1}
                      </span>
                      <span className="line-clamp-2 text-xs">{section.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="px-2 py-2">
        <SidebarMenuButton
          tooltip={compact ? "展开视图" : "紧凑视图"}
          onClick={onToggleCompact}
          className="text-zinc-400 hover:text-zinc-200"
        >
          {compact ? (
            <LayoutGrid className="size-4" />
          ) : (
            <LayoutList className="size-4" />
          )}
          {isExpanded && (
            <span className="text-xs">{compact ? "展开视图" : "紧凑视图"}</span>
          )}
        </SidebarMenuButton>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
