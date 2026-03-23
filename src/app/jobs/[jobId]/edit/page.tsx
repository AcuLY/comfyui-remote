import { notFound } from "next/navigation";
import { getJobDetail } from "@/lib/server-data";
import { JobEditForm } from "./job-edit-form";

export default async function JobEditPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJobDetail(jobId);

  if (!job) {
    notFound();
  }

  const primaryPosition = job.positions[0];
  const aspectRatioOptions = Array.from(
    new Set([primaryPosition?.aspectRatio].filter((value): value is string => Boolean(value)).concat(["3:4", "4:3", "1:1"])),
  );
  const characterLoraPath = job.promptOverview.characterLoraPath || job.character.loraPath;
  const defaultAspectRatio = primaryPosition?.aspectRatio ?? "";

  return (
    <JobEditForm
      job={job}
      aspectRatioOptions={aspectRatioOptions}
      characterLoraPath={characterLoraPath}
      defaultAspectRatio={defaultAspectRatio}
    />
  );
}
