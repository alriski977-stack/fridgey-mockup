import db from "@/lib/db";

export async function POST(request) {
  const { phone, otp } = await request.json();
  if (!phone || !otp) {
    return Response.json({ ok: false, error: "Nomor dan OTP wajib diisi" }, { status: 400 });
  }
  // Mockup: OTP apa pun selain kosong dianggap benar
  return Response.json({ ok: true, token: "mock-token-" + phone });
}