import type { JobCard, LoraAsset, QueueRun, ReviewGroup, TrashItem } from "@/lib/types";

export const queueRuns: QueueRun[] = [
  {
    id: "run-miku-standing-0323-1",
    characterName: "Nakano Miku",
    jobTitle: "Miku spring batch A",
    positionName: "Standing",
    createdAt: "2026-03-23 22:08",
    pendingCount: 7,
    totalCount: 9,
    status: "done",
  },
  {
    id: "run-miku-watching-0323-2",
    characterName: "Nakano Miku",
    jobTitle: "Miku spring batch A",
    positionName: "Watching",
    createdAt: "2026-03-23 21:56",
    pendingCount: 4,
    totalCount: 9,
    status: "done",
  },
  {
    id: "run-tangtang-park-0323-1",
    characterName: "Tangtang",
    jobTitle: "Tangtang park test",
    positionName: "Bench sit",
    createdAt: "2026-03-23 21:22",
    pendingCount: 9,
    totalCount: 9,
    status: "done",
  },
];

export const reviewGroups: ReviewGroup[] = [
  {
    id: "run-miku-standing-0323-1",
    title: "Miku spring batch A",
    characterName: "Nakano Miku",
    positionName: "Standing",
    createdAt: "2026-03-23 22:08",
    pendingCount: 7,
    totalCount: 9,
    images: Array.from({ length: 9 }, (_, index) => ({
      id: `miku-standing-${index + 1}`,
      src: `https://picsum.photos/seed/miku-standing-${index + 1}/900/1200`,
      label: `${index + 1}`.padStart(2, "0"),
      status: index < 2 ? "kept" : "pending",
    })),
  },
  {
    id: "run-miku-watching-0323-2",
    title: "Miku spring batch A",
    characterName: "Nakano Miku",
    positionName: "Watching",
    createdAt: "2026-03-23 21:56",
    pendingCount: 4,
    totalCount: 9,
    images: Array.from({ length: 9 }, (_, index) => ({
      id: `miku-watching-${index + 1}`,
      src: `https://picsum.photos/seed/miku-watching-${index + 1}/900/1200`,
      label: `${index + 1}`.padStart(2, "0"),
      status: index < 4 ? "pending" : "kept",
    })),
  },
  {
    id: "run-tangtang-park-0323-1",
    title: "Tangtang park test",
    characterName: "Tangtang",
    positionName: "Bench sit",
    createdAt: "2026-03-23 21:22",
    pendingCount: 9,
    totalCount: 9,
    images: Array.from({ length: 9 }, (_, index) => ({
      id: `tangtang-bench-${index + 1}`,
      src: `https://picsum.photos/seed/tangtang-bench-${index + 1}/900/1200`,
      label: `${index + 1}`.padStart(2, "0"),
      status: "pending",
    })),
  },
];

export const jobs: JobCard[] = [
  {
    id: "job-miku-spring-a",
    title: "Miku spring batch A",
    characterName: "Nakano Miku",
    sceneName: "Park bench",
    styleName: "Soft daylight",
    status: "running",
    updatedAt: "2026-03-23 22:10",
    positionCount: 5,
  },
  {
    id: "job-tangtang-park-test",
    title: "Tangtang park test",
    characterName: "Tangtang",
    sceneName: "Riverside",
    styleName: "Anime cinematic",
    status: "draft",
    updatedAt: "2026-03-23 21:40",
    positionCount: 3,
  },
];

export const trashItems: TrashItem[] = [
  {
    id: "trash-1",
    src: "https://picsum.photos/seed/trash-1/900/1200",
    title: "Miku / Standing / #04",
    deletedAt: "2026-03-23 22:05",
    originalPath: "data/images/job-miku-spring-a/run-01/raw/04.png",
  },
  {
    id: "trash-2",
    src: "https://picsum.photos/seed/trash-2/900/1200",
    title: "Tangtang / Bench sit / #07",
    deletedAt: "2026-03-23 21:31",
    originalPath: "data/images/job-tangtang-park-test/run-01/raw/07.png",
  },
];

export const loraAssets: LoraAsset[] = [
  {
    id: "lora-1",
    name: "miku-v3.safetensors",
    category: "characters",
    relativePath: "characters/miku-v3.safetensors",
    uploadedAt: "2026-03-22 18:10",
  },
  {
    id: "lora-2",
    name: "soft-cinema.safetensors",
    category: "styles",
    relativePath: "styles/soft-cinema.safetensors",
    uploadedAt: "2026-03-22 18:16",
  },
];
