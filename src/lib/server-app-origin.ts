import { headers } from "next/headers";

const DEFAULT_APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getFirstHeaderValue(value: string | null) {
  if (!value) {
    return null;
  }

  const firstValue = value.split(",")[0]?.trim();
  return firstValue || null;
}

function hasExplicitPort(host: string) {
  if (host.startsWith("[")) {
    return /\]:\d+$/.test(host);
  }

  return host.includes(":");
}

function appendForwardedPort(host: string, port: string | null) {
  if (!port || hasExplicitPort(host)) {
    return host;
  }

  return `${host}:${port}`;
}

function isLocalHost(host: string) {
  const normalizedHost = host.toLowerCase();
  const hostname = normalizedHost.startsWith("[") ? normalizedHost.slice(1, normalizedHost.indexOf("]")) : normalizedHost.split(":")[0];

  return (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function getProtocol(host: string, forwardedProto: string | null) {
  if (forwardedProto) {
    return forwardedProto;
  }

  return isLocalHost(host) ? "http" : "https";
}

export async function getServerAppOrigin() {
  try {
    const requestHeaders = await headers();
    const forwardedHost = getFirstHeaderValue(requestHeaders.get("x-forwarded-host"));
    const host = appendForwardedPort(
      forwardedHost ?? getFirstHeaderValue(requestHeaders.get("host")) ?? "",
      getFirstHeaderValue(requestHeaders.get("x-forwarded-port")),
    );

    if (host) {
      const protocol = getProtocol(host, getFirstHeaderValue(requestHeaders.get("x-forwarded-proto")));
      return `${protocol}://${host}`;
    }
  } catch {
    // Fall through to env/default origin when request headers are unavailable.
  }

  return DEFAULT_APP_ORIGIN;
}
