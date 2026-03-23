import { jobs, loraAssets, queueRuns, trashItems } from "@/lib/mock-data";
import type { JobCard, LoraAsset, QueueRun, TrashItem } from "@/lib/types";

type ApiEnvelope<T> = { ok?: boolean; data?: T };
type ApiTrashItem = {
  id: string;
  deletedAt: string;
  originalPath: string;
  previewPath?: string | null;
  src?: string;
  title?: string;
};

function getFileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function normalizeTrashItems(items: ApiTrashItem[]): TrashItem[] {
  return items.map((item) => ({
    id: item.id,
    src: item.src ?? item.previewPath ?? undefined,
    title: item.title ?? getFileName(item.originalPath),
    deletedAt: item.deletedAt,
    originalPath: item.originalPath,
  }));
}

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as ApiEnvelope<T>;
    return payload?.data ?? fallback;
  } catch {
    return fallback;
  }
}

export function getQueueRuns(): Promise<QueueRun[]> {
  return fetchJson("/api/queue", queueRuns);
}

export function getJobs(): Promise<JobCard[]> {
  return fetchJson("/api/jobs", jobs);
}

export async function getTrashItems(): Promise<TrashItem[]> {
  const items = await fetchJson<ApiTrashItem[]>("/api/trash", trashItems);
  return normalizeTrashItems(items);
}

export function getLoraAssets(): Promise<LoraAsset[]> {
  return fetchJson("/api/loras", loraAssets);
}
