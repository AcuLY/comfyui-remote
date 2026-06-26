import type {
  QueueControlProgressEvent,
  QueueControlProgressReporter,
} from "@/lib/queue-control-progress";

export function wantsQueueControlStream(request: Request) {
  const url = new URL(request.url);
  return (
    url.searchParams.get("stream") === "1" ||
    request.headers.get("accept")?.includes("text/event-stream") === true
  );
}

function encodeSse(eventName: string, data: unknown) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createQueueControlProgressStream<T>(
  operation: (onProgress: QueueControlProgressReporter) => Promise<T>,
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (eventName: string, data: unknown) => {
        controller.enqueue(encoder.encode(encodeSse(eventName, data)));
      };
      const onProgress: QueueControlProgressReporter = (event: QueueControlProgressEvent) => {
        send("progress", event);
      };

      try {
        const result = await operation(onProgress);
        send("result", result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send("progress", {
          stage: "failed",
          processedRuns: 0,
          totalRuns: 0,
          error: message,
          message,
        } satisfies QueueControlProgressEvent);
        send("result", { ok: false, error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
