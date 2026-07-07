"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useRouteHref } from "@/components/design-demo-routing";
import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import type { LoraTrainingProject } from "@/features/training/types";

import s from "./training-project-pages.module.css";

const PROJECT_TABS = [
  { key: "overview", label: "总览", path: "" },
  { key: "profile", label: "资料", path: "/profile" },
  { key: "sections", label: "小节", path: "/sections" },
  { key: "results", label: "结果池", path: "/results" },
  { key: "dataset", label: "数据集", path: "/dataset" },
  { key: "generation", label: "生成任务", path: "/generation-tasks" },
  { key: "training", label: "训练任务", path: "/training-runs" },
] as const;

type ProjectTabKey = (typeof PROJECT_TABS)[number]["key"];

function ProjectNav({ active, project }: { active: ProjectTabKey; project: LoraTrainingProject }) {
  const hrefForRoute = useRouteHref();

  return (
    <nav className={s.projectNav} aria-label="训练项目页面">
      {PROJECT_TABS.map((item) => (
        <Link
          aria-current={item.key === active ? "page" : undefined}
          className={cx(s.projectNavItem, item.key === active && s.projectNavItemActive)}
          href={hrefForRoute(`/training/projects/${project.id}${item.path}`)}
          key={item.key}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function ProjectHeader({
  active,
  actions,
  project,
  subtitle,
  title,
}: {
  active: ProjectTabKey;
  actions?: ReactNode;
  project: LoraTrainingProject;
  subtitle?: string;
  title?: string;
}) {
  return (
    <>
      <PageHeader
        back={{ href: "/training/projects", label: "返回训练项目" }}
        eyebrow="LoRA 训练项目"
        title={title ?? project.title}
        subtitle={subtitle ?? project.profileSummary}
        actions={actions}
      />
      <ProjectNav active={active} project={project} />
    </>
  );
}
