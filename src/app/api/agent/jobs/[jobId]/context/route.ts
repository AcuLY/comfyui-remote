import { fail } from "@/lib/api-response";

export async function GET() {
  return fail("Agent job context endpoint is reserved for future implementation", 501);
}
