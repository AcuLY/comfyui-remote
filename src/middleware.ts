import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "auth_token";

// Routes that don't require auth
const PUBLIC_PATHS = ["/login", "/favicon.ico"];

function isPublicPath(pathname: string): boolean {
  // Exact match for public paths
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Auth endpoints (login page needs to verify token)
  if (pathname.startsWith("/api/auth/")) return true;
  // Next.js internals
  if (pathname.startsWith("/_next")) return true;
  // MCP transport (not browser-based)
  if (pathname.startsWith("/api/mcp")) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes (pass through without auth, but add pathname header for layout)
  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  const authToken = process.env.AUTH_TOKEN;

  // If no AUTH_TOKEN configured, skip auth entirely
  if (!authToken) {
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // Check cookie value with timing-safe comparison
  if (!cookieToken || !timingSafeEqual(cookieToken, authToken)) {
    // API routes get 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Valid auth_token cookie required" },
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
    // Page routes redirect to login
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
    // Match all paths except _next/static, _next/image (handled by isPublicPath)
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Falls back to regular comparison if lengths differ.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (crypto.subtle as any).timingSafeEqual(aBuf, bBuf) as boolean;
  } catch {
    return false;
  }
}
