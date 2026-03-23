import { db } from "@/lib/db";

export async function listLoraAssets() {
  return db.loraAsset.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 100,
  });
}
