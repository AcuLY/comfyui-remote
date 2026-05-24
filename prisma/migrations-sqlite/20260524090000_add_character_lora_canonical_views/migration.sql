-- Add explicit four-view metadata for Character LoRA canonical/persona-reference generation.
ALTER TABLE "CharacterLoraCanonicalVersion" ADD COLUMN "canonicalView" TEXT;
ALTER TABLE "CharacterLoraGenerationRun" ADD COLUMN "canonicalView" TEXT;

CREATE INDEX "CharacterLoraCanonicalVersion_jobId_canonicalView_idx" ON "CharacterLoraCanonicalVersion"("jobId", "canonicalView");
CREATE INDEX "CharacterLoraGenerationRun_jobId_canonicalView_idx" ON "CharacterLoraGenerationRun"("jobId", "canonicalView");
