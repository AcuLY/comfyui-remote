export type ShowcaseFamilyId =
  | "controls"
  | "surfaces"
  | "unit-items"
  | "folders"
  | "batch-actions"
  | "generation-params"
  | "preset-prompt-lora"
  | "taxonomy-history"
  | "images"
  | "runs"
  | "system"
  | "headers"
  | "icons";

export type ShowcaseRouteMetadata = {
  id: ShowcaseFamilyId;
  route: string;
  title: string;
};

export const SHOWCASE_ROUTE_METADATA = [
  {
    id: "controls",
    route: "/component-showcase-controls",
    title: "基础操作控件",
  },
  {
    id: "surfaces",
    route: "/component-showcase-surfaces",
    title: "页面骨架、容器与空状态",
  },
  {
    id: "unit-items",
    route: "/component-showcase-unit-items",
    title: "单元行项 / List Item 家族",
  },
  {
    id: "folders",
    route: "/component-showcase-folders",
    title: "文件夹、路径与移动目标",
  },
  {
    id: "batch-actions",
    route: "/component-showcase-batch-actions",
    title: "批量选择、工具栏与操作反馈",
  },
  {
    id: "generation-params",
    route: "/component-showcase-generation-params",
    title: "生成参数与小节配置",
  },
  {
    id: "preset-prompt-lora",
    route: "/component-showcase-preset-prompt-lora",
    title: "预设、Prompt 与 LoRA 编辑",
  },
  {
    id: "taxonomy-history",
    route: "/component-showcase-taxonomy-history",
    title: "分类、排序、历史与差异",
  },
  {
    id: "images",
    route: "/component-showcase-images",
    title: "图片结果与审核面",
  },
  {
    id: "runs",
    route: "/component-showcase-runs",
    title: "任务运行、队列与进度",
  },
  {
    id: "system",
    route: "/component-showcase-system",
    title: "系统、日志、监控与模型文件",
  },
  {
    id: "headers",
    route: "/component-showcase-headers",
    title: "Headers 固定顶栏专项",
  },
  {
    id: "icons",
    route: "/component-showcase-icons",
    title: "Icons 图标专项",
  },
] as const satisfies readonly ShowcaseRouteMetadata[];

export const SHOWCASE_FAMILY_ROUTES: Record<ShowcaseFamilyId, string> = Object.fromEntries(
  SHOWCASE_ROUTE_METADATA.map((family) => [family.id, family.route]),
) as Record<ShowcaseFamilyId, string>;
