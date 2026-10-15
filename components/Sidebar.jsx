"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const links = [
    ["/dashboard", "Dashboard"],
    ["/stok", "Daftar Stok"],
    ["/tambah", "Tambah Bahan"],
    ["/laporan", "Laporan"],
    ["/bayar", "Paket & Bayar"],
    ["/profil", "Profil"],
  ];

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // abaikan, tetap arahkan ke login
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        Fridgey<span>.</span>
      </div>
      <nav>
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={path.startsWith(href) ? "active" : ""}
          >
            {label}
          </Link>
        ))}
        <button className="logout-link" onClick={logout} disabled={busy}>
          {busy ? "Keluar..." : "Keluar"}
        </button>
      </nav>
    </aside>
  );
}
