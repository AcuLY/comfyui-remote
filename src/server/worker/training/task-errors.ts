export class TrainingWorkerTaskError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingWorkerTaskError";
    this.status = status;
    this.details = details;
  }
}

export function mapTrainingWorkerTaskError(error: unknown) {
  if (error instanceof TrainingWorkerTaskError) {
    return {
      details: error.details,
      message: error.message,
      status: error.status,
    };
  }
  return {
    details: error instanceof Error ? error.message : String(error),
    message: "Unexpected training worker task error",
    status: 500,
  };
}
