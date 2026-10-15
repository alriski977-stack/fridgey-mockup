"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function emptyForm(source) {
  return {
    name: "",
    qty: "",
    unit: "",
    unitCost: "",
    expiry: "",
    category: "",
    source,
    photoUrl: "",
  };
}

export default function TambahPage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const previewRef = useRef("");
  const [method, setMethod] = useState("photo");
  const [form, setForm] = useState(() => emptyForm("photo"));
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState("");

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function chooseMethod(k) {
    setMethod(k);
    setForm((f) => ({ ...f, source: k }));
  }

  function showPreview(url) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreview(url);
  }

  // Lepaskan URL pratinjau saat halaman ditinggalkan agar tidak ada kebocoran memori.
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setMsg("");
    setUploading(true);
    showPreview(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Gagal mengunggah foto.");
        showPreview("");
        set("photoUrl", "");
        return;
      }
      set("photoUrl", data.url);
      setMsg("Foto berhasil diunggah.");
    } catch {
      setError("Tidak dapat mengunggah foto. Coba lagi.");
      showPreview("");
      set("photoUrl", "");
    } finally {
      setUploading(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setMsg("");

    const name = form.name.trim();
    if (name.length < 2) {
      setError("Nama bahan minimal 2 karakter.");
      return;
    }
    if (!form.qty || Number(form.qty) <= 0) {
      setError("Jumlah (qty) harus lebih dari 0.");
      return;
    }
    if (!form.expiry) {
      setError("Tanggal kedaluwarsa wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          qty: Number(form.qty),
          unit: form.unit.trim() || "pcs",
          unitCost: Number(form.unitCost) || 0,
          expiry: form.expiry,
          category: form.category.trim() || "Lainnya",
          source: form.source,
          photoUrl: form.photoUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError("Gagal menyimpan: " + (data.error || "terjadi kesalahan"));
        return;
      }
      // Data bahan yang sudah diketik tetap dipertahankan agar bahan berikutnya
      // bisa langsung ditambahkan tanpa mengisi ulang dari awal. Hanya foto
      // yang dibersihkan, karena foto tersebut sudah tertaut ke bahan ini.
      setForm((f) => ({ ...f, photoUrl: "" }));
      showPreview("");
      if (fileRef.current) fileRef.current.value = "";
      setMsg(`"${name}" berhasil disimpan. Form tetap terisi untuk bahan berikutnya.`);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Tambah Bahan</h1>
        <span className="user">Isi sekali, langsung tersimpan</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {[
          ["photo", "Foto Struk / Kemasan"],
          ["manual", "Isi Manual"],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`btn ${method === k ? "" : "ghost"}`}
            onClick={() => chooseMethod(k)}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={save}>
        {method === "photo" && (
          <div className="upload">
            <div className="big">📷</div>
            <div>
              Unggah foto struk / kemasan bahan (JPG, PNG, atau WEBP, maks 5 MB).
              Nama &amp; tanggal kedaluwarsa diisi manual pada kolom di bawah.
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFile}
              disabled={uploading || saving}
              style={{ marginTop: 14 }}
            />
            {uploading && <p style={{ fontSize: 12 }}>Mengunggah foto...</p>}
            {preview && (
              <div style={{ marginTop: 12 }}>
                <img
                  src={preview}
                  alt="Pratinjau foto"
                  style={{
                    maxWidth: 220,
                    maxHeight: 160,
                    borderRadius: 8,
                    border: "1px solid #b9d8bc",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {method === "manual" && (
          <p
            style={{
              fontSize: 13,
              color: "#6b7280",
              background: "#f4f9f4",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
            }}
          >
            Masukkan data bahan secara manual pada kolom di bawah.
          </p>
        )}

        <div className="form-row">
          <input
            className="input"
            placeholder="Nama bahan"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
          <input
            className="input"
            placeholder="Kategori (mis. Sayur, Protein)"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          />
        </div>
        <div className="form-row">
          <input
            className="input"
            type="number"
            min="0"
            step="any"
            placeholder="Qty"
            value={form.qty}
            onChange={(e) => set("qty", e.target.value)}
          />
          <input
            className="input"
            placeholder="Satuan (pcs/kg/ikat)"
            value={form.unit}
            onChange={(e) => set("unit", e.target.value)}
          />
        </div>
        <div className="form-row">
          <input
            className="input"
            type="number"
            min="0"
            placeholder="Harga beli (per satuan)"
            value={form.unitCost}
            onChange={(e) => set("unitCost", e.target.value)}
          />
          <input
            className="input"
            type="date"
            value={form.expiry}
            onChange={(e) => set("expiry", e.target.value)}
          />
        </div>

        <button className="btn" type="submit" disabled={saving || uploading}>
          {saving ? "Menyimpan..." : "Simpan Bahan"}
        </button>
        <a href="/stok" className="btn ghost" style={{ marginLeft: 8 }}>
          Lihat Daftar Stok
        </a>
        {msg && <span style={{ marginLeft: 12, fontWeight: 700, color: "#2f7d32" }}>{msg}</span>}
        {error && <span style={{ marginLeft: 12, fontWeight: 700, color: "#c0392b" }}>{error}</span>}
      </form>
    </>
  );
}
