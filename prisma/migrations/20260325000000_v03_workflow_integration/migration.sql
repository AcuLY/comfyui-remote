-- v0.3 Workflow Integration
-- 1. Remove loraBindings from ScenePreset and StylePreset
ALTER TABLE "ScenePreset" DROP COLUMN IF EXISTS "loraBindings";
ALTER TABLE "StylePreset" DROP COLUMN IF EXISTS "loraBindings";

-- 2. Restructure PositionTemplate: loraBindings → lora1 + lora2, defaultSeedPolicy → 1+2, add defaultKsampler1/2
ALTER TABLE "PositionTemplate" DROP COLUMN IF EXISTS "loraBindings";
ALTER TABLE "PositionTemplate" DROP COLUMN IF EXISTS "defaultLoraConfig";
ALTER TABLE "PositionTemplate" ADD COLUMN "lora1" JSONB;
ALTER TABLE "PositionTemplate" ADD COLUMN "lora2" JSONB;
ALTER TABLE "PositionTemplate" ADD COLUMN "defaultKsampler1" JSONB;
ALTER TABLE "PositionTemplate" ADD COLUMN "defaultKsampler2" JSONB;

-- Rename defaultSeedPolicy → defaultSeedPolicy1
ALTER TABLE "PositionTemplate" RENAME COLUMN "defaultSeedPolicy" TO "defaultSeedPolicy1";
ALTER TABLE "PositionTemplate" ADD COLUMN "defaultSeedPolicy2" TEXT;

-- 3. Restructure CompleteJobPosition: seedPolicy → 1+2, add ksampler1/2
ALTER TABLE "CompleteJobPosition" RENAME COLUMN "seedPolicy" TO "seedPolicy1";
ALTER TABLE "CompleteJobPosition" ADD COLUMN "seedPolicy2" TEXT;
ALTER TABLE "CompleteJobPosition" ADD COLUMN "ksampler1" JSONB;
ALTER TABLE "CompleteJobPosition" ADD COLUMN "ksampler2" JSONB;
