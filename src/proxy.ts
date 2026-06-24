import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

const AUTH_COOKIE_NAME = "auth_token";

/**
 * Timing-safe string comparison. Returns false for empty strings or
 * mismatched lengths without leaking length info via timing.
 */
function safeTokenCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    // Compare bufA against itself to keep constant time, then return false
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function getHeaderToken(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const bearerToken = authorization.slice("bearer ".length).trim();
    if (bearerToken) {
      return bearerToken;
    }
  }

  return (
    request.headers.get("x-api-token")?.trim() ||
    request.headers.get("x-auth-token")?.trim() ||
    null
  );
}

function hasValidHeaderToken(request: NextRequest) {
  const authToken = process.env.AUTH_TOKEN;
  if (!authToken) {
    return false;
  }

  const headerToken = getHeaderToken(request);
  if (!headerToken) return false;
  return safeTokenCompare(headerToken, authToken);
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/_next")) return true;
  return false;
}

function nextWithRequestContext(
  request: NextRequest,
  pathname: string,
  options: { authMode?: string } = {},
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  if (options.authMode) {
    requestHeaders.set("x-auth-mode", options.authMode);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("x-pathname", pathname);
  if (options.authMode) {
    response.headers.set("x-auth-mode", options.authMode);
  }
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") && hasValidHeaderToken(request)) {
    return nextWithRequestContext(request, pathname, { authMode: "header-token" });
  }

  if (isPublicPath(pathname)) {
    return nextWithRequestContext(request, pathname);
  }

  // Validate cookie value against AUTH_TOKEN using timing-safe comparison
  const cookieValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authToken = process.env.AUTH_TOKEN;
  const hasValidCookie = !!(cookieValue && authToken && safeTokenCompare(cookieValue, authToken));

  if (!hasValidCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Valid auth_token cookie required" },
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return nextWithRequestContext(request, pathname);
}

export const config = {
  matcher: [
    "/((?!_next/).*)",
  ],
};
