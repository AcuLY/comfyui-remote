"use client";

import { useMemo, useState } from "react";

import type { ProjectResultsData } from "@/lib/server-data";

export type ProjectResultsSection = ProjectResultsData["sections"][number];
export type ProjectResultsRun = ProjectResultsSection["runs"][number];
export type ProjectResultsImage = ProjectResultsRun["images"][number];

export type ProjectResultFilter = "all" | "featured" | "featured2" | "cover";

export const PROJECT_RESULT_FILTER_OPTIONS: {
  value: ProjectResultFilter;
  label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "featured", label: "p站" },
  { value: "featured2", label: "预览" },
  { value: "cover", label: "封面" },
];

export type ProjectResultFilterCounts = Record<ProjectResultFilter, number>;

export type ProjectResultsImageWithRun = ProjectResultsImage & {
  runIndex: number;
};

export function summarizeSectionReviewCounts(runs: ProjectResultsSection["runs"]) {
  return {
    imageCount: runs.reduce((sum, run) => sum + run.images.length, 0),
    keptCount: runs.reduce(
      (sum, run) =>
        sum + run.images.filter((image) => image.status === "kept").length,
      0,
    ),
    pendingCount: runs.reduce(
      (sum, run) =>
        sum + run.images.filter((image) => image.status === "pending").length,
      0,
    ),
    featuredCount: runs.reduce(
      (sum, run) =>
        sum + run.images.filter((image) => image.featured).length,
      0,
    ),
    featured2Count: runs.reduce(
      (sum, run) =>
        sum + run.images.filter((image) => image.featured2).length,
      0,
    ),
  };
}

function imageMatchesProjectResultFilter(
  image: ProjectResultsImage,
  resultFilter: ProjectResultFilter,
) {
  if (resultFilter === "featured") return image.featured;
  if (resultFilter === "featured2") return image.featured2;
  if (resultFilter === "cover") return image.cover;
  return true;
}

export function filterProjectResultSections(
  sections: ProjectResultsSection[],
  resultFilter: ProjectResultFilter,
) {
  return sections
    .map((section) => {
      if (resultFilter === "all") return section;

      const runs = section.runs
        .map((run) => ({
          ...run,
          images: run.images.filter((image) =>
            imageMatchesProjectResultFilter(image, resultFilter),
          ),
        }))
        .filter((run) => run.images.length > 0);

      return {
        ...section,
        runCount: runs.length,
        runs,
        ...summarizeSectionReviewCounts(runs),
      };
    })
    .filter((section) => section.imageCount > 0);
}

export function collectProjectResultImages(sections: ProjectResultsSection[]) {
  return sections.flatMap((section) =>
    section.runs.flatMap((run) =>
      run.images.map((image) => ({
        ...image,
        runIndex: run.runIndex,
      })),
    ),
  );
}

export function useProjectResultsFilterState(sections: ProjectResultsSection[]) {
  const [resultFilter, setResultFilter] = useState<ProjectResultFilter>("all");

  const filteredSections = useMemo(
    () => filterProjectResultSections(sections, resultFilter),
    [sections, resultFilter],
  );
  const allImages = useMemo(
    () => collectProjectResultImages(sections),
    [sections],
  );
  const filteredImages = useMemo(
    () => collectProjectResultImages(filteredSections),
    [filteredSections],
  );

  const totalImages = sections.reduce(
    (sum, section) => sum + section.imageCount,
    0,
  );
  const totalKept = sections.reduce(
    (sum, section) => sum + section.keptCount,
    0,
  );
  const totalPending = sections.reduce(
    (sum, section) => sum + section.pendingCount,
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
  const hasCover = allImages.some((image) => image.cover);
  const resultFilterCounts: ProjectResultFilterCounts = {
    all: totalImages,
    featured: totalFeatured,
    featured2: totalFeatured2,
    cover: hasCover ? 1 : 0,
  };
  const activeFilterLabel =
    PROJECT_RESULT_FILTER_OPTIONS.find((option) => option.value === resultFilter)?.label ??
    "结果";

  return {
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
  };
}
