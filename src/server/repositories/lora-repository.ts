import { db } from "@/lib/db";

function serializeLoraAsset(asset: {
  id: string;
  name: string;
  category: string;
  fileName: string;
  absolutePath: string;
  relativePath: string;
  size: bigint | null;
  source: string | null;
  notes: string | null;
  uploadedAt: Date;
  updatedAt: Date;
}) {
  return {
    ...asset,
    size: asset.size === null ? null : Number(asset.size),
    uploadedAt: asset.uploadedAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export async function listLoraAssets() {
  const assets = await db.loraAsset.findMany({
    where: { modelType: "lora" },
    orderBy: { uploadedAt: "desc" },
    take: 100,
  });

  return assets.map(serializeLoraAsset);
}
