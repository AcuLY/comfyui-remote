"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ArrowLeft } from "lucide-react";

import type { ProjectResultsData } from "@/lib/server-data";
import { HardNavigationLink } from "@/components/hard-navigation-link";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { getPreferredScrollContainer } from "@/lib/scroll-container";
import { NeighborNavigation } from "@/components/neighbor-navigation";
import { useReviewLightboxState } from "@/lib/use-review-lightbox-state";
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  useProjectResultsFilterState,
  type ProjectResultsSection,
} from "./use-project-results-filter-state";
import { ProjectResultsGallery } from "./project-results-gallery";
import { ProjectResultsLightbox } from "./project-results-lightbox";
import { ProjectResultsToolbar } from "./project-results-toolbar";
import { useProjectResultsMutationAdapter } from "./use-project-results-mutations";

const COLLAPSED_ROW_COUNT = 2;

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
  sections,
  activeSectionId,
}: {
  project: ProjectResultsData;
  sections: ProjectResultsSection[];
  activeSectionId: string | null;
}) {
  const { state: sidebarState } = useSidebar();
  const isExpanded = sidebarState === "expanded";
  const sidebarContentRef = useSyncedSidebarContent({
    activeSectionId,
    itemCount: sections.length,
  });

  return (
    <Sidebar
      collapsible="icon"
      mobileBehavior="sidebar"
      className="border-r border-white/5"
    >
      <SidebarHeader className="gap-1.5 px-3.5 py-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <HardNavigationLink
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 group-data-[collapsible=icon]:justify-center"
        >
          <ArrowLeft className="size-3.5" />
          {isExpanded && <span>返回项目详情</span>}
        </HardNavigationLink>
        {isExpanded && (
          <div className="mt-1 space-y-2 rounded-xl border border-sky-500/15 bg-sky-500/[0.06] px-3 py-2 shadow-inner shadow-sky-500/5">
            <p className="text-[10px] text-sky-300/70">项目结果</p>
            <h1 className="truncate text-[15px] font-semibold leading-5 text-sky-50">
              {project.title}
            </h1>
            <NeighborNavigation
              previousHref={project.previousProject ? `/projects/${project.previousProject.id}/results` : null}
              nextHref={project.nextProject ? `/projects/${project.nextProject.id}/results` : null}
              hardNavigation
              previousLabel={null}
              nextLabel={null}
              previousTitle={project.previousProject ? `上一个项目：${project.previousProject.title}` : "没有上一个项目"}
              nextTitle={project.nextProject ? `下一个项目：${project.nextProject.title}` : "没有下一个项目"}
              previousAriaLabel={project.previousProject ? `上一个项目：${project.previousProject.title}` : "没有上一个项目"}
              nextAriaLabel={project.nextProject ? `下一个项目：${project.nextProject.title}` : "没有下一个项目"}
              className="grid grid-cols-2 gap-1.5"
              controlClassName="inline-flex h-8 min-w-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
              disabledControlClassName="inline-flex h-8 items-center justify-center rounded-lg border border-white/5 text-zinc-600"
              iconClassName="size-4 shrink-0"
            />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent ref={sidebarContentRef} className="overflow-x-hidden">
        <SidebarSectionNav
          label="小节结果"
          sections={sections}
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
  const [showCensoredMode, setShowCensoredMode] = useState(false);
  const [quickCensorMode, setQuickCensorMode] = useState(false);
  const {
    resultFilter,
    setResultFilter,
    filteredSections,
    allImages,
    filteredImages,
    totalImages,
    totalKept,
    totalPending,
    totalFeatured,
    totalFeatured2,
    hasCover,
    resultFilterCounts,
    activeFilterLabel,
  } = useProjectResultsFilterState(sections);
  const sectionIds = useMemo(
    () => filteredSections.map((section) => section.id),
    [filteredSections],
  );
  const activeSectionId = useScrollSpy(sectionIds, {
    rootSelector: '[data-slot="sidebar-inset"]',
  });
  const {
    lightboxImageId,
    setLightboxImageId: setRawLightboxImageId,
    lightboxIndex,
    lightboxImage,
    openLightbox: openRawLightbox,
    closeLightbox: closeRawLightbox,
    goLightboxPrev: goRawLightboxPrev,
    goLightboxNext: goRawLightboxNext,
  } = useReviewLightboxState(filteredImages);
  const setLightboxImageIdAndResetQuickCensor = useCallback(
    (imageId: string | null) => {
      setQuickCensorMode(false);
      setRawLightboxImageId(imageId);
    },
    [setRawLightboxImageId],
  );
  const openLightbox = useCallback(
    (imageId: string) => {
      setQuickCensorMode(false);
      openRawLightbox(imageId);
    },
    [openRawLightbox],
  );
  const closeLightbox = useCallback(() => {
    setQuickCensorMode(false);
    closeRawLightbox();
  }, [closeRawLightbox]);
  const goLightboxPrev = useCallback(() => {
    setQuickCensorMode(false);
    goRawLightboxPrev();
  }, [goRawLightboxPrev]);
  const goLightboxNext = useCallback(() => {
    setQuickCensorMode(false);
    goRawLightboxNext();
  }, [goRawLightboxNext]);
  const {
    togglingImageId,
    isTrashingAll,
    reviewingAction,
    lightboxBusy,
    handleToggleFeatured,
    handleToggleFeatured2,
    handleUndoMarkerToggle,
    handleSetCover,
    finishQuickCensor,
    reviewLightboxImage,
    runAutoCensorLightboxImage,
    handleTrashAllImages,
  } = useProjectResultsMutationAdapter({
    projectId: project.id,
    projectTitle: project.title,
    totalImages,
    sections,
    setSections,
    allImages,
    filteredImages,
    resultFilter,
    lightboxImageId,
    lightboxImage,
    lightboxIndex,
    quickCensorMode,
    setShowCensoredMode,
    setQuickCensorMode,
    setLightboxImageId: setLightboxImageIdAndResetQuickCensor,
    goLightboxNext,
  });

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

  useEffect(() => {
    if (!lightboxImage) return;
    const currentLightboxImage = lightboxImage;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      const key = event.key;

      if (quickCensorMode) {
        if (key === "Escape") {
          event.preventDefault();
          setQuickCensorMode(false);
        }
        return;
      }

      if (key === "i" || key === "I" || key === "d" || key === "D") {
        event.preventDefault();
        closeLightbox();
        return;
      }
      if (key === "Escape") {
        closeLightbox();
        return;
      }

      if (key === "s" || key === "S" || key === "ArrowLeft") {
        event.preventDefault();
        if (filteredImages.length > 1) goLightboxPrev();
        return;
      }
      if (key === "f" || key === "F" || key === "ArrowRight") {
        event.preventDefault();
        if (filteredImages.length > 1) goLightboxNext();
        return;
      }

      if (key === "j" || key === "J" || key === "w" || key === "W") {
        event.preventDefault();
        reviewLightboxImage("keep", true);
        return;
      }
      if (key === "k" || key === "K" || key === "e" || key === "E") {
        event.preventDefault();
        reviewLightboxImage("trash", true);
        return;
      }

      if (key === "l" || key === "L" || key === "r" || key === "R") {
        event.preventDefault();
        handleToggleFeatured(currentLightboxImage.id, !currentLightboxImage.featured);
        return;
      }
      if (key === ";" || key === "t" || key === "T") {
        event.preventDefault();
        handleToggleFeatured2(currentLightboxImage.id, !currentLightboxImage.featured2);
        return;
      }
      if (key === "'") {
        event.preventDefault();
        handleSetCover(currentLightboxImage.id);
        return;
      }

      if ((key === "z" || key === "Z") && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        handleUndoMarkerToggle();
        return;
      }

      if (key === "h" || key === "H") {
        event.preventDefault();
        if (currentLightboxImage.censoredFull) {
          setShowCensoredMode((prev) => !prev);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeLightbox,
    filteredImages.length,
    goLightboxNext,
    goLightboxPrev,
    handleSetCover,
    handleToggleFeatured,
    handleToggleFeatured2,
    handleUndoMarkerToggle,
    lightboxImage,
    quickCensorMode,
    reviewLightboxImage,
  ]);

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
        project={project}
        sections={filteredSections}
        activeSectionId={activeSectionId}
      />

      <SidebarInset className="flex-1 overflow-auto bg-transparent">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pb-24 pt-4 sm:px-6">
          <ProjectResultsToolbar
            projectTitle={project.title}
            sectionCount={sections.length}
            totalImages={totalImages}
            totalKept={totalKept}
            totalPending={totalPending}
            totalFeatured={totalFeatured}
            totalFeatured2={totalFeatured2}
            hasCover={hasCover}
            resultFilter={resultFilter}
            onResultFilterChange={setResultFilter}
            resultFilterCounts={resultFilterCounts}
            showCensoredMode={showCensoredMode}
            onToggleCensoredMode={() => setShowCensoredMode((current) => !current)}
            isTrashingAll={isTrashingAll}
            onTrashAllImages={handleTrashAllImages}
          />

          {sections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
              暂无小节
            </div>
          ) : filteredSections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
              {resultFilter === "all"
                ? "暂无结果图片"
                : `暂无${activeFilterLabel}图片`}
            </div>
          ) : (
            <ProjectResultsGallery
              projectId={project.id}
              sections={filteredSections}
              onToggleFeatured={handleToggleFeatured}
              onToggleFeatured2={handleToggleFeatured2}
              onSetCover={handleSetCover}
              onOpenImage={openLightbox}
              togglingImageId={togglingImageId}
              expandedSectionIds={expandedSectionIds}
              onToggleExpanded={toggleExpandedSection}
              collapsedImageCount={collapsedImageCount}
              showCensoredMode={showCensoredMode}
            />
          )}
        </div>
      </SidebarInset>
      {lightboxImage && (
        <ProjectResultsLightbox
          lightboxImage={lightboxImage}
          lightboxIndex={lightboxIndex}
          imageCount={filteredImages.length}
          showCensoredMode={showCensoredMode}
          quickCensorMode={quickCensorMode}
          lightboxBusy={lightboxBusy}
          reviewingAction={reviewingAction}
          onClose={closeLightbox}
          onPrevious={goLightboxPrev}
          onNext={goLightboxNext}
          onKeep={() => reviewLightboxImage("keep", true)}
          onTrash={() => reviewLightboxImage("trash", true)}
          onToggleFeatured={() => handleToggleFeatured(lightboxImage.id, !lightboxImage.featured)}
          onToggleFeatured2={() => handleToggleFeatured2(lightboxImage.id, !lightboxImage.featured2)}
          onSetCover={() => handleSetCover(lightboxImage.id)}
          onToggleCensoredMode={() => lightboxImage.censoredFull && setShowCensoredMode((prev) => !prev)}
          onStartQuickCensor={() => {
            setShowCensoredMode(false);
            setQuickCensorMode(true);
          }}
          onCancelQuickCensor={() => setQuickCensorMode(false)}
          onFinishQuickCensor={finishQuickCensor}
          onRunAutoCensor={runAutoCensorLightboxImage}
        />
      )}
    </SidebarProvider>
  );
}
