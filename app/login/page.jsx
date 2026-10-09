"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [msg, setMsg] = useState("");

  async function requestOtp(e) {
    e.preventDefault();
    if (!/^08\d{8,11}$/.test(phone.replace(/[\s-]/g, ""))) {
      setMsg("Nomor tidak valid. Contoh: 081234567890");
      return;
    }
    setMsg("Kode OTP dikirim (mock: 123456)");
    setStep(2);
  }

  async function verify(e) {
    e.preventDefault();
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp }),
    });
    const data = await res.json();
    if (data.ok) {
      router.push("/dashboard");
    } else {
      setMsg(data.error || "Gagal masuk");
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          Fridgey<span>.</span> Smart Pantry
        </div>
        <div className="tag">
          Kelola stok bahan makanan & hemat biaya dapur untuk UMKM kuliner.
          Login tanpa kata sandi - cukup nomor WhatsApp.
        </div>

        {step === 1 ? (
          <form onSubmit={requestOtp}>
            <input
              className="input"
              type="tel"
              placeholder="Nomor WhatsApp (mis. 081234567890)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button className="btn" style={{ width: "100%" }} type="submit">
              Kirim Kode OTP
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <div className="tag">Kode OTP dikirim ke {phone}</div>
            <input
              className="input"
              type="text"
              placeholder="6 digit kode (mock: 123456)"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <button className="btn" style={{ width: "100%" }} type="submit">
              Masuk ke Dashboard
            </button>
          </form>
        )}

        {msg && (
          <p style={{ fontSize: 13, color: "#2f7d32", marginTop: 12 }}>{msg}</p>
        )}

        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 16 }}>
          Mockup UI/UX - Next.js + SQLite3. OTP disimulasikan.
        </p>
      </div>
    </div>
  );
}