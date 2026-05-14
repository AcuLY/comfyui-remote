"use client";

import { ArrowRight } from "lucide-react";

import type { DemoData } from "../../../data";
import { demoHref, sampleRouteInventory } from "../../../routing";
import s from "./route-table.module.css";
import { ButtonLink } from "../button";
import { Panel } from "../panel";

export function RouteTable({ data }: { data: DemoData }) {
  const rows = sampleRouteInventory(data);
  return (
    <Panel title="完整页面路径" subtitle="工作区路径。">
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>页面</th>
              <th>真实路由</th>
              <th>路径</th>
              <th>分组</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pattern}>
                <td>{row.title}</td>
                <td><code>{row.pattern}</code></td>
                <td><code>{demoHref(row.sample)}</code></td>
                <td>{row.group}</td>
                <td>
                  <ButtonLink href={row.sample} icon={ArrowRight}>进入</ButtonLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
