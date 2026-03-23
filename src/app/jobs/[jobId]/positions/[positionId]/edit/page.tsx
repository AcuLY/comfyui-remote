import { notFound } from "next/navigation";
import { getJobDetail } from "@/lib/server-data";
import { JobPositionEditForm } from "./job-position-edit-form";

export default async function JobPositionEditPage({ params }: { params: Promise<{ jobId: string; positionId: string }> }) {
  const { jobId, positionId } = await params;
  const job = await getJobDetail(jobId);

  if (!job) {
    notFound();
  }

  const firstPosition = job.positions[0];
  const position = job.positions.find((item) => item.id === positionId) ?? (
    firstPosition
      ? { ...firstPosition, id: positionId, name: positionId }
      : {
          id: positionId,
          name: positionId,
          enabled: true,
          aspectRatio: "3:4",
          batchSize: 8,
          seedPolicy: "random-per-run",
          promptOverview: {
            templatePrompt: "1girl, standing, outdoor, detailed pose...",
            positivePrompt: "1girl, standing, outdoor, detailed pose...",
            negativePrompt: "lowres, blurry, extra fingers...",
          },
          latestRun: null,
        }
  );
  const positivePrompt = position.promptOverview.positivePrompt || position.promptOverview.templatePrompt;

  return <JobPositionEditForm jobId={job.id} position={position} positivePrompt={positivePrompt} />;
}
