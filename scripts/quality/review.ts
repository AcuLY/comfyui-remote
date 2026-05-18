#!/usr/bin/env tsx
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  getDefaultPhase1LabeledImagesPath,
  getDefaultPhase1PredictionsPath,
  readPhase0LabeledImagesCsv,
} from "../../src/server/quality/phase1-offline-eval";
import {
  createOpenAICompatibleVisionClient,
  writePhase1ReviewerPredictionsJsonl,
  type Phase1ReviewerImageField,
} from "../../src/server/quality/phase1-reviewer";

export interface ReviewCliArgs {
  phase: 1;
  labeledPath?: string;
  outPath?: string;
  limit?: number;
  offset: number;
  projectTitle?: string;
  imageField: Phase1ReviewerImageField;
  resume: boolean;
  projectRoot: string;
}

export function parseReviewArgs(argv: readonly string[]): ReviewCliArgs {
  let phase: number | undefined;
  let labeledPath: string | undefined;
  let outPath: string | undefined;
  let limit: number | undefined;
  let offset = 0;
  let projectTitle: string | undefined;
  let imageField: Phase1ReviewerImageField = "filePath";
  let resume = false;
  let projectRoot = process.cwd();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--phase") {
      phase = parsePhase(requireValue(argv, (index += 1), "--phase"));
    } else if (arg.startsWith("--phase=")) {
      phase = parsePhase(arg.slice("--phase=".length));
    } else if (arg === "--labeled") {
      labeledPath = requireValue(argv, (index += 1), "--labeled");
    } else if (arg.startsWith("--labeled=")) {
      labeledPath = arg.slice("--labeled=".length);
    } else if (arg === "--out") {
      outPath = requireValue(argv, (index += 1), "--out");
    } else if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length);
    } else if (arg === "--limit") {
      limit = parseNonNegativeInteger(requireValue(argv, (index += 1), "--limit"), "--limit");
    } else if (arg.startsWith("--limit=")) {
      limit = parseNonNegativeInteger(arg.slice("--limit=".length), "--limit");
    } else if (arg === "--offset") {
      offset = parseNonNegativeInteger(requireValue(argv, (index += 1), "--offset"), "--offset");
    } else if (arg.startsWith("--offset=")) {
      offset = parseNonNegativeInteger(arg.slice("--offset=".length), "--offset");
    } else if (arg === "--project-title") {
      projectTitle = requireValue(argv, (index += 1), "--project-title");
    } else if (arg.startsWith("--project-title=")) {
      projectTitle = arg.slice("--project-title=".length);
    } else if (arg === "--image-field") {
      imageField = parseImageField(requireValue(argv, (index += 1), "--image-field"));
    } else if (arg.startsWith("--image-field=")) {
      imageField = parseImageField(arg.slice("--image-field=".length));
    } else if (arg === "--resume") {
      resume = true;
    } else if (arg === "--project-root") {
      projectRoot = path.resolve(requireValue(argv, (index += 1), "--project-root"));
    } else if (arg.startsWith("--project-root=")) {
      projectRoot = path.resolve(arg.slice("--project-root=".length));
    } else {
      throw new Error(`Unknown quality review argument: ${arg}`);
    }
  }

  if (phase === undefined) phase = 1;
  if (phase !== 1) {
    throw new Error(`Unsupported quality review phase: ${phase}`);
  }

  return {
    phase: 1,
    labeledPath,
    outPath,
    limit,
    offset,
    projectTitle,
    imageField,
    resume,
    projectRoot,
  };
}

export async function runPhase1ReviewCli(argv = process.argv.slice(2)): Promise<number> {
  const args = parseReviewArgs(argv);
  const projectRoot = args.projectRoot;
  const labeledPath = path.resolve(
    projectRoot,
    args.labeledPath ?? getDefaultPhase1LabeledImagesPath(projectRoot),
  );
  const outputPath = path.resolve(
    projectRoot,
    args.outPath ?? getDefaultPhase1PredictionsPath(projectRoot),
  );

  const labeledRows = await readPhase0LabeledImagesCsv(labeledPath);
  const selectedRows = labeledRows
    .filter((row) => !args.projectTitle || row.projectTitle === args.projectTitle)
    .slice(args.offset)
    .slice(0, args.limit ?? undefined);

  const client = createOpenAICompatibleVisionClient();
  const summary = await writePhase1ReviewerPredictionsJsonl(selectedRows, {
    outputPath,
    projectRoot,
    imageField: args.imageField,
    resume: args.resume,
    client,
  });

  console.log(
    JSON.stringify(
      {
        phase: 1,
        outputPath: summary.outputPath,
        selectedRows: summary.selectedRows,
        written: summary.written,
        skipped: summary.skipped,
        model: client.model,
      },
      null,
      2,
    ),
  );

  return 0;
}

function parsePhase(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Unsupported quality review phase: ${value}`);
  }
  return parsed;
}

function parseImageField(value: string): Phase1ReviewerImageField {
  if (value === "filePath" || value === "thumbPath") return value;
  throw new Error(`Unsupported Phase 1 reviewer image field: ${value}`);
}

function parseNonNegativeInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${flag} value: ${value}`);
  }
  return parsed;
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPhase1ReviewCli().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
