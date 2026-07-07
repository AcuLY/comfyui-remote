"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  ImageIcon,
  Shield,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ProjectResultsData } from "@/lib/server-data";
import { QuickCensorCanvas } from "@/components/quick-censor-canvas";
import { HardNavigationLink } from "@/components/hard-navigation-link";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { getPreferredScrollContainer } from "@/lib/scroll-container";
import { NeighborNavigation } from "@/components/neighbor-navigation";
import { censorImage } from "@/lib/actions/image-review";
import {
  submitReviewMutation,
  type ReviewMutationAction,
} from "@/lib/client-review-mutation";
import { getNextImageIdAfterCurrentLeavesSequence } from "@/lib/review-lightbox-state";
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
  summarizeSectionReviewCounts,
  useProjectResultsFilterState,
  type ProjectResultsImage,
  type ProjectResultsSection,
} from "./use-project-results-filter-state";
import { ProjectResultsGallery } from "./project-results-gallery";
import { ProjectResultsToolbar } from "./project-results-toolbar";

const COLLAPSED_ROW_COUNT = 2;

type ProjectResultMarkerUndoEntry = {
  imageId: string;
  field: "featured" | "featured2";
  value: boolean;
  restoreLightboxImageId: string | null;
};

type ManualCensorUploadResponse = {
  ok?: boolean;
  data?: {
    censoredAt?: string;
    censoredFull?: string | null;
    censoredSrc?: string | null;
  };
  error?: {
    message?: string;
  };
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
  const router = useRouter();
  const [sections, setSections] = useState(project.sections);
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(
    new Set(),
  );
  const [collapsedImageCount, setCollapsedImageCount] = useState(
    2 * COLLAPSED_ROW_COUNT,
  );
  const [togglingImageId, setTogglingImageId] = useState<string | null>(null);
  const [isTrashingAll, setIsTrashingAll] = useState(false);
  const [showCensoredMode, setShowCensoredMode] = useState(false);
  const [quickCensorMode, setQuickCensorMode] = useState(false);
  const [reviewingImageId, setReviewingImageId] = useState<string | null>(null);
  const [reviewingAction, setReviewingAction] = useState<ReviewMutationAction | null>(null);
  const [markerUndoStack, setMarkerUndoStack] = useState<ProjectResultMarkerUndoEntry[]>([]);
  const [, startTransition] = useTransition();
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
    setLightboxImageId,
    lightboxIndex,
    lightboxImage,
    openLightbox,
    closeLightbox,
    goLightboxPrev,
    goLightboxNext,
  } = useReviewLightboxState(filteredImages);
  const lightboxCurrentReviewBusy =
    lightboxImage !== null && reviewingImageId === lightboxImage.id;
  const lightboxBusy =
    lightboxCurrentReviewBusy ||
    (lightboxImage !== null && togglingImageId === lightboxImage.id);

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

  useEffect(() => {
    setQuickCensorMode(false);
  }, [lightboxImageId]);

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
            return {
              ...image,
              featured,
              status:
                featured && image.status === "pending" ? "kept" : image.status,
            };
          });
          return runChanged ? { ...run, images } : run;
        });

        if (!sectionChanged) return section;

        return { ...section, runs, ...summarizeSectionReviewCounts(runs) };
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
            return {
              ...image,
              featured2,
              status:
                featured2 && image.status === "pending" ? "kept" : image.status,
            };
          });
          return runChanged ? { ...run, images } : run;
        });

        if (!sectionChanged) return section;

        return { ...section, runs, ...summarizeSectionReviewCounts(runs) };
      }),
    );
  }, []);

  const setImageCover = useCallback((imageId: string) => {
    setSections((currentSections) =>
      currentSections.map((section) => {
        const runs = section.runs.map((run) => ({
          ...run,
          images: run.images.map((image) => ({
            ...image,
            cover: image.id === imageId,
            status:
              image.id === imageId && image.status === "pending"
                ? "kept"
                : image.status,
          })),
        }));
        return { ...section, runs, ...summarizeSectionReviewCounts(runs) };
      }),
    );
  }, []);

  const setImageReviewStatus = useCallback(
    (imageId: string, status: ProjectResultsImage["status"]) => {
      setSections((currentSections) =>
        currentSections.map((section) => {
          let sectionChanged = false;
          const runs = section.runs.map((run) => {
            let runChanged = false;
            const images = run.images.map((image) => {
              if (image.id !== imageId) return image;
              sectionChanged = true;
              runChanged = true;
              return { ...image, status };
            });
            return runChanged ? { ...run, images } : run;
          });

          if (!sectionChanged) return section;
          return { ...section, runs, ...summarizeSectionReviewCounts(runs) };
        }),
      );
    },
    [],
  );

  const removeProjectResultImage = useCallback((imageId: string) => {
    setSections((currentSections) =>
      currentSections.map((section) => {
        let sectionChanged = false;
        const runs = section.runs.map((run) => {
          const images = run.images.filter((image) => image.id !== imageId);
          if (images.length === run.images.length) return run;
          sectionChanged = true;
          return { ...run, images };
        });

        if (!sectionChanged) return section;
        return { ...section, runs, ...summarizeSectionReviewCounts(runs) };
      }),
    );
  }, []);

  const setImageCensoredResult = useCallback(
    (
      imageId: string,
      result: {
        censoredAt: string;
        censoredFull: string | null;
        censoredSrc: string | null;
      },
    ) => {
      setSections((currentSections) =>
        currentSections.map((section) => {
          let sectionChanged = false;
          const runs = section.runs.map((run) => {
            let runChanged = false;
            const images = run.images.map((image) => {
              if (image.id !== imageId) return image;
              sectionChanged = true;
              runChanged = true;
              return {
                ...image,
                censoredAt: result.censoredAt,
                censoredFull: result.censoredFull,
                censoredSrc: result.censoredSrc,
              };
            });
            return runChanged ? { ...run, images } : run;
          });

          if (!sectionChanged) return section;
          return { ...section, runs };
        }),
      );
    },
    [],
  );

  const handleToggleFeatured = useCallback(
    (imageId: string, featured: boolean) => {
      if (togglingImageId) return;
      const image = allImages.find((item) => item.id === imageId);
      if (!image || image.featured === featured) return;

      const previousSections = sections;
      const nextLightboxImageId =
        resultFilter === "featured" && lightboxImageId === imageId && !featured
          ? getNextImageIdAfterCurrentLeavesSequence(filteredImages, imageId)
          : undefined;
      const undoEntry: ProjectResultMarkerUndoEntry = {
        imageId,
        field: "featured",
        value: image.featured,
        restoreLightboxImageId: lightboxImageId === imageId ? imageId : null,
      };

      setTogglingImageId(imageId);
      setImageFeatured(imageId, featured);
      if (nextLightboxImageId !== undefined) {
        setLightboxImageId(nextLightboxImageId);
      }

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
          if (response.ok && result?.ok !== false) {
            setMarkerUndoStack((prev) => [...prev, undoEntry]);
          }
          if (!response.ok || result?.ok === false) {
            throw new Error(result?.error?.message ?? "更新p站标记失败");
          }
        } catch (error) {
          setSections(previousSections);
          if (nextLightboxImageId !== undefined) {
            setLightboxImageId(imageId);
          }
          toast.error(error instanceof Error ? error.message : "更新p站标记失败");
        } finally {
          setTogglingImageId(null);
        }
      });
    },
    [allImages, filteredImages, lightboxImageId, resultFilter, sections, setImageFeatured, setLightboxImageId, togglingImageId],
  );

  const handleToggleFeatured2 = useCallback(
    (imageId: string, featured2: boolean) => {
      if (togglingImageId) return;
      const image = allImages.find((item) => item.id === imageId);
      if (!image || image.featured2 === featured2) return;

      const previousSections = sections;
      const nextLightboxImageId =
        resultFilter === "featured2" && lightboxImageId === imageId && !featured2
          ? getNextImageIdAfterCurrentLeavesSequence(filteredImages, imageId)
          : undefined;
      const undoEntry: ProjectResultMarkerUndoEntry = {
        imageId,
        field: "featured2",
        value: image.featured2,
        restoreLightboxImageId: lightboxImageId === imageId ? imageId : null,
      };

      setTogglingImageId(imageId);
      setImageFeatured2(imageId, featured2);
      if (nextLightboxImageId !== undefined) {
        setLightboxImageId(nextLightboxImageId);
      }

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
          if (response.ok && result?.ok !== false) {
            setMarkerUndoStack((prev) => [...prev, undoEntry]);
          }
          if (!response.ok || result?.ok === false) {
            throw new Error(result?.error?.message ?? "更新预览标记失败");
          }
        } catch (error) {
          setSections(previousSections);
          if (nextLightboxImageId !== undefined) {
            setLightboxImageId(imageId);
          }
          toast.error(error instanceof Error ? error.message : "更新预览标记失败");
        } finally {
          setTogglingImageId(null);
        }
      });
    },
    [allImages, filteredImages, lightboxImageId, resultFilter, sections, setImageFeatured2, setLightboxImageId, togglingImageId],
  );

  const handleUndoMarkerToggle = useCallback(() => {
    if (togglingImageId) return;

    const undoEntry = markerUndoStack[markerUndoStack.length - 1];
    if (!undoEntry) {
      toast.error("没有可撤销的标记操作");
      return;
    }

    const applyValue =
      undoEntry.field === "featured" ? setImageFeatured : setImageFeatured2;
    const endpoint =
      undoEntry.field === "featured" ? "featured" : "featured2";

    setMarkerUndoStack((prev) => prev.slice(0, -1));
    setTogglingImageId(undoEntry.imageId);
    applyValue(undoEntry.imageId, undoEntry.value);
    if (undoEntry.restoreLightboxImageId) {
      setLightboxImageId(undoEntry.restoreLightboxImageId);
    }

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/images/${encodeURIComponent(undoEntry.imageId)}/${endpoint}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [undoEntry.field]: undoEntry.value }),
          },
        );
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: { message?: string };
        } | null;
        if (!response.ok || result?.ok === false) {
          throw new Error(result?.error?.message ?? "撤销标记失败");
        }
        toast.success("已撤销标记");
      } catch (error) {
        applyValue(undoEntry.imageId, !undoEntry.value);
        setMarkerUndoStack((prev) => [...prev, undoEntry]);
        toast.error(error instanceof Error ? error.message : "撤销标记失败");
      } finally {
        setTogglingImageId(null);
      }
    });
  }, [markerUndoStack, setImageFeatured, setImageFeatured2, setLightboxImageId, togglingImageId]);

  const handleSetCover = useCallback(
    (imageId: string) => {
      if (togglingImageId || allImages.find((image) => image.id === imageId)?.cover) {
        return;
      }

      const previousSections = sections;
      setTogglingImageId(imageId);
      setImageCover(imageId);

      startTransition(async () => {
        try {
          const response = await fetch(
            `/api/images/${encodeURIComponent(imageId)}/cover`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cover: true }),
            },
          );
          const result = (await response.json().catch(() => null)) as {
            ok?: boolean;
            error?: { message?: string };
          } | null;
          if (!response.ok || result?.ok === false) {
            throw new Error(result?.error?.message ?? "更新封面失败");
          }
        } catch (error) {
          setSections(previousSections);
          toast.error(error instanceof Error ? error.message : "更新封面失败");
        } finally {
          setTogglingImageId(null);
        }
      });
    },
    [allImages, sections, setImageCover, togglingImageId],
  );

  const finishQuickCensor = useCallback(
    async (blob: Blob) => {
      if (!lightboxImage) return;

      const formData = new FormData();
      formData.set("file", blob, `${lightboxImage.id}-manual-censor.jpg`);

      const response = await fetch(
        `/api/images/${encodeURIComponent(lightboxImage.id)}/manual-censor`,
        {
          method: "POST",
          body: formData,
        },
      );
      const payload = (await response.json().catch(() => null)) as ManualCensorUploadResponse | null;

      if (!response.ok || payload?.ok === false || !payload?.data) {
        throw new Error(payload?.error?.message ?? "保存快速打码失败");
      }

      setImageCensoredResult(lightboxImage.id, {
        censoredAt: payload.data.censoredAt ?? new Date().toISOString(),
        censoredFull: payload.data.censoredFull ?? lightboxImage.censoredFull,
        censoredSrc: payload.data.censoredSrc ?? lightboxImage.censoredSrc,
      });
      setQuickCensorMode(false);
      setShowCensoredMode(true);
      toast.success("快速打码已保存");
      router.refresh();
    },
    [lightboxImage, router, setImageCensoredResult],
  );

  const reviewLightboxImage = useCallback(
    (action: ReviewMutationAction, autoNext = false) => {
      if (!lightboxImage || reviewingImageId || quickCensorMode) return;

      const imageId = lightboxImage.id;
      const previousSections = sections;
      const imageCount = filteredImages.length;
      const removedIndex = lightboxIndex;
      const nextImageAfterRemoval =
        filteredImages[removedIndex + 1] ?? filteredImages[removedIndex - 1] ?? null;

      setReviewingImageId(imageId);
      setReviewingAction(action);

      if (action === "keep") {
        setImageReviewStatus(imageId, "kept");
        if (autoNext && imageCount > 1) {
          goLightboxNext();
        }
      } else {
        removeProjectResultImage(imageId);
        if (imageCount <= 1 || !nextImageAfterRemoval) {
          setLightboxImageId(null);
        } else {
          setLightboxImageId(nextImageAfterRemoval.id);
        }
      }

      void submitReviewMutation(action, [imageId])
        .catch((error) => {
          setSections(previousSections);
          if (action === "trash") {
            setLightboxImageId(imageId);
          }
          toast.error(error instanceof Error ? error.message : "审核失败");
        })
        .finally(() => {
          setReviewingImageId(null);
          setReviewingAction(null);
        });
    },
    [
      filteredImages,
      goLightboxNext,
      lightboxImage,
      lightboxIndex,
      quickCensorMode,
      removeProjectResultImage,
      reviewingImageId,
      sections,
      setImageReviewStatus,
      setLightboxImageId,
    ],
  );

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

  const handleTrashAllImages = useCallback(() => {
    if (isTrashingAll || totalImages === 0) return;

    const firstConfirmed = confirm(
      `确定要删除项目「${project.title}」中的全部 ${totalImages} 张图片吗？图片会先进入回收站，可从回收站恢复。`,
    );
    if (!firstConfirmed) return;

    const secondConfirmed = confirm("请再次确认：将全部图片移入回收站。继续？");
    if (!secondConfirmed) return;

    setIsTrashingAll(true);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(project.id)}/results/trash`,
          { method: "POST" },
        );
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: { trashedCount?: number };
          error?: { message?: string };
        } | null;

        if (!response.ok || result?.ok === false) {
          throw new Error(result?.error?.message ?? "删除全部图片失败");
        }

        setLightboxImageId(null);
        setSections((currentSections) =>
          currentSections.map((section) => ({
            ...section,
            imageCount: 0,
            keptCount: 0,
            pendingCount: 0,
            featuredCount: 0,
            featured2Count: 0,
            runs: section.runs.map((run) => ({ ...run, images: [] })),
          })),
        );
        toast.success(`已移入回收站 ${result?.data?.trashedCount ?? totalImages} 张图片`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除全部图片失败");
      } finally {
        setIsTrashingAll(false);
      }
    });
  }, [isTrashingAll, project.id, project.title, setLightboxImageId, startTransition, totalImages]);

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
        <div
          data-project-results-lightbox
          className="fixed inset-0 z-[140] flex flex-col bg-black/90 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <div className="z-10 flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-zinc-300">
              <span className="truncate">
                Run #{lightboxImage.runIndex} · {lightboxIndex + 1}/{filteredImages.length}
              </span>
              {lightboxImage.status === "pending" && (
                <span className="rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] text-white">
                  待审
                </span>
              )}
              {lightboxImage.status === "kept" && (
                <span className="rounded bg-emerald-500/80 px-1.5 py-0.5 text-[10px] text-white">
                  保留
                </span>
              )}
              {lightboxImage.featured && (
                <span className="rounded bg-amber-400/80 px-1.5 py-0.5 text-[10px] text-white">
                  p站
                </span>
              )}
              {lightboxImage.featured2 && (
                <span className="rounded bg-cyan-400/80 px-1.5 py-0.5 text-[10px] text-white">
                  预览
                </span>
              )}
              {lightboxImage.cover && (
                <span className="rounded bg-violet-400/80 px-1.5 py-0.5 text-[10px] text-white">
                  封面
                </span>
              )}
              {showCensoredMode && lightboxImage.censoredFull && (
                <span className="rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] text-white">
                  打码版
                </span>
              )}
            </div>

            <button
              type="button"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              onClick={(event) => {
                event.stopPropagation();
                closeLightbox();
              }}
              title="关闭"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="grid h-[calc(100dvh-8.5rem)] min-h-0 flex-1 grid-cols-[3rem_minmax(0,1fr)_3rem] sm:grid-cols-[4.5rem_minmax(0,1fr)_4.5rem]">
            <button
              type="button"
              disabled={quickCensorMode || filteredImages.length <= 1}
              className="flex h-full items-center justify-center border-r border-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:text-white/10"
              onClick={(event) => {
                event.stopPropagation();
                goLightboxPrev();
              }}
              title="上一张"
            >
              <ChevronLeft className="size-7" />
            </button>

            <div
              className="relative flex min-w-0 items-center justify-center px-1 py-3"
              onClick={(event) => event.stopPropagation()}
            >
              {quickCensorMode ? (
                <QuickCensorCanvas
                  source={lightboxImage.full}
                  disabled={lightboxBusy}
                  onCancel={() => setQuickCensorMode(false)}
                  onComplete={finishQuickCensor}
                />
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={lightboxImage.id}
                    src={showCensoredMode && lightboxImage.censoredFull ? lightboxImage.censoredFull : lightboxImage.full}
                    alt=""
                    loading="eager"
                    fetchPriority="high"
                    draggable={false}
                    className="max-h-[calc(100dvh-11rem)] max-w-full rounded-lg object-contain"
                  />
                </>
              )}
            </div>

            <button
              type="button"
              disabled={quickCensorMode || filteredImages.length <= 1}
              className="flex h-full items-center justify-center border-l border-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:text-white/10"
              onClick={(event) => {
                event.stopPropagation();
                goLightboxNext();
              }}
              title="下一张"
            >
              <ChevronRight className="size-7" />
            </button>
          </div>

          <div
            className="z-10 grid grid-cols-2 gap-2 border-t border-white/10 bg-black/50 p-3 sm:grid-cols-8 sm:px-4"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              disabled={quickCensorMode || lightboxBusy}
              onClick={() => reviewLightboxImage("keep", true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/12 px-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-45"
            >
              <Check className="size-4" />
              {reviewingAction === "keep" ? "处理中..." : "保留"}
            </button>
            <button
              type="button"
              disabled={quickCensorMode || lightboxBusy}
              onClick={() => reviewLightboxImage("trash", true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-rose-400/25 bg-rose-500/12 px-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-45"
            >
              <Trash2 className="size-4" />
              {reviewingAction === "trash" ? "处理中..." : "删除"}
            </button>
            <button
              type="button"
              disabled={quickCensorMode || lightboxBusy}
              onClick={() => handleToggleFeatured(lightboxImage.id, !lightboxImage.featured)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
                lightboxImage.featured
                  ? "border-amber-300/35 bg-amber-400/25 text-amber-100 hover:bg-amber-400/30"
                  : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-amber-100"
              }`}
            >
              <Star
                className="size-4"
                fill={lightboxImage.featured ? "currentColor" : "none"}
              />
              {lightboxImage.featured ? "取消p站" : "p站"}
            </button>
            <button
              type="button"
              disabled={quickCensorMode || lightboxBusy}
              onClick={() => handleToggleFeatured2(lightboxImage.id, !lightboxImage.featured2)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
                lightboxImage.featured2
                  ? "border-cyan-300/35 bg-cyan-400/25 text-cyan-100 hover:bg-cyan-400/30"
                  : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-cyan-100"
              }`}
            >
              <Eye className="size-4" />
              {lightboxImage.featured2 ? "取消预览" : "预览"}
            </button>
            <button
              type="button"
              disabled={quickCensorMode || lightboxBusy || lightboxImage.cover}
              onClick={() => handleSetCover(lightboxImage.id)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
                lightboxImage.cover
                  ? "border-violet-300/35 bg-violet-400/25 text-violet-100"
                  : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-violet-100"
              }`}
            >
              <ImageIcon className="size-4" />
              {lightboxImage.cover ? "封面" : "设为封面"}
            </button>
            <button
              type="button"
              disabled={quickCensorMode || !lightboxImage.censoredFull}
              onClick={() => lightboxImage.censoredFull && setShowCensoredMode((prev) => !prev)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
                showCensoredMode && lightboxImage.censoredFull
                  ? "border-amber-300/35 bg-amber-400/25 text-amber-100 hover:bg-amber-400/30"
                  : lightboxImage.censoredFull
                    ? "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-amber-100"
                    : "border-white/10 bg-white/5 text-zinc-600"
              }`}
            >
              <Shield className="size-4" />
              {showCensoredMode && lightboxImage.censoredFull
                ? "显示原图"
                : lightboxImage.censoredFull
                  ? "查看打码"
                  : "暂未打码"}
            </button>
            {(lightboxImage.status === "kept" || lightboxImage.status === "pending") && (
              <button
                type="button"
                disabled={quickCensorMode || lightboxBusy}
                onClick={() => {
                  setShowCensoredMode(false);
                  setQuickCensorMode(true);
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-amber-400/25 bg-amber-500/12 px-3 text-sm font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-45"
              >
                <Shield className="size-4" />
                开始打码
              </button>
            )}
            {(lightboxImage.status === "kept" || lightboxImage.status === "pending") && !lightboxImage.censoredAt && (
              <button
                type="button"
                disabled={quickCensorMode || lightboxBusy}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const result = await censorImage(lightboxImage.id);
                      if (result.success) {
                        toast.success(result.message);
                        router.refresh();
                      } else {
                        toast.error(result.message);
                      }
                    } catch {
                      toast.error("打码失败");
                    }
                  });
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/12 px-3 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-45"
              >
                <Shield className="size-4" />
                执行打码
              </button>
            )}
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
