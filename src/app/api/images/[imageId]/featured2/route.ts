import { NextRequest } from "next/server";
import { handleFeaturedToggle } from "../featured-helper";

type RouteContext = {
  params: Promise<{ imageId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  return handleFeaturedToggle(request, context, "featured2");
}
