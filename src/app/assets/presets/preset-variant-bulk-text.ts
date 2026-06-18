export type VariantBulkTextField = "prompt" | "negativePrompt";

export type VariantBulkTextVariant = {
  key: string;
  name: string;
  prompt: string;
  negativePrompt?: string | null;
};

export type VariantBulkTextStatus = "planned" | "no-match" | "unchanged" | "unselected";

export type VariantBulkTextPlanItem = {
  key: string;
  name: string;
  before: string;
  after: string;
  matchCount: number;
  status: VariantBulkTextStatus;
};

export type VariantBulkTextPlanSummary = {
  total: number;
  selected: number;
  planned: number;
  noMatch: number;
  unchanged: number;
  unselected: number;
  totalMatches: number;
  canApply: boolean;
};

export type VariantBulkTextPlan = {
  field: VariantBulkTextField;
  findText: string;
  replaceText: string;
  items: VariantBulkTextPlanItem[];
  blockers: string[];
  summary: VariantBulkTextPlanSummary;
};

export function countTextOccurrences(value: string, needle: string) {
  if (!needle) return 0;

  let count = 0;
  let index = 0;
  while (true) {
    const nextIndex = value.indexOf(needle, index);
    if (nextIndex < 0) return count;
    count += 1;
    index = nextIndex + needle.length;
  }
}

function selectedKeySet(selectedVariantKeys: readonly string[] | ReadonlySet<string>) {
  return selectedVariantKeys instanceof Set
    ? selectedVariantKeys
    : new Set(selectedVariantKeys);
}

function textForField(variant: VariantBulkTextVariant, field: VariantBulkTextField) {
  return field === "prompt"
    ? variant.prompt
    : variant.negativePrompt ?? "";
}

export function buildVariantBulkTextPlan(input: {
  variants: readonly VariantBulkTextVariant[];
  selectedVariantKeys: readonly string[] | ReadonlySet<string>;
  field: VariantBulkTextField;
  findText: string;
  replaceText: string;
}): VariantBulkTextPlan {
  const blockers = input.findText.length === 0 ? ["查找文本不能为空"] : [];
  const selectedKeys = selectedKeySet(input.selectedVariantKeys);
  const items: VariantBulkTextPlanItem[] = input.variants.map((variant) => {
    const before = textForField(variant, input.field);
    if (!selectedKeys.has(variant.key)) {
      return {
        key: variant.key,
        name: variant.name,
        before,
        after: before,
        matchCount: 0,
        status: "unselected",
      };
    }

    const matchCount = blockers.length > 0 ? 0 : countTextOccurrences(before, input.findText);
    if (matchCount === 0) {
      return {
        key: variant.key,
        name: variant.name,
        before,
        after: before,
        matchCount,
        status: "no-match",
      };
    }

    const after = before.split(input.findText).join(input.replaceText);
    return {
      key: variant.key,
      name: variant.name,
      before,
      after,
      matchCount,
      status: after === before ? "unchanged" : "planned",
    };
  });

  const summary = items.reduce<VariantBulkTextPlanSummary>((next, item) => {
    next.total += 1;
    next.totalMatches += item.matchCount;
    if (item.status === "planned") next.planned += 1;
    if (item.status === "no-match") next.noMatch += 1;
    if (item.status === "unchanged") next.unchanged += 1;
    if (item.status === "unselected") next.unselected += 1;
    if (item.status !== "unselected") next.selected += 1;
    return next;
  }, {
    total: 0,
    selected: 0,
    planned: 0,
    noMatch: 0,
    unchanged: 0,
    unselected: 0,
    totalMatches: 0,
    canApply: false,
  });

  summary.canApply = blockers.length === 0 && summary.planned > 0;

  return {
    field: input.field,
    findText: input.findText,
    replaceText: input.replaceText,
    items,
    blockers,
    summary,
  };
}
