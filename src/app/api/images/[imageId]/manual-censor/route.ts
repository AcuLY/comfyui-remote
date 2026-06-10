import { revalidatePath } from "next/cache";
import { ok, fail } from "@/lib/api-response";
import { toImageUrl } from "@/lib/image-url";
import { persistManualCensoredImage } from "@/server/services/censoring-service";

type RouteContext = {
  params: Promise<{ imageId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { imageId } = await context.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("Invalid multipart form data", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return fail("file is required", 400);
  }

  if (file.size <= 0) {
    return fail("file must not be empty", 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await persistManualCensoredImage(imageId, buffer);
    revalidatePath("/");
    return ok({
      ...result,
      censoredAt: result.censoredAt.toISOString(),
      censoredFull: toImageUrl(result.censoredFilePath),
      censoredSrc: toImageUrl(result.censoredThumbPath),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to save manual censor image", 400);
  }
}
