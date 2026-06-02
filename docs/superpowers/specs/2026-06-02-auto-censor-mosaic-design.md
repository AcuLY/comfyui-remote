# Auto-Censor Mosaic Design

## Goal

Replace the current latent replay censoring flow with an image post-processing
flow based on Wenaka2004/auto-censor. The new flow censors completed output
images directly with YOLO detection and mosaic masking, avoiding ComfyUI
re-generation drift from seed, LoRA, or conditioning changes.

## Current Flow To Remove

The existing censoring flow stores a latent during normal generation, then
uploads that latent back to ComfyUI during censoring. It selects the original
batch item, appends the mosaic LoRA, and re-runs KSampler2 with the original
stage-2 parameters. This produces visual drift and requires every image to have
a saved latent.

The replacement must remove this latent replay dependency completely:

- Remove `SaveLatent` from the standard workflow template and workflow builder.
- Stop downloading and persisting latent outputs after a run completes.
- Remove `Run.latentFilePath` from both Prisma schemas.
- Stop filtering censorable images by latent availability.
- Delete latent files/directories from disk only; keep projects, runs, original
  images, thumbnails, censored images, `ImageResult`, and `CensoringTask`.

## Target Auto-Censor Behavior

Use the auto-censor algorithm as an image post-processing step:

- Mode: mosaic only.
- Classes: `dick` and `pussy`.
- Mosaic size: `100`.
- Sticker mode is out of scope.
- No UI parameterization is required for this iteration.

The auto-censor source maps classes as:

- `0`: anus
- `1`: cum
- `2`: dick
- `3`: breasts
- `4`: pussy

Only classes `2` and `4` are selected.

## Architecture

Keep the existing app-level censoring surfaces and data model. Replace only the
execution backend.

Flow:

1. `CensoringTask` is created from the existing project or image censoring
   actions.
2. The censoring executor claims queued tasks as it does today.
3. The executor reads the source image from `ImageResult.filePath`.
4. The executor calls a repository-local Python CLI runner.
5. The runner loads the YOLO model, detects selected classes, applies mosaic
   masking to detected bounding boxes, and writes a temporary output image.
6. Node converts the output to the managed JPEG format, creates the thumbnail,
   and updates `ImageResult.censoredFilePath`, `censoredThumbPath`, and
   `censoredAt`.
7. The `CensoringTask` is marked done or failed.

The Python runner is intentionally non-GUI. It should extract the useful core
from `auto_mosaic_tool.py`, not include Tkinter, drag-and-drop, gallery UI, or
sticker behavior.

## Configuration

Add environment variables:

- `AUTO_CENSOR_MODEL_PATH`: absolute path to the YOLO `.pt` model file.
- `AUTO_CENSOR_PYTHON_CMD`: Python interpreter command or absolute path. This
  can point at a venv that has `ultralytics`, `opencv-python`, and `pillow`
  installed. If unset, the implementation may fall back to `python` or
  `python3`.

Do not commit the model file or hard-code machine-specific paths. The local
machine and `mypc` can each configure their own model path and Python command.

## Data Model Reuse

Reuse the existing data model:

- `ImageResult` remains the image record.
- `censoredFilePath`, `censoredThumbPath`, and `censoredAt` remain the censored
  output fields.
- `CensoringTask` remains the queue/progress/history table.

Do not introduce a new censoring table unless implementation discovers a strong
reason. The replacement is a backend change, not a product-level data model
change.

## Re-Censoring Behavior

Do not add a dedicated re-censor restriction.

Project-wide batch censoring should continue to target uncensored images by
default, so one-click project censoring does not overwrite existing censored
outputs accidentally.

Manual single-image or selected-image censoring may run against an already
censored image and overwrite its existing censored output paths. This keeps the
current manual workflow flexible without adding a separate re-censor button.

## Failure Handling

Task failures must not partially mark an image as censored.

Mark `CensoringTask.status = failed` and store a useful `errorMessage` when:

- `AUTO_CENSOR_MODEL_PATH` is missing.
- The model file cannot be read.
- The Python command cannot be spawned.
- Python dependencies are missing.
- YOLO model loading fails.
- The source image is missing or unreadable.
- The runner exits non-zero.
- Image post-processing or file writing fails.

If YOLO detects no selected `dick` or `pussy` boxes, treat the task as done by
writing a censored output that is visually identical to the source image. This
keeps export behavior consistent and allows logs to record `detections=0`.

## Latent Cleanup

The implementation should include a cleanup path for latent artifacts:

- Remove latent references from application code and Prisma schemas.
- Clean the database by dropping the `Run.latentFilePath` column.
- Delete only latent disk artifacts, such as `latents/` directories and
  `.latent` files produced by the old censoring flow.

Do not delete original generation images, thumbnails, existing censored images,
projects, runs, image results, or censoring task records.

## Testing

Add focused tests for behavior with modest scope:

- `censorImage` can enqueue images without `latentFilePath`.
- Project batch censoring no longer filters by latent availability.
- Project batch censoring still defaults to uncensored images.
- Manual image censoring can target an already censored image.
- Runner integration can be tested with a mock Python command or fixture output
  so test execution does not require a real YOLO model.

Add search-style regression checks or explicit tests for removed latent paths
where practical:

- No `SaveLatent` in the generated standard workflow.
- No `Run.latentFilePath` in Prisma schemas.
- No censoring dependency on `LoadLatent`, `LatentFromBatch`, or
  `illustrious_mosaic_censor_v2.safetensors`.

## Verification

After implementation:

1. Run the targeted tests.
2. Run the TypeScript test suite.
3. Run Prisma generation for the active provider after schema edits.
4. Verify a local censoring task can create a censored image from an existing
   source image when `AUTO_CENSOR_MODEL_PATH` and `AUTO_CENSOR_PYTHON_CMD` are
   configured.
5. Verify project export still includes censored outputs when present.

Deployment follows the project deployment rules for non-lightweight runtime and
schema changes.
