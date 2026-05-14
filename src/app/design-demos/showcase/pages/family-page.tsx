"use client";

import Link from "next/link";

import type { DemoData } from "../../design-demo-data";
import { demoHref } from "../../design-demo-utils";
import { ButtonLink, PageHeader } from "../../shared/primitives";
import { getShowcaseComponents, getShowcaseFamily, SHOWCASE_FAMILIES } from "../registry";
import type { ShowcaseComponentEntry, ShowcaseComponentStatus, ShowcaseFamilyId } from "../registry";
import { ShowcaseItem } from "../showcase-item";
import { ComponentPreview } from "./component-previews";
import { FamilySamples } from "./family-samples";
import { ComponentShowcaseHeadersPage } from "./headers-page";
import { ComponentShowcaseIconsPage } from "./icons-page";
import s from "./showcase-pages.module.css";

const statusLabels: Record<ShowcaseComponentStatus, string> = {
  implemented: "真实复用",
  adapter: "业务适配",
  specialty: "专项",
};

const statusClasses: Record<ShowcaseComponentStatus, string> = {
  implemented: s.statusImplemented,
  adapter: s.statusAdapter,
  specialty: s.statusSpecialty,
};

export function ComponentShowcaseFamilyPage({ data, familyId }: { data: DemoData; familyId: ShowcaseFamilyId }) {
  const family = getShowcaseFamily(familyId);
  if (!family) {
    return (
      <div className={s.page}>
        <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="未知功能族" subtitle={familyId} />
      </div>
    );
  }

  if (family.id === "headers") {
    return <ComponentShowcaseHeadersPage data={data} />;
  }

  if (family.id === "icons") {
    return <ComponentShowcaseIconsPage />;
  }

  const components = getShowcaseComponents(family.id);

  return (
    <div className={s.page} id={`family-${family.id}`}>
      <PageHeader
        back={{ href: "/component-showcase", label: "返回总览" }}
        eyebrow="组件功能族"
        title={family.title}
        subtitle={family.summary}
        actions={<ButtonLink href="/component-showcase" tone="subtle">总览</ButtonLink>}
      />
      <div className={s.familyLayout}>
        <main className={s.familyMain}>
          <section className={s.familyIntro}>
            <strong>审查目标</strong>
            <p>{family.intent}</p>
          </section>
          <ShowcaseItem name="代表样例" desc="这里展示真实复用组件或迁移后的槽位壳组件。">
            <FamilySamples data={data} familyId={family.id} />
          </ShowcaseItem>
          <section className={s.componentList} aria-label={`${family.title} 组件清单`}>
            {components.map((component) => (
              <ComponentCard component={component} data={data} key={`${component.familyId}-${component.componentName}-${component.reviewName}`} />
            ))}
          </section>
        </main>
        <aside className={s.familyAside}>
          <section className={s.familyIntro}>
            <strong>功能族导航</strong>
            <ShowcaseFamilyNav currentFamilyId={family.id} />
          </section>
          <section className={s.familyIntro}>
            <strong>状态说明</strong>
            <span>真实复用：已经有可复用组件。</span>
            <span>业务适配：feature 组件保留业务数据映射。</span>
            <span>专项：不参与普通功能族混排。</span>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ShowcaseFamilyNav({ currentFamilyId }: { currentFamilyId: ShowcaseFamilyId }) {
  return (
    <nav className={s.familyRouteNav} aria-label="功能族路由导航">
      {SHOWCASE_FAMILIES.map((item) => (
        <Link aria-current={item.id === currentFamilyId ? "page" : undefined} href={demoHref(item.route)} key={item.id}>
          <strong>{item.title}</strong>
          <span>{item.id}</span>
        </Link>
      ))}
    </nav>
  );
}

function ComponentCard({ component, data }: { component: ShowcaseComponentEntry; data: DemoData }) {
  return (
    <article className={s.componentCard}>
      <div className={s.componentHead}>
        <div>
          <strong>{component.reviewName}</strong>
          <code>{component.componentName}</code>
        </div>
        <span className={`${s.status} ${statusClasses[component.status]}`}>{statusLabels[component.status]}</span>
      </div>
      <p>{component.description}</p>
      <div className={s.componentPreview}>
        <ComponentPreview component={component} data={data} />
      </div>
      <div className={s.metaGrid}>
        <MetaBlock label="归属路径" values={component.paths} />
        <MetaBlock label="覆盖页面 / 语境" values={component.usedBy} />
      </div>
      {component.exclusion ? <div className={s.exclusion}>边界说明：{component.exclusion}</div> : null}
    </article>
  );
}

function MetaBlock({ label, values }: { label: string; values: string[] }) {
  return (
    <div className={s.metaBlock}>
      <span>{label}</span>
      <div className={s.tagList}>
        {values.map((value) => <code key={value}>{value}</code>)}
      </div>
    </div>
  );
}
