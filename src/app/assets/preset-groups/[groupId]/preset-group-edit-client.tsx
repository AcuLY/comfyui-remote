"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, Repeat2, Save, Trash2, X } from "lucide-react";
import { NeighborNavigation } from "@/components/neighbor-navigation";
import { PresetCascadePicker } from "@/components/preset-cascade-picker";
import type { PresetCategoryFull, PresetGroupItem, PresetVariantItem } from "@/lib/server-data";
import {
  addGroupMember,
  deletePresetGroup,
  removeGroupMember,
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
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(group.name);
  const [openReplaceMemberId, setOpenReplaceMemberId] = useState<string | null>(null);
  const backHref = groupListUrl(categoryId, group.id, group.folderId);
  const selectableGroups = groups.filter((item) => item.id !== group.id);
  const previousGroupHref = previousGroup?.id ? `/assets/preset-groups/${previousGroup.id}` : null;
  const nextGroupHref = nextGroup?.id ? `/assets/preset-groups/${nextGroup.id}` : null;
  const groupPositionText = groupPosition >= 0 ? `${groupPosition + 1} / ${totalGroups}` : null;

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
      router.push(href);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextGroupHref, previousGroupHref, router]);

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

  // Group non-sub-group members by their preset's category sortOrder
  const previewGroups = useMemo(() => {
    const presetToCategory = new Map<string, PresetCategoryFull>();
    for (const cat of categories) {
      for (const preset of cat.presets) {
        presetToCategory.set(preset.id, cat);
      }
    }

    // Collect members with their category info
    const memberEntries = group.members
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
  }, [group.members, variantLookup, categories]);

  function saveGroup() {
    startTransition(async () => {
      try {
        await updatePresetGroup(group.id, {
          categoryId,
          name: name.trim(),
        });
        toast.success("预制组已保存");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "保存失败");
      }
    });
  }

  function removeGroup() {
    if (!confirm(`确认删除预制组「${group.name}」？`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deletePresetGroup(group.id);
        toast.success("预制组已删除");
        router.push(groupListUrl(categoryId, null, group.folderId));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败");
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
        />
      </div>
      <div>
        <h1 className="text-lg font-semibold text-white">{group.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">预制组 / {group.members.length} 个成员</p>
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
          {group.members.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 py-5 text-center text-[11px] text-zinc-600">
              暂无成员
            </div>
          ) : (
            <div className="space-y-1.5">
              {group.members.map((member) => {
                const presetHref = member.presetId ? `/assets/presets/${member.presetId}` : null;
                const memberCategoryId = member.presetId ? presetCategoryLookup.get(member.presetId) : undefined;
                const title = (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-zinc-200">
                      {member.subGroupName ?? member.presetName ?? "未知成员"}
                    </div>
                    <div className="truncate text-[10px] text-zinc-500">
                      {member.subGroupName ? "子组" : member.variantName ? `变体：${member.variantName}` : "默认变体"}
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
                                    await updateGroupMember(member.id, { presetId: val.presetId, variantId: val.variantId });
                                    toast.success("成员已替换");
                                    setOpenReplaceMemberId(null);
                                    router.refresh();
                                  } catch (error) {
                                    toast.error(error instanceof Error ? error.message : "替换成员失败");
                                  }
                                });
                              }}
                              lockedCategoryId={memberCategoryId}
                              placeholder="替换成员..."
                              disabled={isPending}
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
                          await removeGroupMember(member.id);
                          toast.success("成员已移除");
                          router.refresh();
                        });
                      }}
                      className="rounded p-1 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                );
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
          )}
          <AddGroupMemberForm
            groupId={group.id}
            categories={categories}
            groups={selectableGroups}
            onAdd={(input) => {
              startTransition(async () => {
                await addGroupMember(input);
                toast.success("成员已添加");
                router.refresh();
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

        <PresetChangeHistoryPanel history={group.changeHistory} tabs={GROUP_HISTORY_TABS} />

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
