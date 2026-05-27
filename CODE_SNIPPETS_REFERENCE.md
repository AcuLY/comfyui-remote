# Code Snippets Reference Guide

## 1. Navigation Trigger (Card Click)

**File:** `pending-review-groups.tsx` (Line 65-73)

```tsx
{group.rows.map((row) => (
  <Link className={s.queueRunRow} href={demoHref(`/runs/${row.run.id}`)} key={row.run.id}>
    <div className={s.queueRunMain}>
      <strong>{row.run.sectionName}</strong>
      <span>run {row.run.runIndex}</span>
      <span className={s.queueRunDate}>生成于 {row.run.createdAt}</span>
    </div>
    <ImageListSmall className={s.queueThumbs} images={row.run.images} limit={row.run.images.length} showCounts />
  </Link>
))}
```

**What happens:**
- User clicks anywhere on `<Link>`
- Next.js navigates to `href={demoHref(`/runs/${row.run.id}`)}`
- Browser URL changes to `/design-demos/runs/{runId}`

---

## 2. Route Href Helper Function

**File:** `routing/routes.ts` (Lines 106-110)

```tsx
export function demoHref(route: string) {
  const normalized = normalizeProductRoute(route);
  if (normalized === "/") return "/design-demos";
  return `/design-demos${normalized}`;
}
```

**Purpose:**
- Input: `/runs/run-123`
- Output: `/design-demos/runs/run-123`
- Handles route normalization (e.g., `/queue` → `/runs`)

**Related helper:**

```tsx
// Lines 112-118
export function normalizeProductRoute(route: string) {
  if (route === "/queue") return "/runs";
  if (route.startsWith("/queue/")) return `/runs/${route.slice("/queue/".length)}`;
  if (route === "/assets") return "/";
  if (route.startsWith("/assets/")) return route.slice("/assets".length);
  return route;
}
```

---

## 3. Route Definition

**File:** `routing/routes.ts` (Line 62)

```tsx
{ 
  key: "queue-review", 
  pattern: "/runs/:runId",           // ← The route pattern with parameter
  title: "审核宫格", 
  group: "核心", 
  icon: Grid3X3 
}
```

**Route matching logic (Lines 146-153):**

```tsx
export function matchRoute(route: string): Match {
  const normalized = route === "" ? "/" : route;
  for (const def of ROUTES) {
    const params = matchPattern(def.pattern, normalized);
    if (params) return { key: def.key, params, route: normalized };
  }
  return { key: "not-found", params: {}, route: normalized };
}
```

**Pattern matching (Lines 128-144):**

```tsx
export function matchPattern(pattern: string, route: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const routeParts = route.split("/").filter(Boolean);
  if (patternParts.length !== routeParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const patternPart = patternParts[i];
    const routePart = routeParts[i];
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(routePart);
    } else if (patternPart !== routePart) {
      return null;
    }
  }
  return params;
}
```

**Example:**
```
Pattern: "/runs/:runId"
Route:   "/runs/run-abc123"
Result:  { runId: "run-abc123" }
```

---

## 4. Review Page Component

**File:** `review-page.tsx` (Lines 17-30)

```tsx
export function ReviewPage({ data, run }: { data: DemoData; run: DemoRun | undefined }) {
  const [filter, setFilter] = useState<ResultDemoFilter>("all");
  const [runImages, setRunImages] = useState(run?.images ?? []);

  // Reset when run changes
  useEffect(() => { if (run) setRunImages(run.images); }, [run]);

  if (!run) return <EmptyPage title="没有可审核运行" />;
  const images = filterImages(runImages, filter);
  const project = findProject(data, run.projectId);
  const section = findSection(project, run.sectionId);
  // ... rest of component
}
```

**Props:**
- `data: DemoData` - All application data
- `run: DemoRun | undefined` - The specific run being reviewed

---

## 5. Page Header

**File:** `review-page.tsx` (Lines 32-47)

```tsx
<PageHeader
  className={s.reviewPageHeader}
  back={{ href: "/runs", label: "返回任务" }}           // ← Back button
  eyebrow="审核"
  title={`${run.projectTitle} / ${run.sectionName}`}    // ← Page title
  subtitle={project?.notes || undefined}
  actions={
    <>
      {sectionPath ? (
        <ButtonLink href={sectionPath} icon={ExternalLink}>
          跳转至小节
        </ButtonLink>
      ) : null}
      <a className={s.workflowDownloadLink} href={`/api/runs/${run.id}/workflow`} download>
        <Download className={s.iconMd} />
        下载工作流文件
      </a>
    </>
  }
/>
```

**Features:**
- **Back button:** Navigates to `/runs`
- **Title:** Shows project and section name
- **Actions:** Links to jump to section and download workflow

---

## 6. Parameters Section (ReviewMetaCard)

**File:** `review-meta-card.tsx` (Lines 154-181)

```tsx
export function ReviewMetaCard({
  run,
  meta,
}: {
  run: DemoRun;
  meta: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);  // ← CURRENTLY COLLAPSED BY DEFAULT
  const completedAt = run.finishedAt ?? run.createdAt;

  return (
    <section className={s.reviewMetaSurface} data-open={open ? "true" : "false"}>
      <button
        type="button"
        className={s.reviewMetaHeader}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <div className={s.reviewMetaHeading}>
          <em>RUN-{run.runIndex.toString().padStart(2, "0")}</em>
          <span>完成于 {completedAt}</span>
        </div>
        <ChevronDown className={s.reviewMetaChevron} aria-hidden="true" />
      </button>
      {meta ? <ReviewExecutionMeta meta={meta} /> : null}
    </section>
  );
}
```

**To expand by default, change line 161 to:**
```tsx
const [open, setOpen] = useState(true);  // ← EXPANDED BY DEFAULT
```

---

## 7. Data Merging Logic

**File:** `review-meta-card.tsx` (Lines 11-29)

```tsx
export function mergeExecutionMeta(run: DemoRun, section: NonNullable<ReturnType<typeof findSection>>) {
  // Start with section defaults
  const fallback: Record<string, unknown> = {
    aspectRatio: section.aspectRatio,
    shortSidePx: section.shortSidePx,
    batchSize: section.batchSize,
    checkpointName: section.checkpointName,
    workflowId: run.id,
    lora1: section.lora1 ?? [],
    lora2: section.lora2 ?? [],
    positivePrompt: section.positivePrompt,
    negativePrompt: section.negativePrompt,
  };

  // Override with run-specific metadata
  for (const [key, value] of Object.entries(run.executionMeta ?? {})) {
    if (value !== null && value !== undefined && value !== "") fallback[key] = value;
  }

  return fallback;
}
```

**Priority:**
1. Section default values
2. Run-specific execution metadata (overrides if not empty/null/undefined)

---

## 8. Parameters Display Content

**File:** `review-meta-card.tsx` (Lines 102-152)

```tsx
function ReviewExecutionMeta({ meta }: { meta: Record<string, unknown> }) {
  const lora1 = loraEntries(meta.lora1);
  const lora2 = loraEntries(meta.lora2);
  const positivePrompt = metaText(meta, "positivePrompt", "");
  const negativePrompt = metaText(meta, "negativePrompt", "");
  const positivePromptText = positivePrompt ? promptTextWithBreakLines(positivePrompt) : "";
  const negativePromptText = negativePrompt ? promptTextWithBreakLines(negativePrompt) : "";

  return (
    <div className={s.reviewMetaBody}>
      {/* KSampler 1 & 2 */}
      <div className={s.reviewSamplerGrid}>
        <SamplerMetaBlock meta={meta} stage={1} />
        <SamplerMetaBlock meta={meta} stage={2} />
      </div>

      {/* Checkpoint & Workflow */}
      <div className={s.reviewMetaLine}>
        <MetaStat label="Checkpoint" value={metaText(meta, "checkpointName")} />
        <MetaStat label="Workflow" value={metaText(meta, "workflowId")} />
      </div>

      {/* LoRA 1 & 2 */}
      <div className={s.reviewLoraGrid}>
        {[["LoRA1", lora1] as const, ["LoRA2", lora2] as const].map(([label, entries]) => (
          <div key={label} className={s.reviewLoraColumn}>
            <em>{label}<span>{entries.length}</span></em>
            {entries.length > 0 ? (
              <ul>
                {entries.map((entry) => (
                  <li key={entry.id} data-disabled={!entry.enabled}>
                    <span title={entry.name}>{entry.name}</span>
                    <strong>{entry.weight}</strong>
                  </li>
                ))}
              </ul>
            ) : <p>未记录</p>}
          </div>
        ))}
      </div>

      {/* Prompts */}
      <div className={s.reviewPromptGrid}>
        <div>
          <em>Prompt<span>{positivePrompt ? `${positivePrompt.length.toLocaleString()} chars` : "空"}</span></em>
          <pre>{positivePromptText || "未记录"}</pre>
        </div>
        <div>
          <em>Negative<span>{negativePrompt ? `${negativePrompt.length.toLocaleString()} chars` : "空"}</span></em>
          <pre>{negativePromptText || "未记录"}</pre>
        </div>
      </div>
    </div>
  );
}
```

---

## 9. KSampler Display Block

**File:** `review-meta-card.tsx` (Lines 66-91)

```tsx
function SamplerMetaBlock({ meta, stage }: { meta: Record<string, unknown>; stage: 1 | 2 }) {
  const prefix = stage === 1 ? "ks1" : "ks2";
  const hasSampler = ["Seed", "Steps", "Cfg", "Sampler", "Denoise"].some(
    (key) => meta[`${prefix}${key}`] !== null && meta[`${prefix}${key}`] !== undefined
  );

  if (!hasSampler && stage === 2) {
    return (
      <div className={s.reviewSamplerBlock} data-empty="true">
        <em>KSampler2</em>
        <p>跳过（1x 或未记录高清修复参数）</p>
      </div>
    );
  }

  return (
    <div className={s.reviewSamplerBlock}>
      <em>KSampler{stage}</em>
      <dl>
        <div><dt>seed</dt><dd>{metaText(meta, `${prefix}Seed`)}</dd></div>
        <div><dt>steps</dt><dd>{metaText(meta, `${prefix}Steps`)}</dd></div>
        <div><dt>cfg</dt><dd>{metaText(meta, `${prefix}Cfg`)}</dd></div>
        <div><dt>denoise</dt><dd>{metaText(meta, `${prefix}Denoise`)}</dd></div>
        <div data-span="2"><dt>sampler</dt><dd>{metaText(meta, `${prefix}Sampler`)}</dd></div>
      </dl>
    </div>
  );
}
```

**Metadata key naming:**
- Stage 1: `ks1Seed`, `ks1Steps`, `ks1Cfg`, `ks1Denoise`, `ks1Sampler`
- Stage 2: `ks2Seed`, `ks2Steps`, `ks2Cfg`, `ks2Denoise`, `ks2Sampler`

---

## 10. Filter Tabs

**File:** `review-page.tsx` (Lines 52-66)

```tsx
<SegmentedControl
  ariaLabel="切换视图"
  className={s.reviewFilterTabs}
  role="tablist"
  items={[
    { value: "all", label: "全部", count: runImages.length },
    { value: "pending", label: "待审", count: runImages.filter((image) => image.status === "pending").length },
    { value: "kept", label: "已保留", count: runImages.filter((image) => image.status === "kept").length },
    { value: "pstation", label: "p站", count: runImages.filter((image) => image.featured).length },
    { value: "preview", label: "预览", count: runImages.filter((image) => image.featured2).length },
    { value: "cover", label: "封面", count: runImages.filter((image) => image.cover).length },
  ]}
  value={filter}
  onChange={setFilter}
/>
```

**Filter values and their logic:**
| Filter | Label | Count Formula | Description |
|--------|-------|---------------|-------------|
| `all` | 全部 | All images | Total images |
| `pending` | 待审 | `status === "pending"` | Awaiting review |
| `kept` | 已保留 | `status === "kept"` | Approved/kept |
| `pstation` | p站 | `featured === true` | Featured |
| `preview` | 预览 | `featured2 === true` | Preview |
| `cover` | 封面 | `cover === true` | Cover image |

---

## 11. Review Usage in Page

**File:** `review-page.tsx` (Lines 48-50)

```tsx
{section ? (
  <ReviewMetaCard run={run} meta={executionMeta} />
) : null}
```

**This renders the parameters section only if:**
- `section` exists (the project section was found)
- If section not found, parameters section is hidden

---

## 12. Image Board Update

**File:** `review-page.tsx` (Lines 67-72)

```tsx
<ReviewImageBoard 
  images={images} 
  onImagesChange={(updated) => {
    setRunImages((prev) => prev.map((img) => {
      const match = updated.find((u) => u.id === img.id);
      return match ?? img;
    }));
  }} 
/>
```

**When user updates images:**
1. `ReviewImageBoard` calls `onImagesChange(updatedImages)`
2. Component updates `runImages` state
3. Next render uses new image data
4. Filter tabs update their counts

---

## 13. Text Formatting Helpers

**File:** `review-meta-card.tsx`

```tsx
// Convert BREAK tokens to newlines
function promptTextWithBreakLines(value: string) {
  return value.replace(/\s*BREAK\s*/g, "\n").trim();
}

// Extract LoRA name from path
function loraName(path: string) {
  return path.split(/[/\\]/).pop() ?? path;
}

// Convert LoRA array entries to display format
function loraEntries(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const raw = entry as Record<string, unknown>;
      const path = typeof raw.path === "string"
        ? raw.path
        : typeof raw.filePath === "string"
          ? raw.filePath
          : typeof raw.fileName === "string"
            ? raw.fileName
            : "";
      if (!path) return null;
      const weight = raw.weight === null || raw.weight === undefined ? "未设权重" : String(raw.weight);
      const enabled = raw.enabled !== false;
      return { id: `${path}-${index}`, name: loraName(path), weight, enabled };
    })
    .filter((entry): entry is { id: string; name: string; weight: string; enabled: boolean } => Boolean(entry));
}

// Get metadata value with fallback
function metaText(meta: Record<string, unknown>, key: string, fallback = "未记录") {
  const value = meta[key];
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}
```

---

## Summary Table: Quick Reference

| Aspect | Value | File | Line |
|--------|-------|------|------|
| Navigation trigger | `<Link href={demoHref(...)}` | pending-review-groups.tsx | 66 |
| Route pattern | `/runs/:runId` | routes.ts | 62 |
| Route key | `queue-review` | routes.ts | 62 |
| Page component | `ReviewPage` | review-page.tsx | 17 |
| Parameters component | `ReviewMetaCard` | review-meta-card.tsx | 154 |
| Initial open state | `useState(false)` | review-meta-card.tsx | 161 |
| Back button href | `/runs` | review-page.tsx | 34 |
| Filter count | 6 options | review-page.tsx | 56-62 |

