type JsonObject = Record<string, unknown>;

export type ApplyParamResponse =
  | { ok: true; count: number }
  | { ok: false; error: string };

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCount(payload: JsonObject) {
  const count = payload.count;
  return typeof count === "number" && Number.isFinite(count) ? count : 0;
}

function readError(payload: JsonObject) {
  const error = payload.error;
  if (typeof error === "string") return error;
  if (isObject(error) && typeof error.message === "string") return error.message;
  return "应用失败";
}

export function readApplyParamResponse(payload: unknown): ApplyParamResponse {
  if (!isObject(payload)) {
    return { ok: false, error: "应用失败" };
  }

  if (payload.ok === true) {
    const data = isObject(payload.data) ? payload.data : payload;
    return { ok: true, count: readCount(data) };
  }

  return { ok: false, error: readError(payload) };
}
