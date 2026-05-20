"use client";

import { useState } from "react";
import { GripVertical, Plus, Save, Search, Trash2 } from "lucide-react";

import { categoryTypeLabel, presetFolderBreadcrumb, type DemoData, type DemoPresetGroup } from "../../data";
import s from "./group-page.library.module.css";
import { Button } from "../../shared/primitives/button";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { Field } from "../../shared/primitives/field";
import { PageHeader } from "../../shared/primitives/page-header";
import { FloatingSelect } from "../../shared/primitives/floating-select";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { firstCategory } from "../../routing";
import { SortableList, useDemoSortable } from "../../shared/primitives/sortable";

export function PresetGroupPage({ data, group }: { data: DemoData; group: DemoPresetGroup | undefined }) {
  const [memberOrder, setMemberOrder] = useState<string[]>([]);
  const [deleted, setDeleted] = useState(false);
  const [removedMemberIds, setRemovedMemberIds] = useState<Set<string>>(new Set());
  const [addedMembers, setAddedMembers] = useState<Array<{ id: string; name: string; categoryName: string; variant: string }>>([]);

  if (deleted) return <EmptyPage title="预设组已删除" />;
  if (!group) return <EmptyPage title="没有预设组数据" />;
  const category = data.categories.find((item) => item.id === group.categoryId) ?? firstCategory(data);
  const folderPath = category ? presetFolderBreadcrumb(category, group.folderId).map((folder) => folder.name).join(" / ") || "根目录" : "根目录";
  const fallbackMembers = data.categories.flatMap((item) => item.presets).slice(0, Math.max(3, group.memberCount));
  const baseMembers = Array.from({ length: Math.max(group.memberCount, 3) }, (_, index) => ({
    id: `${group.id}-${index}`,
    name: group.members[index] ?? fallbackMembers[index % Math.max(fallbackMembers.length, 1)]?.name ?? "选择预设",
    categoryName: data.categories.find((item) => item.presets.some((preset) => preset.name === group.members[index]))?.name ?? "预设",
    variant: fallbackMembers[index % Math.max(fallbackMembers.length, 1)]?.variants[0]?.name ?? "默认",
  }));
  const members = [...baseMembers, ...addedMembers].filter((m) => !removedMemberIds.has(m.id));
  const orderedMembers = memberOrder.length
    ? memberOrder.map((id) => members.find((m) => m.id === id)).filter((m): m is typeof members[number] => Boolean(m))
    : members;

  function addMember() {
    const nextIndex = baseMembers.length + addedMembers.length;
    const fallbackPreset = fallbackMembers[nextIndex % Math.max(fallbackMembers.length, 1)];
    setAddedMembers((prev) => [
      ...prev,
      {
        id: `${group!.id}-added-${Date.now()}`,
        name: fallbackPreset?.name ?? "新成员预设",
        categoryName: data.categories[nextIndex % Math.max(data.categories.length, 1)]?.name ?? "预设",
        variant: fallbackPreset?.variants[0]?.name ?? "默认",
      },
    ]);
  }

  function handleRemoveMember(memberId: string) {
    setRemovedMemberIds((prev) => new Set([...prev, memberId]));
    setMemberOrder((prev) => prev.filter((id) => id !== memberId));
  }

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
          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>组信息</strong>
                <span>预设组保留分类、文件夹和删除返回路径，名称可直接编辑。</span>
              </div>
              <Button tone="danger" icon={Trash2} onClick={() => setDeleted(true)} feedback={{ tone: "warning", title: "删除预设组需要确认", detail: group.name }}>删除组</Button>
            </div>
            <div className={s.formGrid}>
              <Field label="名称" value={group.name} />
              <FloatingSelect label="分类" value={category?.name ?? group.categoryId} />
              <FloatingSelect label="文件夹" value={folderPath} />
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>成员列表</strong>
                <span>行内展示成员来源、变体和排序手柄，避免在列表里再展开编辑卡片。</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button icon={Plus} onClick={addMember} feedback={{ title: "新成员已添加" }}>添加成员</Button>
                <Button icon={Search} feedback={{ title: "预设选择面板已准备" }}>选择预设</Button>
              </div>
            </div>
            <div className={s.groupMemberList}>
              <SortableList items={orderedMembers.map((m) => m.id)} onReorder={setMemberOrder}>
                {orderedMembers.map((member, index) => (
                  <PresetMemberRow index={index} key={member.id} member={member} onRemove={handleRemoveMember} />
                ))}
              </SortableList>
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
  onRemove,
}: {
  index: number;
  member: PresetMemberRowData;
  onRemove?: (memberId: string) => void;
}) {
  const { ref, style, handleProps } = useDemoSortable(member.id);

  return (
    <div ref={ref} style={style} className={s.groupMemberRow}>
      <GripVertical className={s.icon} {...handleProps} />
      <span>{String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>{member.name}</strong>
        <em>{member.categoryName} · {member.variant}</em>
      </div>
      <FloatingSelect label="变体" value={member.variant} />
      <Button tone="danger" icon={Trash2} iconOnly size="sm" ariaLabel="移除成员" onClick={() => onRemove?.(member.id)} />
    </div>
  );
}
