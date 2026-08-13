import { NextResponse } from "next/server";
import { USER_SESSION_COOKIE } from "@/lib/requireUserSession";

export async function POST() {
  const res = NextResponse.json({ ok: true });
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
