import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { DESIGN_DEMO_THEME_COOKIE, resolveDemoTheme } from "./design-demos/routing/sfw";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ComfyUI Manager",
  description: "Mobile-first ComfyUI project, review, and asset manager.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [headersList, cookieStore] = await Promise.all([headers(), cookies()]);
  const pathname = headersList.get("x-pathname") ?? "/";
  const isLoginPage = pathname === "/login";
  const isDesignDemoPage = pathname === "/design-demos" || pathname.startsWith("/design-demos/");
  const isTrainingPage = pathname === "/training" || pathname.startsWith("/training/");
  const designDemoTheme = resolveDemoTheme(cookieStore.get(DESIGN_DEMO_THEME_COOKIE)?.value);

  const content = isLoginPage || isDesignDemoPage || isTrainingPage ? children : <AppShell>{children}</AppShell>;

  return (
    <html
      lang="zh-CN"
      data-design-demo-theme={designDemoTheme}
      data-sfw-mode="off"
      suppressHydrationWarning
      className={cn("antialiased", geistSans.variable, geistMono.variable, "font-sans", geist.variable)}
    >
      <body className="bg-[var(--bg)] text-[var(--fg)]">
        <TooltipProvider>{content}</TooltipProvider>
      </body>
    </html>
  );
}
