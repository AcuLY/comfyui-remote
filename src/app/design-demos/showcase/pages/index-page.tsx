"use client";

import Link from "next/link";

import type { DemoData } from "../../design-demo-data";
import { demoHref } from "../../design-demo-utils";
import { PageHeader } from "../../shared/primitives";
import { SHOWCASE_COMPONENTS, SHOWCASE_FAMILIES } from "../registry";
import s from "./showcase-pages.module.css";

export function ComponentShowcaseIndex({ data: data }: { data: DemoData }) {
  void data;

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="组件展示"
        title="组件功能族总览"
        subtitle="按功能族审核真实复用组件、业务适配组件和待抽模式。每个条目都有中文审查名、英文组件名和迁移状态。"
      />
      <div className={s.indexGrid}>
        {SHOWCASE_FAMILIES.map((family) => {
          const count = SHOWCASE_COMPONENTS.filter((component) => component.familyId === family.id).length;
          return (
            <Link className={s.familyCard} href={demoHref(family.route)} key={family.id}>
              <span>{family.id}</span>
              <strong>{family.title}</strong>
              <p>{family.summary}</p>
              <em>{count} 个审查项</em>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
