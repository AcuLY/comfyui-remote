"use client";

import { useSearchParams } from "next/navigation";

export function useUrlSearch() {
  const searchParams = useSearchParams();
  return searchParams.toString();
}
