import { jobs, loraAssets, queueRuns, trashItems } from "@/lib/mock-data";
import type { JobCard, LoraAsset, QueueRun, TrashItem } from "@/lib/types";

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as { ok?: boolean; data?: T };
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

export function getTrashItems(): Promise<TrashItem[]> {
  return fetchJson("/api/trash", trashItems);
}

export function getLoraAssets(): Promise<LoraAsset[]> {
  return fetchJson("/api/loras", loraAssets);
}
