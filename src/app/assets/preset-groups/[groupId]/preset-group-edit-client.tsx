"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
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
import { ArrowLeft, GripVertical, Repeat2, Save, Trash2, X } from "lucide-react";
import { NeighborNavigation } from "@/components/neighbor-navigation";
import { PresetCascadePicker } from "@/components/preset-cascade-picker";
import type { PresetCategoryFull, PresetGroupItem, PresetVariantItem } from "@/lib/server-data";
import { buildPresetGroupMemberLayout } from "@/lib/preset-group-slot-layout";
import {
  addGroupMember,
  deletePresetGroup,
  removeGroupMember,
  updateCategorySlotTemplate,
  updateGroupMember,
  updatePresetGroup,
} from "@/lib/actions";
import { AddGroupMemberForm } from "../../presets/add-group-member-form";
import { PresetChangeHistoryPanel } from "../../presets/change-history-panel";
import { GROUP_HISTORY_TABS } from "../../presets/preset-types";
import { parseLoraBindings } from "@/lib/lora-types";
import { toast } from "sonner";

function groupListUrl(categoryId: string, groupId?: string | null, folderId?: string | null) {
  const params = new URLSearchParams({ category: categoryId });

  if (groupId) {
    params.set("preset", groupId);
  }

  if (folderId) {
    params.set("folder", folderId);
  }

  return `/assets/presets?${params.toString()}`;
}

type GroupMemberDisplay = PresetGroupItem["members"][number];
type GroupMemberLayoutRow = ReturnType<typeof buildPresetGroupMemberLayout<GroupMemberDisplay>>[number];
type GroupMemberSlotRow = Extract<GroupMemberLayoutRow, { kind: "slot" }>;

type GroupMemberMutationResult = {
  id: string;
  presetId: string | null;
  variantId: string | null;
  subGroupId: string | null;
  slotCategoryId: string | null;
  sortOrder: number;
};

function sortGroupMembers(members: GroupMemberDisplay[]) {
  return [...members].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function toGroupMemberDisplay(
  member: GroupMemberMutationResult,
  categories: PresetCategoryFull[],
  groups: PresetGroupItem[],
): GroupMemberDisplay {
  let presetName: string | undefined;
  let variantName: string | undefined;

  if (member.presetId) {
    for (const category of categories) {
      const preset = category.presets.find((item) => item.id === member.presetId);
      if (!preset) continue;
      presetName = preset.name;
      variantName = member.variantId
        ? preset.variants.find((variant) => variant.id === member.variantId)?.name
        : undefined;
      break;
    }
  }

  const subGroupName = member.subGroupId
    ? groups.find((item) => item.id === member.subGroupId)?.name
    : undefined;

  return {
    id: member.id,
    presetId: member.presetId,
    variantId: member.variantId,
    subGroupId: member.subGroupId,
    slotCategoryId: member.slotCategoryId,
    sortOrder: member.sortOrder,
    presetName,
    variantName,
    subGroupName,
  };
}

function SortableSlotShell({
  id,
  dashed,
  disabled,
  children,
}: {
  id: string;
  dashed: boolean;
  disabled: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
        dashed
          ? "border-dashed border-white/10 bg-white/[0.015]"
          : "border-white/5 bg-white/[0.02] transition hover:border-white/10 hover:bg-white/[0.04]"
      }`}
    >
      <button
        type="button"
        aria-label="拖拽调整槽位顺序"
        title="拖拽调整槽位顺序"
        disabled={disabled}
        className="shrink-0 cursor-grab touch-none rounded p-1 text-zinc-600 transition hover:bg-white/5 hover:text-zinc-300 disabled:cursor-default disabled:opacity-30"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      {children}
    </div>
  );
}

export function PresetGroupEditClient({
  categories,
  categoryId,
  group,
  groups,
  previousGroup,
  nextGroup,
  groupPosition,
  totalGroups,
}: {
  categories: PresetCategoryFull[];
  categoryId: string;
  group: PresetGroupItem;
  groups: PresetGroupItem[];
  previousGroup: PresetGroupItem | null;
  nextGroup: PresetGroupItem | null;
  groupPosition: number;
  totalGroups: number;
}) {
  const router = useRouter();
  const initialCategory = categories.find((category) => category.id === group.categoryId) ??
    categories.find((category) => category.id === categoryId);
  const [isPending, startTransition] = useTransition();
  const [currentGroup, setCurrentGroup] = useState(group);
  const [name, setName] = useState(group.name);
  const [openReplaceMemberId, setOpenReplaceMemberId] = useState<string | null>(null);
  const [slotTemplate, setSlotTemplate] = useState(initialCategory?.slotTemplate ?? []);
  const slotDndId = useId();
  const slotSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const backHref = groupListUrl(categoryId, currentGroup.id, currentGroup.folderId);
  const selectableGroups = groups.filter((item) => item.id !== currentGroup.id);
  const previousGroupHref = previousGroup?.id ? `/assets/preset-groups/${previousGroup.id}` : null;
  const nextGroupHref = nextGroup?.id ? `/assets/preset-groups/${nextGroup.id}` : null;
  const groupPositionText = groupPosition >= 0 ? `${groupPosition + 1} / ${totalGroups}` : null;
  const currentCategory = categories.find((category) => category.id === currentGroup.categoryId) ??
    categories.find((category) => category.id === categoryId);

  useEffect(() => {
    const nextCategory = categories.find((category) => category.id === group.categoryId) ??
      categories.find((category) => category.id === categoryId);
    queueMicrotask(() => {
      setCurrentGroup(group);
      setName(group.name);
      setOpenReplaceMemberId(null);
      setSlotTemplate(nextCategory?.slotTemplate ?? []);
    });
  }, [categories, categoryId, group]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName;
        if (target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
          return;
        }
      }

      const href = event.key.toLowerCase() === "s"
        ? previousGroupHref
        : event.key.toLowerCase() === "f"
          ? nextGroupHref
          : null;

      if (!href) {
        return;
      }

      event.preventDefault();
      window.location.assign(href);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextGroupHref, previousGroupHref]);

  // Build variant lookup for preview card
  const variantLookup = useMemo(() => {
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

  const presetCategoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      for (const preset of cat.presets) {
        map.set(preset.id, cat.id);
      }
    }
    return map;
  }, [categories]);

  const categoryLookup = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);

  const memberRows = useMemo(() =>
    buildPresetGroupMemberLayout({
      slots: slotTemplate,
      members: currentGroup.members,
      getMemberCategoryId: (member) => member.presetId ? presetCategoryLookup.get(member.presetId) : null,
    }),
  [currentGroup.members, presetCategoryLookup, slotTemplate]);
  const slotRows = memberRows.filter((row): row is GroupMemberSlotRow => row.kind === "slot");

  // Group non-sub-group members by their preset's category sortOrder
  const previewGroups = useMemo(() => {
    const presetToCategory = new Map<string, PresetCategoryFull>();
    for (const cat of categories) {
      for (const preset of cat.presets) {
        presetToCategory.set(preset.id, cat);
      }
    }

    // Collect members with their category info
    const memberEntries = currentGroup.members
      .filter((m) => m.variantId && !m.subGroupId)
      .map((m) => {
        const variant = variantLookup.get(m.variantId!);
        const cat = m.presetId ? presetToCategory.get(m.presetId) : undefined;
        return { member: m, variant, category: cat };
      })
      .filter((e) => e.variant);

    // Group by category id, preserving category sortOrder
    const catMap = new Map<string, { category: PresetCategoryFull; entries: typeof memberEntries }>();
    for (const entry of memberEntries) {
      const catId = entry.category?.id ?? "__unknown__";
      if (!catMap.has(catId)) {
        catMap.set(catId, { category: entry.category!, entries: [] });
      }
      catMap.get(catId)!.entries.push(entry);
    }

    // Sort groups by category sortOrder
    return [...catMap.values()].sort((a, b) => (a.category?.sortOrder ?? 0) - (b.category?.sortOrder ?? 0));
  }, [currentGroup.members, variantLookup, categories]);

  function saveGroup() {
    startTransition(async () => {
      try {
        await updatePresetGroup(currentGroup.id, {
          name: name.trim(),
        });
        setCurrentGroup((current) => ({ ...current, name: name.trim() }));
        toast.success("预制组已保存");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "保存失败");
      }
    });
  }

  function removeGroup() {
    if (!confirm(`确认删除预制组「${currentGroup.name}」？`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deletePresetGroup(currentGroup.id);
        toast.success("预制组已删除");
        router.push(groupListUrl(categoryId, null, currentGroup.folderId));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    });
  }

  function addSlotMember(slotCategoryId: string, value: { presetId: string; variantId: string }) {
    startTransition(async () => {
      try {
        const addedMember = await addGroupMember({
          groupId: currentGroup.id,
          presetId: value.presetId,
          variantId: value.variantId,
          slotCategoryId,
        });
        setCurrentGroup((current) => ({
          ...current,
          members: sortGroupMembers([
            ...current.members,
            toGroupMemberDisplay(addedMember, categories, groups),
          ]),
        }));
        toast.success("成员已添加");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "添加成员失败");
      }
    });
  }

  function handleSlotDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !currentCategory) return;

    const oldIndex = slotRows.findIndex((row) => row.key === active.id);
    const newIndex = slotRows.findIndex((row) => row.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previousSlots = slotTemplate;
    const nextSlots = arrayMove(slotTemplate, oldIndex, newIndex);
    setSlotTemplate(nextSlots);

    startTransition(async () => {
      try {
        await updateCategorySlotTemplate(currentCategory.id, nextSlots);
        toast.success("槽位顺序已更新");
        router.refresh();
      } catch (error) {
        setSlotTemplate(previousSlots);
        toast.error(error instanceof Error ? error.message : "调整槽位顺序失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200">
          <ArrowLeft className="size-3.5" /> 返回预制列表
        </Link>
        <NeighborNavigation
          previousHref={previousGroupHref}
          nextHref={nextGroupHref}
          previousTitle={previousGroup?.name}
          nextTitle={nextGroup?.name}
          positionText={groupPositionText}
          className="justify-end"
          hardNavigation
        />
      </div>
      <div>
        <h1 className="text-lg font-semibold text-white">{currentGroup.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">预制组 / {currentGroup.members.length} 个成员</p>
      </div>
      <div className="space-y-4">
        <div className="grid gap-3 border-t border-white/5 pt-3">
          <label className="space-y-1.5">
            <span className="text-[10px] text-zinc-500">名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500/30"
            />
          </label>
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 bg-black/10 p-3">
          <div className="text-xs font-medium text-zinc-200">成员</div>
          {memberRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 py-5 text-center text-[11px] text-zinc-600">
              暂无成员
            </div>
          ) : (
            <DndContext id={slotDndId} sensors={slotSensors} collisionDetection={closestCenter} onDragEnd={handleSlotDragEnd}>
              <SortableContext items={slotRows.map((row) => row.key)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
              {memberRows.map((row) => {
                if (row.kind === "slot" && !row.member) {
                  const slotCategory = categoryLookup.get(row.slot.categoryId);
                  const slotLabel = row.slot.label ?? slotCategory?.name ?? `槽位 ${row.slotIndex + 1}`;
                  return (
                    <SortableSlotShell
                      key={row.key}
                      id={row.key}
                      dashed
                      disabled={isPending || slotRows.length < 2}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs text-zinc-300">{slotLabel}</div>
                        <div className="truncate text-[10px] text-zinc-600">
                          {slotCategory ? `固定分类：${slotCategory.name}` : "固定槽位"}
                        </div>
                      </div>
                      <div
                        className="w-48 shrink-0"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                      >
                        <PresetCascadePicker
                          categories={categories}
                          value={null}
                          onChange={(value) => {
                            if (!value) return;
                            addSlotMember(row.slot.categoryId, {
                              presetId: value.presetId,
                              variantId: value.variantId,
                            });
                          }}
                          lockedCategoryId={row.slot.categoryId}
                          placeholder={`选择${slotCategory?.name ?? "预制"}...`}
                          disabled={isPending}
                          presetCategoriesOnly
                        />
                      </div>
                    </SortableSlotShell>
                  );
                }

                const member = row.member;
                if (!member) return null;
                const presetHref = member.presetId ? `/assets/presets/${member.presetId}` : null;
                const memberCategoryId = row.kind === "slot"
                  ? row.slot.categoryId
                  : member.presetId
                    ? presetCategoryLookup.get(member.presetId)
                    : undefined;
                const slotCategory = row.kind === "slot" ? categoryLookup.get(row.slot.categoryId) : null;
                const slotLabel = row.kind === "slot"
                  ? row.slot.label ?? slotCategory?.name ?? `槽位 ${row.slotIndex + 1}`
                  : null;
                const title = (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-zinc-200">
                      {member.subGroupName ?? member.presetName ?? "未知成员"}
                    </div>
                    <div className="truncate text-[10px] text-zinc-500">
                      {slotLabel
                        ? `${slotLabel} · ${member.variantName ? `变体：${member.variantName}` : "默认变体"}`
                        : member.subGroupName
                          ? "子组"
                          : member.variantName ? `变体：${member.variantName}` : "默认变体"}
                    </div>
                  </div>
                );
                const controls = (
                  <>
                    {!member.subGroupId && member.presetId && member.variantId && (
                      <>
                        <button
                          type="button"
                          aria-label={`替换成员：${member.presetName ?? member.presetId}`}
                          title="替换成员"
                          disabled={isPending}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenReplaceMemberId(openReplaceMemberId === member.id ? null : member.id);
                          }}
                          className="rounded p-1 text-zinc-500 transition hover:bg-sky-500/10 hover:text-sky-400 disabled:opacity-50"
                        >
                          <Repeat2 className="size-3.5" />
                        </button>
                        {openReplaceMemberId === member.id && (
                          <div
                            className="w-44 shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            <PresetCascadePicker
                              categories={categories}
                              value={{ presetId: member.presetId, variantId: member.variantId }}
                              onChange={(val) => {
                                if (!val) return;
                                startTransition(async () => {
                                  try {
                                    const updatedMember = await updateGroupMember(member.id, { presetId: val.presetId, variantId: val.variantId });
                                    if (updatedMember) {
                                      setCurrentGroup((current) => ({
                                        ...current,
                                        members: sortGroupMembers(
                                          current.members.map((item) =>
                                            item.id === member.id
                                              ? toGroupMemberDisplay(updatedMember, categories, groups)
                                              : item,
                                          ),
                                        ),
                                      }));
                                    }
                                    toast.success("成员已替换");
                                    setOpenReplaceMemberId(null);
                                  } catch (error) {
                                    toast.error(error instanceof Error ? error.message : "替换成员失败");
                                  }
                                });
                              }}
                              lockedCategoryId={memberCategoryId}
                              placeholder="替换成员..."
                              disabled={isPending}
                              presetCategoriesOnly
                              defaultOpen
                            />
                          </div>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startTransition(async () => {
                          try {
                            await removeGroupMember(member.id);
                            setCurrentGroup((current) => ({
                              ...current,
                              members: current.members.filter((item) => item.id !== member.id),
                            }));
                            setOpenReplaceMemberId((current) => current === member.id ? null : current);
                            toast.success("成员已移除");
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "移除成员失败");
                          }
                        });
                      }}
                      className="rounded p-1 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                );
                if (row.kind === "slot") {
                  return (
                    <SortableSlotShell
                      key={row.key}
                      id={row.key}
                      dashed={false}
                      disabled={isPending || slotRows.length < 2}
                    >
                      {presetHref ? (
                        <Link href={presetHref} className="min-w-0 flex-1">
                          {title}
                        </Link>
                      ) : (
                        <div className="min-w-0 flex-1">{title}</div>
                      )}
                      {controls}
                    </SortableSlotShell>
                  );
                }
                return presetHref ? (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 transition hover:bg-white/[0.04] hover:border-white/10"
                  >
                    <Link href={presetHref} className="min-w-0 flex-1">
                      {title}
                    </Link>
                    {controls}
                  </div>
                ) : (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                  >
                    {title}
                    {controls}
                  </div>
                );
              })}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <AddGroupMemberForm
            groupId={currentGroup.id}
            categories={categories}
            groups={selectableGroups}
            onAdd={(input) => {
              startTransition(async () => {
                try {
                  const addedMember = await addGroupMember(input);
                  setCurrentGroup((current) => ({
                    ...current,
                    members: sortGroupMembers([
                      ...current.members,
                      toGroupMemberDisplay(addedMember, categories, groups),
                    ]),
                  }));
                  toast.success("成员已添加");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "添加成员失败");
                }
              });
            }}
            isPending={isPending}
          />
        </div>

        {/* Read-only preview card */}
        {previewGroups.length > 0 && (
          <div className="space-y-2 rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="text-xs font-medium text-zinc-200">预览</div>
            {previewGroups.map((pg) => (
              <div key={pg.category?.id ?? "__unknown__"} className="space-y-2">
                {pg.category && previewGroups.length > 1 && (
                  <div className="text-[10px] font-medium text-zinc-500">{pg.category.name}</div>
                )}
                {pg.entries.map(({ member, variant }) => {
                  if (!variant) return null;
                  const loras = [
                    ...parseLoraBindings(variant.lora1),
                    ...parseLoraBindings(variant.lora2),
                  ].filter((l) => l.enabled);
                  return (
                    <div key={member.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 space-y-1.5">
                      <div className="text-[11px] font-medium text-zinc-300">
                        {member.presetName ?? "未知"}
                        {member.variantName && <span className="text-zinc-500"> / {member.variantName}</span>}
                      </div>
                      {variant.prompt && (
                        <div>
                          <div className="mb-0.5 text-[10px] font-medium text-zinc-500">正面提示词</div>
                          <pre className="whitespace-pre-wrap break-words text-[11px] text-zinc-400">{variant.prompt}</pre>
                        </div>
                      )}
                      {variant.negativePrompt && (
                        <div>
                          <div className="mb-0.5 text-[10px] font-medium text-zinc-500">负面提示词</div>
                          <pre className="whitespace-pre-wrap break-words text-[11px] text-zinc-400">{variant.negativePrompt}</pre>
                        </div>
                      )}
                      {loras.length > 0 && (
                        <div>
                          <div className="mb-0.5 text-[10px] font-medium text-zinc-500">LoRA</div>
                          <div className="space-y-0.5 text-[11px] text-zinc-500">
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
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <PresetChangeHistoryPanel history={currentGroup.changeHistory} tabs={GROUP_HISTORY_TABS} />

        <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">
          <button
            type="button"
            disabled={isPending || !name.trim()}
            onClick={saveGroup}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/20 px-3 py-2 text-xs text-sky-300 transition hover:bg-sky-500/30 disabled:opacity-50"
          >
            <Save className="size-3.5" /> 保存
          </button>
          <button
            type="button"
            onClick={removeGroup}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 transition hover:bg-red-500/20"
          >
            <Trash2 className="size-3.5" /> 删除
          </button>
        </div>
      </div>
    </div>
  );
}
