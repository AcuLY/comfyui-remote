# Auto-Censor Mosaic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace latent replay censoring with YOLO-based mosaic post-processing, while removing latent persistence and preserving the existing censoring queue/output model.

**Architecture:** Keep `CensoringTask` and `ImageResult` as the app-facing model. Add a non-GUI Python runner that applies Wenaka2004/auto-censor mosaic behavior to source images, and have the Node censoring service call it instead of submitting ComfyUI prompts. Remove old latent schema, workflow, and persistence code.

**Tech Stack:** Next.js 16, TypeScript, Prisma 7, Node `child_process`, Python CLI with `ultralytics` and `opencv-python`, `sharp`, Node test runner.

---

## File Structure

- Create `scripts/auto-censor-mosaic.py`: non-GUI Python CLI. Reads source image, model path, selected classes, mosaic size, and output path; writes processed image and JSON stats.
- Create `src/server/services/auto-censor-runner.ts`: TypeScript wrapper around the Python CLI. Validates env, spawns Python, parses runner JSON, and returns output metadata.
- Modify `src/lib/env.ts`: add `autoCensorModelPath` and `autoCensorPythonCmd`.
- Modify `src/server/services/censoring-service.ts`: replace ComfyUI latent prompt submission/polling with direct image post-processing and managed output persistence.
- Modify `src/server/services/censoring-executor.ts`: keep queue semantics, but active task tracking no longer needs ComfyUI prompt cancellation for the new runner.
- Modify `src/lib/actions/censoring.ts`: remove `latentFilePath` checks and filters; keep project batch default to `censoredAt: null`.
- Modify `src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx`: keep manual selected-image censoring flexible; update stale comment text.
- Modify `src/server/services/workflow-prompt-builder.ts` and `docs/workflow.api.json`: remove `SaveLatent`.
- Modify `src/server/services/comfyui-service.ts`, `src/server/services/image-result-service.ts`, `src/server/services/run-executor.ts`, and `src/server/worker/repository.ts`: remove latent output extraction and persistence.
- Modify `prisma/schema.prisma` and `prisma/schema.sqlite.prisma`: remove `Run.latentFilePath`.
- Modify `.env.example` and `README.md`: document the new auto-censor env variables and Python dependencies.
- Add tests under `tests/`: source-level and runner-wrapper tests that do not require a real YOLO model.

---

### Task 1: Add Environment Config And Runner Wrapper

**Files:**
- Create: `src/server/services/auto-censor-runner.ts`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`
- Test: `tests/test-auto-censor-runner.test.ts`

- [ ] **Step 1: Write the failing runner env test**

Create `tests/test-auto-censor-runner.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("auto-censor env variables are exposed in env config", () => {
  const envSource = readSource("src/lib/env.ts");

  assert.match(envSource, /autoCensorModelPath:\s*process\.env\.AUTO_CENSOR_MODEL_PATH/);
  assert.match(envSource, /autoCensorPythonCmd:\s*process\.env\.AUTO_CENSOR_PYTHON_CMD/);
});

test("auto-censor runner passes fixed mosaic settings to the Python CLI", () => {
  const runnerSource = readSource("src/server/services/auto-censor-runner.ts");

  assert.match(runnerSource, /AUTO_CENSOR_SELECTED_CLASSES\s*=\s*\[2,\s*4\]/);
  assert.match(runnerSource, /AUTO_CENSOR_MOSAIC_SIZE\s*=\s*100/);
  assert.match(runnerSource, /--classes/);
  assert.match(runnerSource, /2,4/);
  assert.match(runnerSource, /--mosaic-size/);
});

test("auto-censor documentation names model path and python command env vars", () => {
  const exampleEnv = readSource(".env.example");

  assert.match(exampleEnv, /AUTO_CENSOR_MODEL_PATH/);
  assert.match(exampleEnv, /AUTO_CENSOR_PYTHON_CMD/);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- tests/test-auto-censor-runner.test.ts
```

Expected: FAIL because `auto-censor-runner.ts` does not exist and `env.ts` has no auto-censor keys.

- [ ] **Step 3: Add env keys**

Patch `src/lib/env.ts` inside the exported `env` object after `characterLoraArtifactRoot`:

```ts
  autoCensorModelPath: process.env.AUTO_CENSOR_MODEL_PATH ?? "",
  autoCensorPythonCmd: process.env.AUTO_CENSOR_PYTHON_CMD ?? "",
```

- [ ] **Step 4: Create the runner wrapper**

Create `src/server/services/auto-censor-runner.ts`:

```ts
import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { env } from "@/lib/env";

export const AUTO_CENSOR_SELECTED_CLASSES = [2, 4] as const;
export const AUTO_CENSOR_MOSAIC_SIZE = 100;

export type AutoCensorRunInput = {
  sourcePath: string;
  outputPath: string;
  timeoutMs?: number;
};

export type AutoCensorRunResult = {
  detections: number;
  selectedDetections: number;
  outputPath: string;
};

type RunnerJson = {
  detections?: unknown;
  selectedDetections?: unknown;
};

function pythonCommand() {
  return env.autoCensorPythonCmd.trim() || "python3";
}

function scriptPath() {
  return resolve(process.cwd(), "scripts", "auto-censor-mosaic.py");
}

function parseRunnerJson(stdout: string): AutoCensorRunResult {
  const lastLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (!lastLine) {
    throw new Error("auto-censor runner produced no JSON output");
  }

  let parsed: RunnerJson;
  try {
    parsed = JSON.parse(lastLine) as RunnerJson;
  } catch {
    throw new Error(`auto-censor runner output was not JSON: ${lastLine}`);
  }

  const detections = Number(parsed.detections ?? 0);
  const selectedDetections = Number(parsed.selectedDetections ?? 0);

  return {
    detections: Number.isFinite(detections) ? detections : 0,
    selectedDetections: Number.isFinite(selectedDetections) ? selectedDetections : 0,
    outputPath: "",
  };
}

export async function runAutoCensorMosaic(
  input: AutoCensorRunInput,
): Promise<AutoCensorRunResult> {
  if (!env.autoCensorModelPath.trim()) {
    throw new Error("AUTO_CENSOR_MODEL_PATH is not configured");
  }

  const sourcePath = resolve(process.cwd(), input.sourcePath);
  const outputPath = resolve(process.cwd(), input.outputPath);
  const modelPath = env.autoCensorModelPath;

  await access(sourcePath);
  await access(modelPath);
  await mkdir(dirname(outputPath), { recursive: true });

  const args = [
    scriptPath(),
    "--model",
    modelPath,
    "--input",
    sourcePath,
    "--output",
    outputPath,
    "--classes",
    AUTO_CENSOR_SELECTED_CLASSES.join(","),
    "--mosaic-size",
    String(AUTO_CENSOR_MOSAIC_SIZE),
  ];

  const timeoutMs = input.timeoutMs ?? 120_000;

  return await new Promise<AutoCensorRunResult>((resolveResult, reject) => {
    const child = spawn(pythonCommand(), args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`auto-censor runner timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`failed to start auto-censor runner: ${error.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`auto-censor runner failed (${code}): ${stderr.trim() || stdout.trim()}`));
        return;
      }

      try {
        const parsed = parseRunnerJson(stdout);
        resolveResult({ ...parsed, outputPath: input.outputPath });
      } catch (error) {
        reject(error);
      }
    });
  });
}
```

- [ ] **Step 5: Document env variables**

Add this block to `.env.example` under the file path section:

```dotenv
# ---------------------------------------------------------------------------
# 自动打码（YOLO 后处理）
# ---------------------------------------------------------------------------
# YOLO .pt 模型绝对路径；模型文件不进入仓库
AUTO_CENSOR_MODEL_PATH=""
# Python/venv 解释器路径；需安装 ultralytics、opencv-python、pillow
AUTO_CENSOR_PYTHON_CMD=""
```

- [ ] **Step 6: Run the test**

Run:

```bash
npm test -- tests/test-auto-censor-runner.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/lib/env.ts src/server/services/auto-censor-runner.ts .env.example tests/test-auto-censor-runner.test.ts
git commit -m "feat: add auto-censor runner config"
```

---

### Task 2: Add Non-GUI Python Mosaic Runner

**Files:**
- Create: `scripts/auto-censor-mosaic.py`
- Test: `tests/test-auto-censor-python-script.test.ts`

- [ ] **Step 1: Write the failing source-level script test**

Create `tests/test-auto-censor-python-script.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("auto-censor Python runner is CLI-only and uses YOLO plus OpenCV mosaic", () => {
  const source = readSource("scripts/auto-censor-mosaic.py");

  assert.match(source, /from ultralytics import YOLO/);
  assert.match(source, /import cv2/);
  assert.match(source, /def create_mosaic/);
  assert.match(source, /block_size = max\(1, int\(mosaic_size \* 0\.1\)\)/);
  assert.match(source, /argparse\.ArgumentParser/);
  assert.match(source, /selected_classes/);
  assert.doesNotMatch(source, /tkinter/);
  assert.doesNotMatch(source, /TkinterDnD/);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- tests/test-auto-censor-python-script.test.ts
```

Expected: FAIL because `scripts/auto-censor-mosaic.py` does not exist.

- [ ] **Step 3: Create the Python runner**

Create `scripts/auto-censor-mosaic.py`:

```py
#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

import cv2
from ultralytics import YOLO


def parse_classes(value: str) -> set[int]:
    classes: set[int] = set()
    for item in value.split(","):
        item = item.strip()
        if not item:
            continue
        classes.add(int(item))
    return classes


def create_mosaic(roi, mosaic_size: int):
    block_size = max(1, int(mosaic_size * 0.1))
    height, width = roi.shape[:2]
    small_width = max(1, width // block_size)
    small_height = max(1, height // block_size)
    small = cv2.resize(roi, (small_width, small_height), interpolation=cv2.INTER_LINEAR)
    return cv2.resize(small, (width, height), interpolation=cv2.INTER_NEAREST)


def run(model_path: Path, input_path: Path, output_path: Path, selected_classes: set[int], mosaic_size: int):
    image = cv2.imread(str(input_path))
    if image is None:
        raise RuntimeError(f"failed to read input image: {input_path}")

    model = YOLO(str(model_path))
    results = model(image)
    detections = 0
    selected_detections = 0

    for result in results:
        for box in result.boxes:
            cls = int(box.cls[0].cpu().numpy())
            if cls < 0:
                continue
            detections += 1
            if cls not in selected_classes:
                continue

            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            height, width = image.shape[:2]
            left = max(0, int(x1))
            top = max(0, int(y1))
            right = min(width, int(x2))
            bottom = min(height, int(y2))
            if right <= left or bottom <= top:
                continue

            roi = image[top:bottom, left:right]
            image[top:bottom, left:right] = create_mosaic(roi, mosaic_size)
            selected_detections += 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output_path), image):
        raise RuntimeError(f"failed to write output image: {output_path}")

    return {
        "detections": detections,
        "selectedDetections": selected_detections,
        "output": str(output_path),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply YOLO-based mosaic censoring to one image.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--classes", required=True)
    parser.add_argument("--mosaic-size", required=True, type=int)
    args = parser.parse_args()

    try:
        stats = run(
            model_path=Path(args.model),
            input_path=Path(args.input),
            output_path=Path(args.output),
            selected_classes=parse_classes(args.classes),
            mosaic_size=args.mosaic_size,
        )
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1

    print(json.dumps(stats, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run the script test**

Run:

```bash
npm test -- tests/test-auto-censor-python-script.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add scripts/auto-censor-mosaic.py tests/test-auto-censor-python-script.test.ts
git commit -m "feat: add auto-censor mosaic python runner"
```

---

### Task 3: Replace Censoring Service Backend

**Files:**
- Modify: `src/server/services/censoring-service.ts`
- Modify: `src/server/services/censoring-executor.ts`
- Modify: `src/lib/actions/censoring.ts`
- Modify: `src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx`
- Test: `tests/test-auto-censor-service-source.test.ts`

- [ ] **Step 1: Write failing source-level service tests**

Create `tests/test-auto-censor-service-source.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("censoring service uses auto-censor runner instead of ComfyUI latent replay", () => {
  const source = readSource("src/server/services/censoring-service.ts");

  assert.match(source, /runAutoCensorMosaic/);
  assert.match(source, /processCensorTask/);
  assert.doesNotMatch(source, /submitCensorPrompt/);
  assert.doesNotMatch(source, /pollCensorCompletion/);
  assert.doesNotMatch(source, /buildLatentCensorWorkflow/);
  assert.doesNotMatch(source, /LoadLatent/);
  assert.doesNotMatch(source, /LatentFromBatch/);
  assert.doesNotMatch(source, /illustrious_mosaic_censor_v2/);
});

test("censoring actions do not require latentFilePath and project batch defaults to uncensored images", () => {
  const source = readSource("src/lib/actions/censoring.ts");

  assert.doesNotMatch(source, /latentFilePath/);
  assert.match(source, /censoredAt:\s*null/);
  assert.match(source, /reviewStatus:\s*\{\s*in:\s*reviewStatuses/);
});

test("manual selected-image censoring keeps re-censor flexibility without stale re-censor comment", () => {
  const source = readSource("src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx");

  assert.doesNotMatch(source, /including re-censor/);
  assert.match(source, /runSelectedIds\.includes\(img\.id\)/);
});
```

- [ ] **Step 2: Run the failing service tests**

Run:

```bash
npm test -- tests/test-auto-censor-service-source.test.ts
```

Expected: FAIL because service code still contains latent replay and actions still reference `latentFilePath`.

- [ ] **Step 3: Replace `censoring-service.ts` with image post-processing service**

Rewrite `src/server/services/censoring-service.ts` to this shape:

```ts
import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { runAutoCensorMosaic } from "@/server/services/auto-censor-runner";

const log = createLogger({ module: "censoring" });
const THUMBNAIL_WIDTH = 300;

type ImageResultForCensor = {
  id: string;
  filePath: string;
  reviewStatus: string;
};

async function atomicWriteFile(targetPath: string, data: Buffer): Promise<void> {
  const tempPath = `${targetPath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, data);

  try {
    await unlink(targetPath);
  } catch (error) {
    if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  try {
    await rename(tempPath, targetPath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

function censoredPathsForSource(filePath: string) {
  if (filePath.includes("/raw/")) {
    return {
      censoredFilePath: filePath.replace("/raw/", "/censored/"),
      censoredThumbPath: filePath.replace("/raw/", "/censored-thumb/"),
    };
  }

  const suffix = filePath.split("/").pop() ?? `${randomUUID()}.jpg`;
  const base = `data/images/censored/${randomUUID()}`;
  return {
    censoredFilePath: `${base}/${suffix}`,
    censoredThumbPath: `${base}/thumb-${suffix.replace(/\.[^.]+$/, ".jpg")}`,
  };
}

async function persistCensoredImage(imageResult: ImageResultForCensor, sourceImagePath: string) {
  const { censoredFilePath, censoredThumbPath } = censoredPathsForSource(imageResult.filePath);

  const rawOutputBuffer = await sharp(sourceImagePath).rotate().toBuffer();
  const { data: jpegBuffer } = await sharp(rawOutputBuffer)
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  const censoredAbsPath = resolve(process.cwd(), censoredFilePath);
  await mkdir(dirname(censoredAbsPath), { recursive: true });
  await atomicWriteFile(censoredAbsPath, jpegBuffer);

  const thumbBuffer = await sharp(jpegBuffer)
    .resize({ width: THUMBNAIL_WIDTH })
    .jpeg({ quality: 80 })
    .toBuffer();

  const censoredThumbAbsPath = resolve(process.cwd(), censoredThumbPath);
  await mkdir(dirname(censoredThumbAbsPath), { recursive: true });
  await atomicWriteFile(censoredThumbAbsPath, thumbBuffer);

  await prisma.imageResult.update({
    where: { id: imageResult.id },
    data: {
      censoredFilePath,
      censoredThumbPath,
      censoredAt: new Date(),
    },
  });

  return { censoredFilePath, censoredThumbPath };
}

export async function processCensorTask(imageResultId: string): Promise<void> {
  const imageResult = await prisma.imageResult.findUnique({
    where: { id: imageResultId },
    select: {
      id: true,
      filePath: true,
      reviewStatus: true,
    },
  });

  if (!imageResult) {
    throw new Error(`ImageResult not found: ${imageResultId}`);
  }

  if (imageResult.reviewStatus !== "kept" && imageResult.reviewStatus !== "pending") {
    throw new Error(
      `ImageResult ${imageResultId} has status "${imageResult.reviewStatus}", expected "kept" or "pending"`,
    );
  }

  const sourceAbsPath = resolve(process.cwd(), imageResult.filePath);
  await access(sourceAbsPath);

  const tempOutputPath = `data/images/.tmp/auto-censor-${imageResult.id}-${randomUUID()}.png`;
  const tempAbsPath = resolve(process.cwd(), tempOutputPath);

  try {
    const result = await runAutoCensorMosaic({
      sourcePath: imageResult.filePath,
      outputPath: tempOutputPath,
    });

    const persisted = await persistCensoredImage(imageResult, tempAbsPath);
    log.info("Censoring complete", {
      imageResultId: imageResult.id,
      censoredFilePath: persisted.censoredFilePath,
      detections: result.detections,
      selectedDetections: result.selectedDetections,
    });
  } finally {
    await unlink(tempAbsPath).catch(() => {});
  }
}

export async function censorSingleImage(imageResultId: string): Promise<void> {
  await processCensorTask(imageResultId);
}
```

- [ ] **Step 4: Update executor to process tasks directly**

In `src/server/services/censoring-executor.ts`:

1. Replace imports:

```ts
import { processCensorTask } from "@/server/services/censoring-service";
```

2. Remove imports for `submitCensorPrompt`, `pollCensorCompletion`, `clearComfyQueueSnapshotCache`, `deleteComfyQueueItems`, `getComfyQueuePosition`, and `interruptComfyPrompt`.

3. Replace active task tracking with direct processing. Keep `recoverStaleCensoringTasks`, `processingLoop`, `wakeUpCensoringProcessor`, and pause/resume behavior. In `submitQueuedTasks`, after claiming a task, call:

```ts
await processCensorTask(task.imageResultId);
await prisma.censoringTask.updateMany({
  where: { id: task.id, status: "running" },
  data: { status: "done", finishedAt: new Date(), errorMessage: null },
});
```

4. On error, keep the existing failure update:

```ts
await prisma.censoringTask.update({
  where: { id: task.id },
  data: { status: "failed", errorMessage: message, finishedAt: new Date() },
}).catch(() => {});
```

5. Remove ComfyUI prompt cancellation for censoring tasks. Existing `cancelCensoringTasks` can still mark tasks `cancelled`; it no longer needs to interrupt ComfyUI.

- [ ] **Step 5: Remove latent requirements from actions**

In `src/lib/actions/censoring.ts`:

1. In `censorImage`, change the include to:

```ts
include: { run: { select: { id: true, projectId: true } } },
```

2. Delete this block:

```ts
if (!image.run.latentFilePath) {
  return { success: false, message: "此图片不支持打码（无潜空间文件）" };
}
```

3. In `censorProjectImages`, remove `latentFilePath: { not: null }` from both `run` filters so they become:

```ts
run: { projectId },
```

4. Keep `censoredAt: null` in project batch filters.

- [ ] **Step 6: Update stale UI comment**

In `src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx`, replace:

```ts
// Censor: if selected → censor selected kept (including re-censor); else → censor all uncensored kept in run
```

with:

```ts
// Censor selected kept/pending images; without a selection, censor uncensored kept/pending images in this run.
```

- [ ] **Step 7: Run service tests**

Run:

```bash
npm test -- tests/test-auto-censor-service-source.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/server/services/censoring-service.ts src/server/services/censoring-executor.ts src/lib/actions/censoring.ts 'src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx' tests/test-auto-censor-service-source.test.ts
git commit -m "feat: process censoring with auto-censor mosaic"
```

---

### Task 4: Remove Latent Persistence From Generation

**Files:**
- Modify: `src/server/services/workflow-prompt-builder.ts`
- Modify: `docs/workflow.api.json`
- Modify: `src/server/services/comfyui-service.ts`
- Modify: `src/server/services/image-result-service.ts`
- Modify: `src/server/services/run-executor.ts`
- Modify: `src/server/worker/repository.ts`
- Test: `tests/test-latent-cleanup-source.test.ts`

- [ ] **Step 1: Write failing latent cleanup source tests**

Create `tests/test-latent-cleanup-source.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("standard workflow and builder no longer save latents", () => {
  const workflow = readSource("docs/workflow.api.json");
  const builder = readSource("src/server/services/workflow-prompt-builder.ts");

  assert.doesNotMatch(workflow, /SaveLatent/);
  assert.doesNotMatch(builder, /SaveLatent/);
  assert.doesNotMatch(builder, /latents\//);
});

test("run executor no longer extracts or persists latent outputs", () => {
  const executor = readSource("src/server/services/run-executor.ts");
  const comfy = readSource("src/server/services/comfyui-service.ts");
  const imageService = readSource("src/server/services/image-result-service.ts");
  const workerRepo = readSource("src/server/worker/repository.ts");

  assert.doesNotMatch(executor, /extractLatentOutputs/);
  assert.doesNotMatch(executor, /downloadAndPersistLatent/);
  assert.doesNotMatch(comfy, /extractLatentOutputs/);
  assert.doesNotMatch(imageService, /downloadAndPersistLatent/);
  assert.doesNotMatch(workerRepo, /latentFilePath/);
});
```

- [ ] **Step 2: Run the failing cleanup tests**

Run:

```bash
npm test -- tests/test-latent-cleanup-source.test.ts
```

Expected: FAIL because latent persistence is still present.

- [ ] **Step 3: Remove `SaveLatent` from workflow builder**

In `src/server/services/workflow-prompt-builder.ts`, delete this block:

```ts
  // 10. SaveLatent — persist LatentUpscale output for future censoring re-generation
  if (!skipHiresFix) {
    wf["900"] = {
      class_type: "SaveLatent",
      inputs: {
        samples: ["425", 0],
        filename_prefix: `latents/${input.runId || "run"}`,
      },
    };
  }
```

- [ ] **Step 4: Remove `SaveLatent` from template**

Edit `docs/workflow.api.json` and delete node `"900"` whose `class_type` is `"SaveLatent"`. Keep valid JSON. The end of the file should still parse with:

```bash
node -e 'JSON.parse(require("fs").readFileSync("docs/workflow.api.json","utf8")); console.log("ok")'
```

Expected: `ok`.

- [ ] **Step 5: Remove latent output extraction from ComfyUI service**

In `src/server/services/comfyui-service.ts`, delete the exported function:

```ts
export function extractLatentOutputs(entry: ComfyPromptHistoryEntry): ComfyPromptOutputImage[] {
  ...
}
```

- [ ] **Step 6: Remove latent download helper from image result service**

In `src/server/services/image-result-service.ts`, delete the exported `downloadAndPersistLatent(...)` function and any helper used only by that function. Keep `persistComfyOutputImages(...)`, `removeManagedRunOutput(...)`, and normal image persistence intact.

- [ ] **Step 7: Remove latent finalization from run executor**

In `src/server/services/run-executor.ts`:

1. Remove imports:

```ts
  extractLatentOutputs,
```

and:

```ts
  downloadAndPersistLatent,
```

2. Delete this block:

```ts
      // Download and persist latent file (from SaveLatent node 900)
      let latentFilePath: string | null = null;
      const latentOutputs = extractLatentOutputs(historyEntry);
      if (latentOutputs.length > 0) {
        try {
          latentFilePath = await downloadAndPersistLatent(run, apiUrl, latentOutputs[0]);
          runLog.info("Saved latent file", { latentFilePath });
        } catch (latentError) {
          runLog.warn("Failed to save latent file (non-fatal)", {
            error: latentError instanceof Error ? latentError.message : String(latentError),
          });
        }
      }
```

3. Remove `latentFilePath,` from the `completeWorkerRun(...)` call.

- [ ] **Step 8: Remove latent field from worker repository input**

In `src/server/worker/repository.ts`:

1. Delete from `CompleteWorkerRunInput`:

```ts
  latentFilePath?: string | null;
```

2. Delete:

```ts
    if (input.latentFilePath !== undefined) {
      data.latentFilePath = input.latentFilePath;
    }
```

- [ ] **Step 9: Run cleanup tests**

Run:

```bash
npm test -- tests/test-latent-cleanup-source.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add src/server/services/workflow-prompt-builder.ts docs/workflow.api.json src/server/services/comfyui-service.ts src/server/services/image-result-service.ts src/server/services/run-executor.ts src/server/worker/repository.ts tests/test-latent-cleanup-source.test.ts
git commit -m "refactor: remove latent persistence from generation"
```

---

### Task 5: Remove Latent Schema Field And Add Cleanup Script

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.sqlite.prisma`
- Create: `scripts/cleanup-latent-artifacts.mjs`
- Test: `tests/test-latent-schema-cleanup.test.ts`

- [ ] **Step 1: Write failing schema cleanup test**

Create `tests/test-latent-schema-cleanup.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("Prisma schemas no longer contain Run.latentFilePath", () => {
  for (const schemaPath of ["prisma/schema.prisma", "prisma/schema.sqlite.prisma"]) {
    const source = readSource(schemaPath);
    assert.doesNotMatch(source, /latentFilePath/);
  }
});

test("latent cleanup script only targets latent artifacts", () => {
  const source = readSource("scripts/cleanup-latent-artifacts.mjs");

  assert.match(source, /latents/);
  assert.match(source, /\.latent/);
  assert.doesNotMatch(source, /\/raw\//);
  assert.doesNotMatch(source, /\/thumb\//);
  assert.doesNotMatch(source, /\/censored\//);
});
```

- [ ] **Step 2: Run the failing schema cleanup test**

Run:

```bash
npm test -- tests/test-latent-schema-cleanup.test.ts
```

Expected: FAIL because schemas still contain `latentFilePath` and the cleanup script does not exist.

- [ ] **Step 3: Remove field from both Prisma schemas**

In `prisma/schema.prisma`, delete:

```prisma
  latentFilePath        String?               // Saved latent file path for censoring re-generation
```

In `prisma/schema.sqlite.prisma`, delete:

```prisma
  latentFilePath        String?               // Saved latent file path for censoring re-generation
```

- [ ] **Step 4: Add latent artifact cleanup script**

Create `scripts/cleanup-latent-artifacts.mjs`:

```js
import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2] ?? "data/images";
let deleted = 0;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  if (!(await exists(dir))) return;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "latents") {
        await rm(fullPath, { recursive: true, force: true });
        deleted += 1;
        continue;
      }
      await walk(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".latent")) {
      await rm(fullPath, { force: true });
      deleted += 1;
    }
  }
}

await walk(root);
console.log(JSON.stringify({ root, deleted }, null, 2));
```

- [ ] **Step 5: Run schema cleanup tests**

Run:

```bash
npm test -- tests/test-latent-schema-cleanup.test.ts
```

Expected: PASS.

- [ ] **Step 6: Generate Prisma client**

Run:

```bash
npm run prisma:generate
```

Expected: Prisma Client generation succeeds.

- [ ] **Step 7: Commit**

Run:

```bash
git add prisma/schema.prisma prisma/schema.sqlite.prisma scripts/cleanup-latent-artifacts.mjs tests/test-latent-schema-cleanup.test.ts
git commit -m "refactor: remove latent schema field"
```

---

### Task 6: Documentation And Full Verification

**Files:**
- Modify: `README.md`
- Test: all touched tests and full test suite

- [ ] **Step 1: Update README env table**

In `README.md`, add rows to the environment variable table:

```md
| `AUTO_CENSOR_MODEL_PATH` | 打码时必填 | — | `D:\Models\auto-censor.pt` | auto-censor YOLO `.pt` 模型绝对路径 |
| `AUTO_CENSOR_PYTHON_CMD` | 否 | `python3` | `D:\venvs\auto-censor\Scripts\python.exe` | 运行 auto-censor runner 的 Python/venv 命令 |
```

Also add this note near the setup requirements:

```md
自动打码需要额外 Python 环境，安装 `ultralytics`、`opencv-python` 和 `pillow`，并通过 `AUTO_CENSOR_MODEL_PATH` 指向 YOLO `.pt` 模型。
```

- [ ] **Step 2: Run targeted tests**

Run:

```bash
npm test -- \
  tests/test-auto-censor-runner.test.ts \
  tests/test-auto-censor-python-script.test.ts \
  tests/test-auto-censor-service-source.test.ts \
  tests/test-latent-cleanup-source.test.ts \
  tests/test-latent-schema-cleanup.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Typecheck/build verification**

Run:

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 5: Search for removed latent replay artifacts**

Run:

```bash
rg -n "latentFilePath|SaveLatent|LoadLatent|LatentFromBatch|downloadAndPersistLatent|extractLatentOutputs|illustrious_mosaic_censor_v2" src prisma docs/workflow.api.json tests
```

Expected: no matches, except historical design/plan docs if the search includes `docs/superpowers`.

- [ ] **Step 6: Commit docs**

Run:

```bash
git add README.md
git commit -m "docs: document auto-censor mosaic setup"
```

---

### Task 7: Runtime Cleanup, Deployment, And Public Verification

**Files:**
- No code edits expected unless verification exposes a defect.

- [ ] **Step 1: Check queue status before disruptive operations**

If implementation is being deployed, call the project queue status endpoints or inspect the queue UI before build/restart. If queued/running tasks exist and a restart/build is required, use the AGENTS.md pause/resume flow:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/queue/pause-active"
```

Expected: record returned `batchId` and `runIds` for later resume.

- [ ] **Step 2: Apply schema changes**

For PostgreSQL deployment, run:

```powershell
$env:DB_PROVIDER="postgresql"; npx prisma generate
$env:DB_PROVIDER="postgresql"; npx prisma db push
```

Expected: Prisma applies the dropped `latentFilePath` column.

- [ ] **Step 3: Delete latent disk artifacts only**

Run from the project root:

```bash
node scripts/cleanup-latent-artifacts.mjs data/images
```

Expected: JSON output with a `deleted` count. No raw, thumb, censored, project, run, or ImageResult data is deleted by this script.

- [ ] **Step 4: Build/deploy per AGENTS.md**

Follow AGENTS.md deployment rules for the current machine. This is not a lightweight change because it touches runtime behavior, Prisma schema, and external process execution.

Required build command on the deployment target:

```powershell
npx next build
```

Expected: build succeeds.

- [ ] **Step 5: Resume paused queue tasks if any were paused**

If Step 1 paused tasks, resume only those tasks:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/queue/resume-paused" \
  -H "Content-Type: application/json" \
  -d '{"batchId":"<recorded-batch-id>"}'
```

Expected: only tasks paused for this deployment resume.

- [ ] **Step 6: Public verification**

Verify:

```bash
curl -I https://comfy.bgmss.fun/
```

Expected: no 500 response. Then use authenticated browser verification if UI auth redirects to `/login`; read token from `.env` without printing it.

---

## Self-Review

Spec coverage:

- Auto-censor mosaic mode, classes `dick+pussy`, and size `100`: Task 1 and Task 2.
- Python runner with env-configured model and interpreter: Task 1 and Task 2.
- Reuse `ImageResult` and `CensoringTask`: Task 3.
- Project batch defaults to uncensored images while manual censoring can overwrite: Task 3.
- Remove latent code, schema, workflow, and disk artifacts only: Task 4, Task 5, and Task 7.
- Failure handling without partial censored DB writes: Task 3.
- Testing and deployment verification: Task 6 and Task 7.

Red-flag scan:

- No unresolved filler steps are intentionally present. Deployment resume uses `<recorded-batch-id>` only after Step 1 records the real value.

Type consistency:

- The plan defines `runAutoCensorMosaic(...)` in Task 1 and uses the same function in Task 3.
- The plan defines `processCensorTask(...)` in Task 3 and updates `censoring-executor.ts` to call that same function.
- Prisma field removal consistently refers to `Run.latentFilePath`.
