import { getSummary } from "@/lib/items";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await getSummary()) });
  } catch (e) {
    console.error("[reports GET]", e);
    return NextResponse.json(
      { ok: false, error: "Gagal memuat ringkasan laporan." },
      { status: 500 }
    );
  }
}