import { useSearchParams } from "next/navigation";

export function useResourceUrlSearch() {
  const searchParams = useSearchParams();
  return searchParams.toString();
}
