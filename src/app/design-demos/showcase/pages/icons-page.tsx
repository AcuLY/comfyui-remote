"use client";

import { useMemo, useState } from "react";
import { FolderInput, History, Home, ImageIcon, Play, Search, Star, Trash2 } from "lucide-react";

import { CustomIconDemo } from "../../icon-showcase/custom-icon-demo";
import { ALL_ICONS } from "../../icon-showcase/icon-data";
import { GroupedIconList } from "../../icon-showcase/icon-list";
import { PageHeader } from "../../shared/primitives";
import iconS from "../../icon-showcase-page.showcase.module.css";
import s from "./showcase-pages.module.css";

const ICON_MEANINGS = [
  { icon: Home, name: "Home", meaning: "任务工作台、返回主入口；不用于普通文件夹根目录。" },
  { icon: FolderInput, name: "FolderInput", meaning: "移动到文件夹、导入目录；不表示普通打开。" },
  { icon: History, name: "History", meaning: "历史记录、差异和审计流；不用于刷新。" },
  { icon: Star, name: "Star", meaning: "精选、收藏或结果标记，必须配合文案区分含义。" },
  { icon: ImageIcon, name: "ImageIcon", meaning: "图片结果、审核对象和生成输出入口。" },
  { icon: Play, name: "Play", meaning: "运行、启动或执行生成任务；危险动作不用它。" },
  { icon: Search, name: "Search", meaning: "搜索、探测、刷新式查询，需要结合按钮文字确认范围。" },
  { icon: Trash2, name: "Trash2", meaning: "删除、移到回收站或清理记录，默认危险语义。" },
];

export function IconMeaningTable() {
  return (
    <section className={s.iconMeaningTable} aria-label="图标语义说明">
      {ICON_MEANINGS.map(({ icon: Icon, name, meaning }) => (
        <div key={name}>
          <Icon size={18} />
          <strong>{name}</strong>
          <span>{meaning}</span>
        </div>
      ))}
    </section>
  );
}

export function ComponentShowcaseIconsPage() {
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

      if (!isMatch) continue;

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
    <div className={iconS.showcasePage}>
      <PageHeader
        back={{ href: "/component-showcase", label: "返回总览" }}
        eyebrow="组件展示"
        title="Icons 图标专项"
        subtitle={`项目使用的全部 ${ALL_ICONS.length} 个 Lucide 图标、自定义 SVG 图标和中文语义说明。`}
      />

      <IconMeaningTable />

      <div className={iconS.iconFilterBar}>
        <input
          type="text"
          placeholder="搜索图标名 / 说明 / 分类 / 使用位置..."
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className={iconS.iconFilterInput}
        />
        {filter ? (
          <button type="button" className={iconS.iconFilterClear} onClick={() => setFilter("")}>
            x
          </button>
        ) : null}
      </div>

      <GroupedIconList groups={groups} metaHeader="使用位置" />

      {groups.length === 0 ? (
        <div className={iconS.iconShowcaseEmpty}>没有匹配的图标</div>
      ) : null}

      <CustomIconDemo />
    </div>
  );
}
