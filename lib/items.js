import { store } from "@/lib/db";

// Semua operasi bahan dikaitkan ke satu akun (userId) sehingga tiap pengguna
// hanya melihat dan mengubah perpustakaan bahannya sendiri.
export const getAllItems = (userId) => store.getAllItems(userId);
export const addItem = (userId, data) => store.addItem(userId, data);
export const updateStatus = (userId, id, status, note) =>
  store.updateStatus(userId, id, status, note);

export async function getSummary(userId) {
  const items = await getAllItems(userId);
  const today = new Date();
  let total = 0;
  let near = 0;
  let wastedValue = 0;
  let savedValue = 0;

  for (const it of items) {
    total += it.qty;
    const days = Math.ceil(
      (new Date(it.expiry) - today) / (1000 * 60 * 60 * 24)
    );
    if (days <= 3) near += it.qty;
    const value = it.qty * it.unitCost;
    if (it.status === "terbuang") wastedValue += value;
    if (it.status === "dipakai") savedValue += value;
  }

  return {
    totalItems: items.length,
    totalQty: Math.round(total),
    nearExpiry: near,
    wastedValue,
    savedValue,
  };
}