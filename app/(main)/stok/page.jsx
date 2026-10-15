import { getAllItems } from "@/lib/items";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SafeImage from "@/components/SafeImage";

export const dynamic = "force-dynamic";

function daysLeft(expiry) {
  const today = new Date();
  const exp = new Date(expiry);
  return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
}

function badge(days) {
  if (days <= 1) return <span className="badge alert">Basi/Hari ini</span>;
  if (days <= 3) return <span className="badge warn">{days} hari</span>;
  return <span className="badge safe">{days} hari</span>;
}

const STATUS_LABEL = {
  tersimpan: "Tersimpan",
  dipakai: "Dipakai",
  terbuang: "Terbuang",
};

export default async function StokPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const items = await getAllItems(user.id);
  return (
    <>
      <div className="topbar">
        <h1>Daftar Stok Kulkas</h1>
        <a href="/tambah" className="btn">
          + Tambah Bahan
        </a>
      </div>

      <div className="panel">
        <div className="panel-head">Semua Bahan (urut: sisa hari)</div>
        <table>
          <thead>
            <tr>
              <th>Bahan</th>
              <th>Foto</th>
              <th>Qty</th>
              <th>Satuan</th>
              <th>Kategori</th>
              <th>Expiry</th>
              <th>Sisa</th>
              <th>Sumber</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", color: "#6b7280", padding: "28px 12px" }}>
                  Kulkas masih kosong. Klik <strong>+ Tambah Bahan</strong> untuk mencatat bahan
                  pertama Anda.
                </td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it.id}>
                <td>
                  <strong>{it.name}</strong>
                </td>
                <td>
                  {it.photoUrl ? (
                    <a href={it.photoUrl} target="_blank" rel="noreferrer">
                      <SafeImage src={it.photoUrl} alt={`Foto ${it.name}`} className="thumb" />
                    </a>
                  ) : (
                    <span style={{ color: "#9ca3af" }}>—</span>
                  )}
                </td>
                <td>{it.qty}</td>
                <td>{it.unit}</td>
                <td>{it.category}</td>
                <td>{it.expiry}</td>
                <td>{badge(daysLeft(it.expiry))}</td>
                <td>{it.source}</td>
                <td>{STATUS_LABEL[it.status] || it.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}