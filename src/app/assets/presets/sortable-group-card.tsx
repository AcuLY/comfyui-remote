"use client";

import { useId, useMemo, useState } from "react";
import type * as React from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckSquare, ChevronRight, GripVertical, Square, X } from "lucide-react";
import type {
  FolderItem,
  PresetCategoryFull,
  PresetGroupItem,
  PresetVariantItem,
} from "@/lib/server-data";
import {
  addGroupMember,
  deletePresetGroup,
  removeGroupMember,
  reorderGroupMembers,
  updatePresetGroup,
} from "@/lib/actions";
import { toast } from "sonner";
import { GROUP_HISTORY_TABS } from "./preset-types";
import { PresetChangeHistoryPanel } from "./change-history-panel";
import { MoveToFolderButton } from "./folder-components";
import { AddGroupMemberForm } from "./add-group-member-form";
import { GroupInlineEditor } from "./group-inline-editor";

// ---------------------------------------------------------------------------
// SortableGroupCard
// ---------------------------------------------------------------------------

export function SortableGroupCard({
  group,
  categories,
  groups,
  folders,
  isEditing,
  onEdit,
  onRefresh,
  onGroupDeleted,
  onMoveToFolder,
  isPending,
  startTransition,
  isSelected,
  onToggleSelect,
  onNavigateToPreset,
}: {
  group: PresetGroupItem;
  categories: PresetCategoryFull[];
  groups: PresetGroupItem[];
  folders: FolderItem[];
  isEditing: boolean;
  onEdit: () => void;
  onRefresh: () => void;
  onGroupDeleted: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  isSelected: boolean;
  onToggleSelect: () => void;
  onNavigateToPreset: (presetId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition: dndTransition, isDragging } = useSortable({ id: group.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: dndTransition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [localMembers, setLocalMembers] = useState<{
    sourceMembers: PresetGroupItem["members"];
    members: PresetGroupItem["members"];
  } | null>(null);
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Set<string>>(new Set());
  const memberDndId = useId();
  const members = localMembers?.sourceMembers === group.members ? localMembers.members : group.members;

  // Build variant lookup from all categories
  const variantMap = useMemo(() => {
    const map = new Map<string, PresetVariantItem>();
    for (const cat of categories) {
      for (const preset of cat.presets) {
        for (const v of preset.variants) {
          map.set(v.id, v);
        }
      }
    }
    return map;
  }, [categories]);

  const presetVariantsMap = useMemo(() => {
    const map = new Map<string, PresetVariantItem[]>();
    for (const cat of categories) {
      for (const preset of cat.presets) {
        if (preset.variants.length > 0) map.set(preset.id, preset.variants);
      }
    }
    return map;
  }, [categories]);

  // Resolve a member's variant data
  function getMemberVariant(member: GroupMemberDisplay): PresetVariantItem | null {
    if (member.subGroupId) return null;
    if (member.variantId) return variantMap.get(member.variantId) ?? null;
    const variants = member.presetId ? presetVariantsMap.get(member.presetId) : null;
    return variants?.[0] ?? null;
  }

  function togglePreview(id: string) {
    setExpandedPreviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const memberSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleMemberDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = members.findIndex((m) => m.id === active.id);
    const newIndex = members.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(members, oldIndex, newIndex);
    setLocalMembers({ sourceMembers: group.members, members: reordered });
    startTransition(async () => {
      await reorderGroupMembers(group.id, reordered.map((m) => m.id));
    });
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-white/5 bg-white/[0.02]">
      <Link
        href={`/assets/preset-groups/${group.id}`}
        className="flex items-center gap-2 px-3 py-2.5 transition hover:bg-white/[0.03]"
      >
        <button
          type="button"
          className="shrink-0 text-zinc-600 hover:text-sky-400"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(); }}
        >
          {isSelected ? <CheckSquare className="size-3.5 text-sky-400" /> : <Square className="size-3.5" />}
        </button>
        <button
          type="button"
          className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400"
          onClick={(e) => e.preventDefault()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-200">{group.name}</div>
          <div className="text-[10px] text-zinc-500">
            {members.length} 个成员 · {group.slug}
          </div>
        </div>
        <span onClick={(e) => e.preventDefault()}>
          <MoveToFolderButton
            currentFolderId={group.folderId}
            folders={folders}
            onMove={onMoveToFolder}
          />
        </span>
      </Link>

      {isEditing && (
        <div className="border-t border-white/5 px-3 py-3 space-y-3">
          <GroupInlineEditor
            group={group}
            onSave={(data) => {
              startTransition(async () => {
                try {
                  await updatePresetGroup(group.id, data);
                  toast.success("预制组已保存");
                  onRefresh();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "保存失败");
                }
              });
            }}
            onDelete={() => {
              if (!confirm(`确认删除预制组「${group.name}」？`)) return;
              startTransition(async () => {
                try {
                  await deletePresetGroup(group.id);
                  toast.success("预制组已删除");
                  onGroupDeleted();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "删除失败");
                }
              });
            }}
            isPending={isPending}
          />

          <div className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">成员</span>
            {members.length === 0 && (
              <div className="text-[10px] text-zinc-600 py-1">暂无成员</div>
            )}
            <DndContext
              id={memberDndId}
              sensors={memberSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleMemberDragEnd}
            >
              <SortableContext
                items={members.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                {members.map((m) => {
                  const variant = m.subGroupId ? null : getMemberVariant(m);
                  const isExpanded = expandedPreviewIds.has(m.id);
                  return (
                    <SortableGroupMemberItem
                      key={m.id}
                      member={m}
                      variant={variant}
                      isExpanded={isExpanded}
                      onToggle={() => togglePreview(m.id)}
                      isPending={isPending}
                      onRemove={() => {
                        startTransition(async () => {
                          try {
                            await removeGroupMember(m.id);
                            toast.success("成员已移除");
                            onRefresh();
                          } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : "移除成员失败");
                          }
                        });
                      }}
                      onNavigate={() => {
                        if (m.presetId) onNavigateToPreset(m.presetId);
                      }}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>

          <AddGroupMemberForm
            groupId={group.id}
            categories={categories}
            groups={groups.filter((g) => g.id !== group.id)}
            onAdd={(input) => {
              startTransition(async () => {
                try {
                  await addGroupMember(input);
                  toast.success("成员已添加");
                  onRefresh();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "添加成员失败");
                }
              });
            }}
            isPending={isPending}
          />

          <PresetChangeHistoryPanel
            history={group.changeHistory}
            tabs={GROUP_HISTORY_TABS}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableGroupMemberItem
// ---------------------------------------------------------------------------

type GroupMemberDisplay = PresetGroupItem["members"][number];

function SortableGroupMemberItem({
  member,
  variant,
  isExpanded,
  onToggle,
  isPending,
  onRemove,
  onNavigate,
}: {
  member: GroupMemberDisplay;
  variant: PresetVariantItem | null;
  isExpanded: boolean;
  onToggle: () => void;
  isPending: boolean;
  onRemove: () => void;
  onNavigate?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: member.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const loras = variant
    ? [...(variant.lora1 as Array<{ path: string; weight: number; enabled: boolean }> ?? []), ...(variant.lora2 as Array<{ path: string; weight: number; enabled: boolean }> ?? [])].filter((l) => l.enabled)
    : [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-white/5 bg-white/[0.02] ${isExpanded ? "border-white/10" : ""}`}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
        >
          <ChevronRight className={`size-3 shrink-0 text-zinc-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          <div className="min-w-0 text-xs">
            {member.subGroupId ? (
              <span className="text-amber-400/80">
                {member.subGroupName ?? member.subGroupId}
              </span>
            ) : (
              <>
                <span className="text-zinc-300">{member.presetName ?? "?"}</span>
                {member.variantName && (
                  <span className="text-zinc-500"> / {member.variantName}</span>
                )}
              </>
            )}
          </div>
          {loras.length > 0 && !member.subGroupId && (
            <span className="shrink-0 text-[10px] text-zinc-600">{loras.length} LoRA</span>
          )}
          {onNavigate && !member.subGroupId && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNavigate(); }}
              className="shrink-0 rounded p-0.5 text-zinc-600 hover:text-sky-400"
              title="跳转到预制编辑"
            >
              <ChevronRight className="size-3" />
            </button>
          )}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="rounded p-0.5 text-zinc-600 hover:text-red-400 disabled:opacity-50"
        >
          <X className="size-3" />
        </button>
      </div>
      {isExpanded && variant && (
        <div className="border-t border-white/5 px-2.5 py-2 space-y-2 text-[11px]">
          {variant.prompt && (
            <div>
              <div className="mb-1 text-[10px] font-medium text-zinc-500">正面提示词</div>
              <pre className="whitespace-pre-wrap break-words text-zinc-400">{variant.prompt}</pre>
            </div>
          )}
          {variant.negativePrompt && (
            <div>
              <div className="mb-1 text-[10px] font-medium text-zinc-500">负面提示词</div>
              <pre className="whitespace-pre-wrap break-words text-zinc-400">{variant.negativePrompt}</pre>
            </div>
          )}
          {loras.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] font-medium text-zinc-500">LoRA</div>
              <div className="space-y-0.5 text-zinc-500">
                {loras.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="truncate">{l.path.split(/[/\\]/).pop()}</span>
                    <span className="shrink-0 text-zinc-600">{l.weight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
