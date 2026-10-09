import { getAllItems } from "@/lib/items";

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

export default async function StokPage() {
  const items = await getAllItems();
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
            {items.map((it) => (
              <tr key={it.id}>
                <td>
                  <strong>{it.name}</strong>
                </td>
                <td>{it.qty}</td>
                <td>{it.unit}</td>
                <td>{it.category}</td>
                <td>{it.expiry}</td>
                <td>{badge(daysLeft(it.expiry))}</td>
                <td>{it.source}</td>
                <td>{it.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}