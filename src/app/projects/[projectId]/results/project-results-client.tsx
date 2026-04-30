"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
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
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { ProjectResultsData } from "@/lib/server-data";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { getPreferredScrollContainer } from "@/lib/scroll-container";
import {
  SidebarSectionNav,
  useSyncedSidebarContent,
} from "@/components/section-sidebar-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
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
    const y =
      element.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      16;
    container.scrollTo({ top: y, behavior: "smooth" });
  }
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
  const sidebarContentRef = useSyncedSidebarContent({
    activeSectionId,
    itemCount: project.sections.length,
  });

  return (
    <Sidebar
      collapsible="icon"
      mobileBehavior="sidebar"
      className="border-r border-white/5"
    >
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
            <h1 className="truncate text-[15px] font-semibold leading-5 text-sky-50">
              {project.title}
            </h1>
            <div className="grid grid-cols-2 gap-1.5">
              {project.previousProject ? (
                <Link
                  href={`/projects/${project.previousProject.id}/results`}
                  title={`上一个项目：${project.previousProject.title}`}
                  aria-label={`上一个项目：${project.previousProject.title}`}
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
              {project.nextProject ? (
                <Link
                  href={`/projects/${project.nextProject.id}/results`}
                  title={`下一个项目：${project.nextProject.title}`}
                  aria-label={`下一个项目：${project.nextProject.title}`}
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
        <SidebarSectionNav
          label="小节结果"
          sections={project.sections}
          activeSectionId={activeSectionId}
          onNavigateToSection={scrollToSection}
          menuClassName="gap-1"
          buttonClassName="min-h-9"
        />
      </SidebarContent>

      <SidebarFooter className="px-3 py-3" />
      <SidebarRail />
    </Sidebar>
  );
}

function ResultImageCard({
  image,
  onOpen,
  onToggleFeatured,
  onToggleFeatured2,
  disabled,
}: {
  image: ProjectResultsImageWithRun;
  onOpen: (imageId: string) => void;
  onToggleFeatured: (imageId: string, featured: boolean) => void;
  onToggleFeatured2: (imageId: string, featured2: boolean) => void;
  disabled: boolean;
}) {
  const aspectRatio =
    image.width && image.height && image.width > 0 && image.height > 0
      ? `${image.width} / ${image.height}`
      : "1 / 1";

  return (
    <div
      style={{ aspectRatio }}
      className={`group relative flex w-full items-center justify-center overflow-hidden rounded-lg border bg-white/[0.03] transition hover:border-sky-500/40 ${
        image.status === "kept"
          ? "border-emerald-500/30"
          : image.status === "pending"
            ? "border-amber-500/20"
            : "border-white/10"
      }`}
    >
      <button
        type="button"
        className="flex size-full items-center justify-center"
        title="放大预览"
        onClick={() => onOpen(image.id)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt=""
          loading="lazy"
          decoding="async"
          className="max-h-full max-w-full object-contain"
        />
      </button>

      <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFeatured2(image.id, !image.featured2);
          }}
          className={`inline-flex size-7 items-center justify-center rounded-full border text-[10px] font-semibold backdrop-blur transition disabled:opacity-50 ${
            image.featured2
              ? "border-cyan-300/40 bg-cyan-400/25 text-cyan-100"
              : "border-white/15 bg-black/40 text-white/70 hover:bg-white/15 hover:text-cyan-200"
          }`}
          title={image.featured2 ? "取消精选2" : "标记为精选2"}
        >
          2
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFeatured(image.id, !image.featured);
          }}
          className={`inline-flex size-7 items-center justify-center rounded-full border backdrop-blur transition disabled:opacity-50 ${
            image.featured
              ? "border-amber-300/40 bg-amber-400/25 text-amber-200"
              : "border-white/15 bg-black/40 text-white/70 hover:bg-white/15 hover:text-amber-200"
          }`}
          title={image.featured ? "取消精选" : "标记为精选"}
        >
          <Star
            className="size-3.5"
            fill={image.featured ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/45 px-2 py-1 text-[10px] text-zinc-200 opacity-90">
        <span>Run #{image.runIndex}</span>
        <span className="flex items-center gap-1">
          {image.featured && <span className="text-amber-200">精选</span>}
          {image.featured2 && <span className="text-cyan-200">精选2</span>}
        </span>
      </div>
    </div>
  );
}

function SectionResultsBlock({
  projectId,
  section,
  onToggleFeatured,
  onToggleFeatured2,
  onOpenImage,
  togglingImageId,
  isExpanded,
  onToggleExpanded,
  collapsedImageCount,
}: {
  projectId: string;
  section: ProjectResultsSection;
  onToggleFeatured: (imageId: string, featured: boolean) => void;
  onToggleFeatured2: (imageId: string, featured2: boolean) => void;
  onOpenImage: (imageId: string) => void;
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
  const visibleImages =
    shouldCollapse && !isExpanded
      ? images.slice(0, collapsedImageCount)
      : images;

  return (
    <section
      id={`section-${section.id}`}
      className="scroll-mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-sm font-semibold text-white">
            {section.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>{section.runCount} 次运行</span>
            <span>{section.imageCount} 张图片</span>
            {section.pendingCount > 0 && (
              <span className="text-amber-400">
                {section.pendingCount} 待审
              </span>
            )}
            {section.featuredCount > 0 && (
              <span className="text-amber-300">
                {section.featuredCount} 精选
              </span>
            )}
            {section.featured2Count > 0 && (
              <span className="text-cyan-300">
                {section.featured2Count} 精选2
              </span>
            )}
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] items-start gap-2">
            {visibleImages.map((image) => (
              <ResultImageCard
                key={image.id}
                image={image}
                onOpen={onOpenImage}
                onToggleFeatured={onToggleFeatured}
                onToggleFeatured2={onToggleFeatured2}
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

export function ProjectResultsClient({
  project,
}: {
  project: ProjectResultsData;
}) {
  const [sections, setSections] = useState(project.sections);
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(
    new Set(),
  );
  const [collapsedImageCount, setCollapsedImageCount] = useState(
    2 * COLLAPSED_ROW_COUNT,
  );
  const [togglingImageId, setTogglingImageId] = useState<string | null>(null);
  const [lightboxImageId, setLightboxImageId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sectionIds = useMemo(
    () => sections.map((section) => section.id),
    [sections],
  );
  const activeSectionId = useScrollSpy(sectionIds, {
    rootSelector: '[data-slot="sidebar-inset"]',
  });
  const allImages = useMemo(
    () =>
      sections.flatMap((section) =>
        section.runs.flatMap((run) =>
          run.images.map((image) => ({
            ...image,
            runIndex: run.runIndex,
          })),
        ),
      ),
    [sections],
  );
  const lightboxIndex = lightboxImageId
    ? allImages.findIndex((image) => image.id === lightboxImageId)
    : -1;
  const lightboxImage = lightboxIndex >= 0 ? allImages[lightboxIndex] : null;

  const totalImages = sections.reduce(
    (sum, section) => sum + section.imageCount,
    0,
  );
  const totalFeatured = sections.reduce(
    (sum, section) => sum + section.featuredCount,
    0,
  );
  const totalFeatured2 = sections.reduce(
    (sum, section) => sum + section.featured2Count,
    0,
  );

  useEffect(() => {
    const getColumnCount = () => {
      if (window.matchMedia("(min-width: 1280px)").matches) return 6;
      if (window.matchMedia("(min-width: 1024px)").matches) return 5;
      if (window.matchMedia("(min-width: 640px)").matches) return 4;
      return 3;
    };

    const syncCollapsedImageCount = () => {
      setCollapsedImageCount(getColumnCount() * COLLAPSED_ROW_COUNT);
    };

    syncCollapsedImageCount();
    window.addEventListener("resize", syncCollapsedImageCount);
    return () => window.removeEventListener("resize", syncCollapsedImageCount);
  }, []);

  const openLightbox = useCallback((imageId: string) => {
    setLightboxImageId(imageId);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxImageId(null);
  }, []);

  const goLightboxPrev = useCallback(() => {
    if (allImages.length === 0 || lightboxIndex < 0) return;
    const nextIndex = lightboxIndex > 0 ? lightboxIndex - 1 : allImages.length - 1;
    setLightboxImageId(allImages[nextIndex].id);
  }, [allImages, lightboxIndex]);

  const goLightboxNext = useCallback(() => {
    if (allImages.length === 0 || lightboxIndex < 0) return;
    const nextIndex = lightboxIndex < allImages.length - 1 ? lightboxIndex + 1 : 0;
    setLightboxImageId(allImages[nextIndex].id);
  }, [allImages, lightboxIndex]);

  useEffect(() => {
    if (!lightboxImage) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") goLightboxPrev();
      if (event.key === "ArrowRight") goLightboxNext();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeLightbox, goLightboxNext, goLightboxPrev, lightboxImage]);

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
          (sum, run) =>
            sum + run.images.filter((image) => image.featured).length,
          0,
        );
        return { ...section, runs, featuredCount };
      }),
    );
  }, []);

  const setImageFeatured2 = useCallback((imageId: string, featured2: boolean) => {
    setSections((currentSections) =>
      currentSections.map((section) => {
        let sectionChanged = false;
        const runs = section.runs.map((run) => {
          let runChanged = false;
          const images = run.images.map((image) => {
            if (image.id !== imageId) return image;
            sectionChanged = true;
            runChanged = true;
            return { ...image, featured2 };
          });
          return runChanged ? { ...run, images } : run;
        });

        if (!sectionChanged) return section;

        const featured2Count = runs.reduce(
          (sum, run) =>
            sum + run.images.filter((image) => image.featured2).length,
          0,
        );
        return { ...section, runs, featured2Count };
      }),
    );
  }, []);

  const handleToggleFeatured = useCallback(
    (imageId: string, featured: boolean) => {
      if (togglingImageId) return;
      setTogglingImageId(imageId);
      setImageFeatured(imageId, featured);

      startTransition(async () => {
        try {
          const response = await fetch(
            `/api/images/${encodeURIComponent(imageId)}/featured`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ featured }),
            },
          );
          const result = (await response.json().catch(() => null)) as {
            ok?: boolean;
            error?: { message?: string };
          } | null;
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
    },
    [setImageFeatured, togglingImageId],
  );

  const handleToggleFeatured2 = useCallback(
    (imageId: string, featured2: boolean) => {
      if (togglingImageId) return;
      setTogglingImageId(imageId);
      setImageFeatured2(imageId, featured2);

      startTransition(async () => {
        try {
          const response = await fetch(
            `/api/images/${encodeURIComponent(imageId)}/featured2`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ featured2 }),
            },
          );
          const result = (await response.json().catch(() => null)) as {
            ok?: boolean;
            error?: { message?: string };
          } | null;
          if (!response.ok || result?.ok === false) {
            throw new Error(result?.error?.message ?? "更新精选2失败");
          }
        } catch (error) {
          setImageFeatured2(imageId, !featured2);
          toast.error(error instanceof Error ? error.message : "更新精选2失败");
        } finally {
          setTogglingImageId(null);
        }
      });
    },
    [setImageFeatured2, togglingImageId],
  );

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "14rem",
          "--sidebar-width-icon": "3rem",
        } as React.CSSProperties
      }
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
              <h1 className="truncate text-sm font-semibold text-white">
                {project.title}
              </h1>
            </div>
            <div className="hidden shrink-0 items-center gap-2 text-[11px] text-zinc-500 sm:flex">
              <span>{sections.length} 小节</span>
              <span>{totalImages} 张图片</span>
              <span>{totalFeatured} 精选</span>
              <span>{totalFeatured2} 精选2</span>
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
                onToggleFeatured2={handleToggleFeatured2}
                onOpenImage={openLightbox}
                togglingImageId={togglingImageId}
                isExpanded={expandedSectionIds.has(section.id)}
                onToggleExpanded={toggleExpandedSection}
                collapsedImageCount={collapsedImageCount}
              />
            ))
          )}
        </div>
      </SidebarInset>
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm sm:p-4"
          onClick={closeLightbox}
        >
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <button
              type="button"
              disabled={togglingImageId === lightboxImage.id}
              onClick={(event) => {
                event.stopPropagation();
                handleToggleFeatured2(lightboxImage.id, !lightboxImage.featured2);
              }}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                lightboxImage.featured2
                  ? "bg-cyan-500/30 text-cyan-200 hover:bg-cyan-500/40"
                  : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-cyan-100"
              }`}
              title={lightboxImage.featured2 ? "取消精选2" : "标记精选2"}
            >
              2
            </button>
            <button
              type="button"
              disabled={togglingImageId === lightboxImage.id}
              onClick={(event) => {
                event.stopPropagation();
                handleToggleFeatured(lightboxImage.id, !lightboxImage.featured);
              }}
              className={`rounded-full p-2 transition disabled:opacity-50 ${
                lightboxImage.featured
                  ? "bg-amber-500/30 text-amber-300 hover:bg-amber-500/40"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
              title={lightboxImage.featured ? "取消精选" : "标记精选"}
            >
              <Star
                className="size-5"
                fill={lightboxImage.featured ? "currentColor" : "none"}
              />
            </button>
            <button
              type="button"
              className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              onClick={closeLightbox}
              title="关闭"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="absolute left-4 top-4 z-10 rounded-full bg-white/10 px-3 py-1.5 text-xs text-zinc-300">
            Run #{lightboxImage.runIndex} · {lightboxIndex + 1}/{allImages.length}
          </div>

          {allImages.length > 1 && (
            <button
              type="button"
              className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              onClick={(event) => {
                event.stopPropagation();
                goLightboxPrev();
              }}
              title="上一张"
            >
              <ChevronLeft className="size-6" />
            </button>
          )}

          <div
            className="relative flex h-[100dvh] w-[100dvw] items-center justify-center px-2 py-16 sm:px-12"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.full}
              alt=""
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>

          {allImages.length > 1 && (
            <button
              type="button"
              className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              onClick={(event) => {
                event.stopPropagation();
                goLightboxNext();
              }}
              title="下一张"
            >
              <ChevronRight className="size-6" />
            </button>
          )}
        </div>
      )}
    </SidebarProvider>
  );
}
