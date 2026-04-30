"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  ImageIcon,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import type { ProjectResultsData } from "@/lib/server-data";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import {
  addScrollListener,
  getMaxScrollTop,
  getPreferredScrollContainer,
  getScrollProgress,
  scrollContainerTo,
} from "@/lib/scroll-container";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

type ProjectResultsSection = ProjectResultsData["sections"][number];
type ProjectResultsRun = ProjectResultsSection["runs"][number];
type ProjectResultsImage = ProjectResultsRun["images"][number];

const COLLAPSED_ROW_COUNT = 2;

type ProjectResultsImageWithRun = ProjectResultsImage & {
  runIndex: number;
};

function scrollToSection(sectionId: string) {
  const element = document.getElementById(`section-${sectionId}`);
  if (!element) return;

  const container = getPreferredScrollContainer('[data-slot="sidebar-inset"]');
  if (container instanceof Window) {
    const y = element.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top: y, behavior: "smooth" });
  } else {
    const y = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
    container.scrollTo({ top: y, behavior: "smooth" });
  }
}

function findNavItem(container: HTMLElement, sectionId: string) {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-nav-section-id]")).find(
    (item) => item.dataset.navSectionId === sectionId,
  );
}

function ProjectResultsSidebar({
  project,
  activeSectionId,
}: {
  project: ProjectResultsData;
  activeSectionId: string | null;
}) {
  const { state: sidebarState } = useSidebar();
  const isExpanded = sidebarState === "expanded";
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const syncLockRef = useRef<"main" | "sidebar" | null>(null);
  const syncUnlockTimerRef = useRef<number | null>(null);

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
    const mainScroller = getPreferredScrollContainer('[data-slot="sidebar-inset"]');
    const sidebarScroller = sidebarContentRef.current;
    if (!sidebarScroller) return;

    let mainFrame: number | null = null;
    let sidebarFrame: number | null = null;

    const syncFromMain = () => {
      mainFrame = null;
      if (syncLockRef.current === "sidebar") return;

      const progress = getScrollProgress(mainScroller);
      const targetTop = progress * getMaxScrollTop(sidebarScroller);
      runWithSyncLock("main", () => {
        scrollContainerTo(sidebarScroller, targetTop, "instant");
      });
    };

    const syncFromSidebar = () => {
      sidebarFrame = null;
      if (syncLockRef.current === "main") return;

      const progress = getScrollProgress(sidebarScroller);
      const targetTop = progress * getMaxScrollTop(mainScroller);
      runWithSyncLock("sidebar", () => {
        scrollContainerTo(mainScroller, targetTop, "instant");
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

    const removeMainScrollListener = addScrollListener(mainScroller, handleMainScroll, { passive: true });
    const removeSidebarScrollListener = addScrollListener(sidebarScroller, handleSidebarScroll, { passive: true });
    handleMainScroll();

    return () => {
      removeMainScrollListener();
      removeSidebarScrollListener();

      if (mainFrame !== null) window.cancelAnimationFrame(mainFrame);
      if (sidebarFrame !== null) window.cancelAnimationFrame(sidebarFrame);
      if (syncUnlockTimerRef.current !== null) {
        window.clearTimeout(syncUnlockTimerRef.current);
        syncUnlockTimerRef.current = null;
      }
    };
  }, [project.sections.length, runWithSyncLock]);

  useEffect(() => {
    if (!activeSectionId) return;
    const sidebarScroller = sidebarContentRef.current;
    if (!sidebarScroller) return;

    const navItem = findNavItem(sidebarScroller, activeSectionId);
    if (!navItem) return;

    const containerRect = sidebarScroller.getBoundingClientRect();
    const itemRect = navItem.getBoundingClientRect();
    const isVisible = itemRect.top >= containerRect.top && itemRect.bottom <= containerRect.bottom;

    if (isVisible) return;

    const targetTop =
      sidebarScroller.scrollTop +
      itemRect.top -
      containerRect.top -
      (containerRect.height - itemRect.height) / 2;

    runWithSyncLock("main", () => {
      scrollContainerTo(sidebarScroller, targetTop, "smooth");
    }, 700);
  }, [activeSectionId, runWithSyncLock]);

  return (
    <Sidebar collapsible="icon" mobileBehavior="sidebar" className="border-r border-white/5">
      <SidebarHeader className="gap-1.5 px-3.5 py-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 group-data-[collapsible=icon]:justify-center"
        >
          <ArrowLeft className="size-3.5" />
          {isExpanded && <span>返回项目详情</span>}
        </Link>
        {isExpanded && (
          <div className="mt-1 space-y-2 rounded-xl border border-sky-500/15 bg-sky-500/[0.06] px-3 py-2 shadow-inner shadow-sky-500/5">
            <p className="text-[10px] text-sky-300/70">项目结果</p>
            <h1 className="truncate text-[15px] font-semibold leading-5 text-sky-50">{project.title}</h1>
            <div className="grid grid-cols-2 gap-1.5">
              {project.previousProject ? (
                <Link
                  href={`/projects/${project.previousProject.id}/results`}
                  title={project.previousProject.title}
                  className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <ChevronLeft className="size-3 shrink-0" />
                  <span className="truncate">上一个</span>
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/5 px-2 py-1 text-[11px] text-zinc-600">
                  <ChevronLeft className="size-3" />
                  上一个
                </span>
              )}
              {project.nextProject ? (
                <Link
                  href={`/projects/${project.nextProject.id}/results`}
                  title={project.nextProject.title}
                  className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <span className="truncate">下一个</span>
                  <ChevronRight className="size-3 shrink-0" />
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/5 px-2 py-1 text-[11px] text-zinc-600">
                  下一个
                  <ChevronRight className="size-3" />
                </span>
              )}
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent ref={sidebarContentRef} className="overflow-x-hidden">
        <SidebarGroup>
          <SidebarGroupLabel>小节结果</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {project.sections.map((section, index) => (
                <SidebarMenuItem key={section.id} className="flex items-center gap-1" data-nav-section-id={section.id}>
                  <SidebarMenuButton
                    tooltip={`${index + 1}. ${section.name}`}
                    isActive={activeSectionId === section.id}
                    onClick={() => scrollToSection(section.id)}
                    className="h-auto min-h-9 flex-1 py-2"
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center text-[11px] text-zinc-500">
                      {index + 1}
                    </span>
                    <span className="line-clamp-2 !whitespace-normal text-xs">{section.name}</span>
                  </SidebarMenuButton>
                  {isExpanded && (
                    <Link
                      href={`/projects/${project.id}/sections/${section.id}/results`}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-sky-300"
                      title="小节审核"
                    >
                      <ClipboardCheck className="size-3.5" />
                    </Link>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-3" />
      <SidebarRail />
    </Sidebar>
  );
}

function ResultImageCard({
  image,
  onToggleFeatured,
  disabled,
}: {
  image: ProjectResultsImageWithRun;
  onToggleFeatured: (imageId: string, featured: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div
      className={`group relative flex h-44 items-center justify-center overflow-hidden rounded-xl border bg-white/[0.03] transition hover:border-sky-500/40 ${
        image.status === "kept"
          ? "border-emerald-500/30"
          : image.status === "pending"
            ? "border-amber-500/20"
            : "border-white/10"
      }`}
    >
      <a
        href={image.full}
        target="_blank"
        rel="noreferrer"
        className="flex size-full items-center justify-center"
        title="打开原图"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt=""
          loading="lazy"
          decoding="async"
          className="max-h-full max-w-full object-contain"
        />
      </a>

      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleFeatured(image.id, !image.featured);
        }}
        className={`absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-full border backdrop-blur transition disabled:opacity-50 ${
          image.featured
            ? "border-amber-300/40 bg-amber-400/25 text-amber-200"
            : "border-white/15 bg-black/40 text-white/70 hover:bg-white/15 hover:text-amber-200"
        }`}
        title={image.featured ? "取消精选" : "标记为精选"}
      >
        <Star className="size-3.5" fill={image.featured ? "currentColor" : "none"} />
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/45 px-2 py-1 text-[10px] text-zinc-200 opacity-90">
        <span>Run #{image.runIndex}</span>
        {image.featured && <span className="text-amber-200">精选</span>}
      </div>
    </div>
  );
}

function SectionResultsBlock({
  projectId,
  section,
  onToggleFeatured,
  togglingImageId,
  isExpanded,
  onToggleExpanded,
  collapsedImageCount,
}: {
  projectId: string;
  section: ProjectResultsSection;
  onToggleFeatured: (imageId: string, featured: boolean) => void;
  togglingImageId: string | null;
  isExpanded: boolean;
  onToggleExpanded: (sectionId: string) => void;
  collapsedImageCount: number;
}) {
  const images = section.runs.flatMap((run) =>
    run.images.map((image) => ({
      ...image,
      runIndex: run.runIndex,
    })),
  );
  const shouldCollapse = images.length > collapsedImageCount;
  const visibleImages = shouldCollapse && !isExpanded ? images.slice(0, collapsedImageCount) : images;

  return (
    <section id={`section-${section.id}`} className="scroll-mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-sm font-semibold text-white">{section.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>{section.runCount} 次运行</span>
            <span>{section.imageCount} 张图片</span>
            {section.pendingCount > 0 && <span className="text-amber-400">{section.pendingCount} 待审</span>}
            {section.featuredCount > 0 && <span className="text-amber-300">{section.featuredCount} 精选</span>}
          </div>
        </div>
        <Link
          href={`/projects/${projectId}/sections/${section.id}/results`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300 transition hover:bg-sky-500/20"
        >
          <ClipboardCheck className="size-3.5" />
          小节审核
        </Link>
      </div>

      {section.imageCount === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-white/5 bg-white/[0.01] py-8 text-xs text-zinc-600">
          暂无结果
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleImages.map((image) => (
              <ResultImageCard
                key={image.id}
                image={image}
                onToggleFeatured={onToggleFeatured}
                disabled={togglingImageId === image.id}
              />
            ))}
          </div>
          {shouldCollapse && (
            <button
              type="button"
              onClick={() => onToggleExpanded(section.id)}
              className="mx-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="size-3.5" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" />
                  显示全部（剩余 {images.length - collapsedImageCount} 张）
                </>
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function ProjectResultsClient({ project }: { project: ProjectResultsData }) {
  const [sections, setSections] = useState(project.sections);
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(new Set());
  const [collapsedImageCount, setCollapsedImageCount] = useState(2 * COLLAPSED_ROW_COUNT);
  const [togglingImageId, setTogglingImageId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections]);
  const activeSectionId = useScrollSpy(sectionIds, {
    rootSelector: '[data-slot="sidebar-inset"]',
  });

  const totalImages = sections.reduce((sum, section) => sum + section.imageCount, 0);
  const totalFeatured = sections.reduce((sum, section) => sum + section.featuredCount, 0);

  useEffect(() => {
    const getColumnCount = () => {
      if (window.matchMedia("(min-width: 1280px)").matches) return 5;
      if (window.matchMedia("(min-width: 1024px)").matches) return 4;
      if (window.matchMedia("(min-width: 640px)").matches) return 3;
      return 2;
    };

    const syncCollapsedImageCount = () => {
      setCollapsedImageCount(getColumnCount() * COLLAPSED_ROW_COUNT);
    };

    syncCollapsedImageCount();
    window.addEventListener("resize", syncCollapsedImageCount);
    return () => window.removeEventListener("resize", syncCollapsedImageCount);
  }, []);

  const toggleExpandedSection = useCallback((sectionId: string) => {
    setExpandedSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const setImageFeatured = useCallback((imageId: string, featured: boolean) => {
    setSections((currentSections) =>
      currentSections.map((section) => {
        let sectionChanged = false;
        const runs = section.runs.map((run) => {
          let runChanged = false;
          const images = run.images.map((image) => {
            if (image.id !== imageId) return image;
            sectionChanged = true;
            runChanged = true;
            return { ...image, featured };
          });
          return runChanged ? { ...run, images } : run;
        });

        if (!sectionChanged) return section;

        const featuredCount = runs.reduce(
          (sum, run) => sum + run.images.filter((image) => image.featured).length,
          0,
        );
        return { ...section, runs, featuredCount };
      }),
    );
  }, []);

  const handleToggleFeatured = useCallback((imageId: string, featured: boolean) => {
    if (togglingImageId) return;
    setTogglingImageId(imageId);
    setImageFeatured(imageId, featured);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/images/${encodeURIComponent(imageId)}/featured`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featured }),
        });
        const result = await response.json().catch(() => null) as { ok?: boolean; error?: { message?: string } } | null;
        if (!response.ok || result?.ok === false) {
          throw new Error(result?.error?.message ?? "更新精选失败");
        }
      } catch (error) {
        setImageFeatured(imageId, !featured);
        toast.error(error instanceof Error ? error.message : "更新精选失败");
      } finally {
        setTogglingImageId(null);
      }
    });
  }, [setImageFeatured, togglingImageId]);

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "14rem",
        "--sidebar-width-icon": "3rem",
      } as React.CSSProperties}
      className="-mx-5 min-h-[calc(100dvh-5rem)] w-[calc(100%+2.5rem)] bg-transparent sm:-mx-6 sm:w-[calc(100%+3rem)]"
    >
      <ProjectResultsSidebar
        project={{ ...project, sections }}
        activeSectionId={activeSectionId}
      />

      <SidebarInset className="flex-1 overflow-auto bg-transparent">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pb-24 pt-4 sm:px-6">
          <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b border-white/[0.06] bg-[var(--bg)]/80 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
            <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <ImageIcon className="size-3.5" />
                <span>项目结果</span>
              </div>
              <h1 className="truncate text-sm font-semibold text-white">{project.title}</h1>
            </div>
            <div className="hidden shrink-0 items-center gap-2 text-[11px] text-zinc-500 sm:flex">
              <span>{sections.length} 小节</span>
              <span>{totalImages} 张图片</span>
              <span>{totalFeatured} 精选</span>
            </div>
          </div>

          {sections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
              暂无小节
            </div>
          ) : (
            sections.map((section) => (
              <SectionResultsBlock
                key={section.id}
                projectId={project.id}
                section={section}
                onToggleFeatured={handleToggleFeatured}
                togglingImageId={togglingImageId}
                isExpanded={expandedSectionIds.has(section.id)}
                onToggleExpanded={toggleExpandedSection}
                collapsedImageCount={collapsedImageCount}
              />
            ))
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
