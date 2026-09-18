# Delivery quality

Local skill extension, derived from a product UI delivery retrospective. Use it when building or refining interactive UI, or reviewing why delivery required repeated corrections. This adds working guidance, not a new command, approval gate, detector pass, or requirement to change the interface during a documentation task.

Product-specific decisions belong in the project's current design contract and surface brief. Do not generalize one project's library, navigation order, theme policy, widths, touch dimensions, hover policy, or animation duration into defaults for other work.

## Before choosing an implementation

- Establish the current contract in the existing task or surface record: user purpose, entry points, supported contexts, action outcomes, and what remains undecided. Update this summary when the user changes a decision; preserve old records as history rather than asking the next worker to reconstruct the final state from successive overrides.
- Distinguish legitimate preference evolution from implementation defects. A newly requested theme policy or removed action does not prove the previous authorized behavior was wrong. Known user decisions take precedence and do not need repeated confirmation.
- Inspect the installed library version before building a standard interaction. Prefer a semantic component that owns the needed behavior, then public props, theme configuration, and slots. Explain which responsibilities remain with the app, such as routing, asynchronous commits, overlay dismissal, and resource identity.
- Combining several library buttons is not the same as reusing a complete navigation or selection component. Conversely, ordinary native links and buttons remain valid; do not replace them merely to increase library usage or force a component onto unrelated business semantics.
- Keep adaptation outside library internals where possible. Do not compensate for broken sizing with invisible click overlays, replace native focus indicators with decorative layers, or patch dependency source to preserve a speculative appearance.

## Design the whole interaction

Define the meaningful sequence before polishing one state:

`idle/current -> press -> release -> state commit -> transition complete -> repeat/cancel/reverse`

Check icon, text, background, font metrics, focus, and application state together. A press style ending before an asynchronous route notification can cause a default-color flash. A later font-weight change can still produce a second visual stage even when icon and text colors match. Do not claim the whole interaction is fixed after checking only one property.

Keep structure and text metrics stable unless their change is intentional. Use simple transitions when sufficient; use shared progress only when properties actually need strict synchronization. Preserve meaningful reduced-motion feedback. Do not turn immediate navigation selection into a rule to claim success for asynchronous saves or destructive operations.

Verify the integration of native components too: keyboard activation must update the actual address or business state, not just a highlighted item; opening an overlay must preserve the intended focus and dismissal behavior.

## Adapt structure and input together

- Decide whether each container fills its context, has a maximum width, or sizes to content. A form's useful width limit is not automatically the correct width for a bottom sheet.
- Judge useful operations against occupied space. Remove redundant headings, labels, empty rows, and excessive grouping before shrinking real hit targets.
- Compare neighboring controls as a group. Inspect the root hit area and points inside the visible shape near its edges, not only successful activation at the icon center. Keep keyboard focus visible and reachable.
- Distinguish viewport width from input capability. Follow the product's adopted mouse, touch, keyboard, and hover rules; a narrow desktop screenshot is not evidence of a real touch interaction.
- Theme checks include neutral surfaces, separators, borders, overlays, pressed and selected states, and focus. Existing tokens and compiled library styles may have different scopes; changing an accent alone does not prove every state uses it correctly.

## Select evidence to match the change

Use the skill's bounded review passes. Batch relevant checks, fix their causes together, and confirm the affected path. A known reproduced defect or new user feedback warrants targeted follow-up; do not reopen unrelated aesthetic exploration or label unresolved failures complete.

| Change | Useful evidence |
| --- | --- |
| Local static copy or styling | The changed element, its neighbors, and the most affected small context |
| Layout, sizing, or fixed regions | Representative wide, narrow, and intermediate contexts; breakpoint edges, short landscape, and safe areas where relevant |
| Theme or interaction states | Representative combinations that exercise shared styles, plus the actual interaction sequence |
| Motion | Intermediate frames, cancellation or rapid reversal, and reduced motion; name the properties observed |
| Component or routing changes | Pointer and keyboard use, actual URL/state, back/refresh, overlay behavior, and focus return |

Do not turn this table into a cartesian product of every device, theme, browser, network condition, and state. Use the supported product scope and the risks introduced by the change. Do not invent loading or error states for controls that cannot enter them.

## Keep claims inside their evidence

- A successful build, documentation test, or detector scan does not establish visual or interaction quality.
- No horizontal overflow does not establish comfortable spacing or efficient use of the viewport.
- Matching animation endpoints do not establish a smooth path between them.
- One successful click does not establish the full visible hit area.
- Color continuity does not establish stable font weight, a background transition, or correct keyboard behavior.
- A screenshot with known scaling distortion needs an explicit limitation. DOM geometry can supplement dimensions; it cannot replace visual judgment about hierarchy, space, and readability.

Report what changed, what was actually exercised, remaining limits, and the delivery state. Keep implementation, validation, commit, publication, and user design approval distinct. For a retrospective or guidance-only request, use the available conversation and version evidence; do not silently expand it into a live UI audit or another implementation round.
