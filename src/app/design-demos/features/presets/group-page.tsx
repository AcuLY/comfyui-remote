"use client";

import { GripVertical, Plus, Save, Search, Trash2 } from "lucide-react";

import { categoryTypeLabel, presetFolderBreadcrumb, type DemoData, type DemoPresetGroup } from "../../data";
import s from "./group-page.library.module.css";
import { Button } from "../../shared/primitives/button";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { Field } from "../../shared/primitives/field";
import { PageHeader } from "../../shared/primitives/page-header";
import { SelectLike } from "../../shared/primitives/select-like";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { firstCategory } from "../../routing";

export function PresetGroupPage({ data, group }: { data: DemoData; group: DemoPresetGroup | undefined }) {
  if (!group) return <EmptyPage title="没有预设组数据" />;
  const category = data.categories.find((item) => item.id === group.categoryId) ?? firstCategory(data);
  const folderPath = category ? presetFolderBreadcrumb(category, group.folderId).map((folder) => folder.name).join(" / ") || "根目录" : "根目录";
  const fallbackMembers = data.categories.flatMap((item) => item.presets).slice(0, Math.max(3, group.memberCount));
  const members = Array.from({ length: Math.max(group.memberCount, 3) }, (_, index) => ({
    id: `${group.id}-${index}`,
    name: group.members[index] ?? fallbackMembers[index % Math.max(fallbackMembers.length, 1)]?.name ?? "选择预设",
    categoryName: data.categories.find((item) => item.presets.some((preset) => preset.name === group.members[index]))?.name ?? "预设",
    variant: fallbackMembers[index % Math.max(fallbackMembers.length, 1)]?.variants[0]?.name ?? "默认",
  }));

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/presets?category=${group.categoryId}&folder=${group.folderId ?? ""}&group=${group.id}`, label: "返回预设库" }}
        eyebrow="预设组"
        title={group.name}
        subtitle={`${category?.name ?? "未分类"} · ${folderPath} · ${group.memberCount} 个成员`}
        actions={<Button tone="primary" icon={Save} feedback={{ title: "预设组保存已排队", detail: group.name }}>保存</Button>}
      />
      <div className={s.presetGroupShell}>
        <main className={s.editorSurface}>
          <div className={s.editorStickyHeader}>
            <div className={s.editorIdentity}>
              <span>{group.slug}</span>
              <strong>成员编排</strong>
              <em>拖拽排序、添加预设或子组、保存后返回当前分类和文件夹。</em>
            </div>
            <div className={s.toolbar}>
              <StatusBadge status="ready" label="已保存" />
              <Button icon={Plus} feedback={{ title: "成员选择面板已准备" }}>添加成员</Button>
            </div>
          </div>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>组信息</strong>
                <span>预设组保留分类、文件夹和删除返回路径，名称与 slug 可直接编辑。</span>
              </div>
              <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "删除预设组需要确认", detail: group.name }}>删除组</Button>
            </div>
            <div className={s.formGrid}>
              <Field label="名称" value={group.name} />
              <Field label="Slug" value={group.slug} />
              <SelectLike label="分类" value={category?.name ?? group.categoryId} />
              <SelectLike label="文件夹" value={folderPath} />
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>成员列表</strong>
                <span>行内展示成员来源、变体和排序手柄，避免在列表里再展开编辑卡片。</span>
              </div>
              <Button icon={Search} feedback={{ title: "预设选择面板已准备" }}>选择预设</Button>
            </div>
            <div className={s.groupMemberList}>
              {members.map((member, index) => (
                <PresetMemberRow index={index} key={member.id} member={member} />
              ))}
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>Flatten 预览</strong>
                <span>嵌套组展开后按分类顺序输出可执行预设序列。</span>
              </div>
              <StatusBadge status="ready" label={`${members.length} 步`} />
            </div>
            <div className={s.groupPreviewList}>
              {members.map((member, index) => (
                <div className={s.groupPreviewRow} key={`${member.id}-preview`}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{member.name}</strong>
                    <em>Prompt block + LoRA 绑定 · {member.categoryName}</em>
                  </div>
                  <StatusBadge status={index % 2 === 0 ? "ready" : "monitor"} label={index % 2 === 0 ? "直接成员" : "继承"} />
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className={s.editorAside}>
          <strong>成员来源</strong>
          <div className={s.presetCascadeState}>
            <div>
              <strong>分类</strong>
              <span>{category?.name ?? "未分类"} · {categoryTypeLabel(category)}</span>
            </div>
            <StatusBadge status="ready" label="可编辑" />
          </div>
          <div className={s.presetCascadeState}>
            <div>
              <strong>删除保护</strong>
              <span>成员清空后才允许删除预设组。</span>
            </div>
            <StatusBadge status="pending" label="受保护" />
          </div>
          <div className={s.historyDiffList}>
            <div className={s.historyDiffRow}>
              <strong>成员排序</strong>
              <span>Slot 2 移动到 Slot 1，flatten 输出顺序同步。</span>
            </div>
            <div className={s.historyDiffRow}>
              <strong>成员变更</strong>
              <span>新增 {members[0]?.name ?? "成员"} 的默认变体。</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export type PresetMemberRowData = {
  id: string;
  name: string;
  categoryName: string;
  variant: string;
};

export function PresetMemberRow({
  index,
  member,
}: {
  index: number;
  member: PresetMemberRowData;
}) {
  return (
    <div className={s.groupMemberRow}>
      <GripVertical className={s.icon} />
      <span>{String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>{member.name}</strong>
        <em>{member.categoryName} · {member.variant}</em>
      </div>
      <SelectLike label="变体" value={member.variant} />
      <Button tone="danger" icon={Trash2} iconOnly size="sm" ariaLabel="移除成员" />
    </div>
  );
}
