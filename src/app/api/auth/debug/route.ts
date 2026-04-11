import { NextResponse } from "next/server";

export async function GET() {
  const authToken = process.env.AUTH_TOKEN;
  return NextResponse.json({
    auth_token_env_length: authToken?.length ?? -1,
    auth_token_env_prefix: authToken?.slice(0, 8) ?? null,
  });
}
