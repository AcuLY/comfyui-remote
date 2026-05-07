# ComfyUI Manager Design System

Updated: 2026-05-05

This product UI uses a calm dual-theme workspace aesthetic: soft gradient atmosphere, translucent glass surfaces, compact data density, and restrained green actions. Light mode is the primary reference tone; dark mode should feel like the same product translated to dark surfaces, not a separate visual identity.

Reference baseline: the `/design-demos/runs/[runId]` review page. If this document conflicts with that page, follow the page first: fixed left navigation, useful content on the first screen, compact run metadata, a parameter information strip, and a focused review board for image decisions.

## 1. Visual Direction

- Base atmosphere: pale gray-blue canvas with slow, low-contrast emerald and rose radial gradients. Dark mode keeps the same shape, spacing, and accent logic with zinc-like dark surfaces.
- Material: frosted glass surfaces using translucent fills, fine borders, and `backdrop-filter: blur(20px) saturate(140%)`. The glass should read as quiet utility, not decorative shine.
- Depth: mostly border and blur; shadows are soft and shallow, used only to separate floating surfaces from the gradient background.
- Shape: low-to-medium radius. Small controls use 6-10px; major surfaces use 10-16px; badges can be pill-shaped.
- Density: workbench pages stay compact. Use rows, dividers, tool strips, inspectors, and collapsible metadata before adding more cards.
- Accent: green is the primary action/active color; rose is a secondary categorization color. Do not introduce broad decorative hue families.
- Tone: production tool, not showcase. The UI should sound and look direct: real product nouns, current state, next action, no demo language.

## 2. Color Tokens

### Light Theme

- Canvas: `#f7f9fb`
- Surface glass: `rgba(255, 255, 255, 0.68-0.78)`
- Surface hover: `rgba(255, 255, 255, 0.84-0.92)`
- Primary text: `#16181d`
- Secondary text: `#59616d`
- Tertiary text: `#7f8792`
- Border: `rgba(19, 24, 32, 0.075-0.18)`
- Primary green: `#047857` for text on light surfaces, with `rgba(4, 120, 87, 0.10)` backgrounds.
- Secondary rose: `#f472b6` / `rgba(244, 114, 182, 0.08)` for non-primary categories.

### Dark Theme

- Canvas: `#09090b`
- Surface glass: `rgba(24, 24, 27, 0.52-0.72)`
- Surface hover: `rgba(39, 39, 42, 0.78-0.82)`
- Primary text: `#fafafa`
- Secondary text: `#a1a1aa`
- Tertiary text: `#71717a`
- Border: `rgba(255, 255, 255, 0.08-0.14)`
- Primary green: `#34d399`
- Secondary rose: `#f9a8d4`

Dark mode exists for operator comfort. It should preserve the light-mode hierarchy and information density; do not turn it into a terminal, cyber, or high-glow style.

## 3. Background And Material

Use a real background system instead of flat page color:

```css
background:
  linear-gradient(180deg, rgba(255,255,255,.9), transparent 24rem),
  radial-gradient(circle at 20% 30%, rgba(16,185,129,.12), transparent 50%),
  radial-gradient(circle at 80% 70%, rgba(244,114,182,.08), transparent 52%);
```

Primary surfaces should be glass:

```css
background: rgba(255, 255, 255, 0.68);
border: 1px solid rgba(15, 23, 42, 0.075);
backdrop-filter: blur(20px) saturate(140%);
box-shadow: 0 18px 54px rgba(15, 23, 42, 0.10);
```

On dark theme, keep the same material model but swap the fill to translucent zinc, not solid black.

For review pages, the main surface should stay readable as one work area: header, metadata strip, tab/filter row, image board, and action strip. Avoid splitting every small group into standalone floating cards.

## 4. Typography

- Use the app's existing sans stack. Do not add a new web font for the routed shell.
- Page titles: 18-24px, 560-620 weight. Avoid oversized hero typography inside tools.
- Panel and row titles: 12-14px, 540-600 weight.
- Metadata and helper text: 10-12px, normal or medium weight.
- Letter spacing should stay near zero. Avoid heavy bold labels in dense work areas.

## 5. Layout Rules

- The app is a workbench, not a landing page. The first screen should be useful content.
- Desktop keeps global navigation on the left, fixed for the full viewport height. The selected nav item uses a soft green fill/border and stays visually calmer than the page content.
- Desktop global tools should live inside the left navigation or the current page header; avoid a separate floating topbar over every page.
- Project and template work pages can add a context rail on the right for section navigation.
- Mobile keeps only bottom navigation for `任务 / 项目 / 更多`; avoid duplicate global menu buttons.
- Prefer one main surface per work area. Inside it, use rows, strips, lists, and dividers.
- Do not put cards inside cards. If content already lives in a surface, inner items should be row-like.
- On mobile, preserve the two-column preset workflow only when it improves scanning; otherwise collapse the editor to a dedicated page.

### Review Page Pattern

- Page header: back link first, then a small status eyebrow, compact title, one-line state summary, and right-aligned outline actions.
- Parameter information: place directly below the page header. Collapsed state should show run id, title, section/date, and key generation facts such as ratio, size, batch, and upscale. Expanded state can use dense internal grids for KSampler, checkpoint/workflow, LoRA, prompt, and negative prompt.
- Review board: one main glass surface with tabs at the top, selection controls near the grid, thumbnails in stable aspect-ratio tiles, and batch actions in a bottom action strip.
- Keep image review decisions obvious but light: keep, p站, preview, cover, delete, and undo use soft semantic color, icon, and border treatment rather than large filled blocks.

## 6. Components

- Buttons: glass or transparent surface, 1px border, 36px minimum height. Primary actions use green text/border or a very soft green fill, not a heavy solid fill.
- Badges: pill shape, translucent fill, small text. Use color to classify, not to decorate.
- Back links: lightweight text/icon links in the page header area. They should not compete with primary actions.
- Panels: one glass surface with a compact header and row-based body. Parameter panels can be collapsible; their closed state should still expose the facts needed to understand the run.
- Tables/lists: row dividers are preferred over repeated nested cards.
- Tabs and filters: compact segmented rows with small count pills. Active state uses the green token softly; inactive items should stay quiet.
- Image grids: keep thumbnails stable with fixed aspect ratios; selection should use border/ring plus a small control, not large color overlays.
- Modals/sheets: use stronger glass background and shadow, with a dim backdrop. Keep action buttons in the footer.

## 7. Motion

- Hover: subtle translate up by 1-2px, border-color shift, slightly stronger shadow.
- Theme/background movement: slow and low contrast.
- Avoid aggressive scale, glow, or animated gradients on every component.
- Respect reduced-motion by disabling nonessential transitions.

## 8. Do And Do Not

Do:

- Treat the current run review page as the tone reference for `/design-demos`.
- Use frosted surfaces consistently across navigation, panels, sheets, and controls.
- Keep green and rose accents soft and sparse.
- Maintain compact workbench density with clear row hierarchy.
- Use real product nouns in UI copy; avoid demo/mock/explanatory language.
- Keep styles scoped to the relevant module when building prototypes.

Do not:

- Let dark mode become a different product style from light mode.
- Return to pure near-black solid panels as the main product look.
- Use card-inside-card hierarchy for workbench content.
- Use large decorative hero sections for tool pages.
- Use heavy borders or solid accent fills everywhere.
- Modify `src/app/globals.css` for `/design-demos` visual experiments.

## 9. Implementation Notes For `/design-demos`

- The routed demo shell should use this glass system while keeping all CSS inside `src/app/design-demos/**`.
- Existing parity work should stay intact: `/runs`, `/projects`, `/presets`, `/models`, `/templates`, and settings routes remain routeable.
- The shell can use mock data, but visible UI should read as final product state.
- Validation should include TypeScript, targeted ESLint, in-app browser checks on desktop/mobile widths, and a clean `git diff -- src/app/globals.css`.
- For visual validation, include `/design-demos/runs` and `/design-demos/runs/[runId]`; check both theme states when a change touches shared shell tokens.
