import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FolderPlus,
  History,
  Home,
  ImageIcon,
  Layers,
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
  Tags,
  Upload,
  Wand2,
  X,
} from "lucide-react";

import type { DemoData } from "./design-demo-data";
import {
  findCategory,
  findGroup,
  findPreset,
  findProject,
  findRun,
  findTemplate,
  matchPattern,
  matchRoute,
  ROUTES,
  sampleRouteInventory,
} from "./design-demo-utils";
import type { RouteIcon, RouteKey } from "./design-demo-utils";

export type HeaderActionTone = "default" | "primary" | "pink" | "danger" | "subtle";

export type HeaderAction = {
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
  secondaryActions?: HeaderAction[];
  meta?: string[];
  status?: string;
};

export type HeaderSpecSection = {
  label: string;
  specs: HeaderSpec[];
};

const section = (label: string, specs: HeaderSpec[]): HeaderSpecSection => ({ label, specs });

export function headerAction(label: string, icon: RouteIcon, tone: HeaderActionTone = "default"): HeaderAction {
  return { label, icon, tone };
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
        title: `${run?.projectTitle ?? "项目"} / ${run?.sectionName ?? "小节"}`,
        subtitle: project?.notes || "逐张处理待审图片并保留运行上下文。",
        back: { href: "/runs", label: "返回任务" },
        actions: [
          headerAction("跳转至小节", ExternalLink),
          headerAction("下载工作流文件", Download),
        ],
        meta: [`RUN-${String(run?.runIndex ?? 1).padStart(2, "0")}`, `${run?.imageCount ?? 0} 张`, `待审 ${run?.pendingCount ?? 0}`],
        status: "图片审核",
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
        actions: [
          headerAction("新建文件夹", FolderPlus),
          headerAction("创建项目", Plus, "primary"),
        ],
        meta: ["根目录", "可批量移动"],
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
        actions: [headerAction("创建", Save, "primary")],
        meta: ["草稿", "继承模板参数"],
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
        actions: [
          headerAction("编辑", Edit3),
          headerAction("批量创建", Rows3, "primary"),
          headerAction("整组运行", Play, "primary"),
        ],
        secondaryActions: [
          headerAction("导入模板", Download),
          headerAction("图片整合", ImageIcon),
          headerAction("保存模板", Save),
        ],
        meta: [`${project?.sectionCount ?? 0} 小节`, "小节视图", "batch 2"],
        status: "项目详情",
      },
      {
        key: "project-edit",
        route: currentRoute(routes, "project-edit"),
        group: "项目",
        eyebrow: "项目",
        title: `编辑项目：${project?.title ?? "项目"}`,
        subtitle: "基础信息、预设绑定、默认参数和小节种子策略。",
        back: { href: `/projects/${project?.id ?? "project-id"}`, label: "返回项目" },
        actions: [headerAction("保存", Save, "primary")],
        meta: ["自动保存待确认"],
        status: "编辑",
      },
      {
        key: "project-results",
        route: currentRoute(routes, "project-results"),
        group: "项目",
        eyebrow: "项目结果",
        title: `${project?.title ?? "项目"} / 结果`,
        subtitle: "按小节查看已保留、精选、预览和封面图片。",
        back: { href: `/projects/${project?.id ?? "project-id"}`, label: "返回项目" },
        actions: [
          headerAction("小节", Layers, "subtle"),
          headerAction("结果", ImageIcon, "primary"),
        ],
        meta: [`${project?.images.length ?? data.images.length} 张`, "全部状态"],
        status: "结果视图",
      },
      {
        key: "project-batch",
        route: currentRoute(routes, "project-batch"),
        group: "项目",
        eyebrow: "项目",
        title: `${project?.title ?? "项目"} / 批量创建小节`,
        subtitle: "从预设库导入预设并创建新的项目小节。",
        back: { href: `/projects/${project?.id ?? "project-id"}`, label: "返回项目" },
        actions: [headerAction("创建小节", Plus, "primary")],
        meta: ["预设浏览器", "导入队列", "参数草稿"],
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
        actions: [
          headerAction("上一节", ArrowLeft, "subtle"),
          headerAction("下一节", ArrowRight, "subtle"),
          headerAction("workflow", ExternalLink),
          headerAction("运行", Play, "primary"),
        ],
        secondaryActions: [
          headerAction("参数", SlidersHorizontal, "primary"),
          headerAction("预设", Tags),
          headerAction("Prompt", Wand2),
          headerAction("历史", History),
        ],
        meta: ["已保存", "batch 2", "KSampler 1/2"],
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
        meta: [category?.name ?? "分类", "文件夹", "移动队列"],
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
        meta: ["预设 / 预设组", "色相"],
        status: "新建分类",
      },
      {
        key: "preset-category-edit",
        route: currentRoute(routes, "preset-category-edit"),
        group: "资源",
        eyebrow: "预设分类",
        title: `编辑分类 / ${category?.name ?? "分类"}`,
        subtitle: `${category?.type === "group" ? "预设组" : "预设"} · ${category?.presetCount ?? 0} 个条目`,
        back: { href: "/presets", label: "返回预设库" },
        actions: [headerAction("保存分类", Save, "primary")],
        meta: ["分类类型锁定", "删除检查"],
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
        meta: [preset?.slug ?? "preset", "变体", "Prompt Blocks"],
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
        meta: [group?.slug ?? "group", "成员编排"],
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
        meta: ["正向 Prompt", "反向 Prompt", "LoRA 1/2"],
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
        meta: [`${data.loras.length} 个文件`, "触发词"],
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
        meta: ["草稿", "待创建"],
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
        actions: [headerAction("添加小节", Plus)],
        secondaryActions: [headerAction("保存", Save, "primary")],
        meta: ["小节导航", "排序保存"],
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
        ],
        secondaryActions: [
          headerAction("上一节", ArrowLeft, "subtle"),
          headerAction("下一节", ArrowRight, "subtle"),
          headerAction("导出", Download),
        ],
        meta: [`#${String((templateSection?.sortOrder ?? 0) + 1).padStart(2, "0")}`, templateSection?.aspectRatio ?? "2:3"],
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
        meta: ["ComfyUI", "后端日志"],
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
        meta: [`${data.auditLogs.length} 条`, "INFO / WARN / ERROR"],
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
        meta: [`处理中 ${runningCount}`, "HTTP 200"],
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
        meta: ["待输入", "返回任务工作台"],
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
        meta: ["路由表"],
        status: "未匹配",
      },
    ]),
    section("临时与组件", [
      {
        key: "image-list-components",
        route: currentRoute(routes, "image-list-components"),
        group: "临时",
        eyebrow: "临时页面",
        title: "图片列表组件检查",
        subtitle: "统一小图列表和中图列表的布局、溢出、选择与操作区。",
        back: { href: "/component-showcase", label: "返回总览" },
        actions: [headerAction("返回总览", ArrowLeft, "subtle")],
        meta: ["小图列表", "中图列表", "Lightbox"],
        status: "组件检查",
      },
      {
        key: "component-showcase",
        route: currentRoute(routes, "component-showcase"),
        group: "临时",
        eyebrow: "临时页面",
        title: "组件展示总览",
        subtitle: "选择分类查看各组件。",
        actions: [headerAction("Headers", PanelTop, "primary")],
        meta: ["原子", "中组件", "图片", "Headers"],
        status: "组件目录",
      },
      {
        key: "component-showcase-atoms",
        route: currentRoute(routes, "component-showcase-atoms"),
        group: "临时",
        eyebrow: "组件展示",
        title: "原子 / 小组件",
        subtitle: "基础组件的响应式表现。",
        back: { href: "/component-showcase", label: "返回总览" },
        actions: [headerAction("返回总览", ArrowLeft, "subtle")],
        meta: ["Button", "StatusBadge", "Field"],
        status: "原子组件",
      },
      {
        key: "component-showcase-mid",
        route: currentRoute(routes, "component-showcase-mid"),
        group: "临时",
        eyebrow: "组件展示",
        title: "中组件",
        subtitle: "页面标题、面板、路由表和运行指标。",
        back: { href: "/component-showcase", label: "返回总览" },
        actions: [headerAction("返回总览", ArrowLeft, "subtle")],
        meta: ["PageHeader", "Panel", "QueueMetrics"],
        status: "中组件",
      },
      {
        key: "component-showcase-images",
        route: currentRoute(routes, "component-showcase-images"),
        group: "临时",
        eyebrow: "组件展示",
        title: "图片组件",
        subtitle: "图片缩略图、列表、宫格与 Lightbox。",
        back: { href: "/component-showcase", label: "返回总览" },
        actions: [headerAction("返回总览", ArrowLeft, "subtle")],
        meta: ["ImageThumb", "ReviewBoard", "Lightbox"],
        status: "图片组件",
      },
      {
        key: "component-showcase-editor",
        route: currentRoute(routes, "component-showcase-editor"),
        group: "临时",
        eyebrow: "组件展示",
        title: "Section Editor 组件",
        subtitle: "小节编辑器专用组件。",
        back: { href: "/component-showcase", label: "返回总览" },
        actions: [headerAction("返回总览", ArrowLeft, "subtle")],
        meta: ["SectionHeader", "LoraRow", "PromptBlockRow"],
        status: "编辑器组件",
      },
      {
        key: "component-showcase-projects",
        route: currentRoute(routes, "component-showcase-projects"),
        group: "临时",
        eyebrow: "组件展示",
        title: "项目卡片和列表",
        subtitle: "项目列表页和详情页中的卡片、行和导航组件。",
        back: { href: "/component-showcase", label: "返回总览" },
        actions: [headerAction("返回总览", ArrowLeft, "subtle")],
        meta: ["ProjectDetailHeader", "ProjectSectionCard"],
        status: "项目组件",
      },
      {
        key: "component-showcase-icons",
        route: currentRoute(routes, "component-showcase-icons"),
        group: "临时",
        eyebrow: "组件展示",
        title: "Icons",
        subtitle: "项目使用的 Lucide 图标与自定义 SVG。",
        back: { href: "/component-showcase", label: "返回总览" },
        actions: [headerAction("搜索", Search)],
        meta: ["Lucide", "Custom SVG"],
        status: "图标",
      },
      {
        key: "component-showcase-headers",
        route: currentRoute(routes, "component-showcase-headers"),
        group: "临时",
        eyebrow: "组件展示",
        title: "Headers",
        subtitle: "新固定顶部 header 的页面级设计稿。",
        back: { href: "/component-showcase", label: "返回总览" },
        actions: [headerAction("返回总览", ArrowLeft, "subtle")],
        meta: ["桌面", "折叠", "移动端"],
        status: "Header 设计",
      },
    ]),
  ];
}

export function flattenHeaderSpecs(data: DemoData) {
  return buildHeaderSpecs(data).flatMap((group) => group.specs);
}

export function findHeaderSpecForRoute(data: DemoData, currentRoute: string) {
  const specs = flattenHeaderSpecs(data);
  const matched = matchRoute(currentRoute);
  return specs.find((spec) => spec.key === matched.key) ?? specs.find((spec) => spec.route === currentRoute) ?? specs.find((spec) => spec.key === "not-found") ?? null;
}
