import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import {
  normalizePhone,
  isValidPhone,
  generateCode,
  hashCode,
  sendOtp,
  otpProviderStatus,
  OTP_NOT_CONFIGURED_MESSAGE,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_PER_HOUR,
} from "@/lib/otp";

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body permintaan tidak valid." }, { status: 400 });
  }

  const phone = normalizePhone(body.phone);
  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { ok: false, error: "Nomor WhatsApp tidak valid. Contoh: 081234567890" },
      { status: 400 }
    );
  }

  const provider = otpProviderStatus();
  if (!provider.configured) {
    return NextResponse.json(
      { ok: false, error: OTP_NOT_CONFIGURED_MESSAGE },
      { status: 503 }
    );
  }

  try {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const sentLastHour = await store.countOtpsSince(phone, hourAgo);
    if (sentLastHour >= OTP_MAX_PER_HOUR) {
      return NextResponse.json(
        { ok: false, error: "Terlalu banyak permintaan OTP. Coba lagi dalam 1 jam." },
        { status: 429 }
      );
    }

    const cooldownSince = new Date(Date.now() - OTP_RESEND_COOLDOWN_MS).toISOString();
    const recent = await store.countOtpsSince(phone, cooldownSince);
    if (recent >= 1) {
      return NextResponse.json(
        { ok: false, error: "Tunggu 60 detik sebelum meminta kode lagi." },
        { status: 429 }
      );
    }

    const code = generateCode();
    await store.clearActiveOtps(phone);
    const otpId = await store.createOtp({
      phone,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    });

    const send = await sendOtp(phone, code);
    if (!send.ok) {
      // Kode tidak sampai ke pengguna: hapus catatannya supaya percobaan
      // berikutnya tidak ikut terkena cooldown maupun batas per jam.
      await store.deleteOtp(otpId).catch(() => {});
      return NextResponse.json({ ok: false, error: send.error }, { status: 502 });
    }

    const payload = {
      ok: true,
      message: send.devCode
        ? "Kode OTP dibuat dalam mode pengujian (belum dikirim lewat WhatsApp)."
        : `Kode OTP dikirim ke WhatsApp ${phone}.`,
      expiresIn: Math.round(OTP_TTL_MS / 1000),
    };
    if (send.devCode) payload.devCode = send.devCode;
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[auth/otp]", e);
    return NextResponse.json(
      { ok: false, error: "Gagal membuat OTP. Coba lagi sebentar." },
      { status: 500 }
    );
  }
}
