import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import {
  mapCharacterLoraPhase3Error,
  updateCharacterLoraImageCaption,
} from "@/server/services/character-lora-training/phase3-service";

export const dynamic = "force-dynamic";

const bulkCaptionSchema = z
  .object({
    captions: z
      .array(
        z
          .object({
            imageId: z.string().trim().min(1),
            captionDraft: z.string().trim().min(1),
          })
          .strict(),
      )
      .min(1),
    actor: z.string().trim().min(1).optional(),
    source: z.string().trim().min(1).optional(),
    clientRequestId: z.string().trim().min(1).optional(),
  })
  .strict();

export async function PATCH(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const parsed = bulkCaptionSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid character LoRA bulk caption request", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  try {
    const data = await Promise.all(
      parsed.data.captions.map((caption) =>
        updateCharacterLoraImageCaption(caption.imageId, {
          captionDraft: caption.captionDraft,
        }),
      ),
    );
    return ok({
      images: data,
      metadata: {
        actor: parsed.data.actor ?? null,
        source: parsed.data.source ?? null,
        clientRequestId: parsed.data.clientRequestId ?? null,
      },
    });
  } catch (error) {
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
