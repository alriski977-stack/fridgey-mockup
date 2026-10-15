"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileForm({ user }) {
  const router = useRouter();
  const fileRef = useRef(null);
  const [name, setName] = useState(user.name || "");
  const [businessName, setBusinessName] = useState(user.businessName || "");
  const [email, setEmail] = useState(user.email || "");
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSuccess("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Gagal mengunggah foto.");
        return;
      }
      setPhotoUrl(data.url);
      setSuccess("Foto profil diunggah. Jangan lupa simpan.");
    } catch {
      setError("Tidak dapat mengunggah foto. Coba lagi.");
    } finally {
      setUploading(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (name.trim().length < 2) {
      setError("Nama harus 2-60 karakter.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          businessName: businessName.trim(),
          email: email.trim(),
          photoUrl,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Gagal menyimpan profil.");
        return;
      }
      setSuccess("Profil berhasil disimpan.");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={save}>
      <div className="panel-head">Data Akun</div>
      <div style={{ padding: "18px 20px", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
          <div
            className="avatar"
            style={
              photoUrl
                ? { backgroundImage: `url(${photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                : undefined
            }
          >
            {!photoUrl && (name.trim().charAt(0).toUpperCase() || "?")}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhoto}
              disabled={uploading || saving}
            />
            {uploading && <p style={{ fontSize: 12, margin: "6px 0 0" }}>Mengunggah...</p>}
          </div>
        </div>

        <label className="field-label">Nama</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama lengkap"
        />

        <label className="field-label">Nama Usaha</label>
        <input
          className="input"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Mis. Katering Rumahan Bu Rina"
        />

        <label className="field-label">Email (opsional)</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@email.com"
        />

        <label className="field-label">Nomor WhatsApp</label>
        <input className="input" value={user.phone} disabled readOnly />

        <button className="btn" type="submit" disabled={saving || uploading}>
          {saving ? "Menyimpan..." : "Simpan Profil"}
        </button>
        {success && <span style={{ marginLeft: 12, color: "#2f7d32", fontWeight: 700, fontSize: 13 }}>{success}</span>}
        {error && <span style={{ marginLeft: 12, color: "#c0392b", fontWeight: 700, fontSize: 13 }}>{error}</span>}
      </div>
    </form>
  );
}
