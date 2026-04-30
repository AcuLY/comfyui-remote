import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { SFW_MODE_ATTRIBUTE, SFW_MODE_STORAGE_KEY } from "@/lib/sfw-mode";

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
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/";
  const isLoginPage = pathname === "/login";

  const content = isLoginPage ? children : <AppShell>{children}</AppShell>;

  return (
    <html
      lang="zh-CN"
      data-sfw-mode="off"
      suppressHydrationWarning
      className={cn("antialiased", geistSans.variable, geistMono.variable, "font-sans", geist.variable)}
    >
      <body className="bg-[var(--bg)] text-[var(--fg)]">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.setAttribute(${JSON.stringify(SFW_MODE_ATTRIBUTE)},localStorage.getItem(${JSON.stringify(SFW_MODE_STORAGE_KEY)})==="on"?"on":"off")}catch(e){document.documentElement.setAttribute(${JSON.stringify(SFW_MODE_ATTRIBUTE)},"off")}`,
          }}
        />
        <TooltipProvider>{content}</TooltipProvider>
      </body>
    </html>
  );
}
