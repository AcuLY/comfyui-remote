import { z } from "zod";
import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import {
  getModelNotes,
  ModelAssetError,
  updateModelNotes,
} from "@/server/services/model-asset-service";
import { readJsonBody } from "@/server/http/request-json";

const NotesSchema = z.object({
  path: z.string().min(1),
  notes: z.string().optional(),
  triggerWords: z.string().optional(),
  civitaiLink: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const paths = request.nextUrl.searchParams.get("paths") ?? "";
    const data = await getModelNotes("lora", paths);
    return ok(data);
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to load LoRA notes", 500, String(error));
  }
}

export async function PUT(request: NextRequest) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid JSON body", 400);
    }
    const result = NotesSchema.safeParse(body);
    if (!result.success) {
      return fail("Invalid input", 400, result.error.flatten());
    }
    const data = await updateModelNotes("lora", result.data);
    return ok(data);
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to save LoRA notes", 500, String(error));
  }
}
