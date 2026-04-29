import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "auth_token";

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

  return getHeaderToken(request) === authToken;
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/mcp")) return true;
  // Server-side internal API calls (no browser cookie available)
  if (pathname.startsWith("/api/projects/")) return true;
  if (pathname.startsWith("/api/queue")) return true;
  if (pathname.startsWith("/api/loras/")) return true;
  if (pathname.startsWith("/api/runs/")) return true;
  if (pathname.startsWith("/api/trash")) return true;
  if (pathname.startsWith("/api/images/")) return true;
  if (pathname.startsWith("/api/audit-logs")) return true;
  if (pathname.startsWith("/api/logs")) return true;
  if (pathname.startsWith("/api/path-maps")) return true;
  if (pathname.startsWith("/api/worker/")) return true;
  if (pathname.startsWith("/api/comfy/")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (pathname.startsWith("/api/agent/")) return true;
  if (pathname.startsWith("/api/project-create-options")) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") && hasValidHeaderToken(request)) {
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    response.headers.set("x-auth-mode", "header-token");
    return response;
  }

  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  // Only check cookie existence (actual token validation by /api/auth/verify)
  const hasCookie = request.cookies.has(AUTH_COOKIE_NAME);

  if (!hasCookie) {
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

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
