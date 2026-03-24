export type LoraUploadState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const initialLoraUploadState: LoraUploadState = {
  status: "idle",
  message: null,
};
