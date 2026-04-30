"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArrowRight,
  Boxes,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  Database,
  Edit3,
  FileText,
  FolderTree,
  Gauge,
  Grid3X3,
  History,
  Home,
  ImageIcon,
  Layers3,
  ListChecks,
  Lock,
  Menu,
  Monitor,
  Moon,
  MoreHorizontal,
  Play,
  Plus,
  Rows3,
  Save,
  Search,
  Settings,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";

import type {
  DemoAsset,
  DemoCategory,
  DemoData,
  DemoImage,
  DemoPreset,
  DemoPresetGroup,
  DemoProject,
  DemoRun,
  DemoSection,
  DemoTemplate,
} from "./design-demo-data";
import s from "./design-demo.module.css";

type RouteKey =
  | "root"
  | "login"
  | "queue"
  | "queue-review"
  | "projects"
  | "project-new"
  | "project-detail"
  | "project-edit"
  | "project-results"
  | "project-batch"
  | "section-editor"
  | "section-results"
  | "models"
  | "loras"
  | "presets"
  | "preset-edit"
  | "preset-groups"
  | "sort-rules"
  | "templates"
  | "template-new"
  | "template-edit"
  | "template-section"
  | "settings"
  | "logs"
  | "monitor"
  | "not-found";

type Match = {
  key: RouteKey;
  params: Record<string, string>;
  route: string;
};

type RouteDef = {
  key: RouteKey;
  pattern: string;
  title: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ROUTES: RouteDef[] = [
  { key: "root", pattern: "/", title: "根路径", group: "核心", icon: Home },
  { key: "queue-review", pattern: "/queue/:runId", title: "审核宫格", group: "核心", icon: Grid3X3 },
  { key: "queue", pattern: "/queue", title: "队列", group: "核心", icon: ClipboardList },
  { key: "project-new", pattern: "/projects/new", title: "新建项目", group: "项目", icon: Plus },
  { key: "project-edit", pattern: "/projects/:projectId/edit", title: "编辑项目", group: "项目", icon: Edit3 },
  { key: "project-results", pattern: "/projects/:projectId/results", title: "项目结果", group: "项目", icon: ImageIcon },
  { key: "project-batch", pattern: "/projects/:projectId/batch-create", title: "批量创建", group: "项目", icon: Rows3 },
  { key: "section-results", pattern: "/projects/:projectId/sections/:sectionId/results", title: "小节结果", group: "项目", icon: ImageIcon },
  { key: "section-editor", pattern: "/projects/:projectId/sections/:sectionId", title: "小节编辑", group: "项目", icon: SlidersHorizontal },
  { key: "project-detail", pattern: "/projects/:projectId", title: "项目详情", group: "项目", icon: FolderTree },
  { key: "projects", pattern: "/projects", title: "项目列表", group: "项目", icon: FolderTree },
  { key: "sort-rules", pattern: "/assets/presets/sort-rules", title: "排序规则", group: "资源", icon: Shuffle },
  { key: "preset-edit", pattern: "/assets/presets/:presetId", title: "预设详情", group: "资源", icon: Wand2 },
  { key: "preset-groups", pattern: "/assets/preset-groups/:groupId", title: "预设组", group: "资源", icon: Boxes },
  { key: "presets", pattern: "/assets/presets", title: "预设库", group: "资源", icon: Tags },
  { key: "models", pattern: "/assets/models", title: "模型文件", group: "资源", icon: Database },
  { key: "loras", pattern: "/assets/loras", title: "LoRA 文件", group: "资源", icon: Sparkles },
  { key: "template-new", pattern: "/assets/templates/new", title: "新建模板", group: "模板", icon: Plus },
  { key: "template-section", pattern: "/assets/templates/:templateId/sections/:sectionIndex", title: "模板小节", group: "模板", icon: ListChecks },
  { key: "template-edit", pattern: "/assets/templates/:templateId/edit", title: "编辑模板", group: "模板", icon: Edit3 },
  { key: "templates", pattern: "/assets/templates", title: "模板列表", group: "模板", icon: FileText },
  { key: "logs", pattern: "/settings/logs", title: "日志", group: "设置", icon: History },
  { key: "monitor", pattern: "/settings/monitor", title: "Worker 监控", group: "设置", icon: Monitor },
  { key: "settings", pattern: "/settings", title: "设置", group: "设置", icon: Settings },
  { key: "login", pattern: "/login", title: "登录", group: "系统", icon: Lock },
];

const NAV_LINKS: Array<{ href: string; label: string; group: string; icon: RouteDef["icon"]; count?: (data: DemoData) => number }> = [
  { href: "/", label: "根路径", group: "核心", icon: Home },
  { href: "/queue", label: "队列", group: "核心", icon: ClipboardList, count: (data) => data.runs.length },
  { href: "/projects", label: "项目", group: "核心", icon: FolderTree, count: (data) => data.projects.length },
  { href: "/assets/models", label: "模型", group: "资源", icon: Database, count: (data) => data.models.length },
  { href: "/assets/loras", label: "LoRA", group: "资源", icon: Sparkles, count: (data) => data.loras.length },
  { href: "/assets/presets", label: "预设库", group: "资源", icon: Tags, count: (data) => data.metrics.presets },
  { href: "/assets/templates", label: "模板", group: "模板", icon: FileText, count: (data) => data.templates.length },
  { href: "/settings", label: "设置", group: "设置", icon: Settings },
  { href: "/login", label: "登录", group: "系统", icon: Lock },
];

function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(" ");
}

function demoHref(route: string) {
  if (route === "/") return "/design-demos";
  return `/design-demos${route}`;
}

function productRouteFromPathname(pathname: string | null, initialSegments: string[]) {
  if (pathname?.startsWith("/design-demos")) {
    const stripped = pathname.slice("/design-demos".length);
    return stripped || "/";
  }
  return initialSegments.length ? `/${initialSegments.join("/")}` : "/";
}

function rawSectionId(section: DemoSection) {
  return section.id.includes(":") ? section.id.split(":").slice(1).join(":") : section.id;
}

function matchPattern(pattern: string, route: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const routeParts = route.split("/").filter(Boolean);
  if (patternParts.length !== routeParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const patternPart = patternParts[i];
    const routePart = routeParts[i];
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(routePart);
    } else if (patternPart !== routePart) {
      return null;
    }
  }
  return params;
}

function matchRoute(route: string): Match {
  const normalized = route === "" ? "/" : route;
  for (const def of ROUTES) {
    const params = matchPattern(def.pattern, normalized);
    if (params) return { key: def.key, params, route: normalized };
  }
  return { key: "not-found", params: {}, route: normalized };
}

function routeTitle(key: RouteKey) {
  return ROUTES.find((route) => route.key === key)?.title ?? "未匹配页面";
}

function firstProject(data: DemoData) {
  return data.projects[0];
}

function firstSection(project: DemoProject | undefined) {
  return project?.sections[0];
}

function firstRun(data: DemoData) {
  return data.runs[0];
}

function firstPreset(data: DemoData) {
  return data.categories.flatMap((category) => category.presets)[0];
}

function firstGroup(data: DemoData) {
  return data.categories.flatMap((category) => category.groups)[0];
}

function firstTemplate(data: DemoData) {
  return data.templates[0];
}

function sampleRouteInventory(data: DemoData) {
  const project = firstProject(data);
  const section = firstSection(project);
  const run = firstRun(data);
  const preset = firstPreset(data);
  const group = firstGroup(data);
  const template = firstTemplate(data);
  const sectionId = section ? rawSectionId(section) : "section-id";

  return ROUTES.map((route) => {
    let sample = route.pattern;
    sample = sample.replace(":runId", run?.id ?? "run-id");
    sample = sample.replace(":projectId", project?.id ?? "project-id");
    sample = sample.replace(":sectionId", sectionId);
    sample = sample.replace(":presetId", preset?.id ?? "preset-id");
    sample = sample.replace(":groupId", group?.id ?? "group-id");
    sample = sample.replace(":templateId", template?.id ?? "template-id");
    sample = sample.replace(":sectionIndex", "0");
    return { ...route, sample };
  });
}

function findProject(data: DemoData, projectId?: string) {
  return data.projects.find((project) => project.id === projectId) ?? firstProject(data);
}

function findSection(project: DemoProject | undefined, sectionId?: string) {
  return project?.sections.find((section) => rawSectionId(section) === sectionId || section.id === sectionId) ?? firstSection(project);
}

function findRun(data: DemoData, runId?: string) {
  return data.runs.find((run) => run.id === runId) ?? firstRun(data);
}

function findPreset(data: DemoData, presetId?: string) {
  return data.categories.flatMap((category) => category.presets).find((preset) => preset.id === presetId) ?? firstPreset(data);
}

function findGroup(data: DemoData, groupId?: string) {
  return data.categories.flatMap((category) => category.groups).find((group) => group.id === groupId) ?? firstGroup(data);
}

function findTemplate(data: DemoData, templateId?: string) {
  return data.templates.find((template) => template.id === templateId) ?? firstTemplate(data);
}

function statusTone(status: string) {
  const value = status.toLowerCase();
  if (["done", "active", "kept", "healthy", "success", "ready"].includes(value)) return s.statusGreen;
  if (["running", "pending", "queued", "draft"].includes(value)) return s.statusAmber;
  if (["failed", "error", "trashed", "offline"].includes(value)) return s.statusRed;
  if (["review", "monitor", "template"].includes(value)) return s.statusSky;
  return "";
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={cx(s.status, statusTone(status))}>{label ?? status}</span>;
}

function ButtonLink({
  href,
  children,
  tone = "default",
  icon: Icon,
}: {
  href: string;
  children: React.ReactNode;
  tone?: "default" | "primary" | "pink" | "danger";
  icon?: RouteDef["icon"];
}) {
  return (
    <Link
      href={demoHref(href)}
      className={cx(
        s.button,
        tone === "primary" && s.buttonPrimary,
        tone === "pink" && s.buttonPink,
        tone === "danger" && s.buttonDanger,
      )}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </Link>
  );
}

function Button({ children, tone = "default", icon: Icon }: { children: React.ReactNode; tone?: "default" | "primary" | "pink" | "danger"; icon?: RouteDef["icon"] }) {
  return (
    <button
      type="button"
      className={cx(
        s.button,
        tone === "primary" && s.buttonPrimary,
        tone === "pink" && s.buttonPink,
        tone === "danger" && s.buttonDanger,
      )}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
}

function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className={s.pageHeader}>
      <div className={s.pageTitleBlock}>
        <span className={s.eyebrow}>{eyebrow}</span>
        <h1 className={s.pageTitle}>{title}</h1>
        <div className={s.pageSubtitle}>{subtitle}</div>
      </div>
      {actions ? <div className={s.toolbar}>{actions}</div> : null}
    </header>
  );
}

function Panel({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={s.panel}>
      <div className={s.panelHeader}>
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className={s.inlineControls}>{actions}</div> : null}
      </div>
      <div className={s.panelBody}>{children}</div>
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, meta, tone }: { icon: RouteDef["icon"]; label: string; value: string | number; meta: string; tone?: string }) {
  return (
    <div className={s.metric}>
      <div className={s.metricLabel}>
        <Icon className={cx("size-4", tone)} />
        {label}
      </div>
      <div className={s.metricValue}>{value}</div>
      <div className={s.metricMeta}>{meta}</div>
    </div>
  );
}

function ImageStrip({ images, wide = false }: { images: DemoImage[]; wide?: boolean }) {
  if (images.length === 0) {
    return <div className={s.empty}>没有可用图片</div>;
  }
  return (
    <div className={s.imageStrip}>
      {images.slice(0, 10).map((image, index) => (
        <div className={cx(s.thumb, wide && s.thumbWide)} key={`${image.id}-${index}`}>
          {image.src ? (
            <Image
              src={image.src}
              alt=""
              fill
              sizes={wide ? "92px" : "54px"}
              className={s.imageFill}
              unoptimized
            />
          ) : (
            <ImageIcon className="size-5" />
          )}
        </div>
      ))}
    </div>
  );
}

function ImageGrid({ images }: { images: DemoImage[] }) {
  if (images.length === 0) return <div className={s.empty}>没有可用图片</div>;
  return (
    <div className={s.imageGrid}>
      {images.map((image, index) => (
        <div className={s.imageTile} key={`${image.id}-${index}`}>
          {image.src ? (
            <Image
              src={image.src}
              alt=""
              fill
              sizes="(max-width: 820px) 45vw, (max-width: 1180px) 22vw, 160px"
              className={s.imageFill}
              unoptimized
            />
          ) : null}
          <div className={s.imageTileBar}>
            <span className={s.imageTileLabel}>{image.label}</span>
            <StatusBadge status={image.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, value, disabled = false }: { label: string; value: string | number; disabled?: boolean }) {
  return (
    <div className={s.field}>
      <label>{label}</label>
      <input className={s.input} value={value} disabled={disabled} readOnly />
    </div>
  );
}

function TextAreaField({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.textAreaField}>
      <label>{label}</label>
      <textarea className={s.textarea} value={value} readOnly />
    </div>
  );
}

function SelectLike({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.field}>
      <label>{label}</label>
      <select className={s.select} value={value} onChange={() => undefined}>
        <option value={value}>{value}</option>
      </select>
    </div>
  );
}

function SwitchRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={s.switchRow}>
      <div className={s.switchText}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <span className={s.switch} />
    </div>
  );
}

function RouteTable({ data }: { data: DemoData }) {
  const rows = sampleRouteInventory(data);
  return (
    <Panel title="完整页面路由" subtitle="每个真实页面都有一个 demo 路由，动态路由使用当前 mock 数据填充。">
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>页面</th>
              <th>真实路由</th>
              <th>Demo 路由</th>
              <th>分组</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pattern}>
                <td>{row.title}</td>
                <td><code>{row.pattern}</code></td>
                <td><code>{demoHref(row.sample)}</code></td>
                <td>{row.group}</td>
                <td>
                  <Link className={s.button} href={demoHref(row.sample)}>
                    打开 <ArrowRight className="size-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ComponentShowcase() {
  const [tab, setTab] = useState("default");
  return (
    <Panel title="基础 UI 组件" subtitle="后续迁移时可直接拆分为 Button、Field、Tabs、Table、ImageGrid 等组件。">
      <div className={s.grid}>
        <div className={s.toolbar}>
          <Button tone="primary" icon={Save}>主按钮</Button>
          <Button icon={Copy}>次按钮</Button>
          <Button tone="pink" icon={Wand2}>强调按钮</Button>
          <Button tone="danger" icon={Trash2}>危险按钮</Button>
          <button type="button" className={cx(s.button, s.iconButton)} aria-label="更多"><MoreHorizontal className="size-4" /></button>
        </div>
        <div className={s.toolbar}>
          <div className={s.segmented}>
            {["default", "compact", "review"].map((item) => (
              <button
                className={cx(s.segment, tab === item && s.segmentActive)}
                key={item}
                type="button"
                onClick={() => setTab(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className={s.tabs}>
            <button className={cx(s.tab, s.tabActive)} type="button">运行参数</button>
            <button className={s.tab} type="button">Prompt</button>
            <button className={s.tab} type="button">LoRA</button>
          </div>
        </div>
        <div className={s.fieldGrid}>
          <Field label="文本输入" value="可编辑字段状态" />
          <SelectLike label="选择器" value="2:3 竖图" />
          <SwitchRow title="自动保存" subtitle="blur 后保存，保留 loading / error 状态位置。" />
          <SwitchRow title="SFW 预览" subtitle="图片格保持固定尺寸，不因状态变化跳动。" />
        </div>
      </div>
    </Panel>
  );
}

function RootPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Design Demos"
        title="ComfyUI Manager 前端空壳"
        subtitle="根路径页面用于总览 mock 数据、页面覆盖率和基础组件形态；所有页面都能从这里进入。"
        actions={<ButtonLink href="/queue" tone="primary" icon={ClipboardList}>进入队列</ButtonLink>}
      />
      <Metrics data={data} />
      <div className={s.twoCol}>
        <RouteTable data={data} />
        <Panel title="Mock 数据源" subtitle="服务端读取 .env 中的 SQLite 与模型路径，只向前端传递展示数据。">
          <div className={s.grid}>
            <div className={s.sourceRow}><span>SQLite</span><strong>{data.source.databaseLabel}</strong></div>
            <div className={s.sourceRow}><span>图片</span><strong>{data.source.imageSourceLabel}</strong></div>
            <div className={s.sourceRow}><span>模型目录</span><strong>{data.source.modelBaseLabel}</strong></div>
            <div className={s.sourceRow}><span>Comfy API</span><strong>{data.source.comfyApiLabel}</strong></div>
            {data.source.warning ? <StatusBadge status="failed" label={data.source.warning} /> : <StatusBadge status="healthy" label="SQLite 已加载" />}
          </div>
        </Panel>
      </div>
      <ComponentShowcase />
    </div>
  );
}

function Metrics({ data }: { data: DemoData }) {
  return (
    <div className={s.metricGrid}>
      <MetricCard icon={FolderTree} label="项目" value={data.metrics.projects} meta={`${data.metrics.sections} 个小节`} />
      <MetricCard icon={Activity} label="运行" value={data.metrics.runs} meta={`${data.metrics.pendingImages} 张待审`} />
      <MetricCard icon={Tags} label="预设" value={data.metrics.presets} meta={`${data.categories.length} 个分类`} />
      <MetricCard icon={Sparkles} label="LoRA" value={data.metrics.loras} meta={`${data.templates.length} 个模板`} />
    </div>
  );
}

function QueuePage({ data }: { data: DemoData }) {
  const running = data.runs.filter((run) => ["queued", "running"].includes(run.status));
  const failed = data.runs.filter((run) => run.status === "failed");
  const reviewable = data.runs.filter((run) => run.images.length > 0);
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Queue"
        title="审核队列"
        subtitle="运行状态、待审组、失败任务和回收站入口共用一个队列工作台布局。"
        actions={<Button tone="primary" icon={Play}>继续处理</Button>}
      />
      <Metrics data={data} />
      <div className={s.twoCol}>
        <Panel title="待审核运行" subtitle="卡片保持为导航入口，点击进入审核宫格。">
          <div className={s.grid}>
            {reviewable.slice(0, 8).map((run) => (
              <article className={s.card} key={run.id}>
                <div className={s.cardHeader}>
                  <div className={s.cardTitle}>
                    <Link href={demoHref(`/queue/${run.id}`)}>{run.projectTitle}</Link>
                    <div className={cx(s.small, s.muted)}>{run.sectionName} / run {run.runIndex}</div>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
                <ImageStrip images={run.images} wide />
                <div className={s.inlineControls}>
                  <span className={s.badge}>{run.pendingCount} 待审</span>
                  <span className={s.badge}>{run.imageCount} 总图</span>
                  <span className={cx(s.small, s.faint)}>{run.createdAt}</span>
                </div>
              </article>
            ))}
          </div>
        </Panel>
        <div className={s.grid}>
          <RunList title="运行中" runs={running} empty="当前没有运行中的任务" />
          <RunList title="最近失败" runs={failed} empty="当前没有失败任务" />
          <Panel title="回收站" subtitle="保留恢复操作的位置。">
            <div className={s.toolbar}>
              <Button icon={Archive}>查看回收站</Button>
              <Button tone="danger" icon={Trash2}>清空已选</Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function RunList({ title, runs, empty }: { title: string; runs: DemoRun[]; empty: string }) {
  return (
    <Panel title={title}>
      {runs.length === 0 ? (
        <div className={s.empty}>{empty}</div>
      ) : (
        <div className={s.grid}>
          {runs.slice(0, 4).map((run) => (
            <div className={s.card} key={run.id}>
              <div className={s.cardHeader}>
                <div className={s.cardTitle}>{run.projectTitle}</div>
                <StatusBadge status={run.status} />
              </div>
              <div className={cx(s.small, s.muted)}>{run.sectionName} / {run.createdAt}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ReviewPage({ run }: { run: DemoRun | undefined }) {
  if (!run) return <EmptyPage title="没有可审核运行" />;
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Review"
        title={`${run.projectTitle} / ${run.sectionName}`}
        subtitle="审核宫格保留单选、多选、精选、废弃和下一组动作的位置。"
        actions={
          <>
            <ButtonLink href="/queue" icon={ChevronRight}>返回队列</ButtonLink>
            <Button tone="primary" icon={Check}>保留已选</Button>
            <Button tone="danger" icon={Trash2}>废弃已选</Button>
          </>
        }
      />
      <Panel title="图片宫格" subtitle={`${run.pendingCount} 张待审 / ${run.imageCount} 张总图`}>
        <ImageGrid images={run.images} />
      </Panel>
      <Panel title="底部操作栏空壳">
        <div className={s.toolbar}>
          <Button icon={Check}>全选</Button>
          <Button icon={X}>取消选择</Button>
          <Button tone="pink" icon={Sparkles}>标为精选</Button>
          <Button tone="primary" icon={ArrowRight}>下一组</Button>
        </div>
      </Panel>
    </div>
  );
}

function ProjectsPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Projects"
        title="项目列表"
        subtitle="列表页是导航 surface：卡片进入项目详情，创建和批量动作放在顶部。"
        actions={<ButtonLink href="/projects/new" tone="primary" icon={Plus}>创建项目</ButtonLink>}
      />
      <div className={s.threeCol}>
        {data.projects.map((project) => (
          <article className={s.card} key={project.id}>
            <ImageStrip images={project.images} />
            <div className={s.cardHeader}>
              <div className={s.cardTitle}>
                <Link href={demoHref(`/projects/${project.id}`)}>{project.title}</Link>
                <div className={cx(s.small, s.muted)}>{project.presetNames.join(" / ") || "无预设绑定"}</div>
              </div>
              <StatusBadge status={project.status} />
            </div>
            <div className={s.inlineControls}>
              <span className={s.badge}>{project.sectionCount} 小节</span>
              <span className={s.badge}>{project.checkpointName}</span>
            </div>
            <div className={cx(s.small, s.faint)}>更新：{project.updatedAt}</div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProjectDetailPage({ project }: { project: DemoProject | undefined }) {
  if (!project) return <EmptyPage title="没有项目数据" />;
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Project"
        title={project.title}
        subtitle={project.notes || "项目详情页保留左侧小节导航、顶部操作区和小节卡片区域。"}
        actions={
          <>
            <ButtonLink href={`/projects/${project.id}/edit`} icon={Edit3}>编辑</ButtonLink>
            <ButtonLink href={`/projects/${project.id}/results`} icon={ImageIcon}>项目结果</ButtonLink>
            <ButtonLink href={`/projects/${project.id}/batch-create`} tone="primary" icon={Rows3}>批量创建</ButtonLink>
          </>
        }
      />
      <div className={s.splitEditor}>
        <SectionRail project={project} />
        <div className={s.grid}>
          {project.sections.map((section) => (
            <article className={s.card} key={section.id}>
              <div className={s.cardHeader}>
                <div className={s.cardTitle}>
                  <Link href={demoHref(`/projects/${project.id}/sections/${rawSectionId(section)}`)}>{section.name}</Link>
                  <div className={cx(s.small, s.muted)}>{section.aspectRatio} / batch {section.batchSize} / {section.promptBlockCount} blocks</div>
                </div>
                <StatusBadge status={section.enabled ? "active" : "draft"} label={section.enabled ? "启用" : "停用"} />
              </div>
              <ImageStrip images={section.images} wide />
              <div className={s.toolbar}>
                <ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(section)}`} icon={SlidersHorizontal}>编辑小节</ButtonLink>
                <ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(section)}/results`} icon={ImageIcon}>结果</ButtonLink>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionRail({ project, activeSection }: { project: DemoProject; activeSection?: DemoSection }) {
  return (
    <aside className={s.sectionRail}>
      {project.sections.map((section) => (
        <Link
          className={cx(s.railItem, (activeSection?.id ?? project.sections[0]?.id) === section.id && s.railItemActive)}
          href={demoHref(`/projects/${project.id}/sections/${rawSectionId(section)}`)}
          key={section.id}
        >
          <strong>{section.name}</strong>
          <span className={cx(s.small, s.muted)}>{section.aspectRatio} / {section.batchSize} 张</span>
        </Link>
      ))}
    </aside>
  );
}

function ProjectFormPage({ project, mode }: { project?: DemoProject; mode: "new" | "edit" }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Project Form"
        title={mode === "new" ? "创建新项目" : `编辑项目：${project?.title ?? "项目"}`}
        subtitle="表单空壳覆盖基础信息、预设绑定、默认参数和小节种子策略。"
        actions={<Button tone="primary" icon={Save}>{mode === "new" ? "创建" : "保存"}</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="基础信息">
          <div className={s.grid}>
            <div className={s.fieldGrid}>
              <Field label="项目名称" value={project?.title ?? "新图像项目"} />
              <Field label="Slug" value={project?.slug ?? "new-project"} />
              <SelectLike label="状态" value={project?.status ?? "draft"} />
              <SelectLike label="Checkpoint" value={project?.checkpointName ?? "继承默认模型"} />
            </div>
            <TextAreaField label="备注" value={project?.notes || "项目级说明、输出目标和人工备注。"} />
          </div>
        </Panel>
        <Panel title="默认运行参数">
          <div className={s.grid}>
            <SwitchRow title="继承模板参数" subtitle="创建小节时自动填充模板默认值。" />
            <div className={s.fieldGrid}>
              <Field label="默认比例" value="2:3" />
              <Field label="短边像素" value={768} />
              <Field label="批量数" value={2} />
              <Field label="放大倍率" value="2x" />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ProjectResultsPage({ project }: { project: DemoProject | undefined }) {
  if (!project) return <EmptyPage title="没有项目结果" />;
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Results"
        title={`${project.title} / 项目结果`}
        subtitle="项目级结果页按小节聚合运行历史，保留精选、二次精选和待审状态。"
        actions={<ButtonLink href={`/projects/${project.id}`} icon={FolderTree}>返回项目</ButtonLink>}
      />
      {project.sections.map((section) => (
        <Panel key={section.id} title={section.name} subtitle={`${section.images.length} 张缩略图`}>
          <ImageGrid images={section.images} />
        </Panel>
      ))}
    </div>
  );
}

function BatchCreatePage({ project }: { project: DemoProject | undefined }) {
  if (!project) return <EmptyPage title="没有项目数据" />;
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Batch"
        title={`${project.title} / 批量创建`}
        subtitle="批量创建页覆盖小节选择、数量、种子策略和提交队列预览。"
        actions={<Button tone="primary" icon={Play}>加入队列</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="批量参数">
          <div className={s.grid}>
            <div className={s.fieldGrid}>
              <SelectLike label="小节范围" value="全部启用小节" />
              <Field label="每小节运行次数" value={3} />
              <SelectLike label="Seed 1" value="random" />
              <SelectLike label="Seed 2" value="reuse previous" />
            </div>
            <SwitchRow title="运行前同步预设变体" subtitle="提交前重新解析 preset binding。" />
          </div>
        </Panel>
        <Panel title="队列预览">
          <div className={s.grid}>
            {project.sections.slice(0, 8).map((section) => (
              <div className={s.switchRow} key={section.id}>
                <div className={s.switchText}>
                  <strong>{section.name}</strong>
                  <span>{section.aspectRatio} / batch {section.batchSize}</span>
                </div>
                <StatusBadge status="queued" label="待提交" />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SectionEditorPage({ project, section }: { project: DemoProject | undefined; section: DemoSection | undefined }) {
  if (!project || !section) return <EmptyPage title="没有小节数据" />;
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Section"
        title={`${project.title} / ${section.name}`}
        subtitle="小节编辑页覆盖参数表单、Prompt Block、LoRA 配置、运行和复制动作。"
        actions={
          <>
            <Button tone="primary" icon={Play}>运行小节</Button>
            <Button icon={Copy}>复制小节</Button>
            <ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(section)}/results`} icon={ImageIcon}>结果</ButtonLink>
          </>
        }
      />
      <div className={s.splitEditor}>
        <SectionRail project={project} activeSection={section} />
        <div className={s.grid}>
          <Panel title="运行参数">
            <div className={s.fieldGrid}>
              <Field label="小节名" value={section.name} />
              <SelectLike label="比例" value={section.aspectRatio} />
              <Field label="短边像素" value={section.shortSidePx} />
              <Field label="批量数" value={section.batchSize} />
              <SelectLike label="Seed 1" value={section.seedPolicy1} />
              <SelectLike label="Seed 2" value={section.seedPolicy2} />
            </div>
          </Panel>
          <Panel title="Prompt Blocks" actions={<Button icon={Plus}>添加 Block</Button>}>
            <div className={s.grid}>
              <TextAreaField label="正向提示词" value={section.positivePrompt} />
              <TextAreaField label="反向提示词" value={section.negativePrompt} />
            </div>
          </Panel>
          <Panel title="LoRA 配置">
            <div className={s.fieldGrid}>
              <SelectLike label="阶段 1 LoRA" value={`${section.loraCount || 2} 个绑定`} />
              <SelectLike label="阶段 2 LoRA" value="继承阶段 1" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SectionResultsPage({ project, section }: { project: DemoProject | undefined; section: DemoSection | undefined }) {
  if (!project || !section) return <EmptyPage title="没有小节结果" />;
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Section Results"
        title={`${section.name} / 结果`}
        subtitle="小节结果页保留按 run 分组、lightbox 入口、精选和审核状态。"
        actions={<ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(section)}`} icon={SlidersHorizontal}>编辑小节</ButtonLink>}
      />
      <Panel title="结果 Gallery" subtitle={`${section.images.length} 张 mock 图片`}>
        <ImageGrid images={section.images} />
      </Panel>
    </div>
  );
}

function AssetTable({ assets, empty }: { assets: DemoAsset[]; empty: string }) {
  if (assets.length === 0) return <div className={s.empty}>{empty}</div>;
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>名称</th>
            <th>类型</th>
            <th>分类</th>
            <th>文件</th>
            <th>大小</th>
            <th>来源</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td>{asset.name}</td>
              <td><StatusBadge status={asset.modelType} label={asset.modelType} /></td>
              <td>{asset.category}</td>
              <td>{asset.fileName}</td>
              <td>{asset.sizeLabel}</td>
              <td>{asset.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelsPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Assets"
        title="模型文件管理"
        subtitle="模型页保留路径浏览、文件表格、移动、备注和刷新动作。"
        actions={<Button icon={Search}>扫描模型目录</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="目录树">
          <div className={s.sectionRail}>
            {["checkpoints", "loras", "vae", "controlnet"].map((item) => (
              <div className={s.railItem} key={item}>
                <strong>{item}</strong>
                <span className={cx(s.small, s.muted)}>{data.source.modelBaseLabel}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="文件列表" subtitle={`${data.models.length} 个 mock 条目`}>
          <AssetTable assets={data.models} empty="SQLite 中暂无模型资产记录" />
        </Panel>
      </div>
    </div>
  );
}

function LorasPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA"
        title="LoRA 管理"
        subtitle="LoRA 页覆盖上传、触发词、备注、分类和文件移动。"
        actions={<Button tone="primary" icon={Upload}>上传 LoRA</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="上传表单">
          <div className={s.grid}>
            <Field label="文件" value="选择 .safetensors 文件" />
            <Field label="触发词" value="trigger words" />
            <SelectLike label="分类" value="character" />
            <TextAreaField label="备注" value="模型来源、建议权重和训练说明。" />
          </div>
        </Panel>
        <Panel title="LoRA 列表">
          <AssetTable assets={data.loras} empty="SQLite 中暂无 LoRA 资产记录" />
        </Panel>
      </div>
    </div>
  );
}

function PresetsPage({ data }: { data: DemoData }) {
  const [categoryId, setCategoryId] = useState(data.categories[0]?.id ?? "");
  const category = data.categories.find((item) => item.id === categoryId) ?? data.categories[0];
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Preset Library"
        title="提示词预设库"
        subtitle="列表页作为导航 surface：分类、文件夹、预设和预设组完整呈现，编辑进入独立页面。"
        actions={<ButtonLink href="/assets/presets/sort-rules" icon={Shuffle}>排序规则</ButtonLink>}
      />
      <div className={s.toolbar}>
        <div className={s.tabs}>
          {data.categories.map((item) => (
            <button
              className={cx(s.tab, item.id === category?.id && s.tabActive)}
              key={item.id}
              type="button"
              onClick={() => setCategoryId(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
      {category ? <PresetCategoryView category={category} /> : <EmptyPage title="没有预设分类" />}
    </div>
  );
}

function PresetCategoryView({ category }: { category: DemoCategory }) {
  return (
    <div className={s.twoCol}>
      <Panel title={`${category.name} / 预设`} subtitle={`${category.presetCount} 个预设`}>
        <div className={s.grid}>
          {category.presets.map((preset) => (
            <article className={s.card} key={preset.id}>
              <div className={s.cardHeader}>
                <div className={s.cardTitle}>
                  <Link href={demoHref(`/assets/presets/${preset.id}`)}>{preset.name}</Link>
                  <div className={cx(s.small, s.muted)}>{preset.slug}</div>
                </div>
                <span className={s.badge}>{preset.variantCount} variants</span>
              </div>
              <div className={cx(s.small, s.muted)}>{preset.notes || preset.variants[0]?.prompt || "无备注"}</div>
            </article>
          ))}
        </div>
      </Panel>
      <Panel title={`${category.name} / 预设组`} subtitle={`${category.groupCount} 个组`}>
        <div className={s.grid}>
          {category.groups.map((group) => (
            <article className={s.card} key={group.id}>
              <div className={s.cardHeader}>
                <div className={s.cardTitle}>
                  <Link href={demoHref(`/assets/preset-groups/${group.id}`)}>{group.name}</Link>
                  <div className={cx(s.small, s.muted)}>{group.slug}</div>
                </div>
                <span className={s.badge}>{group.memberCount} members</span>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function PresetEditPage({ preset }: { preset: DemoPreset | undefined }) {
  if (!preset) return <EmptyPage title="没有预设数据" />;
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Preset"
        title={preset.name}
        subtitle="预设详情页覆盖 metadata、变体管理、prompt 编辑和变更历史。"
        actions={<Button tone="primary" icon={Save}>保存变体</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="基础信息">
          <div className={s.grid}>
            <Field label="名称" value={preset.name} />
            <Field label="Slug" value={preset.slug} />
            <TextAreaField label="备注" value={preset.notes || "预设说明和迁移备注。"} />
          </div>
        </Panel>
        <Panel title="变体列表" actions={<Button icon={Plus}>添加变体</Button>}>
          <div className={s.grid}>
            {preset.variants.map((variant) => (
              <div className={s.card} key={variant.id}>
                <div className={s.cardHeader}>
                  <div className={s.cardTitle}>{variant.name}</div>
                  <span className={s.badge}>{variant.slug}</span>
                </div>
                <TextAreaField label="Prompt" value={variant.prompt} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function PresetGroupPage({ group }: { group: DemoPresetGroup | undefined }) {
  if (!group) return <EmptyPage title="没有预设组数据" />;
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Preset Group"
        title={group.name}
        subtitle="预设组详情页覆盖槽位、成员排序、嵌套组和 flatten 预览。"
        actions={<Button tone="primary" icon={Save}>保存组</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="组信息">
          <div className={s.fieldGrid}>
            <Field label="名称" value={group.name} />
            <Field label="Slug" value={group.slug} />
            <Field label="成员数" value={group.memberCount} />
            <SelectLike label="分类" value={group.categoryId} />
          </div>
        </Panel>
        <Panel title="成员编排" actions={<Button icon={Plus}>添加成员</Button>}>
          <div className={s.grid}>
            {Array.from({ length: Math.max(group.memberCount, 3) }, (_, index) => (
              <div className={s.switchRow} key={index}>
                <div className={s.switchText}>
                  <strong>Slot {index + 1}</strong>
                  <span>{group.members[index] ?? "选择预设或子组"}</span>
                </div>
                <span className={s.badge}>drag</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SortRulesPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Sort Rules"
        title="预设排序规则"
        subtitle="排序规则页覆盖分类顺序、正反向 prompt 顺序和 LoRA 阶段顺序。"
        actions={<Button tone="primary" icon={Save}>保存排序</Button>}
      />
      <Panel title="分类规则">
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>分类</th>
                <th>类型</th>
                <th>正向顺序</th>
                <th>反向顺序</th>
                <th>LoRA 1</th>
                <th>LoRA 2</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((category, index) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{category.type}</td>
                  <td>{index + 1}</td>
                  <td>{data.categories.length - index}</td>
                  <td>{index + 1}</td>
                  <td>{index + 2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function TemplatesPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Templates"
        title="项目模板"
        subtitle="模板列表、复制、导入、编辑入口和 section 摘要。"
        actions={<ButtonLink href="/assets/templates/new" tone="primary" icon={Plus}>新建模板</ButtonLink>}
      />
      <div className={s.threeCol}>
        {data.templates.map((template) => (
          <article className={s.card} key={template.id}>
            <div className={s.cardHeader}>
              <div className={s.cardTitle}>
                <Link href={demoHref(`/assets/templates/${template.id}/edit`)}>{template.name}</Link>
                <div className={cx(s.small, s.muted)}>{template.description || "无描述"}</div>
              </div>
              <span className={s.badge}>{template.sectionCount} sections</span>
            </div>
            <div className={s.grid}>
              {template.sections.slice(0, 4).map((section, index) => (
                <Link className={s.railItem} href={demoHref(`/assets/templates/${template.id}/sections/${index}`)} key={section.id}>
                  <strong>{section.name}</strong>
                  <span className={cx(s.small, s.muted)}>{section.aspectRatio} / batch {section.batchSize}</span>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function TemplateFormPage({ template, mode }: { template?: DemoTemplate; mode: "new" | "edit" }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Template"
        title={mode === "new" ? "新建项目模板" : `编辑模板：${template?.name ?? "模板"}`}
        subtitle="模板编辑沿用项目小节模型：metadata blur 保存，section 独立进入编辑页。"
        actions={<Button tone="primary" icon={Save}>{mode === "new" ? "创建模板" : "保存变更"}</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="模板信息">
          <div className={s.grid}>
            <Field label="名称" value={template?.name ?? "新模板"} />
            <TextAreaField label="描述" value={template?.description || "模板用途、默认预设绑定和生成流程。"} />
          </div>
        </Panel>
        <Panel title="模板小节" actions={<Button icon={Plus}>添加小节</Button>}>
          <div className={s.grid}>
            {(template?.sections ?? []).map((section, index) => (
              <Link className={s.railItem} href={demoHref(`/assets/templates/${template?.id}/sections/${index}`)} key={section.id}>
                <strong>{section.name}</strong>
                <span className={cx(s.small, s.muted)}>{section.aspectRatio} / batch {section.batchSize}</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function TemplateSectionPage({ template, sectionIndex }: { template: DemoTemplate | undefined; sectionIndex: string | undefined }) {
  const index = Number(sectionIndex ?? "0");
  const section = template?.sections[Number.isFinite(index) ? index : 0] ?? template?.sections[0];
  if (!template || !section) return <EmptyPage title="没有模板小节" />;
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Template Section"
        title={`${template.name} / ${section.name}`}
        subtitle="模板小节页保留参数、Prompt Block、复制小节和返回模板动作。"
        actions={
          <>
            <Button icon={Copy}>复制小节</Button>
            <ButtonLink href={`/assets/templates/${template.id}/edit`} icon={FileText}>返回模板</ButtonLink>
          </>
        }
      />
      <div className={s.twoCol}>
        <Panel title="小节参数">
          <div className={s.fieldGrid}>
            <Field label="名称" value={section.name} />
            <SelectLike label="比例" value={section.aspectRatio} />
            <Field label="批量数" value={section.batchSize} />
            <SelectLike label="Seed 策略" value="random / reuse" />
          </div>
        </Panel>
        <Panel title="Prompt 模板">
          <TextAreaField label="备注 / Prompt" value={section.notes || "模板 prompt block 摘要。"} />
        </Panel>
      </div>
    </div>
  );
}

function SettingsPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Settings"
        title="设置"
        subtitle="设置首页提供日志、Worker、ComfyUI、SFW 和路径配置入口。"
      />
      <div className={s.threeCol}>
        {[
          { title: "日志", href: "/settings/logs", icon: History, meta: `${data.auditLogs.length} 条 mock 记录` },
          { title: "Worker 监控", href: "/settings/monitor", icon: Monitor, meta: "队列与心跳状态" },
          { title: "模型路径", href: "/assets/models", icon: Database, meta: data.source.modelBaseLabel },
        ].map((item) => (
          <Link className={s.card} href={demoHref(item.href)} key={item.href}>
            <div className={s.cardHeader}>
              <div className={s.cardTitle}>{item.title}</div>
              <item.icon className="size-4" />
            </div>
            <div className={cx(s.small, s.muted)}>{item.meta}</div>
          </Link>
        ))}
      </div>
      <Panel title="运行设置">
        <div className={s.fieldGrid}>
          <SwitchRow title="ComfyUI 自动启动" subtitle="本地服务不可用时自动拉起。" />
          <SwitchRow title="Worker 自动恢复" subtitle="失败后按窗口期重试。" />
          <SwitchRow title="文件日志" subtitle="写入 LOG_FILE_PATH 指向的日志文件。" />
          <SwitchRow title="SFW 模式" subtitle="控制图片预览显示策略。" />
        </div>
      </Panel>
    </div>
  );
}

function LogsPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Logs"
        title="日志监控"
        subtitle="日志页覆盖过滤、级别、实体、动作和实时刷新状态。"
        actions={<Button icon={Search}>刷新</Button>}
      />
      <Panel title="审计日志">
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>时间</th>
                <th>实体</th>
                <th>动作</th>
                <th>Actor</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {data.auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.createdAt}</td>
                  <td>{log.entityType}</td>
                  <td>{log.action}</td>
                  <td>{log.actorType}</td>
                  <td><StatusBadge status="done" label="记录" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function MonitorPage({ data }: { data: DemoData }) {
  const running = data.runs.filter((run) => ["queued", "running"].includes(run.status)).length;
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Worker"
        title="Worker 监控"
        subtitle="监控页覆盖 Worker、ComfyUI 连接、队列积压和最近失败。"
        actions={<Button tone="primary" icon={Activity}>健康检查</Button>}
      />
      <div className={s.metricGrid}>
        <MetricCard icon={Gauge} label="Worker" value="ready" meta="心跳正常" />
        <MetricCard icon={Monitor} label="ComfyUI" value={data.source.comfyApiLabel} meta="API endpoint" />
        <MetricCard icon={ClipboardList} label="运行中" value={running} meta="queued / running" />
        <MetricCard icon={ImageIcon} label="待审图片" value={data.metrics.pendingImages} meta="pending images" />
      </div>
      <Panel title="状态流">
        <pre className={s.codeBlock}>{JSON.stringify({
          worker: "ready",
          comfyApi: data.source.comfyApiLabel,
          database: data.source.databaseLabel,
          pendingImages: data.metrics.pendingImages,
        }, null, 2)}</pre>
      </Panel>
    </div>
  );
}

function LoginPage() {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Auth"
        title="登录"
        subtitle="登录页空壳保留 token 输入、错误提示、loading 和返回来源。"
      />
      <Panel title="访问令牌">
        <div className={s.grid}>
          <Field label="Token" value="从 .env AUTH_TOKEN 验证" />
          <div className={s.toolbar}>
            <Button tone="primary" icon={Lock}>登录</Button>
            <Button icon={X}>清除</Button>
          </div>
          <div className={s.empty}>错误、加载和成功状态区域</div>
        </div>
      </Panel>
    </div>
  );
}

function EmptyPage({ title }: { title: string }) {
  return (
    <div className={s.page}>
      <PageHeader eyebrow="Empty" title={title} subtitle="当前 mock 数据不足，页面结构仍保留。" />
      <div className={s.empty}>{title}</div>
    </div>
  );
}

function NotFoundPage({ route }: { route: string }) {
  return (
    <div className={s.page}>
      <PageHeader eyebrow="404" title="未匹配的 demo 路由" subtitle={route} actions={<ButtonLink href="/" icon={Home}>返回总览</ButtonLink>} />
      <RouteTable data={fallbackRouteData} />
    </div>
  );
}

const fallbackRouteData: DemoData = {
  source: {
    loadedFromSqlite: false,
    databaseLabel: "",
    imageSourceLabel: "",
    modelBaseLabel: "",
    comfyApiLabel: "",
    warning: null,
  },
  metrics: { projects: 0, sections: 0, runs: 0, pendingImages: 0, presets: 0, templates: 0, loras: 0 },
  projects: [],
  runs: [],
  categories: [],
  templates: [],
  loras: [],
  models: [],
  auditLogs: [],
  images: [],
};

function CurrentPage({ match, data }: { match: Match; data: DemoData }) {
  const project = findProject(data, match.params.projectId);
  const section = findSection(project, match.params.sectionId);
  const template = findTemplate(data, match.params.templateId);

  switch (match.key) {
    case "root":
      return <RootPage data={data} />;
    case "queue":
      return <QueuePage data={data} />;
    case "queue-review":
      return <ReviewPage run={findRun(data, match.params.runId)} />;
    case "projects":
      return <ProjectsPage data={data} />;
    case "project-new":
      return <ProjectFormPage mode="new" />;
    case "project-detail":
      return <ProjectDetailPage project={project} />;
    case "project-edit":
      return <ProjectFormPage mode="edit" project={project} />;
    case "project-results":
      return <ProjectResultsPage project={project} />;
    case "project-batch":
      return <BatchCreatePage project={project} />;
    case "section-editor":
      return <SectionEditorPage project={project} section={section} />;
    case "section-results":
      return <SectionResultsPage project={project} section={section} />;
    case "models":
      return <ModelsPage data={data} />;
    case "loras":
      return <LorasPage data={data} />;
    case "presets":
      return <PresetsPage data={data} />;
    case "preset-edit":
      return <PresetEditPage preset={findPreset(data, match.params.presetId)} />;
    case "preset-groups":
      return <PresetGroupPage group={findGroup(data, match.params.groupId)} />;
    case "sort-rules":
      return <SortRulesPage data={data} />;
    case "templates":
      return <TemplatesPage data={data} />;
    case "template-new":
      return <TemplateFormPage mode="new" />;
    case "template-edit":
      return <TemplateFormPage mode="edit" template={template} />;
    case "template-section":
      return <TemplateSectionPage template={template} sectionIndex={match.params.sectionIndex} />;
    case "settings":
      return <SettingsPage data={data} />;
    case "logs":
      return <LogsPage data={data} />;
    case "monitor":
      return <MonitorPage data={data} />;
    case "login":
      return <LoginPage />;
    default:
      return <NotFoundPage route={match.route} />;
  }
}

function Sidebar({
  data,
  currentRoute,
  open,
  onClose,
}: {
  data: DemoData;
  currentRoute: string;
  open: boolean;
  onClose: () => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof NAV_LINKS>();
    for (const link of NAV_LINKS) {
      if (!map.has(link.group)) map.set(link.group, []);
      map.get(link.group)!.push(link);
    }
    return [...map.entries()];
  }, []);

  return (
    <aside className={cx(s.sidebar, open && s.sidebarOpen)}>
      <div className={s.brand}>
        <div className={s.brandTop}>
          <div className={s.toolbar}>
            <span className={s.brandMark}><Layers3 className="size-4" /></span>
            <div className={s.brandName}>
              <strong>ComfyUI Manager</strong>
              <span>Design shell</span>
            </div>
          </div>
          <button className={cx(s.button, s.iconButton, s.mobileMenuButton)} type="button" onClick={onClose} aria-label="关闭菜单">
            <X className="size-4" />
          </button>
        </div>
        <div className={s.sourceCard}>
          <div className={s.sourceRow}><span>DB</span><strong>{data.source.databaseLabel}</strong></div>
          <div className={s.sourceRow}><span>图片</span><strong>{data.images.length} mock</strong></div>
          <div className={s.sourceRow}><span>状态</span><strong>{data.source.loadedFromSqlite ? "SQLite" : "Fallback"}</strong></div>
        </div>
      </div>
      {grouped.map(([group, links]) => (
        <nav className={s.navSection} key={group}>
          <div className={s.navTitle}>{group}</div>
          {links.map((link) => {
            const Icon = link.icon;
            const active = link.href === "/" ? currentRoute === "/" : currentRoute === link.href || currentRoute.startsWith(`${link.href}/`);
            return (
              <Link
                className={cx(s.navLink, active && s.navLinkActive)}
                href={demoHref(link.href)}
                key={link.href}
                onClick={onClose}
              >
                <Icon className="size-4" />
                <span>{link.label}</span>
                {link.count ? <em className={s.navCount}>{link.count(data)}</em> : null}
              </Link>
            );
          })}
        </nav>
      ))}
    </aside>
  );
}

export function DesignDemoApp({
  initialRouteSegments,
  data,
}: {
  initialRouteSegments: string[];
  data: DemoData;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentRoute = productRouteFromPathname(pathname, initialRouteSegments);
  const match = matchRoute(currentRoute);
  const title = routeTitle(match.key);

  return (
    <div className={s.shell}>
      <div className={s.workspace}>
        <Sidebar data={data} currentRoute={currentRoute} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className={s.main}>
          <div className={s.topbar}>
            <div className={s.crumbs}>
              <button className={cx(s.button, s.iconButton, s.mobileMenuButton)} type="button" onClick={() => setMenuOpen(true)} aria-label="打开菜单">
                <Menu className="size-4" />
              </button>
              <strong>{title}</strong>
              <ChevronRight className="size-3.5" />
              <span className={s.routeBadge}>{currentRoute}</span>
              <span className={s.routeBadge}>{demoHref(currentRoute)}</span>
            </div>
            <div className={s.topActions}>
              <Button icon={Moon}>主题</Button>
              <Button icon={Search}>搜索</Button>
              <Button tone="primary" icon={Wand2}>Mock</Button>
            </div>
          </div>
          <CurrentPage match={match} data={data} />
        </main>
      </div>
    </div>
  );
}
