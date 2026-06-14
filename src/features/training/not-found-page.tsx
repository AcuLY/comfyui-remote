import { Home } from "lucide-react";

import { fallbackRouteData } from "@/app/design-demos/data/fallback-route-data";
import { ButtonLink } from "@/app/design-demos/shared/primitives/button";
import { PageHeader } from "@/app/design-demos/shared/primitives/page-header";
import { RouteTable } from "@/app/design-demos/shared/primitives/route-table";
import s from "@/app/design-demos/features/settings/not-found-page.shell.module.css";

export function TrainingNotFoundPage({ route }: { route: string }) {
  return (
    <div className={s.page}>
      <PageHeader eyebrow="404" title="未匹配页面" subtitle={route} actions={<ButtonLink href="/runs" icon={Home}>返回任务</ButtonLink>} />
      <RouteTable data={fallbackRouteData} />
    </div>
  );
}
