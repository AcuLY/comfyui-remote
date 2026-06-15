import type {
  TrainingGenerationKind,
  TrainingGenerationTaskType,
} from "@/lib/training/schemas";

export type TrainingImageStatus = "pending" | "kept" | "trashed";

export type TrainingImage = {
  id: string;
  src: string;
  full: string;
  label: string;
  status: TrainingImageStatus;
  featured: boolean;
  featured2: boolean;
  cover: boolean;
  width: number | null;
  height: number | null;
};

export type LoraTrainingProjectStatus = "ready" | "training" | "draft" | "archived";
export type LoraTrainingReviewStatus = "pending" | "kept" | "rejected";

export type LoraTrainingReferenceImage = {
  id: string;
  kind: "original" | "generated" | "auxiliary";
  label: string;
  note: string;
  image: TrainingImage;
};

export type LoraTrainingImageResult = {
  id: string;
  sectionId: string;
  sectionTitle: string;
  image: TrainingImage;
  reviewStatus: LoraTrainingReviewStatus;
  caption: string;
  sourceLabel: string;
};

export type LoraTrainingDatasetRevisionItem = {
  id: string;
  label: string;
  sectionTitle: string;
  image: TrainingImage;
  captionSnapshot: string;
  filePathSnapshot: string;
};

export type LoraTrainingProject = {
  id: string;
  title: string;
  status: LoraTrainingProjectStatus;
  updatedAt: string;
  sectionCount: number;
  imageCount: number;
  datasetVersion: string;
  recentTraining: string;
  profileSummary: string;
  usagePrompt: string;
  detailPrompt: string;
  readiness: "完整" | "待补";
  keptCount: number;
  captionMissingCount: number;
  images: TrainingImage[];
  referenceImages: LoraTrainingReferenceImage[];
  resultPool: LoraTrainingImageResult[];
  sections: LoraTrainingSection[];
  datasetRevisions: LoraTrainingDatasetRevision[];
};

export type LoraTrainingTaskKind = "generation" | "training";
export type LoraTrainingTaskStatus = "completed" | "running" | "queued" | "failed";

export type LoraTrainingConfigRow = {
  label: string;
  value: string;
  detail?: string;
};

export type LoraTrainingDatasetSample = {
  id: string;
  label: string;
  sectionTitle: string;
  image: TrainingImage;
  caption: string;
  status: LoraTrainingReviewStatus;
};

export type LoraTrainingRun = {
  id: string;
  kind: LoraTrainingTaskKind;
  status: LoraTrainingTaskStatus;
  generationKind?: TrainingGenerationKind;
  taskType?: TrainingGenerationTaskType;
  taskTypeLabel?: string;
  projectId: string;
  sectionId?: string;
  projectTitle: string;
  title: string;
  summary: string;
  timestamp: string;
  progress?: number;
  inputImages?: TrainingImage[];
  outputLabel?: string;
  outputResultIds?: string[];
  errorMessage?: string;
  provider?: string;
  finalInput?: string;
  outputText?: string;
  artifactName?: string;
  finalLoraArtifactId?: string;
  presetCreatedAt?: string;
  datasetRevisionId?: string;
  waitReason?: string;
  schedulerMessage?: string;
  currentStep?: number;
  targetSteps?: number;
  trainingConfig?: LoraTrainingConfigRow[];
  trainingLogArtifactName?: string;
  trainingLogLines?: string[];
  datasetSamples?: LoraTrainingDatasetSample[];
};

export type LoraTrainingSectionBlock = {
  id: string;
  source: "预制" | "本地";
  title: string;
  text: string;
};

export type LoraTrainingSection = {
  id: string;
  title: string;
  enabled: boolean;
  updatedAt: string;
  blocks: LoraTrainingSectionBlock[];
  resolvedScene: string;
  imagePrompt: string;
  images: TrainingImage[];
  resultStatus: LoraTrainingReviewStatus;
};

export type LoraTrainingDatasetRevision = {
  id: string;
  version: string;
  status: "ready" | "training" | "draft";
  createdAt: string;
  itemCount: number;
  captionMissingCount: number;
  manifestName: string;
  samples: LoraTrainingDatasetRevisionItem[];
  manifestRows: string[];
  relatedTrainingRunIds: string[];
};

export type LoraTrainingPreset = {
  id: string;
  title: string;
  category: string;
  folder: string;
  status: "active" | "inactive";
  updatedAt: string;
  sceneDescriptionText: string;
  projectUsage: string[];
  templateUsage: string[];
};

export type LoraTrainingTemplate = {
  id: string;
  title: string;
  status: "active" | "archived";
  updatedAt: string;
  description: string;
  imageGuidance: string;
  captionGuidance: string;
  sectionCount: number;
  sections: Array<{
    id: string;
    title: string;
    enabled: boolean;
    blockCount: number;
    blocks: LoraTrainingSectionBlock[];
    resolvedScene: string;
    scenePreview: string;
  }>;
};

export type LoraTrainingData = {
  projects: LoraTrainingProject[];
  runs: LoraTrainingRun[];
  presets: LoraTrainingPreset[];
  templates: LoraTrainingTemplate[];
};
