import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { cn } from "@/lib/utils";
import { DESIGN_DEMO_THEME_COOKIE, resolveDemoTheme } from "./design-demos/routing/sfw";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const STANDALONE_ROOT_SURFACE_PREFIXES = ["/design-demos", "/training"] as const;

export const metadata: Metadata = {
  title: "ComfyUI Manager",
  description: "Mobile-first ComfyUI project, review, and asset manager.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

function isRouteUnder(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function shouldSkipAppShell(pathname: string) {
  return pathname === "/login" || STANDALONE_ROOT_SURFACE_PREFIXES.some((prefix) => isRouteUnder(pathname, prefix));
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [headersList, cookieStore] = await Promise.all([headers(), cookies()]);
  const pathname = headersList.get("x-pathname") ?? "/";
  const designDemoTheme = resolveDemoTheme(cookieStore.get(DESIGN_DEMO_THEME_COOKIE)?.value);

  const content = shouldSkipAppShell(pathname) ? children : <AppShell>{children}</AppShell>;

  return (
    <html
      lang="zh-CN"
      data-design-demo-theme={designDemoTheme}
      data-sfw-mode="off"
      suppressHydrationWarning
      className={cn("antialiased", geistSans.variable, geistMono.variable, "font-sans")}
    >
      <body className="bg-[var(--bg)] text-[var(--fg)]">
        <TooltipProvider>{content}</TooltipProvider>
      </body>
    </html>
  );
}
