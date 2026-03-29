export type ProjectSaveState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type ProjectRunState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type ProjectCopyState = {
  status: "idle" | "success" | "error";
  message: string;
  copiedProjectId?: string;
};

export type ProjectCreateState = {
  status: "idle" | "success" | "error";
  message: string;
  createdProjectId?: string;
};

export const initialProjectSaveState: ProjectSaveState = {
  status: "idle",
  message: "Update the fields and save them to the backend.",
};

export const initialProjectRunState: ProjectRunState = {
  status: "idle",
  message: "Ready to enqueue this project in the backend run queue.",
};

export const initialProjectCopyState: ProjectCopyState = {
  status: "idle",
  message: "Ready to duplicate this project in the backend.",
};

export const initialProjectCreateState: ProjectCreateState = {
  status: "idle",
  message: "Fill in the basics to create a new draft project.",
};
