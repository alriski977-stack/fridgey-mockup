import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { normalizeEmail, isValidEmail, hashCode, safeEqual, OTP_MAX_ATTEMPTS } from "@/lib/otp";

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body permintaan tidak valid." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const otp = String(body.otp || "").trim();

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Alamat email tidak valid." }, { status: 400 });
  }
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json({ ok: false, error: "Kode OTP harus 6 digit angka." }, { status: 400 });
  }

  try {
    const record = await store.getLatestOtp(email);
    if (!record) {
      return NextResponse.json(
        { ok: false, error: "Kode OTP tidak ditemukan. Minta kode baru." },
        { status: 400 }
      );
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      await store.consumeOtp(record.id);
      return NextResponse.json(
        { ok: false, error: "Kode OTP sudah kedaluwarsa. Minta kode baru." },
        { status: 400 }
      );
    }

    if ((record.attempts || 0) >= OTP_MAX_ATTEMPTS) {
      await store.consumeOtp(record.id);
      return NextResponse.json(
        { ok: false, error: "Terlalu banyak percobaan salah. Minta kode baru." },
        { status: 429 }
      );
    }

    if (!safeEqual(record.code_hash, hashCode(otp))) {
      await store.incrementOtpAttempts(record.id);
      return NextResponse.json({ ok: false, error: "Kode OTP salah." }, { status: 400 });
    }

    await store.consumeOtp(record.id);
    const user = await store.ensureUser(email);
    const { token, expiresAt } = await createSession(user.id);

    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        businessName: user.businessName,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(expiresAt),
    });
    return res;
  } catch (e) {
    console.error("[auth/verify]", e);
    return NextResponse.json(
      { ok: false, error: "Gagal memverifikasi kode OTP. Coba lagi sebentar." },
      { status: 500 }
    );
  }
}
