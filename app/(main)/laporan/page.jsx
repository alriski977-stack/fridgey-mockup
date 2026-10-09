import { getAllItems } from "@/lib/items";

export const dynamic = "force-dynamic";

function rupiah(n) {
  return "Rp " + n.toLocaleString("id-ID");
}

export default async function LaporanPage() {
  const items = await getAllItems();
  const totalValue = items.reduce((a, i) => a + i.qty * i.unitCost, 0);
  const nearItems = items.filter(
    (i) => Math.ceil((new Date(i.expiry) - new Date()) / 86400000) <= 3
  );

  const byCategory = {};
  for (const it of items) {
    byCategory[it.category] = (byCategory[it.category] || 0) + it.qty * it.unitCost;
  }

  return (
    <>
      <div className="topbar">
        <h1>Laporan Dapur</h1>
        <a href="#" className="btn">
          ⬇ Export Excel (mock)
        </a>
      </div>

      <div className="grid">
        <div className="card">
          <div className="label">Nilai Total Stok</div>
          <div className="value">{rupiah(totalValue)}</div>
          <div className="sub">perkiraan modal bahan tersimpan</div>
        </div>
        <div className="card">
          <div className="label yellow">Aman Dibung Waktu</div>
          <div className="value" style={{ color: "#f9a825" }}>
            {nearItems.length} bahan
          </div>
          <div className="sub">{rupiah(nearItems.reduce((a, i) => a + i.qty * i.unitCost, 0))} berisiko terbuang</div>
        </div>
        <div className="card">
          <div className="label">Hemat Potensial</div>
          <div className="value" style={{ color: "#2f7d32" }}>
            {rupiah(nearItems.reduce((a, i) => a + i.qty * i.unitCost, 0) || 0)}
          </div>
          <div className="sub">jika semua bahan hampir basi dipakai</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Rincian per Kategori (nilai Rp)</div>
        <table>
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Nilai Stok</th>
              <th>Jumlah Jenis</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byCategory).map(([cat, val]) => (
              <tr key={cat}>
                <td>{cat}</td>
                <td>{rupiah(val)}</td>
                <td>{items.filter((i) => i.category === cat).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}