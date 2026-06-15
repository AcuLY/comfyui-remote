import { Home } from "lucide-react";

import { ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import s from "./not-found-page.module.css";

const TRAINING_ENTRY_ROUTES = [
  { label: "运行", href: "/training/runs" },
  { label: "项目", href: "/training/projects" },
  { label: "预制", href: "/training/presets" },
  { label: "模板", href: "/training/templates" },
];

export function TrainingNotFoundPage({ route }: { route: string }) {
  return (
    <div className={s.page}>
      <PageHeader eyebrow="404" title="未匹配训练页面" subtitle={route} actions={<ButtonLink href="/training/runs" icon={Home}>返回运行</ButtonLink>} />
      <section className={s.panel} aria-label="训练模块入口">
        {TRAINING_ENTRY_ROUTES.map((entry) => (
          <ButtonLink href={entry.href} key={entry.href} tone="subtle">
            {entry.label}
          </ButtonLink>
        ))}
      </section>
    </div>
  );
}
