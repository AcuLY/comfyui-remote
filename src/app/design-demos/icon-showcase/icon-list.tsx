import type { LucideIcon } from "lucide-react";

import type { SvgIconComponent } from "../svg-icon";
import s from "../styles/showcase.module.css";

type IconComponent = LucideIcon | SvgIconComponent;

export interface IconListEntry {
  icon: IconComponent;
  name: string;
  desc: string;
  meta: string[];
}

export interface IconListGroup {
  title: string;
  entries: IconListEntry[];
}

function IconListHeader({ metaHeader }: { metaHeader: string }) {
  return (
    <div className={`${s.iconListRow} ${s.iconListHeader}`}>
      <span className={s.iconListColIcon}>图标</span>
      <span className={s.iconListColName}>名称</span>
      <span className={s.iconListColDesc}>说明</span>
      <span className={s.iconListColUsage}>{metaHeader}</span>
    </div>
  );
}

function IconListRow({ entry }: { entry: IconListEntry }) {
  const Icon = entry.icon;

  return (
    <div className={s.iconListRow}>
      <span className={s.iconListColIcon}>
        <Icon size={18} />
      </span>
      <span className={s.iconListColName}>{entry.name}</span>
      <span className={s.iconListColDesc}>{entry.desc}</span>
      <span className={s.iconListColUsage}>
        {entry.meta.map((item) => (
          <span key={item} className={s.iconListTag}>
            {item}
          </span>
        ))}
      </span>
    </div>
  );
}

export function IconList({ entries, metaHeader }: { entries: IconListEntry[]; metaHeader: string }) {
  return (
    <div className={s.iconListContainer}>
      <IconListHeader metaHeader={metaHeader} />
      {entries.map((entry) => (
        <IconListRow key={entry.name} entry={entry} />
      ))}
    </div>
  );
}

export function GroupedIconList({ groups, metaHeader }: { groups: IconListGroup[]; metaHeader: string }) {
  return (
    <div className={s.iconListContainer}>
      <IconListHeader metaHeader={metaHeader} />
      {groups.map((group) => (
        <div key={group.title}>
          <div className={s.iconListCategory}>{group.title}</div>
          {group.entries.map((entry) => (
            <IconListRow key={entry.name} entry={entry} />
          ))}
        </div>
      ))}
    </div>
  );
}
