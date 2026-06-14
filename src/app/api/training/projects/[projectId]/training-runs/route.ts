import { fail, ok } from "@/lib/api-response";
import { enqueueManagedTrainingRun, mapTrainingProjectError } from "@/server/services/training/project-service";
import { listTrainingRuns, mapTrainingReadError } from "@/server/services/training/read-service";
import {
  freezeCharacterLoraDataset,
  mapCharacterLoraPhase3Error,
} from "@/server/services/character-lora-training/phase3-service";
import {
  enqueueCharacterLoraTrainingRun,
  mapCharacterLoraTrainingError,
} from "@/server/services/character-lora-training/training-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const data = await listTrainingRuns({ kind: "training", projectId });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: Record<string, unknown> = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) as Record<string, unknown> : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { projectId } = await params;
    const managed = await enqueueManagedTrainingRun(projectId, body);
    if (managed) {
      return ok(managed, { status: 201 });
    }
    const revisionId = typeof body.revisionId === "string" && body.revisionId.trim() ? body.revisionId.trim() : null;
    const config = typeof body.config === "object" && body.config ? body.config : {};

    const resolvedRevisionId = revisionId ?? await (async () => {
      const frozen = await freezeCharacterLoraDataset(projectId, {});
      if (!("revision" in frozen) || !frozen.revision?.id) {
        throw new Error("Dataset freeze did not return a revision id");
      }
      return frozen.revision.id;
    })();

    const data = await enqueueCharacterLoraTrainingRun(resolvedRevisionId, config);
    return ok(data, { status: 201 });
  } catch (error) {
    const managedMapped = mapTrainingProjectError(error);
    if (managedMapped.status !== 500 || managedMapped.message !== "Unexpected training project error") {
      return fail(managedMapped.message, managedMapped.status, managedMapped.details);
    }
    const mapped = error instanceof Error && error.message === "Dataset freeze did not return a revision id"
      ? { message: error.message, status: 409, details: undefined }
      : "status" in Object(error ?? {}) && "message" in Object(error ?? {})
        ? null
        : null;
    if (mapped) return fail(mapped.message, mapped.status, mapped.details);

    const trainingMapped = mapCharacterLoraTrainingError(error);
    if (trainingMapped.status !== 400 || trainingMapped.message !== "Unexpected character LoRA training error") {
      return fail(trainingMapped.message, trainingMapped.status, trainingMapped.details);
    }

    const phase3Mapped = mapCharacterLoraPhase3Error(error);
    return fail(phase3Mapped.message, phase3Mapped.status, phase3Mapped.details);
  }
}
