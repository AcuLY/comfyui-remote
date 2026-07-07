"use client";

import {
  useCallback,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { censorImage } from "@/lib/actions/censoring";
import {
  submitReviewMutation,
  type ReviewMutationAction,
} from "@/lib/client-review-mutation";
import { getNextImageIdAfterCurrentLeavesSequence } from "@/lib/review-lightbox-state";
import {
  summarizeSectionReviewCounts,
  type ProjectResultFilter,
  type ProjectResultsImage,
  type ProjectResultsImageWithRun,
  type ProjectResultsSection,
} from "./use-project-results-filter-state";

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

type UseProjectResultsMutationAdapterArgs = {
  projectId: string;
  projectTitle: string;
  totalImages: number;
  sections: ProjectResultsSection[];
  setSections: Dispatch<SetStateAction<ProjectResultsSection[]>>;
  allImages: ProjectResultsImageWithRun[];
  filteredImages: ProjectResultsImageWithRun[];
  resultFilter: ProjectResultFilter;
  lightboxImageId: string | null;
  lightboxImage: ProjectResultsImageWithRun | null;
  lightboxIndex: number;
  quickCensorMode: boolean;
  setShowCensoredMode: Dispatch<SetStateAction<boolean>>;
  setQuickCensorMode: Dispatch<SetStateAction<boolean>>;
  setLightboxImageId: (imageId: string | null) => void;
  goLightboxNext: () => void;
};

export function useProjectResultsMutationAdapter({
  projectId,
  projectTitle,
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
  setLightboxImageId,
  goLightboxNext,
}: UseProjectResultsMutationAdapterArgs) {
  const router = useRouter();
  const [togglingImageId, setTogglingImageId] = useState<string | null>(null);
  const [isTrashingAll, setIsTrashingAll] = useState(false);
  const [reviewingImageId, setReviewingImageId] = useState<string | null>(null);
  const [reviewingAction, setReviewingAction] =
    useState<ReviewMutationAction | null>(null);
  const [markerUndoStack, setMarkerUndoStack] = useState<
    ProjectResultMarkerUndoEntry[]
  >([]);
  const [, startTransition] = useTransition();

  const lightboxCurrentReviewBusy =
    lightboxImage !== null && reviewingImageId === lightboxImage.id;
  const lightboxBusy =
    lightboxCurrentReviewBusy ||
    (lightboxImage !== null && togglingImageId === lightboxImage.id);

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
  }, [setSections]);

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
  }, [setSections]);

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
  }, [setSections]);

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
    [setSections],
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
  }, [setSections]);

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
    [setSections],
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
    [
      allImages,
      filteredImages,
      lightboxImageId,
      resultFilter,
      sections,
      setImageFeatured,
      setLightboxImageId,
      setSections,
      togglingImageId,
      startTransition,
    ],
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
    [
      allImages,
      filteredImages,
      lightboxImageId,
      resultFilter,
      sections,
      setImageFeatured2,
      setLightboxImageId,
      setSections,
      togglingImageId,
      startTransition,
    ],
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
  }, [
    markerUndoStack,
    setImageFeatured,
    setImageFeatured2,
    setLightboxImageId,
    togglingImageId,
    startTransition,
  ]);

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
    [allImages, sections, setImageCover, setSections, togglingImageId, startTransition],
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
    [
      lightboxImage,
      router,
      setImageCensoredResult,
      setQuickCensorMode,
      setShowCensoredMode,
    ],
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
      setSections,
    ],
  );

  const runAutoCensorLightboxImage = useCallback(() => {
    if (!lightboxImage) return;

    const imageId = lightboxImage.id;
    startTransition(async () => {
      try {
        const result = await censorImage(imageId);
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
  }, [lightboxImage, router, startTransition]);

  const handleTrashAllImages = useCallback(() => {
    if (isTrashingAll || totalImages === 0) return;

    const firstConfirmed = confirm(
      `确定要删除项目「${projectTitle}」中的全部 ${totalImages} 张图片吗？图片会先进入回收站，可从回收站恢复。`,
    );
    if (!firstConfirmed) return;

    const secondConfirmed = confirm("请再次确认：将全部图片移入回收站。继续？");
    if (!secondConfirmed) return;

    setIsTrashingAll(true);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/results/trash`,
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
  }, [
    isTrashingAll,
    projectId,
    projectTitle,
    setLightboxImageId,
    setSections,
    startTransition,
    totalImages,
  ]);

  return {
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
  };
}
