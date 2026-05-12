import { Home } from "lucide-react";

import s from "./not-found-page.shell.module.css";
import { ButtonLink } from "../ui/button";
import { PageHeader } from "../ui/page-header";
import { RouteTable } from "../ui/route-table";
import { fallbackRouteData } from "./fallback-route-data";

export function NotFoundPage({ route }: { route: string }) {
  return (
    <div className={s.page}>
      <PageHeader eyebrow="404" title="未匹配页面" subtitle={route} actions={<ButtonLink href="/runs" icon={Home}>返回任务</ButtonLink>} />
      <RouteTable data={fallbackRouteData} />
    </div>
  );
}
