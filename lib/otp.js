// Modul OTP Fridgey.
// Membuat, meng-hash, memverifikasi kode OTP, dan mengirimkannya lewat
// penyedia yang dikonfigurasi via environment. Tidak ada kode OTP yang
// di-hardcode; bila penyedia belum dikonfigurasi, pengiriman gagal secara
// eksplisit (bukan sukses palsu).

import crypto from "node:crypto";

const PEPPER = process.env.OTP_PEPPER || "fridgey-otp-pepper";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000; // 5 menit
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 detik
export const OTP_MAX_PER_HOUR = 5;

export function normalizePhone(input) {
  if (!input) return "";
  let p = String(input).replace(/[\s\-().]/g, "");
  if (p.startsWith("+62")) p = "0" + p.slice(3);
  else if (p.startsWith("62")) p = "0" + p.slice(2);
  return p;
}

export function isValidPhone(phone) {
  return /^08\d{8,11}$/.test(phone);
}

export function generateCode() {
  const max = 10 ** OTP_LENGTH;
  return String(crypto.randomInt(0, max)).padStart(OTP_LENGTH, "0");
}

export function hashCode(code) {
  return crypto.createHmac("sha256", PEPPER).update(String(code)).digest("hex");
}

export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function providerMode() {
  if (
    process.env.OTP_PROVIDER === "whatsapp_cloud" &&
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_PHONE_ID
  ) {
    return "whatsapp_cloud";
  }
  if (process.env.OTP_API_URL && process.env.OTP_API_KEY) {
    return "http";
  }
  // Mode dev hanya untuk pengujian lokal dan SELALU nonaktif di produksi,
  // supaya kode OTP tidak pernah tampil di layar pengguna sungguhan.
  if (process.env.OTP_DEV_MODE === "true" && process.env.NODE_ENV !== "production") {
    return "dev";
  }
  return "none";
}

export function otpProviderStatus() {
  const mode = providerMode();
  return { configured: mode !== "none", mode };
}

// Balas satu pesan konfigurasi untuk semua jenis kegagalan (dipakai UI & log server).
export const OTP_NOT_CONFIGURED_MESSAGE =
  "Layanan OTP belum dikonfigurasi di server. Administrator perlu mengatur " +
  "WHATSAPP_TOKEN & WHATSAPP_PHONE_ID (WhatsApp Cloud API), atau OTP_API_URL & OTP_API_KEY.";

async function sendWhatsAppCloud(phone, code) {
  const to = "62" + phone.replace(/^0/, "");
  const url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: `Kode OTP Fridgey Anda: ${code}. Berlaku 5 menit. Jangan bagikan kode ini.` },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `Penyedia WhatsApp menolak (${res.status}). ${detail}`.trim() };
  }
  return { ok: true };
}

async function sendHttp(phone, code) {
  const res = await fetch(process.env.OTP_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OTP_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: phone,
      target: phone,
      message: `Kode OTP Fridgey Anda: ${code}. Berlaku 5 menit.`,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `Penyedia OTP menolak (${res.status}). ${detail}`.trim() };
  }
  return { ok: true };
}

export async function sendOtp(phone, code) {
  const mode = providerMode();
  try {
    if (mode === "whatsapp_cloud") {
      const r = await sendWhatsAppCloud(phone, code);
      return { ...r, delivered: r.ok };
    }
    if (mode === "http") {
      const r = await sendHttp(phone, code);
      return { ...r, delivered: r.ok };
    }
    if (mode === "dev") {
      // Hanya aktif bila OTP_DEV_MODE=true di set secara eksplisit (mis. pengujian).
      return { ok: true, delivered: false, devCode: code };
    }
    return {
      ok: false,
      delivered: false,
      error: OTP_NOT_CONFIGURED_MESSAGE,
    };
  } catch (e) {
    return { ok: false, delivered: false, error: "Gagal menghubungi penyedia OTP: " + String(e) };
  }
}
