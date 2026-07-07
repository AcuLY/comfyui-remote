import { NextResponse } from "next/server";
import { failFromError } from "@/lib/api-response";
import { buildRunWorkflowDownload } from "@/server/services/run-workflow-service";
import { getWorkflowDownloadVariant } from "@/server/services/workflow-debug-download";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const variant = getWorkflowDownloadVariant(request.url);

  try {
    const download = await buildRunWorkflowDownload(runId, variant);
    return new NextResponse(download.body, {
      headers: download.headers,
    });
  } catch (error) {
    return failFromError(error, "Failed to build workflow", 500);
  }
}
