"use client";

import Link from "next/link";
import { Download, ExternalLink, Gauge, ImageIcon, PanelTop, Play, Rows3, Save, ShieldCheck } from "lucide-react";

import type { DemoData } from "../../design-demo-data";
import { cx, demoHref } from "../../design-demo-utils";
import { buildHeaderSpecs, displayHeaderRoute, headerAction as action } from "../../route-header-specs";
import type { HeaderSpec } from "../../route-header-specs";
import { RouteHeaderSurface } from "../../route-header-surface";
import { PageHeader } from "../../shared/primitives";
import s from "./headers-page.module.css";

function HeaderSurface({
  mode,
  spec,
}: {
  mode: "expanded" | "collapsed" | "mobile";
  spec: HeaderSpec;
}) {
  const isCollapsed = mode === "collapsed";
  const isMobile = mode === "mobile";
  const titleId = `${spec.key}-${mode}-title`;

  return (
    <div className={s.previewFrame}>
      <div className={s.previewChrome}>
        <span>{mode === "expanded" ? "桌面展开" : mode === "collapsed" ? "桌面折叠" : "移动端"}</span>
        <em>{mode === "collapsed" ? "向下滚动" : mode === "expanded" ? "向上滚动" : "合并顶栏"}</em>
      </div>
      <div className={cx(s.previewStage, isCollapsed && s.previewStageCollapsed, isMobile && s.previewStageMobile)}>
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
          <span>{spec.group}</span>
          <h2>{spec.title}</h2>
        </div>
        <Link className={s.routeLink} href={demoHref(spec.route)}>
          {displayHeaderRoute(spec.route)}
        </Link>
      </div>
      <div className={s.stateGrid}>
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
        subtitle={`${total} 个页面 header 设计稿，覆盖桌面展开、桌面折叠和移动端合并状态。`}
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
          <strong>滚动折叠</strong>
          <span>向下滚动保留返回、标题、状态和高频操作；向上滚动恢复完整上下文。</span>
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
