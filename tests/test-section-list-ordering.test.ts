import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGroupedDragOrder,
  mergeVisibleOrderIntoAllIds,
} from "../src/lib/section-list-ordering";

test("buildGroupedDragOrder moves selected sections down as one ordered block", () => {
  assert.deepEqual(
    buildGroupedDragOrder({
      visibleIds: ["a", "b", "c", "d", "e"],
      selectedIds: ["b", "c"],
      activeId: "b",
      overId: "e",
    }),
    ["a", "d", "e", "b", "c"],
  );
});

test("buildGroupedDragOrder moves selected sections up as one ordered block", () => {
  assert.deepEqual(
    buildGroupedDragOrder({
      visibleIds: ["a", "b", "c", "d", "e"],
      selectedIds: ["b", "c"],
      activeId: "c",
      overId: "a",
    }),
    ["b", "c", "a", "d", "e"],
  );
});

test("buildGroupedDragOrder keeps unselected drags as single section moves", () => {
  assert.deepEqual(
    buildGroupedDragOrder({
      visibleIds: ["a", "b", "c", "d", "e"],
      selectedIds: ["b", "c"],
      activeId: "e",
      overId: "b",
    }),
    ["a", "e", "b", "c", "d"],
  );
});

test("buildGroupedDragOrder ignores drops over another selected section in the same group", () => {
  assert.deepEqual(
    buildGroupedDragOrder({
      visibleIds: ["a", "b", "c", "d", "e"],
      selectedIds: ["b", "c"],
      activeId: "b",
      overId: "c",
    }),
    ["a", "b", "c", "d", "e"],
  );
});

test("mergeVisibleOrderIntoAllIds preserves hidden sections while replacing visible slots", () => {
  assert.deepEqual(
    mergeVisibleOrderIntoAllIds({
      allIds: ["a", "hidden-1", "b", "c", "hidden-2", "d"],
      visibleIds: ["d", "b", "c", "a"],
    }),
    ["d", "hidden-1", "b", "c", "hidden-2", "a"],
  );
});
