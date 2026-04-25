import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/";
  const isLoginPage = pathname === "/login";

  const content = isLoginPage ? children : <AppShell>{children}</AppShell>;

  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full bg-[var(--bg)] text-[var(--fg)]">
        {content}
      </body>
    </html>
  );
}
