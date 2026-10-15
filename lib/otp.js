// Modul OTP Fridgey.
// Membuat, meng-hash, memverifikasi kode OTP, dan mengirimkannya lewat
// penyedia WhatsApp yang dikonfigurasi via environment. Tidak ada kode OTP yang
// di-hardcode; bila penyedia belum dikonfigurasi, pengiriman gagal secara
// eksplisit (bukan sukses palsu). Mode uji SELALU nonaktif di produksi.

import crypto from "node:crypto";

const PEPPER = process.env.OTP_PEPPER || "fridgey-otp-pepper";
if (!process.env.OTP_PEPPER && process.env.NODE_ENV === "production") {
  console.warn(
    "[otp] OTP_PEPPER belum diatur; memakai pepper default. Set OTP_PEPPER di produksi."
  );
}

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
  if (!/^08\d{8,11}$/.test(phone)) return false;
  // Tolak nomor yang jelas tidak nyata (seluruh digit pelanggan sama, mis. 0811111111).
  const subscriber = phone.slice(2);
  if (/^(\d)\1+$/.test(subscriber)) return false;
  return true;
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

// Menentukan penyedia pengiriman. Bila OTP_PROVIDER diisi eksplisit, hanya
// penyedia itu yang dipakai (tidak menebak provider lain agar tidak salah kirim).
export function providerMode() {
  const explicit = process.env.OTP_PROVIDER;
  const available = {
    whatsapp_cloud: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
    fonnte: Boolean(process.env.FONNTE_TOKEN),
    wablas: Boolean(process.env.WABLAS_TOKEN),
    generic: Boolean(process.env.OTP_API_URL && process.env.OTP_API_KEY),
  };

  if (explicit && available[explicit]) return explicit;
  if (explicit && explicit !== "dev" && explicit !== "none") return "none";

  for (const name of ["whatsapp_cloud", "fonnte", "wablas", "generic"]) {
    if (available[name]) return name;
  }
  if (process.env.OTP_DEV_MODE === "true" && process.env.NODE_ENV !== "production") {
    return "dev";
  }
  return "none";
}

export function otpProviderStatus() {
  const mode = providerMode();
  return { configured: mode !== "none", mode };
}

// Satu pesan konfigurasi untuk semua jenis kegagalan (dipakai UI & log server).
export const OTP_NOT_CONFIGURED_MESSAGE =
  "Layanan OTP WhatsApp belum dikonfigurasi di server. Administrator perlu mengatur " +
  "salah satu: FONNTE_TOKEN, WABLAS_TOKEN, (WHATSAPP_TOKEN & WHATSAPP_PHONE_ID), " +
  "atau (OTP_API_URL & OTP_API_KEY).";

function otpText(code) {
  return `Kode OTP Fridgey Anda: ${code}. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`;
}

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
      text: { body: otpText(code) },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `Penyedia WhatsApp menolak (${res.status}). ${detail}`.trim() };
  }
  return { ok: true };
}

// Fonnte (Indonesia): header Authorization = token, body { target, message }.
async function sendFonnte(phone, code) {
  const url = process.env.FONNTE_API_URL || "https://api.fonnte.com/send";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: process.env.FONNTE_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: phone,
      message: otpText(code),
      countryCode: "62",
    }),
  });
  const data = await res.json().catch(() => ({}));
  const rejected =
    data && (data.status === false || data.status === "false");
  if (!res.ok || rejected) {
    const reason = data.reason || data.detail || `HTTP ${res.status}`;
    return { ok: false, error: `Fonnte menolak pengiriman: ${reason}` };
  }
  return { ok: true };
}

// Wablas (Indonesia): header Authorization = token, body { phone, message }.
async function sendWablas(phone, code) {
  const domain = (process.env.WABLAS_DOMAIN || "https://console.wablas.com").replace(/\/$/, "");
  const res = await fetch(`${domain}/api/send-message`, {
    method: "POST",
    headers: {
      Authorization: process.env.WABLAS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone, message: otpText(code) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    const reason = data.message || `HTTP ${res.status}`;
    return { ok: false, error: `Wablas menolak pengiriman: ${reason}` };
  }
  return { ok: true };
}

// Penyedia HTTP generik (mis. gateway lain). Header & prefix bisa dikonfigurasi.
async function sendGeneric(phone, code) {
  const headerName = process.env.OTP_API_AUTH_HEADER || "Authorization";
  const prefix = process.env.OTP_API_AUTH_PREFIX ?? "Bearer";
  const headers = { "Content-Type": "application/json" };
  headers[headerName] = prefix ? `${prefix} ${process.env.OTP_API_KEY}` : process.env.OTP_API_KEY;
  const res = await fetch(process.env.OTP_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to: phone,
      target: phone,
      phone,
      code,
      message: otpText(code),
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
    if (mode === "dev") {
      // Hanya aktif bila OTP_DEV_MODE=true DAN NODE_ENV!=="production".
      return { ok: true, delivered: false, devCode: code };
    }
    let r;
    if (mode === "whatsapp_cloud") r = await sendWhatsAppCloud(phone, code);
    else if (mode === "fonnte") r = await sendFonnte(phone, code);
    else if (mode === "wablas") r = await sendWablas(phone, code);
    else if (mode === "generic") r = await sendGeneric(phone, code);
    else return { ok: false, delivered: false, error: OTP_NOT_CONFIGURED_MESSAGE };
    return { ...r, delivered: r.ok };
  } catch (e) {
    return { ok: false, delivered: false, error: "Gagal menghubungi penyedia OTP: " + String(e) };
  }
}
