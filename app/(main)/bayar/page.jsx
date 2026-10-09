import PaymentPlans from "@/components/PaymentPlans";
import { store } from "@/lib/db";

export const dynamic = "force-dynamic";

const PLANS = [
  {
    name: "Trial",
    env: "LYNK_LINK_TRIAL",
    price: "Rp 0 / 14 hari",
    lama: "14 Hari",
    fitur: "Semua fitur inti. Gratis, tanpa kartu (mulai akun tanpa biaya).",
  },
  {
    name: "Starter",
    env: "LYNK_LINK_STARTER",
    price: "Rp 75.000 / bulan",
    lama: "Bulanan",
    fitur: "Kelola stok, notifikasi WhatsApp hampir basi, laporan penghematan.",
  },
  {
    name: "Pro",
    env: "LYNK_LINK_PRO",
    price: "Rp 149.000 / bulan",
    lama: "Bulanan",
    fitur: "Semua fitur Starter + multi-user (s.d. 5 staf) + ekspor laporan bulanan.",
  },
];

export default async function BayarPage() {
  const sub = await store.getSubscription();
  const links = {
    LYNK_LINK_TRIAL: process.env.LYNK_LINK_TRIAL || "",
    LYNK_LINK_STARTER: process.env.LYNK_LINK_STARTER || "",
    LYNK_LINK_PRO: process.env.LYNK_LINK_PRO || "",
  };

  return (
    <>
      <div className="topbar">
        <h1>Paket &amp; Pembayaran</h1>
        <span className="user">Pembayaran via Lynk.id</span>
      </div>
      <p
        style={{
          fontSize: 13,
          color: "#6b7280",
          marginTop: -14,
          marginBottom: 20,
        }}
      >
        Aktifkan paket untuk menyalakan notifikasi WhatsApp &amp; laporan lengkap.
        Catatan: tombol menjadi aktif setelah pemilik mengisi link pembayaran Lynk.id
        di lingkungan hosting (env LYNK_LINK_*).
      </p>
      <PaymentPlans links={links} plans={PLANS} sub={sub} />
    </>
  );
}