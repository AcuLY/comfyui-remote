import assert from "node:assert/strict";
import test from "node:test";
import { buildPresetGroupMemberLayout } from "../src/lib/preset-group-slot-layout";

type Member = {
  id: string;
  categoryId: string | null;
  slotCategoryId?: string | null;
  subGroupId?: string | null;
  sortOrder: number;
};

test("preset group slot layout keeps fixed slot rows and appends overflow members", () => {
  const layout = buildPresetGroupMemberLayout<Member>({
    slots: [
      { categoryId: "cat-character", label: "角色" },
      { categoryId: "cat-expression", label: "表情" },
      { categoryId: "cat-pose", label: "姿势" },
    ],
    members: [
      { id: "pose-a", categoryId: "cat-pose", sortOrder: 0 },
      { id: "extra-style", categoryId: "cat-style", sortOrder: 1 },
      { id: "pose-b", categoryId: "cat-pose", sortOrder: 2 },
      { id: "sub-group", categoryId: null, subGroupId: "group-1", sortOrder: 3 },
    ],
    getMemberCategoryId: (member) => member.categoryId,
  });

  assert.deepEqual(
    layout.map((row) => ({
      kind: row.kind,
      slotCategoryId: row.kind === "slot" ? row.slot.categoryId : null,
      memberId: row.member?.id ?? null,
    })),
    [
      { kind: "slot", slotCategoryId: "cat-character", memberId: null },
      { kind: "slot", slotCategoryId: "cat-expression", memberId: null },
      { kind: "slot", slotCategoryId: "cat-pose", memberId: "pose-a" },
      { kind: "extra", slotCategoryId: null, memberId: "extra-style" },
      { kind: "extra", slotCategoryId: null, memberId: "pose-b" },
      { kind: "extra", slotCategoryId: null, memberId: "sub-group" },
    ],
  );
});

test("preset group slot layout prefers members already marked for the slot", () => {
  const layout = buildPresetGroupMemberLayout<Member>({
    slots: [{ categoryId: "cat-pose", label: "姿势" }],
    members: [
      { id: "plain-pose", categoryId: "cat-pose", sortOrder: 0 },
      { id: "slot-pose", categoryId: "cat-pose", slotCategoryId: "cat-pose", sortOrder: 1 },
    ],
    getMemberCategoryId: (member) => member.categoryId,
  });

  assert.deepEqual(layout.map((row) => row.member?.id ?? null), ["slot-pose", "plain-pose"]);
});

test("preset group slot layout preserves normal member order without slots", () => {
  const layout = buildPresetGroupMemberLayout<Member>({
    slots: [],
    members: [
      { id: "late", categoryId: "cat-late", sortOrder: 10 },
      { id: "early", categoryId: "cat-early", sortOrder: 1 },
    ],
    getMemberCategoryId: (member) => member.categoryId,
  });

  assert.deepEqual(layout.map((row) => row.member?.id ?? null), ["early", "late"]);
});
