"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Save, Trash2, X } from "lucide-react";
import type { PresetCategoryFull, PresetGroupItem, PresetVariantItem } from "@/lib/server-data";
import {
  addGroupMember,
  deletePresetGroup,
  removeGroupMember,
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
}: {
  categories: PresetCategoryFull[];
  categoryId: string;
  group: PresetGroupItem;
  groups: PresetGroupItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(group.name);
  const [slug, setSlug] = useState(group.slug);
  const backHref = groupListUrl(categoryId, group.id, group.folderId);
  const selectableGroups = groups.filter((item) => item.id !== group.id);

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
          slug: slug.trim(),
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
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-3.5" /> 返回预制列表
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-white">{group.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">预制组 / {group.slug}</p>
      </div>
      <div className="space-y-4">
        <div className="grid gap-3 border-t border-white/5 pt-3 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-[10px] text-zinc-500">名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500/30"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] text-zinc-500">Slug</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
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
                const inner = (
                  <>
                    <div className="min-w-0">
                      <div className="truncate text-xs text-zinc-200">
                        {member.subGroupName ?? member.presetName ?? "未知成员"}
                      </div>
                      <div className="truncate text-[10px] text-zinc-500">
                        {member.subGroupName ? "子组" : member.variantName ? `变体：${member.variantName}` : "默认变体"}
                      </div>
                    </div>
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
                  <Link
                    key={member.id}
                    href={presetHref}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 transition hover:bg-white/[0.04] hover:border-white/10"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                  >
                    {inner}
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
            disabled={isPending || !name.trim() || !slug.trim()}
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
