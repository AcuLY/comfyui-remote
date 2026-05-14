import type { DemoImage, DemoProject, DemoSection } from "../../data/types";
import type { ResultDemoFilter } from "../../routing/types";

export function rawSectionId(section: DemoSection) {
  return section.id.includes(":") ? section.id.split(":").slice(1).join(":") : section.id;
}

export function sectionAnchorId(section: DemoSection) {
  return `section-${rawSectionId(section)}`;
}

export function filterImages(images: DemoImage[], filter: ResultDemoFilter) {
  if (filter === "pending") return images.filter((image) => image.status === "pending");
  if (filter === "kept") return images.filter((image) => image.status === "kept");
  if (filter === "pstation") return images.filter((image) => image.featured);
  if (filter === "preview") return images.filter((image) => image.featured2);
  if (filter === "cover") return images.filter((image) => image.cover);
  return images;
}

export function projectPresetSummary(project: DemoProject) {
  return [...new Set(project.presetNames.filter((name) => name && name !== project.title))]
    .slice(0, 4)
    .join(" / ") || "无预设绑定";
}

export function compactFileName(value: string) {
  return value.split(/[\\/]/).pop() ?? value;
}

export function sectionRunStatus(section: DemoSection, index: number) {
  if (!section.enabled) return { status: "draft", label: "停用" };
  if (section.images.some((image) => image.status === "pending")) return { status: "pending", label: "待审" };
  if (index % 7 === 0) return { status: "running", label: "运行中" };
  if (index % 11 === 0) return { status: "failed", label: "失败" };
  return { status: "done", label: "完成" };
}

export function selectionToggleLabel(selectedCount: number, totalCount: number) {
  if (selectedCount === 0) return "选择";
  if (selectedCount === totalCount) return "取消全选";
  return `已选 ${selectedCount}`;
}

export function resultRunGroups(images: DemoImage[]) {
  const groups = [
    { id: "run-latest", title: "最近运行", meta: "Run #3 · 当前筛选" },
    { id: "run-prev", title: "上一轮运行", meta: "Run #2 · 对照组" },
  ];

  return groups.map((group, groupIndex) => ({
    ...group,
    images: images.filter((_, imageIndex) => imageIndex % groups.length === groupIndex),
  })).filter((group) => group.images.length > 0);
}
