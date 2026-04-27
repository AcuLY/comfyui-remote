"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Save, Trash2, X } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import type { PresetCategoryFull, PresetGroupItem } from "@/lib/server-data";
import {
  addGroupMember,
  deletePresetGroup,
  removeGroupMember,
  updatePresetGroup,
} from "@/lib/actions";
import { AddGroupMemberForm, GROUP_HISTORY_TABS, PresetChangeHistoryPanel } from "../../presets/preset-manager";
import { toast } from "sonner";

function groupListUrl(categoryId: string, groupId: string) {
  const params = new URLSearchParams({
    category: categoryId,
    preset: groupId,
  });
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
  const backHref = groupListUrl(categoryId, group.id);
  const selectableGroups = groups.filter((item) => item.id !== group.id);

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
        router.push(`/assets/presets?category=${categoryId}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    });
  }

  return (
    <div className="space-y-3">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-3.5" /> 返回预制列表
      </Link>
      <SectionCard title={group.name} subtitle={`预制组 / ${group.slug}`}>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
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
                {group.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
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
                      onClick={() => {
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
                  </div>
                ))}
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
      </SectionCard>
    </div>
  );
}
