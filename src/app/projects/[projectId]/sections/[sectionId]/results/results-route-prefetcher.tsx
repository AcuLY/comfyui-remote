"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ResultsRoutePrefetcher({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  const hrefKey = hrefs.join("\n");

  useEffect(() => {
    if (!hrefKey) return;

    for (const href of hrefKey.split("\n")) {
      if (href) {
        router.prefetch(href);
      }
    }
  }, [hrefKey, router]);

  return null;
}
