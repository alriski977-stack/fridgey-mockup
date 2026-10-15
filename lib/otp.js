// Modul OTP Fridgey (identitas: EMAIL).
// Membuat, meng-hash, dan memverifikasi kode OTP. Pengiriman email dilakukan
// oleh lib/email.js. Tidak ada kode OTP yang di-hardcode.

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

// Email dinormalisasi (huruf kecil, tanpa spasi) sebagai identitas unik akun.
export function normalizeEmail(input) {
  return String(input || "").trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email) {
  if (!email || email.length > 254) return false;
  if (!EMAIL_RE.test(email)) return false;
  // Tolak domain email sekali pakai yang umum dipakai untuk spam/akun palsu.
  const disposable = [
    "mailinator.com",
    "tempmail.com",
    "temp-mail.org",
    "10minutemail.com",
    "guerrillamail.com",
    "yopmail.com",
    "trashmail.com",
    "sharklasers.com",
  ];
  const domain = email.split("@")[1] || "";
  return !disposable.includes(domain);
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
