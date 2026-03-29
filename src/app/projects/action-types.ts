export type JobSaveState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type JobRunState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type JobCopyState = {
  status: "idle" | "success" | "error";
  message: string;
  copiedJobId?: string;
};

export type JobCreateState = {
  status: "idle" | "success" | "error";
  message: string;
  createdJobId?: string;
};

export const initialJobSaveState: JobSaveState = {
  status: "idle",
  message: "Update the fields and save them to the backend.",
};

export const initialJobRunState: JobRunState = {
  status: "idle",
  message: "Ready to enqueue this job in the backend run queue.",
};

export const initialJobCopyState: JobCopyState = {
  status: "idle",
  message: "Ready to duplicate this job in the backend.",
};

export const initialJobCreateState: JobCreateState = {
  status: "idle",
  message: "Fill in the basics to create a new draft job.",
};
