// Penyimpanan berkas foto (struk / kemasan).
// - Mode CLOUD: Supabase Storage (bucket dari env SUPABASE_STORAGE_BUCKET, default "receipts").
// - Mode LOKAL: folder public/uploads (untuk pengembangan tanpa Supabase).

import crypto from "node:crypto";
import { getSupabaseClient, usingSupabase } from "@/lib/db";

const ALLOWED = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

function publicBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "receipts";
}

// Hanya URL hasil unggahan sendiri yang boleh disimpan di database,
// sehingga kolom photo_url tidak bisa dipakai untuk menyisipkan tautan
// arbitrer (mis. javascript: atau situs pihak ketiga) dari sisi klien.
export function isAllowedPhotoUrl(value) {
  const url = String(value || "").trim();
  if (!url) return true; // kosong = hapus foto
  if (url.startsWith("/uploads/")) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (!parsed.hostname.endsWith(".supabase.co")) return false;
    return parsed.pathname.startsWith(`/storage/v1/object/public/${publicBucket()}/`);
  } catch {
    return false;
  }
}

export async function saveUpload(file, userId) {
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return { ok: false, error: "Berkas tidak ditemukan." };
  }
  const type = (file.type || "").toLowerCase();
  const ext = ALLOWED[type];
  if (!ext) {
    return { ok: false, error: "Format harus JPG, PNG, atau WEBP." };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) return { ok: false, error: "Berkas kosong." };
  if (buf.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Ukuran berkas melebihi 5 MB." };
  }

  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const owner = userId ? String(userId) : "anon";

  if (usingSupabase) {
    const sb = await getSupabaseClient();
    const bucket = publicBucket();
    const key = `uploads/${owner}/${name}`;
    const { error } = await sb.storage.from(bucket).upload(key, buf, {
      contentType: type,
      upsert: false,
    });
    if (error) {
      return {
        ok: false,
        error: `Gagal mengunggah ke storage: ${error.message}. Pastikan bucket "${bucket}" ada dan publik.`,
      };
    }
    const { data } = sb.storage.from(bucket).getPublicUrl(key);
    return { ok: true, url: data.publicUrl };
  }

  // Folder lokal hanya berlaku untuk pengembangan. Di hosting serverless
// (Netlify/Vercel) berkas pada sistem berkas bersifat sementara sehingga
// foto akan hilang; bila itu terjadi kita menolak unggahan secara eksplisit
// alih-alih dianggap berhasil lalu fotonya lenyap.
if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      error:
        "Penyimpanan foto belum dikonfigurasi di hosting ini. Aktifkan Supabase " +
        "(SUPABASE_URL + key) dan jalankan supabase/schema.sql agar bucket foto tersedia.",
    };
  }

  const path = (await import("node:path")).default;
  const fs = (await import("node:fs")).default;
  const dir = path.join(process.cwd(), "public", "uploads", owner);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf);
  return { ok: true, url: `/uploads/${owner}/${name}` };
}
