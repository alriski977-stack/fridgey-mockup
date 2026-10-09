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

    // Field umum yang dikirim Lynk.id. Payload bisa di level atas maupun
    // bertingkat (data/payment/transaction) -> kita normalisasi keduanya.
    const nested =
      (body.data && typeof body.data === "object" ? body.data : null) ||
      (body.payment && typeof body.payment === "object" ? body.payment : null) ||
      (body.transaction && typeof body.transaction === "object" ? body.transaction : null) ||
      {};
    const top = body;
    const get = (k, root) => (root && root[k] !== undefined && root[k] !== null ? root[k] : undefined);
    const pick = (...keys) => {
      for (const k of keys) {
        for (const root of [nested, top]) {
          const v = get(k, root);
          if (v !== undefined) return v;
        }
      }
      return undefined;
    };

    const ref = pick("payment_ref", "paymentRef", "order_id", "external_id", "transaction_id", "id", "invoice_number") || "lynk-" + Date.now();
    const raw_status = pick("status", "payment_status", "transaction_status", "event_type", "event", "type") || "pending";
    const amount = Number(pick("amount", "gross_amount", "nominal", "total", "value") || 0) || 0;
    const method = pick("payment_method", "method", "channel", "payment_channel") || "";

    // Deteksi paket dari teks, lalu fallback dari nominal.
    const planText = String(pick("plan", "description", "item_name") || "").toLowerCase();
    const plan = /pro\b/.test(planText)
      ? "Pro"
      : /starter|bulanan/.test(planText)
        ? "Starter"
        : /trial|coba/.test(planText)
          ? "Trial"
          : amount >= 120000 ? "Pro" : amount >= 60000 ? "Starter" : "Trial";

    await store.savePayment({
      plan,
      status: success(raw_status) ? "success" : "pending",
      paymentRef: String(ref),
      amount,
      method,
      note: "sumber: lynk.id (normalisasi payload)",
    });

    return NextResponse.json({ ok: true, received: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}