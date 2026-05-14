"use client";

import type { DemoData } from "../../design-demo-data";
import { ButtonLink, PageHeader } from "../../shared/primitives";
import { AnchorRail } from "../../shared/patterns";
import { getShowcaseComponents, getShowcaseFamily, SHOWCASE_FAMILIES } from "../registry";
import type { ShowcaseComponentEntry, ShowcaseComponentStatus, ShowcaseFamilyId } from "../registry";
import { ShowcaseItem } from "../showcase-item";
import { FamilySamples } from "./family-samples";
import s from "./showcase-pages.module.css";

const statusLabels: Record<ShowcaseComponentStatus, string> = {
  implemented: "真实复用",
  adapter: "业务适配",
  planned: "待抽",
  specialty: "专项",
};

const statusClasses: Record<ShowcaseComponentStatus, string> = {
  implemented: s.statusImplemented,
  adapter: s.statusAdapter,
  planned: s.statusPlanned,
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

  const components = getShowcaseComponents(family.id);
  const navItems = SHOWCASE_FAMILIES.map((item) => ({
    id: `family-${item.id}`,
    label: item.title,
    meta: item.id,
    active: item.id === family.id,
  }));

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
              <ComponentCard component={component} key={`${component.familyId}-${component.componentName}-${component.reviewName}`} />
            ))}
          </section>
        </main>
        <aside className={s.familyAside}>
          <section className={s.familyIntro}>
            <strong>功能族导航</strong>
            <AnchorRail items={navItems} />
          </section>
          <section className={s.familyIntro}>
            <strong>状态说明</strong>
            <span>真实复用：已经有可复用组件。</span>
            <span>业务适配：feature 组件保留业务数据映射。</span>
            <span>待抽：现有页面内模式，后续应抽出。</span>
            <span>专项：不参与普通功能族混排。</span>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ComponentCard({ component }: { component: ShowcaseComponentEntry }) {
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
