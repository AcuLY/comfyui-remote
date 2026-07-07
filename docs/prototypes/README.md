# Training Prototype Governance

`docs/prototypes/**` is source-of-truth only for training prototype intent, not production route behavior.

Production route behavior is owned by `src/app/training/[[...route]]/page.tsx`, `src/features/training/**`, and the matching Training API/service tests. These prototypes are retained as product/design intent references for page structure, density, visual hierarchy, and interaction vocabulary.

## Route Map

| prototype file | production training route | intent status | production owner |
| --- | --- | --- | --- |
| `docs/prototypes/manager-lora-training-runs-prototype.html` | `/training/runs` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-generation-detail-prototype.html` | `/training/runs/generation/:taskId` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-training-detail-prototype.html` | `/training/runs/training/:trainingRunId` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-projects-prototype.html` | `/training/projects` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-project-new-prototype.html` | `/training/projects/new` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-project-detail-prototype.html` | `/training/projects/:trainingProjectId` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-project-profile-prototype.html` | `/training/projects/:trainingProjectId/profile` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-project-sections-prototype.html` | `/training/projects/:trainingProjectId/sections` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-project-section-detail-prototype.html` | `/training/projects/:trainingProjectId/sections/:sectionId` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-generation-compose-prototype.html` | `/training/projects/:trainingProjectId/sections/:sectionId/generation-tasks/new` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-project-results-prototype.html` | `/training/projects/:trainingProjectId/results` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-project-dataset-prototype.html` | `/training/projects/:trainingProjectId/dataset` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-project-dataset-revision-prototype.html` | `/training/projects/:trainingProjectId/dataset/revisions/:revisionId` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-project-training-runs-prototype.html` | `/training/projects/:trainingProjectId/training-runs` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-project-generation-tasks-prototype.html` | `/training/projects/:trainingProjectId/generation-tasks` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-presets-prototype.html` | `/training/presets` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-preset-detail-prototype.html` | `/training/presets/:presetId` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-preset-sort-rules-prototype.html` | `/training/presets/sort-rules` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-templates-prototype.html` | `/training/templates` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-template-new-prototype.html` | `/training/templates/new` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-template-edit-prototype.html` | `/training/templates/:templateId/edit` | prototype intent | `src/features/training` |
| `docs/prototypes/manager-lora-training-template-section-prototype.html` | `/training/templates/:templateId/sections/:sectionIndex` | prototype intent | `src/features/training` |

## Shared Assets

These are prototype-only shared assets:

- `docs/prototypes/assets/lora-training-shared.css`
- `docs/prototypes/assets/lora-training-shared.js`
- `docs/prototypes/assets/images/lora-training-generation-result-output.png`
- `docs/prototypes/assets/images/lora-training-generation-result-thumb.png`
- `docs/prototypes/assets/fonts/geist-latin.woff2`

Do not import these assets from production CSS or src/**. Production training UI must use `src/features/training/**`, shared production components, and application assets instead of prototype CSS or prototype JavaScript.

Page-specific inline CSS in prototype HTML is allowed only for prototype layout exploration. Durable styling decisions must move into production modules or current UI docs before being treated as implementation guidance.

## Verification

```bash
node --import tsx --test tests/test-training-prototype-governance.test.ts tests/test-repo-inventory.test.ts
```

Run `npx tsx scripts/docs/generate-repo-inventory.ts` when prototype files are added, removed, or renamed.
