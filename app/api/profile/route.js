import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { store } from "@/lib/db";
import { isAllowedPhotoUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, user });
}

export async function PUT(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body permintaan tidak valid." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const businessName = String(body.businessName || "").trim();
  const phone = String(body.phone || "").trim();
  const photoUrl = String(body.photoUrl || "").trim();

  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { ok: false, error: "Nama harus 2-60 karakter." },
      { status: 400 }
    );
  }
  if (businessName.length > 80) {
    return NextResponse.json(
      { ok: false, error: "Nama usaha maksimal 80 karakter." },
      { status: 400 }
    );
  }
  if (phone && !/^(0|62|\+62)8\d{8,11}$/.test(phone.replace(/[\s-]/g, ""))) {
    return NextResponse.json(
      { ok: false, error: "Format nomor WhatsApp tidak valid. Contoh: 081234567890" },
      { status: 400 }
    );
  }
  if (!isAllowedPhotoUrl(photoUrl)) {
    return NextResponse.json(
      { ok: false, error: "Foto profil tidak valid. Unggah ulang foto terlebih dahulu." },
      { status: 400 }
    );
  }

  try {
    const updated = await store.updateUser(user.id, { name, businessName, phone, photoUrl });
    return NextResponse.json({ ok: true, user: updated });
  } catch (e) {
    console.error("[profile PUT]", e);
    return NextResponse.json(
      { ok: false, error: "Gagal menyimpan profil. Coba lagi sebentar." },
      { status: 500 }
    );
  }
}
