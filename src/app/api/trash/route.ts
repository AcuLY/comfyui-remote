import { fail, ok } from "@/lib/api-response";
import { listTrashItems } from "@/server/repositories/trash-repository";

export async function GET() {
  try {
    const data = await listTrashItems();
    return ok(data);
  } catch (error) {
    return fail("Failed to load trash items", 500, String(error));
  }
}
