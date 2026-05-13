"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FolderPlus,
  Gauge,
  History,
  Home,
  ImageIcon,
  Layers,
  Lock,
  Monitor,
  MoreHorizontal,
  PanelTop,
  Play,
  Plus,
  RefreshCw,
  Rows3,
  Save,
  Search,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  Tags,
  Upload,
  Wand2,
  X,
} from "lucide-react";

import type { DemoData } from "../design-demo-data";
import {
  cx,
  demoHref,
  findCategory,
  findGroup,
  findPreset,
  findProject,
  findRun,
  findTemplate,
  matchPattern,
  ROUTES,
  sampleRouteInventory,
} from "../design-demo-utils";
import type { RouteIcon, RouteKey } from "../design-demo-utils";
import s from "./headers-page.showcase.module.css";
import { PageHeader, PageHeaderBack } from "../ui/page-header";
import headerS from "./headers-showcase.module.css";

type HeaderActionTone = "default" | "primary" | "pink" | "danger" | "subtle";

type HeaderAction = {
  icon: RouteIcon;
  label: string;
  tone?: HeaderActionTone;
};

type HeaderSpec = {
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

const section = (label: string, specs: HeaderSpec[]) => ({ label, specs });

function action(label: string, icon: RouteIcon, tone: HeaderActionTone = "default"): HeaderAction {
  return { label, icon, tone };
}

function routeMap(data: DemoData) {
  return new Map(sampleRouteInventory(data).map((item) => [item.key, item.sample]));
}

function currentRoute(routes: Map<RouteKey, string>, key: RouteKey) {
  return routes.get(key) ?? "/runs";
}

function displayRoute(route: string) {
  const matchedRoute = ROUTES.find((item) => matchPattern(item.pattern, route));
  return matchedRoute ? matchedRoute.pattern.replace(/:[^/]+/g, ":id") : route;
}

function buildHeaderSpecs(data: DemoData) {
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
    actions: [action("刷新", RefreshCw, "subtle")],
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
          action("跳转至小节", ExternalLink),
          action("下载工作流文件", Download),
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
          action("新建文件夹", FolderPlus),
          action("创建项目", Plus, "primary"),
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
        actions: [action("创建", Save, "primary")],
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
          action("编辑", Edit3),
          action("批量创建", Rows3, "primary"),
          action("整组运行", Play, "primary"),
        ],
        secondaryActions: [
          action("导入模板", Download),
          action("图片整合", ImageIcon),
          action("保存模板", Save),
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
        actions: [action("保存", Save, "primary")],
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
          action("小节", Layers, "subtle"),
          action("结果", ImageIcon, "primary"),
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
        actions: [action("创建小节", Plus, "primary")],
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
          action("上一节", ArrowLeft, "subtle"),
          action("下一节", ArrowRight, "subtle"),
          action("workflow", ExternalLink),
          action("运行", Play, "primary"),
        ],
        secondaryActions: [
          action("参数", SlidersHorizontal, "primary"),
          action("预设", Tags),
          action("Prompt", Wand2),
          action("历史", History),
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
          action("新建分类", Plus),
          action("排序规则", Shuffle),
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
        actions: [action("创建分类", Save, "primary")],
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
        actions: [action("保存分类", Save, "primary")],
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
          action("添加变体", Plus),
          action("保存", Save, "primary"),
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
          action("选择预设", Search),
          action("保存", Save, "primary"),
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
        actions: [action("保存全部", Save, "primary")],
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
          action("上传文件", Upload),
          action("新建文件夹", Plus),
          action("扫描目录", Search),
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
          action("上传 LoRA", Upload),
          action("扫描目录", Search),
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
        actions: [action("新建模板", Plus, "primary")],
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
        actions: [action("创建模板", Save, "primary")],
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
        actions: [action("添加小节", Plus)],
        secondaryActions: [action("保存", Save, "primary")],
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
          action("复制小节", Copy),
          action("已保存", Save, "primary"),
        ],
        secondaryActions: [
          action("上一节", ArrowLeft, "subtle"),
          action("下一节", ArrowRight, "subtle"),
          action("导出", Download),
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
          action("监控", Monitor),
          action("日志", History),
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
        actions: [action("刷新日志", Search)],
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
          action("探测连接", Activity, "primary"),
          action("启动", Play),
          action("停止", X, "danger"),
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
          action("登录", Lock, "primary"),
          action("清除", X),
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
        actions: [action("返回任务", Home)],
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
        actions: [action("返回总览", ArrowLeft, "subtle")],
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
        actions: [action("Headers", PanelTop, "primary")],
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
        actions: [action("返回总览", ArrowLeft, "subtle")],
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
        actions: [action("返回总览", ArrowLeft, "subtle")],
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
        actions: [action("返回总览", ArrowLeft, "subtle")],
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
        actions: [action("返回总览", ArrowLeft, "subtle")],
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
        actions: [action("返回总览", ArrowLeft, "subtle")],
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
        actions: [action("搜索", Search)],
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
        actions: [action("返回总览", ArrowLeft, "subtle")],
        meta: ["桌面", "折叠", "移动端"],
        status: "Header 设计",
      },
    ]),
  ];
}

function HeaderActionButton({
  action: item,
  iconOnly = false,
}: {
  action: HeaderAction;
  iconOnly?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      aria-label={iconOnly ? item.label : undefined}
      className={cx(
        headerS.headerButton,
        item.tone === "primary" && headerS.headerButtonPrimary,
        item.tone === "pink" && headerS.headerButtonPink,
        item.tone === "danger" && headerS.headerButtonDanger,
        item.tone === "subtle" && headerS.headerButtonSubtle,
        iconOnly && headerS.headerButtonIconOnly,
      )}
      title={iconOnly ? item.label : undefined}
      type="button"
    >
      <Icon aria-hidden="true" className={headerS.headerIcon} />
      {iconOnly ? null : <span>{item.label}</span>}
    </button>
  );
}

function HeaderMeta({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className={headerS.metaStrip}>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function HeaderSurface({
  mode,
  spec,
}: {
  mode: "expanded" | "collapsed" | "mobile";
  spec: HeaderSpec;
}) {
  const isCollapsed = mode === "collapsed";
  const isMobile = mode === "mobile";
  const visibleActions = isMobile ? spec.actions?.slice(0, 1) : isCollapsed ? spec.actions?.slice(0, 2) : spec.actions;
  const hiddenCount = Math.max(0, (spec.actions?.length ?? 0) - (visibleActions?.length ?? 0));
  const titleId = `${spec.key}-${mode}-title`;

  return (
    <div className={headerS.previewFrame}>
      <div className={headerS.previewChrome}>
        <span>{mode === "expanded" ? "桌面展开" : mode === "collapsed" ? "桌面折叠" : "移动端"}</span>
        <em>{mode === "collapsed" ? "向下滚动" : mode === "expanded" ? "向上滚动" : "合并顶栏"}</em>
      </div>
      <section
        aria-labelledby={titleId}
        className={cx(
          headerS.fixedHeader,
          isCollapsed && headerS.fixedHeaderCollapsed,
          isMobile && headerS.fixedHeaderMobile,
        )}
      >
        <div className={headerS.mainRow}>
          <div className={headerS.leftCluster}>
            {spec.back ? (
              <div className={headerS.backSlot}>
                <PageHeaderBack href={spec.back.href} label={spec.back.label} />
              </div>
            ) : null}
          </div>

          <div className={headerS.identityBlock}>
            {!isCollapsed ? <span className={headerS.eyebrow}>{spec.eyebrow}</span> : null}
            <div className={headerS.titleRow}>
              <h3 id={titleId}>{spec.title}</h3>
              {spec.status ? <span className={headerS.statusPill}>{spec.status}</span> : null}
            </div>
            {!isCollapsed ? (
              <p>{isMobile ? "ComfyUI Manager" : spec.subtitle}</p>
            ) : (
              <HeaderMeta items={spec.meta?.slice(0, 2)} />
            )}
          </div>

          <div className={headerS.actionCluster} role="toolbar" aria-label={`${spec.title} 页面操作`}>
            {visibleActions?.map((item) => (
              <HeaderActionButton action={item} iconOnly={isCollapsed || isMobile} key={item.label} />
            ))}
            {(hiddenCount > 0 || spec.secondaryActions?.length) ? (
              <button aria-label="更多页面操作" className={cx(headerS.headerButton, headerS.headerButtonIconOnly)} type="button">
                <MoreHorizontal aria-hidden="true" className={headerS.headerIcon} />
              </button>
            ) : null}
          </div>
        </div>

        {!isCollapsed && !isMobile ? (
          <>
            <HeaderMeta items={spec.meta} />
            {spec.secondaryActions?.length ? (
              <div className={headerS.commandRow} role="toolbar" aria-label={`${spec.title} 二级操作`}>
                {spec.secondaryActions.map((item) => (
                  <HeaderActionButton action={item} key={item.label} />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

function PageHeaderCard({ spec }: { spec: HeaderSpec }) {
  return (
    <article className={headerS.headerCard}>
      <div className={headerS.cardIntro}>
        <div>
          <span>{spec.group}</span>
          <h2>{spec.title}</h2>
        </div>
        <Link className={headerS.routeLink} href={demoHref(spec.route)}>
          {displayRoute(spec.route)}
        </Link>
      </div>
      <div className={headerS.stateGrid}>
        <HeaderSurface mode="expanded" spec={spec} />
        <HeaderSurface mode="collapsed" spec={spec} />
        <HeaderSurface mode="mobile" spec={spec} />
      </div>
    </article>
  );
}

function HeaderPrinciples() {
  const specs: HeaderSpec[] = [
    {
      key: "principle-review",
      route: "/runs/run-id",
      group: "核心",
      eyebrow: "审核",
      title: "Miku spring batch A / Standing",
      subtitle: "返回、标题、运行摘要和下载 workflow 都收进同一条固定 header。",
      back: { href: "/runs", label: "返回任务" },
      actions: [action("跳转至小节", ExternalLink), action("下载工作流文件", Download)],
      meta: ["RUN-01", "3:4", "8 张", "待审 6"],
      status: "图片审核",
    },
    {
      key: "principle-project",
      route: "/projects/project-id",
      group: "项目",
      eyebrow: "项目",
      title: "Miku spring batch A",
      subtitle: "项目页的视图切换、命令栏和运行控制在展开态完整保留。",
      back: { href: "/projects", label: "返回项目列表" },
      actions: [action("批量创建", Rows3, "primary"), action("整组运行", Play, "primary")],
      secondaryActions: [action("导入模板", Download), action("图片整合", ImageIcon), action("保存模板", Save)],
      meta: ["12 小节", "小节视图", "batch 2"],
      status: "项目详情",
    },
  ];

  return (
    <section className={headerS.principles}>
      {specs.map((spec) => (
        <HeaderSurface key={spec.key} mode="expanded" spec={spec} />
      ))}
    </section>
  );
}

export function ComponentShowcaseHeaders({ data }: { data: DemoData }) {
  const groups = buildHeaderSpecs(data);
  const total = groups.reduce((sum, group) => sum + group.specs.length, 0);

  return (
    <div className={s.showcasePage}>
      <PageHeader
        back={{ href: "/component-showcase", label: "返回总览" }}
        eyebrow="组件展示"
        title="Headers"
        subtitle={`${total} 个页面 header 设计稿，先审核固定顶部方案，再落到正式页面。`}
      />
      <HeaderPrinciples />
      <div className={headerS.pageMap}>
        {groups.map((group) => (
          <section className={headerS.groupSection} key={group.label}>
            <div className={headerS.groupTitle}>
              <span>{group.label}</span>
              <em>{group.specs.length} 页</em>
            </div>
            <div className={headerS.cardGrid}>
              {group.specs.map((spec) => (
                <PageHeaderCard key={spec.key} spec={spec} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className={headerS.reviewNotes} aria-label="Header 规则">
        <div>
          <PanelTop aria-hidden="true" className={headerS.noteIcon} />
          <strong>固定顶部</strong>
          <span>桌面端与移动端共用一套页面身份和操作归属；内容区后续需要补齐顶部安全距离。</span>
        </div>
        <div>
          <Gauge aria-hidden="true" className={headerS.noteIcon} />
          <strong>滚动折叠</strong>
          <span>向下滚动保留返回、标题、状态和一到两个高频操作；向上滚动恢复完整上下文。</span>
        </div>
        <div>
          <ShieldCheck aria-hidden="true" className={headerS.noteIcon} />
          <strong>移动合并</strong>
          <span>移动端不再单独堆页面 header，返回和页面操作进入当前顶栏，低频操作进更多菜单。</span>
        </div>
      </section>
    </div>
  );
}
