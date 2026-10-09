import { NextResponse } from "next/server";
import { store } from "@/lib/db";

function success(status) {
  const s = String(status || "").toLowerCase();
  return ["success", "settled", "paid", "completed", "captured", "payment-received", "berhasil"].includes(s);
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Verifikasi token webhook (opsional). Set LYNK_WEBHOOK_TOKEN pada env bila ingin aman.
    const token = process.env.LYNK_WEBHOOK_TOKEN;
    if (token) {
      const got =
        request.headers.get("x-lynk-token") ||
        request.headers.get("x-webhook-token") ||
        (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (got !== token) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }

    // Field umum yang dikirim Lynk.id (normalisasi dari beberapa skema payload).
    const ref = body.payment_ref || body.paymentRef || body.order_id || body.external_id ||
      body.transaction_id || body.id || body.invoice_number || "lynk-" + Date.now();
    const raw_status = body.status || body.payment_status || body.transaction_status ||
      body.event_type || "pending";
    const plan = body.plan || body.metadata?.plan || body.description || "Pro";
    const amount = Number(body.amount || body.gross_amount || body.nominal || 0) || 0;
    const method = body.payment_method || body.method || body.channel || "";

    await store.savePayment({
      plan,
      status: success(raw_status) ? "success" : "pending",
      paymentRef: String(ref),
      amount,
      method,
      note: "sumber: lynk.id",
    });

    return NextResponse.json({ ok: true, received: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}