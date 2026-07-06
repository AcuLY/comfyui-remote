import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { flatFail, okOnly } from "@/lib/api-response";
import { readJsonBody } from "@/server/http/request-json";

const COOKIE_NAME = "auth_token";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function shouldUseSecureCookie(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return false;

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  if (forwardedProto) return forwardedProto === "https";
  if (request.nextUrl.protocol === "https:") return true;

  const hostname = request.nextUrl.hostname.toLowerCase();
  return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1";
}

function safeTokenCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  const authToken = process.env.AUTH_TOKEN;

  // If no AUTH_TOKEN configured, auth is disabled
  if (!authToken) {
    return flatFail("AUTH_TOKEN is not configured on the server", 500);
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return flatFail("Invalid JSON body", 400);
  }

  const token = typeof body === "object" && body !== null && "token" in body ? (body as { token: string }).token : null;

  if (!token || typeof token !== "string") {
    return flatFail("token field is required", 400);
  }

  if (!safeTokenCompare(token, authToken)) {
    return flatFail("Invalid token", 401);
  }

  // Set cookie and redirect
  const response = okOnly();
  response.cookies.set(COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}
