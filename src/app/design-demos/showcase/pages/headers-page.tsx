"use client";

import Link from "next/link";
import { Download, ExternalLink, Gauge, ImageIcon, PanelTop, Play, Rows3, Save, ShieldCheck } from "lucide-react";

import type { DemoData } from "../../data";
import { cx } from "../../routing";
import { demoHref } from "../../routing";
import { buildHeaderSpecs, displayHeaderRoute, headerAction as action } from "../../routing/header-specs";
import type { HeaderSpec } from "../../routing/header-specs";
import { RouteHeaderSurface } from "../../shell/header-surface";
import { PageHeader } from "../../shared/primitives";
import s from "./headers-page.module.css";

type HeaderMode = "expanded" | "mobile";

const modeLabels: Record<HeaderMode, { label: string; state: string; summary: string }> = {
  expanded: { label: "桌面展开", state: "完整上下文", summary: "标题、状态、摘要、元数据和命令栏完整展示" },
  mobile: { label: "移动端", state: "合并顶栏", summary: "标题截断、返回和主操作固定为触控尺寸" },
};

function summarizeActions(spec: HeaderSpec) {
  return spec.actions?.map((item) => item.label).join(" / ") || "无操作";
}

function summarizeStructure(spec: HeaderSpec) {
  const back = spec.back ? `返回：${spec.back.label}` : "无返回";
  const status = spec.status ? `状态：${spec.status}` : "无状态";
  const meta = spec.meta?.length ? `元数据：${spec.meta.join(" / ")}` : "无元数据";
  return { back, status, meta };
}

function AuditReadout({ spec }: { spec: HeaderSpec }) {
  const structure = summarizeStructure(spec);

  return (
    <dl className={s.auditReadout} aria-label={`${spec.title} header 审核摘要`}>
      <div>
        <dt>Group</dt>
        <dd>{spec.group}</dd>
      </div>
      <div>
        <dt>Route</dt>
        <dd>{displayHeaderRoute(spec.route)}</dd>
      </div>
      <div>
        <dt>Back</dt>
        <dd>{structure.back}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{structure.status}</dd>
      </div>
      <div>
        <dt>Actions</dt>
        <dd>{summarizeActions(spec)}</dd>
      </div>
      <div>
        <dt>Meta</dt>
        <dd>{structure.meta}</dd>
      </div>
    </dl>
  );
}

function HeaderSurface({
  mode,
  spec,
}: {
  mode: HeaderMode;
  spec: HeaderSpec;
}) {
  const isMobile = mode === "mobile";
  const titleId = `${spec.key}-${mode}-title`;
  const modeLabel = modeLabels[mode];

  return (
    <div className={s.previewFrame}>
      <div className={s.previewChrome}>
        <span>{modeLabel.label}</span>
        <em>{modeLabel.state}</em>
      </div>
      <div className={s.stateLabel} aria-label={`${modeLabel.label} 状态说明`}>
        <strong>{modeLabel.state}</strong>
        <span>{modeLabel.summary}</span>
      </div>
      <div className={cx(s.previewStage, isMobile && s.previewStageMobile)}>
        <RouteHeaderSurface headingLevel={3} mode={mode} spec={spec} titleId={titleId} />
        <div className={s.previewContent} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function PageHeaderCard({ spec }: { spec: HeaderSpec }) {
  return (
    <article className={s.headerCard}>
      <div className={s.cardIntro}>
        <div>
          <span>
            {spec.group} / {displayHeaderRoute(spec.route)}
          </span>
          <h2>{spec.title}</h2>
        </div>
        <Link className={s.routeLink} href={demoHref(spec.route)}>
          {displayHeaderRoute(spec.route)}
        </Link>
      </div>
      <AuditReadout spec={spec} />
      <div className={s.stateGrid}>
        <HeaderSurface mode="expanded" spec={spec} />
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
      actions: [
        action("批量创建", Rows3, "primary"),
        action("整组运行", Play, "primary"),
        action("导入模板", Download),
        action("图片整合", ImageIcon),
        action("保存模板", Save),
      ],
      meta: ["12 小节", "小节视图", "batch 2"],
      status: "项目详情",
    },
  ];

  return (
    <section className={s.principles}>
      {specs.map((spec) => (
        <HeaderSurface key={spec.key} mode="expanded" spec={spec} />
      ))}
    </section>
  );
}

export function ComponentShowcaseHeadersPage({ data }: { data: DemoData }) {
  const groups = buildHeaderSpecs(data);
  const total = groups.reduce((sum, group) => sum + group.specs.length, 0);

  return (
    <div className={s.showcasePage}>
      <PageHeader
        back={{ href: "/component-showcase", label: "返回总览" }}
        eyebrow="组件展示"
        title="Headers 固定顶栏专项"
        subtitle={`${total} 个页面 header 设计稿，覆盖桌面展开和移动端合并状态；滚动时整条 header 隐藏或恢复。`}
      />
      <HeaderPrinciples />
      <div className={s.pageMap}>
        {groups.map((group) => (
          <section className={s.groupSection} key={group.label}>
            <div className={s.groupTitle}>
              <span>{group.label}</span>
              <em>{group.specs.length} 页</em>
            </div>
            <div className={s.cardGrid}>
              {group.specs.map((spec) => (
                <PageHeaderCard key={spec.key} spec={spec} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className={s.reviewNotes} aria-label="Header 规则">
        <div>
          <PanelTop aria-hidden="true" className={s.noteIcon} />
          <strong>固定顶部</strong>
          <span>桌面端与移动端共用一套页面身份和操作归属；内容区保留顶部安全距离。</span>
        </div>
        <div>
          <Gauge aria-hidden="true" className={s.noteIcon} />
          <strong>滚动隐藏</strong>
          <span>向下滚动整条 header 上移隐藏；向上滚动恢复完整上下文。</span>
        </div>
        <div>
          <ShieldCheck aria-hidden="true" className={s.noteIcon} />
          <strong>移动合并</strong>
          <span>移动端返回和页面操作进入当前顶栏，低频操作进更多菜单。</span>
        </div>
      </section>
    </div>
  );
}
