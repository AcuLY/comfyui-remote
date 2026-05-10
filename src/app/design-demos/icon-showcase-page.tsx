"use client";

import { useMemo, useState } from "react";

import { CustomIconDemo } from "./icon-showcase/custom-icon-demo";
import { ALL_ICONS } from "./icon-showcase/icon-data";
import { GroupedIconList } from "./icon-showcase/icon-list";
import { PageHeader } from "./ui/page-header";
import s from "./styles/showcase.module.css";

export function IconShowcasePage() {
  const [filter, setFilter] = useState("");

  const groups = useMemo(() => {
    const query = filter.toLowerCase();
    const groupMap = new Map<string, typeof ALL_ICONS>();

    for (const item of ALL_ICONS) {
      const isMatch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.desc.includes(query) ||
        item.category.includes(query) ||
        item.usedIn.some((usage) => usage.toLowerCase().includes(query));

      if (!isMatch) {
        continue;
      }

      const list = groupMap.get(item.category) ?? [];
      list.push(item);
      groupMap.set(item.category, list);
    }

    return Array.from(groupMap.entries()).map(([title, entries]) => ({
      title,
      entries: entries.map(({ icon, name, desc, usedIn }) => ({
        icon,
        name,
        desc,
        meta: usedIn,
      })),
    }));
  }, [filter]);

  return (
    <div className={s.showcasePage}>
      <PageHeader
        back={{ href: "/component-showcase", label: "返回总览" }}
        eyebrow="组件展示"
        title="Icons"
        subtitle={`项目使用的全部 ${ALL_ICONS.length} 个 Lucide 图标`}
      />

      <div className={s.iconFilterBar}>
        <input
          type="text"
          placeholder="搜索图标名 / 说明 / 分类 / 使用位置…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className={s.iconFilterInput}
        />
        {filter ? (
          <button type="button" className={s.iconFilterClear} onClick={() => setFilter("")}>
            ✕
          </button>
        ) : null}
      </div>

      <GroupedIconList groups={groups} metaHeader="使用位置" />

      {groups.length === 0 ? (
        <div className={s.iconShowcaseEmpty}>没有匹配的图标</div>
      ) : null}

      <CustomIconDemo />
    </div>
  );
}
