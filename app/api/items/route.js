import { addItem, updateStatus, getAllItems } from "@/lib/items";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 });
  }
  return user;
}

export async function GET() {
  const user = await requireUser();
  if (!user.id) return user;
  try {
    return NextResponse.json({ ok: true, items: await getAllItems(user.id) });
  } catch (e) {
    console.error("[items GET]", e);
    return NextResponse.json(
      { ok: false, error: "Gagal memuat daftar bahan." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const user = await requireUser();
  if (!user.id) return user;
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const qty = Number(body.qty);
    const unitCost = Number(body.unitCost);
    const expiry = String(body.expiry || "").trim();

    if (name.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Nama bahan minimal 2 karakter." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json(
        { ok: false, error: "Jumlah (qty) harus lebih dari 0." },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      return NextResponse.json(
        { ok: false, error: "Tanggal kedaluwarsa wajib diisi." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      return NextResponse.json(
        { ok: false, error: "Harga satuan tidak valid." },
        { status: 400 }
      );
    }

    const id = await addItem(user.id, {
      name,
      qty,
      unit: String(body.unit || "pcs").trim() || "pcs",
      unitCost,
      expiry,
      category: String(body.category || "Lainnya").trim() || "Lainnya",
      source: body.source || "manual",
      photoUrl: body.photoUrl || "",
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    console.error("[items POST]", e);
    return NextResponse.json(
      { ok: false, error: "Gagal menyimpan bahan. Coba lagi sebentar." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const user = await requireUser();
  if (!user.id) return user;
  try {
    const body = await request.json();
    const status = String(body.status || "").trim();
    if (!["tersimpan", "dipakai", "terbuang"].includes(status)) {
      return NextResponse.json(
        { ok: false, error: "Status bahan tidak dikenal." },
        { status: 400 }
      );
    }
    if (!Number.isInteger(Number(body.id))) {
      return NextResponse.json({ ok: false, error: "ID bahan tidak valid." }, { status: 400 });
    }
    await updateStatus(user.id, Number(body.id), status, String(body.note || ""));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[items PATCH]", e);
    return NextResponse.json(
      { ok: false, error: "Gagal memperbarui status bahan." },
      { status: 500 }
    );
  }
}
