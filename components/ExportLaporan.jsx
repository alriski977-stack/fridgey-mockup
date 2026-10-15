"use client";

import { useState } from "react";

export default function ExportLaporan({ categories = [] }) {
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function exportExcel() {
    setError("");
    setInfo("");
    if (from && to && from > to) {
      setError("Tanggal awal tidak boleh lebih besar dari tanggal akhir.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/reports/export?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Gagal mengekspor laporan.");
        return;
      }

      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match
        ? match[1]
        : `laporan_dapur_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setInfo(`Berhasil mengunduh ${filename}`);
    } catch {
      setError("Tidak dapat mengunduh laporan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ marginBottom: 26 }}>
      <div className="panel-head">Export Laporan ke Excel (.xlsx)</div>
      <div style={{ padding: "16px 18px" }}>
        <div className="form-row">
          <div>
            <label className="field-label">Kategori</label>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua status</option>
              <option value="tersimpan">Tersimpan</option>
              <option value="dipakai">Dipakai</option>
              <option value="terbuang">Terbuang</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div>
            <label className="field-label">Kedaluwarsa dari</label>
            <input
              className="input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Kedaluwarsa sampai</label>
            <input
              className="input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

        <button className="btn" type="button" onClick={exportExcel} disabled={loading}>
          {loading ? "Menyiapkan berkas..." : "⬇ Export Excel"}
        </button>
        {info && <span style={{ marginLeft: 12, color: "#2f7d32", fontWeight: 700, fontSize: 13 }}>{info}</span>}
        {error && <span style={{ marginLeft: 12, color: "#c0392b", fontWeight: 700, fontSize: 13 }}>{error}</span>}
      </div>
    </div>
  );
}
