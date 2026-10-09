"use client";

export default function PaymentPlans({ links, plans, sub }) {
  const active = sub && sub.status === "success";

  return (
    <>
      {active && (
        <div
          style={{
            background: "#e8f5e9",
            border: "1px solid #b9d8bc",
            color: "#1b5e20",
            padding: "12px 16px",
            borderRadius: 10,
            marginBottom: 18,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          ✓ Langganan Aktif - {sub.plan} (ref: {sub.payment_ref})
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {plans.map((p) => {
          const link = links[p.env];
          const disabled = !link;
          return (
            <div className="card" key={p.name} style={{ display: "flex", flexDirection: "column" }}>
              <div className="label">{p.name}</div>
              <div className="value" style={{ fontSize: 26 }}>{p.price}</div>
              <div className="sub" style={{ minHeight: 90, marginBottom: 12 }}>{p.fitur}</div>
              <button
                className={disabled ? "btn" : "btn"}
                style={{
                  marginTop: "auto",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                }}
                onClick={(e) => {
                  e.preventDefault();
                  if (link) window.open(link, "_blank");
                }}
              >
                {disabled ? "Link belum diatur" : `Bayar via Lynk.id (${p.lama})`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="panel" style={{ marginTop: 22 }}>
        <div className="panel-head">Alur Langganan</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Langkah</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Klik tombol paket</td>
              <td>Diarahkan ke halaman pembayaran Lynk.id (QRIS / VA / E-Wallet)</td>
            </tr>
            <tr>
              <td>2</td>
              <td>Bayar</td>
              <td>Pembeli memilih metode & menuntaskan pembayaran</td>
            </tr>
            <tr>
              <td>3</td>
              <td>Webhook Lynk.id</td>
              <td>Lynk.id memanggil /api/payments/lynk (status berhasil) </td>
            </tr>
            <tr>
              <td>4</td>
              <td>Status tampil</td>
              <td>Banner "Langganan Aktif" muncul di halaman ini</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}