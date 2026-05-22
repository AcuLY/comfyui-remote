import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import {
  getCharacterLoraJobReport,
  mapCharacterLoraReportError,
  persistCharacterLoraJobReport,
  renderCharacterLoraJobReportMarkdown,
} from "@/server/services/character-lora-training/report-service";

type JobReportRouteContext = {
  params: Promise<{ jobId: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: JobReportRouteContext) {
  const { jobId } = await context.params;
  const format = new URL(request.url).searchParams.get("format");

  try {
    const report = await getCharacterLoraJobReport(jobId);

    if (format === "markdown" || format === "md") {
      return new NextResponse(renderCharacterLoraJobReportMarkdown(report), {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
        },
      });
    }

    return ok(report);
  } catch (error) {
    const mapped = mapCharacterLoraReportError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(_request: Request, context: JobReportRouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await persistCharacterLoraJobReport(jobId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraReportError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
