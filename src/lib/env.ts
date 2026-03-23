export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  comfyApiUrl: process.env.COMFY_API_URL ?? "http://127.0.0.1:8188",
  loraBaseDir: process.env.LORA_BASE_DIR ?? "",
  imageBaseDir: process.env.IMAGE_BASE_DIR ?? "",
};

export function assertEnv() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }
}
