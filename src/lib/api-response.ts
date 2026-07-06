import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function okOnly(init?: ResponseInit) {
  return NextResponse.json({ ok: true }, init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: { message, details } }, { status });
}

export function flatFail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function readErrorStatus(error: Error) {
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function readErrorDetails(error: Error) {
  return (error as { details?: unknown }).details;
}

export function failFromError(error: unknown, fallbackMessage = "Unknown error", fallbackStatus = 500) {
  if (error instanceof Error) {
    return fail(error.message, readErrorStatus(error) ?? fallbackStatus, readErrorDetails(error));
  }

  return fail(fallbackMessage, fallbackStatus);
}
