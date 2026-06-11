"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { Edit3, Layers3, Plus, Trash2 } from "lucide-react";

import type { DemoData } from "../../data";
import { demoHref } from "../../routing";
import s from "./template-list.module.css";
import { Button } from "../../shared/primitives/button";
import { ButtonLink } from "../../shared/primitives/button";
import { PageHeader } from "../../shared/primitives/page-header";
import { StatusBadge } from "../../shared/primitives/status-badge";

const SCROLL_KEY = "demo-templates-from";

function readAndClear() {
  try {
    const v = sessionStorage.getItem(SCROLL_KEY);
    if (v) {
      sessionStorage.removeItem(SCROLL_KEY);
      return v;
    }
  } catch {}
  return undefined;
}

export function TemplatesPage({ data }: { data: DemoData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fromId] = useState(readAndClear);

  useLayoutEffect(() => {
    if (!fromId) return;
    const el = ref.current?.querySelector(`[data-template-id="${fromId}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "instant" });
    } else {
      const t = setTimeout(() => {
        ref.current?.querySelector(`[data-template-id="${fromId}"]`)?.scrollIntoView({ block: "center", behavior: "instant" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [fromId]);

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="模板"
        title="项目模板"
        subtitle="管理可复用的小节结构、默认参数和预设导入配置。"
        actions={<ButtonLink href="/templates/new" tone="primary" icon={Plus}>新建模板</ButtonLink>}
      />
      <div className={s.rowList} ref={ref}>
        {data.templates.map((template) => (
          <article className={s.templateListItem} key={template.id} data-template-id={template.id}>
            <div className={s.templateListMain}>
              <div className={s.templateListTitle}>
                <Link href={demoHref(`/templates/${template.id}/edit`)}>
                  <Layers3 className={s.icon} />
                  <strong>{template.name}</strong>
                </Link>
                <span>{template.description || "未填写描述"}</span>
              </div>
              <div className={s.templateSectionSummary}>
                {template.sections.slice(0, 5).map((section, index) => (
                  <Link href={demoHref(`/templates/${template.id}/sections/${index}`)} key={section.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {section.name}
                  </Link>
                ))}
                {template.sections.length > 5 ? <em>+{template.sections.length - 5}</em> : null}
              </div>
            </div>
            <div className={s.templateListMeta}>
              <StatusBadge status="sections" label={`${template.sectionCount} 小节`} />
              <StatusBadge status="updated" label={`更新 ${template.updatedAt}`} />
              <div className={s.toolbar}>
                <ButtonLink href={`/templates/${template.id}/edit`} icon={Edit3}>编辑</ButtonLink>
                <Button tone="danger" icon={Trash2}>删除</Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
