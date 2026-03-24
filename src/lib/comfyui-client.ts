/**
 * ComfyUI HTTP API Client
 *
 * Wraps the ComfyUI REST API for prompt submission and history polling.
 * ComfyUI API docs: https://docs.comfy.org/essentials/comfyui_server
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single node in the ComfyUI workflow prompt */
export type ComfyNode = {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
};

/** The full prompt payload sent to /prompt */
export type ComfyPromptPayload = {
  prompt: Record<string, ComfyNode>;
  client_id?: string;
};

/** Response from POST /prompt */
export type ComfyPromptResponse = {
  prompt_id: string;
  number: number;
  node_errors: Record<string, unknown>;
};

/** A single output image entry from /history */
export type ComfyOutputImage = {
  filename: string;
  subfolder: string;
  type: string; // "output" or "temp"
};

/** History entry for a single prompt */
export type ComfyHistoryEntry = {
  prompt: [number, string, Record<string, ComfyNode>, unknown, unknown];
  outputs: Record<
    string,
    {
      images?: ComfyOutputImage[];
    }
  >;
  status: {
    status_str: string; // "success" | "error"
    completed: boolean;
  };
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ComfyUIClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? process.env.COMFYUI_URL ?? "http://127.0.0.1:8188").replace(
      /\/$/,
      ""
    );
  }

  /** Check if ComfyUI server is reachable */
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/system_stats`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Submit a prompt to ComfyUI. Returns prompt_id. */
  async submitPrompt(payload: ComfyPromptPayload): Promise<ComfyPromptResponse> {
    const res = await fetch(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ComfyUI /prompt failed (${res.status}): ${text}`);
    }

    return (await res.json()) as ComfyPromptResponse;
  }

  /** Get history for a specific prompt_id. Returns null if not found yet. */
  async getHistory(promptId: string): Promise<ComfyHistoryEntry | null> {
    const res = await fetch(`${this.baseUrl}/history/${promptId}`);
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, ComfyHistoryEntry>;
    return data[promptId] ?? null;
  }

  /**
   * Poll /history until the prompt is done.
   * @param promptId  The prompt_id returned from submitPrompt
   * @param interval  Polling interval in ms (default 2000)
   * @param timeout   Max wait time in ms (default 300000 = 5 minutes)
   */
  async waitForCompletion(
    promptId: string,
    interval = 2000,
    timeout = 300_000
  ): Promise<ComfyHistoryEntry> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const entry = await this.getHistory(promptId);

      if (entry?.status?.completed) {
        return entry;
      }

      await sleep(interval);
    }

    throw new Error(`ComfyUI prompt ${promptId} timed out after ${timeout}ms`);
  }

  /**
   * Download a generated image from ComfyUI.
   * @param filename   The filename from outputs
   * @param subfolder  The subfolder from outputs
   * @param type       "output" or "temp"
   * @returns ArrayBuffer of the image data
   */
  async downloadImage(
    filename: string,
    subfolder: string,
    type = "output"
  ): Promise<ArrayBuffer> {
    const params = new URLSearchParams({ filename, subfolder, type });
    const res = await fetch(`${this.baseUrl}/view?${params}`);

    if (!res.ok) {
      throw new Error(`ComfyUI /view failed (${res.status}): ${filename}`);
    }

    return res.arrayBuffer();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Default shared client instance */
let _client: ComfyUIClient | null = null;
export function getComfyUIClient(): ComfyUIClient {
  if (!_client) {
    _client = new ComfyUIClient();
  }
  return _client;
}
