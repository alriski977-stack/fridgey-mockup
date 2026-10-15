"use client";

import { useState } from "react";

/**
 * Gambar dengan penanganan URL rusak: bila foto gagal dimuat (link hilang,
 * bucket privat, jaringan terputus), tampilkan placeholder "—" agar tabel
 * tidak rusak dan pengguna tidak melihat ikon gambar rusak.
 */
export default function SafeImage({ src, alt, className, fallback = "—" }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span style={{ color: "#9ca3af" }} className={className}>
        {fallback}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ""}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}