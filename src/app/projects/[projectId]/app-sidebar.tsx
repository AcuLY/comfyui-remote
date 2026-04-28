"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
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
  activeSectionId: string | null;
  onNavigateToSection: (id: string) => void;
};

function clampScrollTop(value: number, element: HTMLElement) {
  const max = Math.max(0, element.scrollHeight - element.clientHeight);
  return Math.min(Math.max(0, value), max);
}

function getScrollProgress(element: HTMLElement) {
  const max = element.scrollHeight - element.clientHeight;
  if (max <= 0) return 0;
  return element.scrollTop / max;
}

function findNavItem(container: HTMLElement, sectionId: string) {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-nav-section-id]")).find(
    (item) => item.dataset.navSectionId === sectionId,
  );
}

export function AppSidebar({
  projectId,
  projectTitle,
  sections,
  compact,
  onToggleCompact,
  activeSectionId,
  onNavigateToSection,
}: AppSidebarProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [batchSize, setBatchSize] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const sectionNavRef = useRef<HTMLDivElement>(null);
  const syncLockRef = useRef<"main" | "sidebar" | null>(null);
  const syncUnlockTimerRef = useRef<number | null>(null);
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();

  const runWithSyncLock = useCallback((source: "main" | "sidebar", callback: () => void, duration = 180) => {
    syncLockRef.current = source;
    callback();

    if (syncUnlockTimerRef.current !== null) {
      window.clearTimeout(syncUnlockTimerRef.current);
    }

    syncUnlockTimerRef.current = window.setTimeout(() => {
      syncLockRef.current = null;
      syncUnlockTimerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    const mainScroller = document.querySelector<HTMLElement>('[data-slot="sidebar-inset"]');
    const sectionNav = sectionNavRef.current;
    if (!mainScroller || !sectionNav) return;

    let mainFrame: number | null = null;
    let sidebarFrame: number | null = null;

    const syncFromMain = () => {
      mainFrame = null;
      if (syncLockRef.current === "sidebar") return;

      const progress = getScrollProgress(mainScroller);
      const targetTop = progress * Math.max(0, sectionNav.scrollHeight - sectionNav.clientHeight);
      runWithSyncLock("main", () => {
        sectionNav.scrollTo({ top: clampScrollTop(targetTop, sectionNav), behavior: "instant" });
      });
    };

    const syncFromSidebar = () => {
      sidebarFrame = null;
      if (syncLockRef.current === "main") return;

      const progress = getScrollProgress(sectionNav);
      const targetTop = progress * Math.max(0, mainScroller.scrollHeight - mainScroller.clientHeight);
      runWithSyncLock("sidebar", () => {
        mainScroller.scrollTo({ top: clampScrollTop(targetTop, mainScroller), behavior: "instant" });
      });
    };

    const handleMainScroll = () => {
      if (mainFrame !== null) return;
      mainFrame = window.requestAnimationFrame(syncFromMain);
    };

    const handleSidebarScroll = () => {
      if (sidebarFrame !== null) return;
      sidebarFrame = window.requestAnimationFrame(syncFromSidebar);
    };

    mainScroller.addEventListener("scroll", handleMainScroll, { passive: true });
    sectionNav.addEventListener("scroll", handleSidebarScroll, { passive: true });
    handleMainScroll();

    return () => {
      mainScroller.removeEventListener("scroll", handleMainScroll);
      sectionNav.removeEventListener("scroll", handleSidebarScroll);

      if (mainFrame !== null) window.cancelAnimationFrame(mainFrame);
      if (sidebarFrame !== null) window.cancelAnimationFrame(sidebarFrame);
      if (syncUnlockTimerRef.current !== null) {
        window.clearTimeout(syncUnlockTimerRef.current);
        syncUnlockTimerRef.current = null;
      }
    };
  }, [sections.length, runWithSyncLock]);

  // Auto-scroll sidebar to keep the active section nav item centered.
  useEffect(() => {
    if (!activeSectionId) return;
    const sectionNav = sectionNavRef.current;
    if (!sectionNav) return;

    const navItem = findNavItem(sectionNav, activeSectionId);
    if (!navItem) return;

    const containerRect = sectionNav.getBoundingClientRect();
    const itemRect = navItem.getBoundingClientRect();
    const targetTop =
      sectionNav.scrollTop +
      itemRect.top -
      containerRect.top -
      (containerRect.height - itemRect.height) / 2;

    runWithSyncLock("main", () => {
      sectionNav.scrollTo({
        top: clampScrollTop(targetTop, sectionNav),
        behavior: "smooth",
      });
    }, 700);
  }, [activeSectionId, runWithSyncLock]);

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

      <SidebarContent className="overflow-hidden">
        <div className="shrink-0">
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
        </div>

        {/* ── 小节 ── */}
        {sections.length > 0 && (
          <SidebarGroup className="min-h-0 flex-1">
            <SidebarGroupLabel>小节</SidebarGroupLabel>
            <SidebarGroupContent className="flex min-h-0 flex-1 overflow-hidden">
              <div
                ref={sectionNavRef}
                data-section-nav-scroll
                className="min-h-0 flex-1 overflow-y-auto pr-1"
              >
              <SidebarMenu>
                {sections.map((section, index) => (
                  <SidebarMenuItem key={section.id} data-nav-section-id={section.id}>
                    <SidebarMenuButton
                      tooltip={`${index + 1}. ${section.name}`}
                      isActive={activeSectionId === section.id}
                      onClick={() => {
                        onNavigateToSection(section.id);
                        if (isMobile) setOpenMobile(false);
                      }}
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
              </div>
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
