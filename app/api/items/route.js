import { addItem, updateStatus, getAllItems } from "@/lib/items";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ items: await getAllItems() });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const id = await addItem({
      name: body.name,
      qty: Number(body.qty) || 0,
      unit: body.unit || "pcs",
      unitCost: Number(body.unitCost) || 0,
      expiry: body.expiry,
      category: body.category || "Lainnya",
      source: body.source || "manual",
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    await updateStatus(body.id, body.status, body.note || "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}