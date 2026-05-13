import { NextResponse } from "next/server";
import { loadIdentityBundle } from "@/lib/identity/load-identity.server";

export async function GET() {
  const bundle = await loadIdentityBundle();
  return NextResponse.json(bundle);
}