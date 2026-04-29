type DiffKind = "added" | "removed" | "changed";

type DiffRow = {
  path: string;
  before: string;
  after: string;
  kind: DiffKind;
};

const MISSING = Symbol("missing");
const MAX_TEXT_LENGTH = 180;
const ARRAY_ID_KEYS = ["id", "bindingId", "sourceId", "variantId", "slug", "name", "label", "path"];
const VALUE_KEYS = [
  "name",
  "label",
  "title",
  "slug",
  "category",
  "variantId",
  "bindingId",
  "groupBindingId",
  "sourceId",
  "sourceName",
  "path",
  "weight",
  "enabled",
];

const FIELD_LABELS: Record<string, string> = {
  aspectRatio: "画幅比例",
  batchSize: "批量数量",
  bindingId: "绑定 ID",
  category: "分类",
  categoryId: "分类 ID",
  enabled: "启用",
  groupBindingId: "组绑定 ID",
  height: "高度",
  id: "ID",
  ksampler1: "一阶段采样",
  ksampler2: "二阶段采样",
  label: "标签",
  lora1: "LoRA 1",
  lora2: "LoRA 2",
  name: "名称",
  negative: "负向提示词",
  negativePrompt: "负向提示词",
  path: "路径",
  positive: "正向提示词",
  prompt: "提示词",
  seed: "种子",
  seedPolicy: "种子策略",
  shortSidePx: "短边尺寸",
  slug: "Slug",
  sourceId: "来源 ID",
  sourceName: "来源名称",
  steps: "步数",
  title: "标题",
  type: "类型",
  upscaleFactor: "放大倍率",
  variantId: "变体 ID",
  weight: "权重",
  width: "宽度",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compactText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "空";
  return normalized.length > MAX_TEXT_LENGTH ? `${normalized.slice(0, MAX_TEXT_LENGTH)}...` : normalized;
}

function formatValue(value: unknown): string {
  if (value === MISSING || value === undefined) return "无";
  if (value === null) return "空";
  if (typeof value === "string") return compactText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "0 项";
    const labels = value
      .slice(0, 4)
      .map((item) => itemLabel(item))
      .filter(Boolean);
    const suffix = value.length > 4 ? "..." : "";
    return labels.length > 0 ? `${value.length} 项：${labels.join("、")}${suffix}` : `${value.length} 项`;
  }

  if (isPlainObject(value)) {
    const parts = VALUE_KEYS.flatMap((key) => {
      if (!(key in value)) return [];
      return [`${FIELD_LABELS[key] ?? key}: ${formatValue(value[key])}`];
    });
    if (parts.length > 0) return compactText(parts.slice(0, 4).join("；"));
    return `${Object.keys(value).length} 个字段`;
  }

  return String(value);
}

function itemLabel(value: unknown): string | null {
  if (typeof value === "string") return compactText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (!isPlainObject(value)) return null;

  for (const key of ["name", "label", "title", "slug", "sourceName", "path", "id"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return compactText(candidate);
    if (typeof candidate === "number") return String(candidate);
  }

  return null;
}

function arrayIdentity(value: unknown): string | null {
  if (!isPlainObject(value)) return null;
  for (const key of ARRAY_ID_KEYS) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return `${key}:${candidate}`;
    if (typeof candidate === "number") return `${key}:${candidate}`;
  }
  return null;
}

function arrayIdentityLabel(identity: string) {
  const separatorIndex = identity.indexOf(":");
  return separatorIndex >= 0 ? identity.slice(separatorIndex + 1) : identity;
}

function buildIdentityMap(values: unknown[]) {
  const map = new Map<string, unknown>();
  for (const item of values) {
    const identity = arrayIdentity(item);
    if (!identity || map.has(identity)) return null;
    map.set(identity, item);
  }
  return map;
}

function stableStringify(value: unknown): string {
  if (value === MISSING) return "__missing__";
  if (!isPlainObject(value)) return JSON.stringify(value);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = value[key];
  }
  return JSON.stringify(sorted);
}

function isSameValue(before: unknown, after: unknown) {
  if (before === MISSING || after === MISSING) return before === after;
  if (Object.is(before, after)) return true;
  return stableStringify(before) === stableStringify(after);
}

function formatPath(path: string[]) {
  if (path.length === 0) return "整体";
  return path
    .map((part) => {
      if (part.startsWith("[") && part.endsWith("]")) return part.slice(1, -1);
      return FIELD_LABELS[part] ?? part;
    })
    .join(" / ");
}

function collectDiffs(before: unknown, after: unknown, path: string[] = []): DiffRow[] {
  if (isSameValue(before, after)) return [];

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = [...Object.keys(before), ...Object.keys(after).filter((key) => !(key in before))];
    return keys.flatMap((key) =>
      collectDiffs(key in before ? before[key] : MISSING, key in after ? after[key] : MISSING, [...path, key]),
    );
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const beforeMap = buildIdentityMap(before);
    const afterMap = buildIdentityMap(after);

    if (beforeMap && afterMap) {
      const identities = [
        ...beforeMap.keys(),
        ...[...afterMap.keys()].filter((identity) => !beforeMap.has(identity)),
      ];
      return identities.flatMap((identity) =>
        collectDiffs(
          beforeMap.has(identity) ? beforeMap.get(identity) : MISSING,
          afterMap.has(identity) ? afterMap.get(identity) : MISSING,
          [...path, `[${arrayIdentityLabel(identity)}]`],
        ),
      );
    }

    if (before.every((item) => !isPlainObject(item)) && after.every((item) => !isPlainObject(item))) {
      const length = Math.max(before.length, after.length);
      return Array.from({ length }, (_, index) =>
        collectDiffs(
          index in before ? before[index] : MISSING,
          index in after ? after[index] : MISSING,
          [...path, `[第 ${index + 1} 项]`],
        ),
      ).flat();
    }
  }

  const kind: DiffKind = before === MISSING ? "added" : after === MISSING ? "removed" : "changed";
  return [
    {
      path: formatPath(path),
      before: formatValue(before),
      after: formatValue(after),
      kind,
    },
  ];
}

function kindClasses(kind: DiffKind) {
  if (kind === "added") {
    return {
      badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
      row: "border-emerald-400/10 bg-emerald-400/[0.04]",
    };
  }
  if (kind === "removed") {
    return {
      badge: "border-rose-400/20 bg-rose-400/10 text-rose-200",
      row: "border-rose-400/10 bg-rose-400/[0.04]",
    };
  }
  return {
    badge: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    row: "border-white/5 bg-black/10",
  };
}

function kindLabel(kind: DiffKind) {
  if (kind === "added") return "新增";
  if (kind === "removed") return "删除";
  return "修改";
}

export function ChangeDiffView({ before, after }: { before: unknown; after: unknown }) {
  const rows = collectDiffs(before, after);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 py-4 text-center text-[11px] text-zinc-600">
        没有字段级差异
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const classes = kindClasses(row.kind);
        return (
          <div key={`${row.path}-${index}`} className={`rounded-lg border p-2.5 ${classes.row}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded border px-1.5 py-0.5 text-[10px] ${classes.badge}`}>
                {kindLabel(row.kind)}
              </span>
              <span className="break-words text-[11px] font-medium text-zinc-300">{row.path}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
              <div className="min-w-0 rounded border border-white/5 bg-black/15 p-2">
                <div className="mb-1 text-[10px] text-zinc-600">变更前</div>
                <div className="break-words text-[11px] leading-5 text-zinc-400">{row.before}</div>
              </div>
              <div className="hidden px-1 pt-7 text-[11px] text-zinc-600 md:block">→</div>
              <div className="min-w-0 rounded border border-white/5 bg-black/15 p-2">
                <div className="mb-1 text-[10px] text-zinc-600">变更后</div>
                <div className="break-words text-[11px] leading-5 text-zinc-200">{row.after}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
