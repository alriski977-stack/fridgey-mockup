"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const COOLDOWN_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devCode, setDevCode] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function requestOtp(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    setDevCode("");
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError("Alamat email tidak valid. Contoh: nama@email.com");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Gagal mengirim kode OTP.");
        return;
      }
      setEmail(clean);
      setStep(2);
      setMsg(data.message || "Kode OTP dikirim.");
      if (data.devCode) setDevCode(data.devCode);
      setCooldown(COOLDOWN_SECONDS);
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || loading) return;
    setError("");
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Gagal mengirim ulang kode.");
        return;
      }
      setMsg(data.message || "Kode OTP dikirim ulang.");
      if (data.devCode) setDevCode(data.devCode);
      setCooldown(COOLDOWN_SECONDS);
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Kode OTP harus 6 digit angka.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Gagal masuk.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          Fridgey<span>.</span> Smart Pantry
        </div>
        <div className="tag">
          Kelola stok bahan makanan &amp; hemat biaya dapur untuk UMKM kuliner.
          Login tanpa kata sandi - cukup email Anda.
        </div>

        {step === 1 ? (
          <form onSubmit={requestOtp}>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Alamat email (mis. nama@email.com)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <button className="btn" style={{ width: "100%" }} type="submit" disabled={loading}>
              {loading ? "Mengirim..." : "Kirim Kode OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <div className="tag">Kode OTP dikirim ke email {email}</div>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="Masukkan 6 digit kode"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              disabled={loading}
            />
            <button className="btn" style={{ width: "100%" }} type="submit" disabled={loading}>
              {loading ? "Memverifikasi..." : "Masuk ke Dashboard"}
            </button>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="btn ghost"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={resend}
                disabled={cooldown > 0 || loading}
              >
                {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : "Kirim ulang kode"}
              </button>
              <button
                type="button"
                className="btn ghost"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => {
                  setStep(1);
                  setOtp("");
                  setError("");
                  setMsg("");
                  setDevCode("");
                }}
                disabled={loading}
              >
                Ganti email
              </button>
            </div>
          </form>
        )}

        {msg && <p style={{ fontSize: 13, color: "#2f7d32", marginTop: 12 }}>{msg}</p>}
        {devCode && (
          <p style={{ fontSize: 12, color: "#c77700", marginTop: 6 }}>
            Mode pengujian aktif: kode OTP = {devCode}
          </p>
        )}
        {error && <p style={{ fontSize: 13, color: "#c0392b", marginTop: 12 }}>{error}</p>}

        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 16 }}>
          Fridgey Smart Pantry V2 - pengelolaan stok &amp; laporan dapur untuk UMKM kuliner.
        </p>
      </div>
    </div>
  );
}
