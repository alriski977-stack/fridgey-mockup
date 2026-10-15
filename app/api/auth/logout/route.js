import { NextResponse } from "next/server";
import { destroyCurrentSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await destroyCurrentSession();
  } catch {
    // sesi mungkin sudah tidak ada
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
