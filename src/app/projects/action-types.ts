export type ProjectSaveState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialProjectSaveState: ProjectSaveState = {
  status: "idle",
  message: "Update the fields and save them to the backend.",
};
