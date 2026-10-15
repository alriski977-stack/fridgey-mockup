// Modul pengiriman OTP via email untuk Fridgey.
// Provider didukung (pilih via env EMAIL_PROVIDER, atau terdeteksi otomatis):
//   - resend : RESEND_API_KEY                       (paling mudah, tanpa dependency)
//   - smtp   : SMTP_HOST, SMTP_USER, SMTP_PASS      (Gmail/Outlook/SMTP apa pun)
//   - http   : EMAIL_API_URL, EMAIL_API_KEY         (gateway HTTP generik)
// Tidak ada kode OTP yang di-hardcode. Mode uji hanya aktif bila
// OTP_DEV_MODE=true DAN NODE_ENV!=="production" (selalu nonaktif di produksi).

export const OTP_SUBJECT = "Kode OTP Fridgey Anda";

export function emailProviderMode() {
  const explicit = process.env.EMAIL_PROVIDER;
  const available = {
    resend: Boolean(process.env.RESEND_API_KEY),
    smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    http: Boolean(process.env.EMAIL_API_URL && process.env.EMAIL_API_KEY),
  };

  if (explicit && available[explicit]) return explicit;
  if (explicit && explicit !== "dev" && explicit !== "none") return "none";

  for (const name of ["resend", "smtp", "http"]) {
    if (available[name]) return name;
  }
  if (process.env.OTP_DEV_MODE === "true" && process.env.NODE_ENV !== "production") {
    return "dev";
  }
  return "none";
}

export function emailProviderStatus() {
  const mode = emailProviderMode();
  return { configured: mode !== "none", mode };
}

export const EMAIL_NOT_CONFIGURED_MESSAGE =
  "Layanan email OTP belum dikonfigurasi di server. Administrator perlu mengatur " +
  "RESEND_API_KEY, atau SMTP_HOST & SMTP_USER & SMTP_PASS, " +
  "atau EMAIL_API_URL & EMAIL_API_KEY.";

function fromAddress() {
  return process.env.EMAIL_FROM || "Fridgey <onboarding@resend.dev>";
}

function textBody(code) {
  return (
    `Kode OTP Fridgey Anda: ${code}\n\n` +
    `Masukkan kode ini untuk masuk. Kode berlaku 5 menit dan hanya bisa dipakai sekali.\n` +
    `Jangan bagikan kode ini kepada siapa pun.\n\n` +
    `Jika Anda tidak meminta kode ini, abaikan email ini.\n\n` +
    `- Fridgey Smart Pantry`
  );
}

function htmlBody(code) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:24px">
    <div style="background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
      <div style="font-size:20px;font-weight:800;color:#1f2937;margin-bottom:4px">Fridgey<span style="color:#2f7d32">.</span> Smart Pantry</div>
      <p style="color:#6b7280;font-size:13px;margin:0 0 20px">Kode verifikasi untuk masuk</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#111827;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center">${code}</div>
      <p style="color:#374151;font-size:14px;margin:20px 0 4px">Kode ini berlaku <b>5 menit</b> dan hanya bisa dipakai sekali.</p>
      <p style="color:#9ca3af;font-size:12px;margin:0">Jangan bagikan kode ini kepada siapa pun. Jika Anda tidak meminta kode ini, abaikan email ini.</p>
    </div>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:12px">Fridgey Smart Pantry V2 - pengelolaan stok &amp; laporan dapur untuk UMKM kuliner.</p>
  </div>
</body></html>`;
}

async function sendResend(to, code) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject: OTP_SUBJECT,
      text: textBody(code),
      html: htmlBody(code),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `Resend menolak (${res.status}). ${detail}`.trim() };
  }
  return { ok: true };
}

async function sendSmtp(to, code) {
  const nodemailer = (await import("nodemailer")).default;
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: fromAddress(),
    to,
    subject: OTP_SUBJECT,
    text: textBody(code),
    html: htmlBody(code),
  });
  return { ok: true };
}

async function sendHttp(to, code) {
  const headerName = process.env.EMAIL_API_AUTH_HEADER || "Authorization";
  const prefix = process.env.EMAIL_API_AUTH_PREFIX ?? "Bearer";
  const headers = { "Content-Type": "application/json" };
  headers[headerName] = prefix ? `${prefix} ${process.env.EMAIL_API_KEY}` : process.env.EMAIL_API_KEY;
  const res = await fetch(process.env.EMAIL_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: fromAddress(),
      to,
      email: to,
      subject: OTP_SUBJECT,
      code,
      text: textBody(code),
      html: htmlBody(code),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `Penyedia email menolak (${res.status}). ${detail}`.trim() };
  }
  return { ok: true };
}

export async function sendOtpEmail(email, code) {
  const mode = emailProviderMode();
  try {
    if (mode === "dev") {
      return { ok: true, delivered: false, devCode: code };
    }
    let r;
    if (mode === "resend") r = await sendResend(email, code);
    else if (mode === "smtp") r = await sendSmtp(email, code);
    else if (mode === "http") r = await sendHttp(email, code);
    else return { ok: false, delivered: false, error: EMAIL_NOT_CONFIGURED_MESSAGE };
    return { ...r, delivered: r.ok };
  } catch (e) {
    return { ok: false, delivered: false, error: "Gagal mengirim email OTP: " + String(e) };
  }
}
