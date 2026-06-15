import { fail, ok } from "@/lib/api-response";
import {
  getTrainingProjectProfile,
  mapTrainingProjectProfileError,
  updateTrainingProjectProfile,
} from "@/server/services/training/project-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    return ok(await getTrainingProjectProfile(projectId));
  } catch (error) {
    const mapped = mapTrainingProjectProfileError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  if (!body || typeof body !== "object") {
    return fail("Profile update body must be an object", 400);
  }

  const payload = body as Record<string, unknown>;
  const loraUsagePrompt = typeof payload.loraUsagePrompt === "string" ? payload.loraUsagePrompt.trim() : "";
  const characterDetailPrompt = typeof payload.characterDetailPrompt === "string" ? payload.characterDetailPrompt.trim() : "";
  const profileSummary = typeof payload.profileSummary === "string" ? payload.profileSummary.trim() : "";

  if (!loraUsagePrompt && !characterDetailPrompt && !profileSummary) {
    return fail("At least one profile field is required", 400, {
      supportedFields: ["loraUsagePrompt", "characterDetailPrompt", "profileSummary"],
    });
  }

  try {
    const { projectId } = await params;
    const data = await updateTrainingProjectProfile(projectId, {
      loraUsagePrompt,
      characterDetailPrompt,
      profileSummary,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectProfileError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
