import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
  assert.match(runnerSource, /AUTO_CENSOR_MOSAIC_SIZE/);
  assert.match(runnerSource, /from ["']@\/lib\/quick-censor-core["']/);
  assert.match(runnerSource, /--classes/);
  assert.match(runnerSource, /2,4/);
  assert.match(runnerSource, /--mosaic-size/);
});

test("auto-censor documentation names model path and python command env vars", () => {
  const exampleEnv = readSource(".env.example");

  assert.match(exampleEnv, /AUTO_CENSOR_MODEL_PATH/);
  assert.match(exampleEnv, /AUTO_CENSOR_PYTHON_CMD/);
});

type RunnerCaseOptions = {
  mode?:
    | "success"
    | "nonzero"
    | "invalid-json"
    | "array-json"
    | "missing-stats"
    | "non-finite-stats"
    | "timeout"
    | "batch-item-error";
  harnessSafetyTimeoutMs?: number;
  modelPathEnv?: string | null;
  modelExists?: boolean;
  modelIsDirectory?: boolean;
  sourceIsDirectory?: boolean;
  sourceExists?: boolean;
  outputPath?: string;
  timeoutMs?: number;
};

type RunnerCaseResult = {
  result: { ok: true; result: unknown } | { ok: false; message: string };
  args?: string[];
  manifest?: unknown;
  outputDirExists: boolean;
  paths: {
    modelPath: string;
    outputAbsPath: string;
    outputPath: string;
    sourcePath: string;
  };
  spawnCalls: string[][];
};

type BatchRunnerCaseResult = {
  result: RunnerCaseResult["result"];
  args?: string[];
  manifest?: unknown;
  outputDirExists: Record<string, boolean>;
  paths: {
    modelPath: string;
    items: Array<{
      sourcePath: string;
      outputAbsPath: string;
      outputPath: string;
    }>;
  };
  spawnCalls: string[][];
};

async function runRunnerCase(options: RunnerCaseOptions = {}): Promise<RunnerCaseResult> {
  const tempRoot = await mkdtemp(join(tmpdir(), "auto-censor-runner-"));
  const childRoot = await realpath(tempRoot);
  const sourcePath = join(tempRoot, "source.png");
  const defaultModelPath = join(tempRoot, "model.pt");
  const modelPath = options.modelPathEnv === undefined ? defaultModelPath : options.modelPathEnv;
  const outputPath = options.outputPath ?? "nested/output.png";
  const outputAbsPath = resolve(childRoot, outputPath);
  const argsPath = join(tempRoot, "spawn-args.json");
  const manifestSnapshotPath = join(tempRoot, "batch-manifest.json");
  const spawnsPath = join(tempRoot, "spawn-calls.json");
  const fakeScriptPath = join(tempRoot, "scripts", "auto-censor-mosaic.py");
  const harnessPath = join(tempRoot, "run-wrapper.mjs");

  try {
    if (options.sourceIsDirectory) {
      await mkdir(sourcePath, { recursive: true });
    } else if (options.sourceExists !== false) {
      await writeFile(sourcePath, "source");
    }

    if (modelPath && options.modelIsDirectory) {
      await mkdir(modelPath, { recursive: true });
    } else if (modelPath && options.modelExists !== false) {
      await writeFile(modelPath, "model");
    }

    await mkdir(dirname(fakeScriptPath), { recursive: true });
    await writeFile(fakeScriptPath, fakeAutoCensorScriptSource());
    await writeFile(harnessPath, runnerHarnessSource());

    const result = await runNodeHarness(harnessPath, {
      argsPath,
      mode: options.mode ?? "success",
      modelPath,
      manifestSnapshotPath,
      outputPath,
      root: tempRoot,
      sourcePath,
      spawnsPath,
      timeoutMs: options.timeoutMs,
    }, options.harnessSafetyTimeoutMs);

    const args = existsSync(argsPath)
      ? JSON.parse(await readFile(argsPath, "utf8")) as string[]
      : undefined;
    const spawnCalls = existsSync(spawnsPath)
      ? JSON.parse(await readFile(spawnsPath, "utf8")) as string[][]
      : [];
    const manifest = existsSync(manifestSnapshotPath)
      ? JSON.parse(await readFile(manifestSnapshotPath, "utf8")) as unknown
      : undefined;

    return {
      result,
      args,
      manifest,
      outputDirExists: await pathExists(dirname(outputAbsPath)),
      paths: {
        modelPath: modelPath ?? "",
        outputAbsPath,
        outputPath,
        sourcePath,
      },
      spawnCalls,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runBatchRunnerCase(
  options: RunnerCaseOptions = {},
): Promise<BatchRunnerCaseResult> {
  const tempRoot = await mkdtemp(join(tmpdir(), "auto-censor-runner-batch-"));
  const childRoot = await realpath(tempRoot);
  const defaultModelPath = join(tempRoot, "model.pt");
  const modelPath = options.modelPathEnv === undefined ? defaultModelPath : options.modelPathEnv;
  const argsPath = join(tempRoot, "spawn-args.json");
  const manifestSnapshotPath = join(tempRoot, "batch-manifest.json");
  const spawnsPath = join(tempRoot, "spawn-calls.json");
  const fakeScriptPath = join(tempRoot, "scripts", "auto-censor-mosaic.py");
  const harnessPath = join(tempRoot, "run-wrapper.mjs");
  const items = [
    {
      sourcePath: join(tempRoot, "sources", "one.png"),
      outputPath: "batch-output/one.png",
    },
    {
      sourcePath: join(tempRoot, "sources", "two.png"),
      outputPath: "batch-output/nested/two.png",
    },
    {
      sourcePath: join(tempRoot, "sources", "three.png"),
      outputPath: "batch-output/three.png",
    },
  ];

  try {
    await mkdir(join(tempRoot, "sources"), { recursive: true });
    await Promise.all(items.map((item) => writeFile(item.sourcePath, "source")));

    if (modelPath && options.modelIsDirectory) {
      await mkdir(modelPath, { recursive: true });
    } else if (modelPath && options.modelExists !== false) {
      await writeFile(modelPath, "model");
    }

    await mkdir(dirname(fakeScriptPath), { recursive: true });
    await writeFile(fakeScriptPath, fakeAutoCensorScriptSource());
    await writeFile(harnessPath, runnerHarnessSource());

    const result = await runNodeHarness(harnessPath, {
      api: "batch",
      argsPath,
      items,
      manifestSnapshotPath,
      mode: options.mode ?? "success",
      modelPath,
      root: tempRoot,
      spawnsPath,
      timeoutMs: options.timeoutMs,
    }, options.harnessSafetyTimeoutMs);

    const args = existsSync(argsPath)
      ? JSON.parse(await readFile(argsPath, "utf8")) as string[]
      : undefined;
    const spawnCalls = existsSync(spawnsPath)
      ? JSON.parse(await readFile(spawnsPath, "utf8")) as string[][]
      : [];
    const manifest = existsSync(manifestSnapshotPath)
      ? JSON.parse(await readFile(manifestSnapshotPath, "utf8")) as unknown
      : undefined;
    const paths = items.map((item) => ({
      sourcePath: item.sourcePath,
      outputAbsPath: resolve(childRoot, item.outputPath),
      outputPath: item.outputPath,
    }));
    const outputDirEntries = await Promise.all(
      paths.map(async (item) => [item.outputPath, await pathExists(dirname(item.outputAbsPath))] as const),
    );

    return {
      result,
      args,
      manifest,
      outputDirExists: Object.fromEntries(outputDirEntries),
      paths: {
        modelPath: modelPath ?? "",
        items: paths,
      },
      spawnCalls,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runNodeHarness(
  harnessPath: string,
  input: {
    api?: "single" | "batch";
    argsPath: string;
    items?: Array<{
      sourcePath: string;
      outputPath: string;
    }>;
    manifestSnapshotPath: string;
    mode: string;
    modelPath: string | null | undefined;
    outputPath?: string;
    root: string;
    sourcePath?: string;
    spawnsPath: string;
    timeoutMs?: number;
  },
  safetyTimeoutMs = 8_000,
): Promise<RunnerCaseResult["result"]> {
  const stdout = await new Promise<string>((resolvePromise, rejectPromise) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    let forceKillTimer: NodeJS.Timeout | undefined;
    const child = spawn(process.execPath, ["--import", "tsx", harnessPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AUTO_CENSOR_TEST_INPUT: JSON.stringify(input),
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const safetyTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 1_000);
      forceKillTimer.unref();
      rejectPromise(new Error(`runner harness safety timeout after ${safetyTimeoutMs} ms`));
    }, safetyTimeoutMs);
    safetyTimer.unref();

    const cleanup = () => {
      clearTimeout(safetyTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
    };

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      cleanup();

      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (code !== 0) {
        rejectPromise(new Error(`runner harness exited with code ${code}: ${stderr || stdout}`));
        return;
      }

      resolvePromise(stdout);
    });
  });
  const resultLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  assert.ok(resultLine, "runner harness should print a JSON result line");
  return JSON.parse(resultLine) as RunnerCaseResult["result"];
}

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function readManifestItems(manifest: unknown) {
  assert.ok(manifest && typeof manifest === "object", "manifest must be an object");

  const payload = manifest as {
    items?: unknown;
  };
  assert.ok(Array.isArray(payload.items), "manifest must contain an items array");

  return payload.items.map((item) => {
    assert.ok(item && typeof item === "object", "manifest item must be an object");
    const record = item as Record<string, unknown>;
    return {
      sourcePath: record.sourcePath ?? record.inputPath ?? record.input,
      outputPath: record.outputPath ?? record.output,
    };
  });
}

function runnerHarnessSource() {
  const runnerUrl = pathToFileURL(resolve(process.cwd(), "src/server/services/auto-censor-runner.ts")).href;

  return `
const input = JSON.parse(process.env.AUTO_CENSOR_TEST_INPUT);

process.chdir(input.root);

if (input.modelPath) {
  process.env.AUTO_CENSOR_MODEL_PATH = input.modelPath;
} else {
  delete process.env.AUTO_CENSOR_MODEL_PATH;
}

process.env.AUTO_CENSOR_PYTHON_CMD = process.execPath;
process.env.FAKE_AUTO_CENSOR_MODE = input.mode;
process.env.FAKE_AUTO_CENSOR_ARGS_PATH = input.argsPath;
process.env.FAKE_AUTO_CENSOR_MANIFEST_PATH = input.manifestSnapshotPath;
process.env.FAKE_AUTO_CENSOR_SPAWNS_PATH = input.spawnsPath;

const runner = await import(${JSON.stringify(runnerUrl)});

try {
  const result = input.api === "batch"
    ? await runner.runAutoCensorMosaicBatch(input.items.map((item) => ({
        sourcePath: item.sourcePath,
        outputPath: item.outputPath,
        timeoutMs: input.timeoutMs ?? 5000,
      })))
    : await runner.runAutoCensorMosaic({
        sourcePath: input.sourcePath,
        outputPath: input.outputPath,
        timeoutMs: input.timeoutMs ?? 5000,
      });
  console.log(JSON.stringify({ ok: true, result }));
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    message: error instanceof Error ? error.message : String(error),
  }));
}
`;
}

function fakeAutoCensorScriptSource() {
  return `
const { existsSync, readFileSync, writeFileSync } = require("node:fs");

const args = process.argv.slice(2);
writeFileSync(process.env.FAKE_AUTO_CENSOR_ARGS_PATH, JSON.stringify(args));

if (process.env.FAKE_AUTO_CENSOR_SPAWNS_PATH) {
  const previousCalls = existsSync(process.env.FAKE_AUTO_CENSOR_SPAWNS_PATH)
    ? JSON.parse(readFileSync(process.env.FAKE_AUTO_CENSOR_SPAWNS_PATH, "utf8"))
    : [];
  previousCalls.push(args);
  writeFileSync(process.env.FAKE_AUTO_CENSOR_SPAWNS_PATH, JSON.stringify(previousCalls));
}

function readBatchItems() {
  const batchIndex = args.indexOf("--batch");
  if (batchIndex < 0) return null;

  const manifest = JSON.parse(readFileSync(args[batchIndex + 1], "utf8"));
  writeFileSync(process.env.FAKE_AUTO_CENSOR_MANIFEST_PATH, JSON.stringify(manifest));
  return manifest.items;
}

function itemInputPath(item) {
  return item.sourcePath ?? item.inputPath ?? item.input;
}

function itemOutputPath(item) {
  return item.outputPath ?? item.output;
}

function batchResultForItem(item, index) {
  if (process.env.FAKE_AUTO_CENSOR_MODE === "batch-item-error" && index === 1) {
    return {
      ok: false,
      inputPath: itemInputPath(item),
      outputPath: itemOutputPath(item),
      error: "fake item failure",
    };
  }

  if (process.env.FAKE_AUTO_CENSOR_MODE === "missing-stats") {
    return {
      ok: true,
      inputPath: itemInputPath(item),
      outputPath: itemOutputPath(item),
    };
  }

  if (process.env.FAKE_AUTO_CENSOR_MODE === "non-finite-stats") {
    return {
      ok: true,
      inputPath: itemInputPath(item),
      outputPath: itemOutputPath(item),
      detections: "NaN",
      selectedDetections: "Infinity",
    };
  }

  return {
    ok: true,
    inputPath: itemInputPath(item),
    outputPath: itemOutputPath(item),
    detections: 5 + index,
    selectedDetections: 3 + index,
  };
}

const batchItems = readBatchItems();

switch (process.env.FAKE_AUTO_CENSOR_MODE) {
  case "nonzero":
    console.error("fake auto-censor failure");
    process.exit(7);
  case "invalid-json":
    console.log("not-json");
    process.exit(0);
  case "array-json":
    console.log("[]");
    process.exit(0);
  case "missing-stats":
    if (batchItems) {
      console.log(JSON.stringify({ results: batchItems.map(batchResultForItem) }));
      process.exit(0);
    }
    console.log(JSON.stringify({}));
    process.exit(0);
  case "non-finite-stats":
    if (batchItems) {
      console.log(JSON.stringify({ results: batchItems.map(batchResultForItem) }));
      process.exit(0);
    }
    console.log(JSON.stringify({ detections: "NaN", selectedDetections: "Infinity" }));
    process.exit(0);
  case "timeout":
    setTimeout(() => {
      console.log(JSON.stringify({ detections: 1, selectedDetections: 1 }));
    }, 10000);
    break;
  default:
    if (batchItems) {
      console.log("fake startup noise");
      console.log(JSON.stringify({ results: batchItems.map(batchResultForItem) }));
      break;
    }

    console.log("fake startup noise");
    console.log(JSON.stringify({ detections: 5, selectedDetections: 3, outputPath: "ignored-by-wrapper" }));
}
`;
}

test("auto-censor runner validates configured model path before spawning", async () => {
  const { args, result } = await runRunnerCase({ modelPathEnv: null });

  assert.equal(args, undefined);
  assert.deepEqual(result, {
    ok: false,
    message: "AUTO_CENSOR_MODEL_PATH is not configured.",
  });
});

test("auto-censor runner validates source and model files before spawning", async () => {
  const missingSource = await runRunnerCase({ sourceExists: false });
  const missingModel = await runRunnerCase({ modelExists: false });

  assert.equal(missingSource.args, undefined);
  assert.equal(missingModel.args, undefined);
  assert.equal(missingSource.result.ok, false);
  assert.equal(missingModel.result.ok, false);
  assert.match(missingSource.result.message, /Auto-censor source image does not exist/);
  assert.match(missingModel.result.message, /Auto-censor model does not exist/);
});

test("auto-censor runner rejects directories during source and model preflight", async () => {
  const sourceDirectory = await runRunnerCase({ sourceIsDirectory: true });
  const modelDirectory = await runRunnerCase({ modelIsDirectory: true });

  assert.equal(sourceDirectory.args, undefined);
  assert.equal(modelDirectory.args, undefined);
  assert.equal(sourceDirectory.result.ok, false);
  assert.equal(modelDirectory.result.ok, false);
  assert.match(sourceDirectory.result.message, /Auto-censor source image must be a file/);
  assert.match(modelDirectory.result.message, /Auto-censor model must be a file/);
});

test("auto-censor single-image wrapper uses batch-of-one while preserving return shape", async () => {
  const outputPath = "created-output/original-return.png";
  const { args, manifest, outputDirExists, paths, result, spawnCalls } = await runRunnerCase({ outputPath });

  assert.equal(result.ok, true);
  assert.equal(outputDirExists, true);
  assert.equal(spawnCalls.length, 1);
  assert.deepEqual(result.result, {
    detections: 5,
    selectedDetections: 3,
    outputPath,
  });

  assert.ok(args, "Python CLI args must be captured");
  assert.equal(args[args.indexOf("--model") + 1], paths.modelPath);
  assert.ok(args.includes("--batch"), "single-image wrapper must call batch CLI mode");
  assert.equal(args.includes("--input"), false);
  assert.equal(args.includes("--output"), false);
  assert.equal(args[args.indexOf("--classes") + 1], "2,4");
  assert.equal(args[args.indexOf("--mosaic-size") + 1], "100");
  assert.deepEqual(readManifestItems(manifest), [
    {
      sourcePath: paths.sourcePath,
      outputPath: paths.outputAbsPath,
    },
  ]);
});

test("auto-censor batch runner spawns once with manifest and returns per-item errors", async () => {
  const { args, manifest, outputDirExists, paths, result, spawnCalls } =
    await runBatchRunnerCase({ mode: "batch-item-error" });

  if (!result.ok) {
    assert.fail(result.message);
  }

  assert.equal(spawnCalls.length, 1);
  assert.deepEqual(args, spawnCalls[0]);

  assert.ok(args, "Python CLI args must be captured");
  assert.equal(args[args.indexOf("--model") + 1], paths.modelPath);
  assert.ok(args.includes("--batch"), "batch runner must call batch CLI mode");
  assert.equal(args.includes("--input"), false);
  assert.equal(args.includes("--output"), false);
  assert.equal(args[args.indexOf("--classes") + 1], "2,4");
  assert.equal(args[args.indexOf("--mosaic-size") + 1], "100");

  assert.deepEqual(
    readManifestItems(manifest),
    paths.items.map((item) => ({
      sourcePath: item.sourcePath,
      outputPath: item.outputAbsPath,
    })),
  );
  for (const item of paths.items) {
    assert.equal(
      outputDirExists[item.outputPath],
      true,
      `output directory must be created for ${item.outputPath}`,
    );
  }
  assert.deepEqual(result.result, [
    {
      ok: true,
      detections: 5,
      selectedDetections: 3,
      outputPath: paths.items[0].outputPath,
    },
    {
      ok: false,
      error: "fake item failure",
      outputPath: paths.items[1].outputPath,
    },
    {
      ok: true,
      detections: 7,
      selectedDetections: 5,
      outputPath: paths.items[2].outputPath,
    },
  ]);
});

test("auto-censor runner rejects non-zero Python exits with stderr detail", async () => {
  const { result } = await runRunnerCase({ mode: "nonzero" });

  assert.equal(result.ok, false);
  assert.match(result.message, /code 7/);
  assert.match(result.message, /fake auto-censor failure/);
});

test("auto-censor runner rejects hung Python CLI after timeout", async () => {
  const { result } = await runRunnerCase({
    harnessSafetyTimeoutMs: 2_500,
    mode: "timeout",
    timeoutMs: 50,
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /timed out after 50 ms/);
});

test("auto-censor runner rejects invalid and non-object JSON results", async () => {
  const invalidJson = await runRunnerCase({ mode: "invalid-json" });
  const arrayJson = await runRunnerCase({ mode: "array-json" });

  assert.equal(invalidJson.result.ok, false);
  assert.equal(arrayJson.result.ok, false);
  assert.match(invalidJson.result.message, /invalid JSON result/);
  assert.match(arrayJson.result.message, /JSON result must be an object/);
});

test("auto-censor runner defaults missing or non-finite stats to zero", async () => {
  const missingStats = await runRunnerCase({ mode: "missing-stats" });
  const nonFiniteStats = await runRunnerCase({ mode: "non-finite-stats" });

  assert.deepEqual(missingStats.result, {
    ok: true,
    result: {
      detections: 0,
      selectedDetections: 0,
      outputPath: "nested/output.png",
    },
  });
  assert.deepEqual(nonFiniteStats.result, {
    ok: true,
    result: {
      detections: 0,
      selectedDetections: 0,
      outputPath: "nested/output.png",
    },
  });
});
