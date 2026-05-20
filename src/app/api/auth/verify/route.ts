import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "auth_token";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

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
    return NextResponse.json({ error: "AUTH_TOKEN is not configured on the server" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body === "object" && body !== null && "token" in body ? (body as { token: string }).token : null;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token field is required" }, { status: 400 });
  }

  if (!safeTokenCompare(token, authToken)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Set cookie and redirect
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}
