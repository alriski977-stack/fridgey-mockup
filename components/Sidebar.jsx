"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const path = usePathname();

  const links = [
    ["/dashboard", "Dashboard"],
    ["/stok", "Daftar Stok"],
    ["/tambah", "Tambah Bahan"],
    ["/laporan", "Laporan"],
    ["/bayar", "Paket & Bayar"],
  ];

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
        <Link href="/login" className={path === "/login" ? "active" : ""}>
          Keluar
        </Link>
      </nav>
    </aside>
  );
}