# Bulk Preset Section Replacement Design

## Goal

Add a current-project/current-template tool for replacing imported preset bindings in all sections, with multi-rule Dry Run and Apply. Also fix the existing consistency bug where editing preset-derived LoRA keeps the section bound to the original preset.

## Confirmed Scope

- Project entry: the current project detail page replaces bindings in all sections of that project.
- Template entry: the current template edit page replaces bindings in all sections of that template.
- The tool does not scan all projects or all templates globally.
- Replacement only targets ordinary imported preset bindings where `presetId` equals the source preset.
- Replacement does not target preset-group virtual member rows or preset group definitions.
- If no section imports the source preset, the rule is a valid no-op.

## Existing Behavior To Fix

Project prompt editing already detaches imported preset bindings: editing a preset prompt block changes the prompt row to custom, clears `sectionBindingId`, and deletes the matching `SectionPresetBinding`.

Template prompt editing already follows the same concept in client state: editing a preset prompt block turns it into a custom block and clears `sourceId`, `variantId`, `categoryId`, `bindingId`, and `groupBindingId`.

LoRA editing is currently inconsistent. Project LoRA changes persist manual rows but can keep them attached to the original `SectionPresetBinding`; template LoRA changes can similarly keep binding identity in state unless the prompt block is edited. After the fix, local LoRA edits to preset-derived entries must detach from the preset binding and remain as independent manual LoRA entries. Once detached, those local edits no longer count as "section imports preset A" for replacement.

## Replacement Rules

Each replacement rule contains:

- `fromPresetId`
- `toPresetId`
- optional `toVariantId`

Validation:

- Both presets must exist and be active.
- Both presets must have the same `categoryId`.
- If `toVariantId` is provided, it must belong to `toPresetId` and be active.
- If `toVariantId` is omitted, use the first active variant of `toPresetId` by `sortOrder`.
- If the target preset has no active variant, the rule blocks Apply.
- Duplicate or conflicting source rules block Apply because a source preset can only map to one target in one operation.

Dry Run:

- Does not write the database.
- Returns a per-rule plan with planned update count, affected sections, and blockers.
- Rules with zero affected sections are reported as no-op and do not block Apply.

Apply:

- Requires a fresh successful Dry Run for the current rules.
- Updates only binding rows that still reference `fromPresetId`.
- Preserves section order, `bindingKey`, `groupBindingKey`, `sortOrder`, and surrounding prompt/manual LoRA rows.
- Updates `presetId` and `variantId`; `categoryId` remains unchanged because cross-category replacement is rejected.
- Re-runs Dry Run after Apply. Success means planned update count is now zero.

## Data Model

Project sections use `SectionPresetBinding`.

Template sections use `TemplateSectionPresetBinding`.

The service should handle both with a shared planner:

- `targetType: "project" | "template"`
- `targetId: string`
- `rules: ReplacementRule[]`
- `dryRun: boolean`

The planner should return a normalized result shape so the UI can render project and template results with the same dialog component.

## UI Design

Add a `批量替换预制` button to:

- Current project detail toolbar.
- Current template edit toolbar.

Dialog behavior:

- Scope text says either `当前项目全部小节` or `当前模板全部小节`.
- Starts with one replacement row.
- User can add/remove rows.
- Each row selects A, then locks B choices to A's category.
- B variant is optional; if blank, the backend default active variant rule applies.
- Changing any rule clears previous Dry Run and disables Apply until Dry Run is run again.
- Dry Run renders total planned updates, per-rule counts, affected section names, no-op rows, and blockers.
- Apply asks for confirmation and then refreshes the current page.
- Apply result shows post-apply verification status.

## Error Handling

Dry Run returns validation blockers in structured form rather than partially applying.

Apply must reject stale or invalid payloads. If the current database state changed after Dry Run, Apply may update fewer rows than previewed, but the post-apply verification must make that visible.

No-op rules should not throw. They should be visible so the user knows nothing matched.

## Tests

LoRA detach tests:

- Project section: editing preset-derived LoRA converts it to manual LoRA and removes the preset binding relationship from local edits.
- Template section: editing preset-derived LoRA converts it to manual LoRA state and clears binding identity from local edits.

Planner/service tests:

- Dry Run reports ordinary project section binding replacements.
- Dry Run reports ordinary template section binding replacements.
- Apply updates project bindings from A to B with default target variant.
- Apply updates template bindings from A to B with explicit target variant.
- No source matches returns no-op without blocking.
- Cross-category A/B blocks Apply.
- Inactive or wrong target variant blocks Apply.
- Duplicate source rules block Apply.
- Preset group member rows are not treated as replaceable ordinary bindings.

UI/API glue tests:

- Project toolbar opens the dialog with project scope.
- Template toolbar opens the dialog with template scope.
- Rule changes clear previous Dry Run.
- Apply is disabled until a successful Dry Run exists.

## Non-Goals

- No global all-project/all-template replacement.
- No mutation of preset group definitions or group members.
- No automatic migration of already-detached custom prompt blocks.
- No deployment behavior is implied by this design; implementation should follow the repository's normal commit/deploy rules for the actual code change.
