"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TambahPage() {
  const router = useRouter();
  const [method, setMethod] = useState("photo");
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    name: "Bayam Segar",
    qty: 2,
    unit: "ikat",
    unitCost: 5000,
    expiry: "2026-10-03",
    category: "Sayur",
    source: "photo",
  });

  function simulateScan(e) {
    e.preventDefault();
    // Simulasi OCR/barcode mengisi form otomatis
    setResult({
      detected: true,
      message:
        "OCR mendeteksi: 'Bayam Segar' - tanggal pada label: 03 Okt 2026. Verifikasi lalu simpan.",
    });
    setForm({
      name: "Bayam Segar",
      qty: 2,
      unit: "ikat",
      unitCost: 5000,
      expiry: "2026-10-03",
      category: "Sayur",
      source: "photo",
    });
  }

  async function save(e) {
    e.preventDefault();
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg("Item berhasil disimpan ke SQLite!");
      setTimeout(() => router.push("/stok"), 900);
    } else {
      setMsg("Gagal menyimpan: " + data.error);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Tambah Bahan</h1>
        <span className="user">Input chat-first: sekali konfirmasi</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {[
          ["photo", "Foto / OCR"],
          ["barcode", "Scan Barcode"],
          ["manual", "Manual"],
        ].map(([k, label]) => (
          <button
            key={k}
            className={`btn ${method === k ? "" : "ghost"}`}
            onClick={(e) => {
              e.preventDefault();
              setMethod(k);
              setForm((f) => ({ ...f, source: k }));
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={method === "photo" ? simulateScan : save}>
        {method === "photo" && (
          <div className="upload">
            <div className="big">📷</div>
            <div>
              Foto struk / kemasan bahan. OCR membaca nama & tanggal kedaluwarsa (simulasi).
            </div>
            {!result && (
              <button
                className="btn"
                type="submit"
                style={{ marginTop: 14 }}
                onClick={(e) => e.preventDefault()}
              >
                Ambil/Mock Foto & Deteksi
              </button>
            )}
          </div>
        )}

        {method === "barcode" && (
          <div className="upload">
            <div className="big">▌▐</div>
            <div>
              Scan barcode untuk identifikasi produk (barcode tidak memuat tanggal expiry -
              pengguna memasukkan tanggal / verifikasi dari label).
            </div>
          </div>
        )}

        {result && (
          <p
            style={{
              background: "#e8f5e9",
              border: "1px solid #b9d8bc",
              color: "#1b5e20",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {result.message}
          </p>
        )}

        <div className="form-row">
          <input
            className="input"
            placeholder="Nama bahan"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="input"
            placeholder="Kategori"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </div>
        <div className="form-row">
          <input
            className="input"
            type="number"
            placeholder="Qty"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: e.target.value })}
          />
          <input
            className="input"
            placeholder="Satuan (pcs/kg/ikat)"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
        </div>
        <div className="form-row">
          <input
            className="input"
            type="number"
            placeholder="Harga beli (per satuan)"
            value={form.unitCost}
            onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
          />
          <input
            className="input"
            type="date"
            placeholder="Tanggal kedaluwarsa"
            value={form.expiry}
            onChange={(e) => setForm({ ...form, expiry: e.target.value })}
          />
        </div>

        <button className="btn" type="submit">
          Simpan Bahan
        </button>
        {msg && (
          <p style={{ marginLeft: 12, fontWeight: 700, color: "#2f7d32" }}>{msg}</p>
        )}
      </form>
    </>
  );
}