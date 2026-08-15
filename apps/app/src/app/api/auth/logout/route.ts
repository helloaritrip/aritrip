import { NextRequest, NextResponse } from "next/server";
import { USER_SESSION_COOKIE } from "@/lib/requireUserSession";
import { corsHeaders } from "@/lib/cors";

// CORS agregado (2026-08-15) — el menú de cuenta de aritrips.com
// (AccountMenu.tsx en apps/www) ahora tiene su propio "Sign out", cross-
// origin igual que /api/auth/me y /api/account.
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"));
  const res = NextResponse.json({ ok: true }, { headers });
  res.cookies.set(USER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    domain: ".aritrips.com",
    maxAge: 0,
  });
  return res;
}
