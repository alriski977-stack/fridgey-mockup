import { getSummary } from "@/lib/items";

function rupiah(n) {
  return "Rp " + n.toLocaleString("id-ID");
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const s = await getSummary();
  return (
    <>
      <div className="topbar">
        <h1>Dashboard</h1>
        <span className="user">Ibu Rina - Katering Rumahan</span>
      </div>

      <div className="grid">
        <div className="card">
          <div className="label">Total Stok</div>
          <div className="value">{s.totalQty}</div>
          <div className="sub">{s.totalItems} jenis bahan</div>
        </div>
        <div className="card">
          <div className="label yellow">Hampir Basi (&lt; 3 hari)</div>
          <div className="value yellow" style={{ color: "#f9a825" }}>
            {s.nearExpiry}
          </div>
          <div className="sub">segera pakai untuk hemat</div>
        </div>
        <div className="card">
          <div className="label">Hemat Bulan Ini</div>
          <div className="value" style={{ color: "#2f7d32" }}>
            {rupiah(s.savedValue || 0)}
          </div>
          <div className="sub">bahan terpakai sebelum basi (perkiraan)</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          Bahan Mendekati Kedaluwarsa
          <a href="/stok" className="btn ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
            Lihat Semua
          </a>
        </div>
        <div
          style={{
            padding: "14px 18px",
            fontSize: 13,
            color: "#6b7280",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          Notifikasi WhatsApp aktif untuk paket berbayar (trial 14 hari).
        </div>
      </div>
    </>
  );
}