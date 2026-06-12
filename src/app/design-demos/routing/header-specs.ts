import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  ExternalLink,
  History,
  Home,
  Lock,
  Monitor,
  PanelTop,
  Play,
  Plus,
  Rows3,
  Save,
  Search,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import type { DemoData, DemoSection } from "../data";
import {
  findCategory,
  findGroup,
  findPreset,
  findProject,
  findRun,
  findSection,
  findTemplate,
  matchPattern,
  matchRoute,
  ROUTES,
  sampleRouteInventory,
} from "./";
import type { RouteIcon, RouteKey } from "./";

export type HeaderActionTone = "default" | "primary" | "pink" | "danger" | "subtle";

export type HeaderAction = {
  href?: string;
  icon: RouteIcon;
  label: string;
  tone?: HeaderActionTone;
};

export type HeaderSpec = {
  key: string;
  route: string;
  group: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  back?: {
    href: string;
    label: string;
  };
  actions?: HeaderAction[];
  meta?: string[];
  status?: string;
};

export type HeaderSpecSection = {
  label: string;
  specs: HeaderSpec[];
};

const section = (label: string, specs: HeaderSpec[]): HeaderSpecSection => ({ label, specs });

export function headerAction(label: string, icon: RouteIcon, tone: HeaderActionTone = "default", href?: string): HeaderAction {
  return { label, icon, tone, href };
}

function routeMap(data: DemoData) {
  return new Map(sampleRouteInventory(data).map((item) => [item.key, item.sample]));
}

function currentRoute(routes: Map<RouteKey, string>, key: RouteKey) {
  return routes.get(key) ?? "/runs";
}

export function displayHeaderRoute(route: string) {
  const matchedRoute = ROUTES.find((item) => matchPattern(item.pattern, route));
  return matchedRoute ? matchedRoute.pattern.replace(/:[^/]+/g, ":id") : route;
}

export function buildHeaderSpecs(data: DemoData): HeaderSpecSection[] {
  const routes = routeMap(data);
  const run = findRun(data);
  const project = findProject(data);
  const sectionData = project?.sections[0];
  const category = findCategory(data);
  const preset = findPreset(data);
  const group = findGroup(data);
  const template = findTemplate(data);
  const templateSection = template?.sections[0];
  const runningCount = data.runs.filter((item) => item.status === "queued" || item.status === "running").length;
  const failedCount = data.runs.filter((item) => item.status === "failed").length;
  const completedProjectCount = data.projects.filter((item) => item.status === "done").length;
  const unfinishedProjectCount = Math.max(data.projects.length - completedProjectCount, 0);
  const projectImages = project?.sections.flatMap((section) => section.images) ?? project?.images ?? [];
  const projectImageSummary = {
    total: projectImages.length,
    pending: projectImages.filter((item) => item.status === "pending").length,
    kept: projectImages.filter((item) => item.status === "kept").length,
    featured: projectImages.filter((item) => item.featured).length,
    preview: projectImages.filter((item) => item.featured2).length,
    cover: projectImages.filter((item) => item.cover).length,
  };
  const projectImageMeta = [
    `${project?.sectionCount ?? 0} 小节`,
    `${projectImageSummary.total} 张`,
    `待审 ${projectImageSummary.pending}`,
    `保留 ${projectImageSummary.kept}`,
    `p站 ${projectImageSummary.featured}`,
    `预览 ${projectImageSummary.preview}`,
    `封面 ${projectImageSummary.cover}`,
  ];
  const sectionImageCount = sectionData?.images.length ?? 0;
  const sectionMeta = sectionData
    ? [
        sectionData.aspectRatio,
        `batch ${sectionData.batchSize}`,
        `${sectionImageCount} 张`,
        `Prompt ${sectionData.promptBlockCount}`,
        `LoRA ${sectionData.loraCount}`,
      ]
    : undefined;
  const presetGroupCount = data.categories.reduce((sum, item) => sum + item.groupCount, 0);
  const categoryItemCount = category ? (category.type === "group" ? category.groupCount : category.presetCount) : 0;

  const queueHeader: HeaderSpec = {
    key: "root",
    route: currentRoute(routes, "root"),
    group: "核心",
    eyebrow: "任务",
    title: "任务工作台",
    subtitle: "按状态处理待审图片、运行中任务和失败记录。",
    meta: [`待审 ${data.metrics.pendingImages}`, `运行 ${runningCount}`, `失败 ${failedCount}`],
    status: "审核队列",
  };

  return [
    section("核心任务", [
      queueHeader,
      {
        ...queueHeader,
        key: "queue",
        route: currentRoute(routes, "queue"),
        title: "任务",
      },
      {
        key: "queue-review",
        route: currentRoute(routes, "queue-review"),
        group: "核心",
        eyebrow: "审核",
        title: run?.projectTitle ?? project?.title ?? "项目",
        subtitle: project?.notes || "逐张处理待审图片并保留运行上下文。",
        back: { href: "/runs", label: "返回任务" },
        actions: [
          headerAction("小节", ExternalLink),
          headerAction("下载工作流", Download),
        ],
        meta: [run?.sectionName ?? "小节", `RUN-${String(run?.runIndex ?? 1).padStart(2, "0")}`, `${run?.imageCount ?? 0} 张`],
        status: "图片审核",
      },
    ]),
    section("LoRA 训练", [
      {
        key: "training-runs",
        route: currentRoute(routes, "training-runs"),
        group: "LoRA 训练",
        eyebrow: "LoRA 训练",
        title: "运行",
        subtitle: "训练集生成任务、caption 文本任务和 LoRA 训练任务集中处理。",
        actions: [headerAction("启动训练", Play, "primary")],
        meta: ["生成任务", "训练任务", "状态筛选"],
        status: "训练运行",
      },
      {
        key: "training-projects",
        route: currentRoute(routes, "training-projects"),
        group: "LoRA 训练",
        eyebrow: "LoRA 训练",
        title: "训练项目",
        subtitle: "管理角色资料、最近结果、数据集版本和训练入口。",
        actions: [headerAction("新建项目", Plus, "primary")],
        meta: ["当前项目", "已归档", "最近结果"],
        status: "训练项目",
      },
      {
        key: "training-generation-run-detail",
        route: currentRoute(routes, "training-generation-run-detail"),
        group: "LoRA 训练",
        eyebrow: "生成任务",
        title: "生成任务详情",
        subtitle: "展示最终输入、输出和任务状态，不拆 provenance。",
        back: { href: "/training/runs", label: "返回运行" },
        actions: [headerAction("项目详情", ExternalLink)],
        status: "生成详情",
      },
      {
        key: "training-training-run-detail",
        route: currentRoute(routes, "training-training-run-detail"),
        group: "LoRA 训练",
        eyebrow: "训练任务",
        title: "训练任务详情",
        subtitle: "展示 dataset revision、训练配置、日志和最终 LoRA 产物。",
        back: { href: "/training/runs", label: "返回运行" },
        actions: [headerAction("数据集版本", History), headerAction("创建预制", Plus, "primary")],
        status: "训练详情",
      },
      {
        key: "training-project-new",
        route: currentRoute(routes, "training-project-new"),
        group: "LoRA 训练",
        eyebrow: "训练项目",
        title: "新建训练项目",
        subtitle: "选择模板、填写角色资料，并创建初始小节。",
        back: { href: "/training/projects", label: "返回训练项目" },
        actions: [headerAction("创建项目", Save, "primary")],
        status: "新建",
      },
      {
        key: "training-project-detail",
        route: currentRoute(routes, "training-project-detail"),
        group: "LoRA 训练",
        eyebrow: "训练项目",
        title: "训练项目总览",
        subtitle: "角色资料、最近任务、训练入口和最近产物。",
        back: { href: "/training/projects", label: "返回训练项目" },
        actions: [headerAction("启动训练", Play, "primary"), headerAction("保存为模板", Copy)],
        status: "项目总览",
      },
      {
        key: "training-project-profile",
        route: currentRoute(routes, "training-project-profile"),
        group: "LoRA 训练",
        eyebrow: "角色资料",
        title: "角色资料",
        subtitle: "管理角色文本与自由参考图。",
        back: { href: "/training/projects", label: "返回训练项目" },
        actions: [headerAction("保存资料", Save, "primary")],
        status: "资料",
      },
      {
        key: "training-project-sections",
        route: currentRoute(routes, "training-project-sections"),
        group: "LoRA 训练",
        eyebrow: "训练小节",
        title: "小节列表",
        subtitle: "参考生图 section cards，管理小节顺序、场景块和生成入口。",
        back: { href: "/training/projects", label: "返回训练项目" },
        actions: [headerAction("新建小节", Plus, "primary")],
        status: "小节",
      },
      {
        key: "training-project-section-detail",
        route: currentRoute(routes, "training-project-section-detail"),
        group: "LoRA 训练",
        eyebrow: "训练小节",
        title: "小节详情",
        subtitle: "场景块、合成场景描述、生成入口和小节结果同页展示。",
        back: { href: currentRoute(routes, "training-project-sections"), label: "返回小节" },
        actions: [headerAction("生成样本", Plus, "primary")],
        status: "小节详情",
      },
      {
        key: "training-generation-compose",
        route: currentRoute(routes, "training-generation-compose"),
        group: "LoRA 训练",
        eyebrow: "生成任务",
        title: "新建生成任务",
        subtitle: "显式 source tree、补充提示词和最终输入预览。",
        back: { href: currentRoute(routes, "training-project-section-detail"), label: "返回小节" },
        actions: [headerAction("运行生成", Play, "primary")],
        status: "Composer",
      },
      {
        key: "training-project-results",
        route: currentRoute(routes, "training-project-results"),
        group: "LoRA 训练",
        eyebrow: "结果池",
        title: "项目结果池",
        subtitle: "项目级图片审查、批量 keep/reject、caption 和 lightbox。",
        back: { href: currentRoute(routes, "training-project-detail"), label: "返回项目" },
        actions: [headerAction("批量保留", Save, "primary")],
        status: "结果池",
      },
      {
        key: "training-project-dataset",
        route: currentRoute(routes, "training-project-dataset"),
        group: "LoRA 训练",
        eyebrow: "数据集",
        title: "数据集",
        subtitle: "训练准备、kept 草稿、冻结版本和启动训练入口。",
        back: { href: currentRoute(routes, "training-project-detail"), label: "返回项目" },
        actions: [headerAction("启动训练", Play, "primary")],
        status: "数据集",
      },
      {
        key: "training-project-dataset-revision",
        route: currentRoute(routes, "training-project-dataset-revision"),
        group: "LoRA 训练",
        eyebrow: "数据集版本",
        title: "冻结版本详情",
        subtitle: "Snapshot 样本、captionSnapshot、manifest 和关联训练。",
        back: { href: currentRoute(routes, "training-project-dataset"), label: "返回数据集" },
        status: "冻结版本",
      },
      {
        key: "training-project-training-runs",
        route: currentRoute(routes, "training-project-training-runs"),
        group: "LoRA 训练",
        eyebrow: "训练任务",
        title: "项目训练任务",
        subtitle: "项目内 scoped training run list，详情跳全局训练任务详情。",
        back: { href: currentRoute(routes, "training-project-detail"), label: "返回项目" },
        actions: [headerAction("启动训练", Play, "primary")],
        status: "项目任务",
      },
      {
        key: "training-project-generation-tasks",
        route: currentRoute(routes, "training-project-generation-tasks"),
        group: "LoRA 训练",
        eyebrow: "生成任务",
        title: "项目生成任务",
        subtitle: "项目内 scoped generation task list，详情跳全局生成任务详情。",
        back: { href: currentRoute(routes, "training-project-detail"), label: "返回项目" },
        actions: [headerAction("新建生成任务", Plus, "primary")],
        status: "项目任务",
      },
      {
        key: "training-presets",
        route: currentRoute(routes, "training-presets"),
        group: "LoRA 训练",
        eyebrow: "训练预制",
        title: "训练预制",
        subtitle: "单段 scene description 预制，不包含普通预设 variants。",
        actions: [headerAction("排序规则", Shuffle), headerAction("新建", Plus, "primary")],
        status: "预制",
      },
      {
        key: "training-preset-detail",
        route: currentRoute(routes, "training-preset-detail"),
        group: "LoRA 训练",
        eyebrow: "训练预制",
        title: "训练预制详情",
        subtitle: "编辑 sceneDescriptionText，并展示删除影响。",
        back: { href: "/training/presets", label: "返回训练预制" },
        actions: [headerAction("保存", Save, "primary")],
        status: "预制详情",
      },
      {
        key: "training-preset-new",
        route: currentRoute(routes, "training-preset-new"),
        group: "LoRA 训练",
        eyebrow: "训练预制",
        title: "新建训练预制",
        subtitle: "创建单段 scene description 训练预制，不进入普通预设 variants 结构。",
        back: { href: "/training/presets", label: "返回训练预制" },
        actions: [headerAction("创建预制", Save, "primary")],
        status: "草稿",
      },
      {
        key: "training-preset-sort-rules",
        route: currentRoute(routes, "training-preset-sort-rules"),
        group: "LoRA 训练",
        eyebrow: "训练预制",
        title: "排序规则",
        subtitle: "合成顺序和分类内顺序。",
        back: { href: "/training/presets", label: "返回训练预制" },
        actions: [headerAction("保存全部", Save, "primary")],
        status: "排序",
      },
      {
        key: "training-templates",
        route: currentRoute(routes, "training-templates"),
        group: "LoRA 训练",
        eyebrow: "训练模板",
        title: "训练模板",
        subtitle: "训练模板是创建项目的一次性 seed。",
        actions: [headerAction("从模板创建项目", Copy), headerAction("新建模板", Plus, "primary")],
        status: "模板",
      },
      {
        key: "training-template-new",
        route: currentRoute(routes, "training-template-new"),
        group: "LoRA 训练",
        eyebrow: "训练模板",
        title: "新建训练模板",
        subtitle: "模板信息、默认规则和初始小节。",
        back: { href: "/training/templates", label: "返回训练模板" },
        actions: [headerAction("创建模板", Save, "primary")],
        status: "新建模板",
      },
      {
        key: "training-template-edit",
        route: currentRoute(routes, "training-template-edit"),
        group: "LoRA 训练",
        eyebrow: "训练模板",
        title: "编辑训练模板",
        subtitle: "Project-level guidance、section settings、preset/local blocks。",
        back: { href: "/training/templates", label: "返回训练模板" },
        actions: [headerAction("保存模板", Save, "primary")],
        status: "编辑模板",
      },
      {
        key: "training-template-section",
        route: currentRoute(routes, "training-template-section"),
        group: "LoRA 训练",
        eyebrow: "模板小节",
        title: "模板小节",
        subtitle: "模板小节和项目小节保持同一场景块编辑心智。",
        back: { href: currentRoute(routes, "training-template-edit"), label: "返回模板" },
        actions: [headerAction("保存小节", Save, "primary")],
        status: "模板小节",
      },
    ]),
    section("项目", [
      {
        key: "projects",
        route: currentRoute(routes, "projects"),
        group: "项目",
        eyebrow: "项目",
        title: "项目列表",
        subtitle: `${data.projects.length} 个项目 · ${data.projectFolders.length} 个文件夹`,
        meta: [`${data.projects.length} 个项目`, `已完成 ${completedProjectCount}`, `未完成 ${unfinishedProjectCount}`],
        status: "项目管理",
      },
      {
        key: "project-new",
        route: currentRoute(routes, "project-new"),
        group: "项目",
        eyebrow: "项目",
        title: "创建新项目",
        subtitle: "基础信息、预设绑定、默认参数和小节种子策略。",
        back: { href: "/projects", label: "返回项目列表" },
        actions: [headerAction("创建项目", Save, "primary")],
        status: "新建",
      },
      {
        key: "project-detail",
        route: currentRoute(routes, "project-detail"),
        group: "项目",
        eyebrow: "项目",
        title: project?.title ?? "项目详情",
        subtitle: project?.notes || `${project?.sectionCount ?? 0} 个小节`,
        back: { href: "/projects", label: "返回项目列表" },
        meta: projectImageMeta,
        status: "项目详情",
      },
      {
        key: "project-edit",
        route: currentRoute(routes, "project-edit"),
        group: "项目",
        eyebrow: "项目",
        title: project?.title ?? "项目",
        subtitle: "基础信息、预设绑定、默认参数和小节种子策略。",
        back: { href: `/projects/${project?.id ?? "project-id"}`, label: "返回项目" },
        actions: [headerAction("保存", Save, "primary")],
        status: "编辑",
      },
      {
        key: "project-results",
        route: currentRoute(routes, "project-results"),
        group: "项目",
        eyebrow: "项目结果",
        title: project?.title ?? "项目",
        subtitle: "按小节查看已保留、精选、预览和封面图片。",
        back: { href: `/projects/${project?.id ?? "project-id"}`, label: "返回项目" },
        actions: [headerAction("删除全部", Trash2, "danger")],
        meta: projectImageMeta,
        status: "结果视图",
      },
      {
        key: "project-batch",
        route: currentRoute(routes, "project-batch"),
        group: "项目",
        eyebrow: "项目",
        title: project?.title ?? "项目",
        subtitle: "从预设库导入预设并创建新的项目小节。",
        back: { href: `/projects/${project?.id ?? "project-id"}`, label: "返回项目" },
        actions: [headerAction("批量创建", Rows3, "primary")],
        status: "批量创建",
      },
      {
        key: "section-editor",
        route: currentRoute(routes, "section-editor"),
        group: "项目",
        eyebrow: "小节",
        title: sectionData?.name ?? "小节编辑",
        subtitle: `${project?.title ?? "项目"} · ${sectionData?.aspectRatio ?? "2:3"} · 批量 ${sectionData?.batchSize ?? 2}`,
        back: { href: `/projects/${project?.id ?? "project-id"}`, label: project?.title ?? "返回项目" },
        meta: sectionMeta,
        status: "小节编辑",
      },
    ]),
    section("资源", [
      {
        key: "presets",
        route: currentRoute(routes, "presets"),
        group: "资源",
        eyebrow: "预设库",
        title: "提示词预设库",
        subtitle: `${data.categories.length} 个分类 · ${data.metrics.presets} 个预设`,
        actions: [
          headerAction("新建分类", Plus),
          headerAction("排序规则", Shuffle),
        ],
        meta: [`分类 ${data.categories.length}`, `预设 ${data.metrics.presets}`, `预设组 ${presetGroupCount}`],
        status: "预设管理",
      },
      {
        key: "preset-category-new",
        route: currentRoute(routes, "preset-category-new"),
        group: "资源",
        eyebrow: "预设分类",
        title: "新建预设分类",
        subtitle: "创建分类后回到预设库。",
        back: { href: "/presets", label: "返回预设库" },
        actions: [headerAction("创建分类", Save, "primary")],
        status: "新建分类",
      },
      {
        key: "preset-category-edit",
        route: currentRoute(routes, "preset-category-edit"),
        group: "资源",
        eyebrow: "预设分类",
        title: `编辑分类：${category?.name ?? "分类"}`,
        subtitle: `${category?.type === "group" ? "预设组" : "预设"} · ${category?.presetCount ?? 0} 个条目`,
        back: { href: "/presets", label: "返回预设库" },
        actions: [headerAction("保存分类", Save, "primary")],
        meta: [category?.type === "group" ? "预设组" : "预设", `${categoryItemCount} 个条目`],
        status: "编辑分类",
      },
      {
        key: "preset-edit",
        route: currentRoute(routes, "preset-edit"),
        group: "资源",
        eyebrow: "预设",
        title: preset?.name ?? "预设详情",
        subtitle: `${category?.name ?? "未分类"} · ${preset?.variantCount ?? 0} 个变体`,
        back: { href: "/presets", label: "返回预设库" },
        actions: [
          headerAction("添加变体", Plus),
          headerAction("保存", Save, "primary"),
        ],
        meta: [category?.name ?? "未分类", `${preset?.variantCount ?? 0} 变体`],
        status: "预设编辑",
      },
      {
        key: "preset-groups",
        route: currentRoute(routes, "preset-groups"),
        group: "资源",
        eyebrow: "预设组",
        title: group?.name ?? "预设组",
        subtitle: `${category?.name ?? "未分类"} · ${group?.memberCount ?? 0} 个成员`,
        back: { href: "/presets", label: "返回预设库" },
        actions: [
          headerAction("选择预设", Search),
          headerAction("保存", Save, "primary"),
        ],
        meta: [category?.name ?? "未分类", `${group?.memberCount ?? 0} 成员`],
        status: "预设组",
      },
      {
        key: "sort-rules",
        route: currentRoute(routes, "sort-rules"),
        group: "资源",
        eyebrow: "排序规则",
        title: "预设排序规则",
        subtitle: "正向、反向与两段 LoRA 独立保存。",
        back: { href: "/presets", label: "返回预设库" },
        actions: [headerAction("保存全部", Save, "primary")],
        status: "排序",
      },
      {
        key: "models",
        route: currentRoute(routes, "models"),
        group: "资源",
        eyebrow: "模型",
        title: "模型文件管理",
        subtitle: "LoRA 和 checkpoint 按文件夹浏览、上传、移动和维护备注。",
        actions: [
          headerAction("上传文件", Upload),
          headerAction("新建文件夹", Plus),
          headerAction("扫描目录", Search),
        ],
        meta: [`模型 ${data.models.length}`, `LoRA ${data.loras.length}`],
        status: "模型文件",
      },
      {
        key: "loras",
        route: currentRoute(routes, "loras"),
        group: "资源",
        eyebrow: "LoRA",
        title: "LoRA 文件",
        subtitle: "从模型管理中聚焦 LoRA 资产、触发词和备注维护。",
        actions: [
          headerAction("上传 LoRA", Upload),
          headerAction("扫描目录", Search),
        ],
        meta: [`${data.loras.length} 个文件`],
        status: "LoRA",
      },
    ]),
    section("模板", [
      {
        key: "templates",
        route: currentRoute(routes, "templates"),
        group: "模板",
        eyebrow: "模板",
        title: "项目模板",
        subtitle: "管理可复用的小节结构、默认参数和预设导入配置。",
        actions: [headerAction("新建模板", Plus, "primary")],
        meta: [`${data.templates.length} 模板`, `${data.metrics.templates} 总数`],
        status: "模板列表",
      },
      {
        key: "template-new",
        route: currentRoute(routes, "template-new"),
        group: "模板",
        eyebrow: "模板",
        title: "新建项目模板",
        subtitle: "先填写模板信息，再添加可复用的小节配置。",
        back: { href: "/templates", label: "返回模板列表" },
        actions: [headerAction("创建模板", Save, "primary")],
        status: "新建模板",
      },
      {
        key: "template-edit",
        route: currentRoute(routes, "template-edit"),
        group: "模板",
        eyebrow: "模板",
        title: template?.name ?? "编辑模板",
        subtitle: `${template?.sectionCount ?? 0} 个小节`,
        back: { href: "/templates", label: "返回模板列表" },
        actions: [headerAction("添加小节", Plus), headerAction("保存", Save, "primary")],
        meta: [`${template?.sectionCount ?? 0} 小节`, template?.updatedAt ?? "未记录"],
        status: "模板编辑",
      },
      {
        key: "template-section",
        route: currentRoute(routes, "template-section"),
        group: "模板",
        eyebrow: "模板小节",
        title: `${template?.name ?? "模板"} / ${templateSection?.name ?? "小节"}`,
        subtitle: "连续编辑参数、导入绑定、Prompt Blocks 与 LoRA 模板。",
        back: { href: template ? `/templates/${template.id}/edit` : "/templates/template-id/edit", label: "返回模板" },
        actions: [
          headerAction("复制小节", Copy),
          headerAction("已保存", Save, "primary"),
          headerAction("上一节", ArrowLeft, "subtle"),
          headerAction("下一节", ArrowRight, "subtle"),
          headerAction("导出", Download),
        ],
        meta: [
          `#${String((templateSection?.sortOrder ?? 0) + 1).padStart(2, "0")}`,
          templateSection?.aspectRatio ?? "2:3",
          `batch ${templateSection?.batchSize ?? 0}`,
        ],
        status: "模板小节",
      },
    ]),
    section("系统", [
      {
        key: "settings",
        route: currentRoute(routes, "settings"),
        group: "系统",
        eyebrow: "设置",
        title: "设置",
        subtitle: "系统配置入口；预设管理在预设库，项目模板在模板页。",
        actions: [
          headerAction("监控", Monitor),
          headerAction("日志", History),
        ],
        status: "设置入口",
      },
      {
        key: "logs",
        route: currentRoute(routes, "logs"),
        group: "系统",
        eyebrow: "日志",
        title: "后端日志",
        subtitle: "按来源、级别和模块筛选日志。",
        back: { href: "/settings", label: "返回设置" },
        actions: [headerAction("刷新日志", Search)],
        meta: [`${data.auditLogs.length} 条`],
        status: "日志",
      },
      {
        key: "monitor",
        route: currentRoute(routes, "monitor"),
        group: "系统",
        eyebrow: "监控",
        title: "ComfyUI 监控",
        subtitle: "管理内置进程或外部连接。",
        back: { href: "/settings", label: "返回设置" },
        actions: [
          headerAction("探测连接", Activity, "primary"),
          headerAction("启动", Play),
          headerAction("停止", X, "danger"),
        ],
        meta: [`处理中 ${runningCount}`],
        status: "Worker 正常",
      },
      {
        key: "login",
        route: currentRoute(routes, "login"),
        group: "系统",
        eyebrow: "登录",
        title: "登录",
        subtitle: "使用本地访问令牌进入工作台。",
        actions: [
          headerAction("登录", Lock, "primary"),
          headerAction("清除", X),
        ],
        status: "访问令牌",
      },
      {
        key: "not-found",
        route: "/unknown-demo-route",
        group: "系统",
        eyebrow: "404",
        title: "未匹配页面",
        subtitle: "/unknown-demo-route",
        actions: [headerAction("返回任务", Home)],
        status: "未匹配",
      },
    ]),
    section("组件审查", [
      {
        key: "component-showcase",
        route: currentRoute(routes, "component-showcase"),
        group: "组件审查",
        eyebrow: "组件目录",
        title: "组件功能族总览",
        subtitle: "按功能族查看真实复用组件、业务适配组件和专项页面。",
        actions: [headerAction("Headers", PanelTop, "primary")],
        status: "组件目录",
      },
      {
        key: "component-showcase-controls",
        route: currentRoute(routes, "component-showcase-controls"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "基础操作控件",
        subtitle: "按钮、选择、切换、字段和状态徽标等最底层交互控件。",
        back: { href: "/component-showcase", label: "返回总览" },
        status: "功能族",
      },
      {
        key: "component-showcase-surfaces",
        route: currentRoute(routes, "component-showcase-surfaces"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "页面骨架与容器",
        subtitle: "页面标题、连续工作区、编辑区块、右侧详情栏、空状态和加载骨架。",
        back: { href: "/component-showcase", label: "返回总览" },
        status: "功能族",
      },
      {
        key: "component-showcase-unit-items",
        route: currentRoute(routes, "component-showcase-unit-items"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "单元行项",
        subtitle: "项目、小节、模板、预设、运行任务等可浏览、可选择、可操作的行项。",
        back: { href: "/component-showcase", label: "返回总览" },
        status: "功能族",
      },
      {
        key: "component-showcase-folders",
        route: currentRoute(routes, "component-showcase-folders"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "文件夹、路径与移动目标",
        subtitle: "项目、预设、模型和批量创建浏览器中的文件夹、路径和移动目标。",
        back: { href: "/component-showcase", label: "返回总览" },
        status: "功能族",
      },
      {
        key: "component-showcase-batch-actions",
        route: currentRoute(routes, "component-showcase-batch-actions"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "批量选择与操作反馈",
        subtitle: "已选数量、全选、移动、删除、撤销、操作状态条、toast 和保存状态。",
        back: { href: "/component-showcase", label: "返回总览" },
        status: "功能族",
      },
      {
        key: "component-showcase-generation-params",
        route: currentRoute(routes, "component-showcase-generation-params"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "生成参数与小节配置",
        subtitle: "画幅、尺寸、checkpoint、KSampler、batch、放大和小节参数。",
        back: { href: "/component-showcase", label: "返回总览" },
        status: "功能族",
      },
      {
        key: "component-showcase-preset-prompt-lora",
        route: currentRoute(routes, "component-showcase-preset-prompt-lora"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "预设、Prompt 与 LoRA",
        subtitle: "预设绑定、导入、Prompt 块、编译预览、LoRA 两阶段和预设组成员。",
        back: { href: "/component-showcase", label: "返回总览" },
        status: "功能族",
      },
      {
        key: "component-showcase-taxonomy-history",
        route: currentRoute(routes, "component-showcase-taxonomy-history"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "分类、排序、历史与差异",
        subtitle: "分类侧栏、分类编辑、槽位、排序规则、历史 diff、变体 rail 和小节 rail。",
        back: { href: "/component-showcase", label: "返回总览" },
        status: "功能族",
      },
      {
        key: "component-showcase-images",
        route: currentRoute(routes, "component-showcase-images"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "图片结果与审核面",
        subtitle: "小图、中图、结果列表、审核面板、图片统计、Lightbox 和结果筛选。",
        back: { href: "/component-showcase", label: "返回总览" },
        status: "功能族",
      },
      {
        key: "component-showcase-runs",
        route: currentRoute(routes, "component-showcase-runs"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "任务运行、队列与进度",
        subtitle: "队列指标、当前运行进度、运行/失败列表、待审核分组和执行参数摘要。",
        back: { href: "/component-showcase", label: "返回总览" },
        status: "功能族",
      },
      {
        key: "component-showcase-system",
        route: currentRoute(routes, "component-showcase-system"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "系统、日志、监控与模型文件",
        subtitle: "日志筛选、日志行、监控状态、探测结果、模型文件浏览和登录令牌。",
        back: { href: "/component-showcase", label: "返回总览" },
        status: "功能族",
      },
      {
        key: "component-showcase-icons",
        route: currentRoute(routes, "component-showcase-icons"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "Icons 图标专项",
        subtitle: "Lucide 图标、自定义 SVG 图标和图标语义说明。",
        back: { href: "/component-showcase", label: "返回总览" },
        actions: [headerAction("搜索", Search)],
        status: "专项",
      },
      {
        key: "component-showcase-headers",
        route: currentRoute(routes, "component-showcase-headers"),
        group: "组件审查",
        eyebrow: "组件展示",
        title: "Headers 固定顶栏专项",
        subtitle: "所有路由的固定顶部 header 展开、移动端合并和滚动隐藏状态。",
        back: { href: "/component-showcase", label: "返回总览" },
        actions: [
          headerAction("校准间距", SlidersHorizontal),
          headerAction("截图", ExternalLink),
          headerAction("复制配置", Copy),
          headerAction("导出 CSS", Download),
          headerAction("移动端预览", Monitor),
          headerAction("保存样式", Save, "primary"),
          headerAction("重置布局", X, "danger"),
        ],
        status: "专项",
      },
    ]),
  ];
}

export function flattenHeaderSpecs(data: DemoData) {
  return buildHeaderSpecs(data).flatMap((group) => group.specs);
}

function sectionHeaderMeta(section: DemoSection | undefined) {
  if (!section) return undefined;
  const sectionImageCount = section.images.length;
  return [
    section.aspectRatio,
    `batch ${section.batchSize}`,
    `${sectionImageCount} 张`,
    `Prompt ${section.promptBlockCount}`,
    `LoRA ${section.loraCount}`,
  ];
}

export function findHeaderSpecForRoute(data: DemoData, currentRoute: string) {
  const specs = flattenHeaderSpecs(data);
  const matched = matchRoute(currentRoute);
  const spec = specs.find((item) => item.key === matched.key) ?? specs.find((item) => item.route === currentRoute) ?? specs.find((item) => item.key === "not-found") ?? null;
  if (!spec || matched.key !== "section-editor") return spec;

  const project = findProject(data, matched.params.projectId);
  const section = findSection(project, matched.params.sectionId);

  return {
    ...spec,
    back: { href: `/projects/${project?.id ?? matched.params.projectId ?? "project-id"}`, label: project?.title ?? "返回项目" },
    meta: sectionHeaderMeta(section),
    subtitle: `${project?.title ?? "项目"} · ${section?.aspectRatio ?? "2:3"} · 批量 ${section?.batchSize ?? 2}`,
    title: section?.name ?? spec.title,
  };
}
