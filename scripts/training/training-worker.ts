import process from "node:process";

process.env.TRAINING_MANAGER_API_NAMESPACE = process.env.TRAINING_MANAGER_API_NAMESPACE?.trim() || "training";

await import("../character-lora-training/training-worker");
