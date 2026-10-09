import { store } from "@/lib/db";

export const getAllItems = () => store.getAllItems();
export const addItem = (data) => store.addItem(data);
export const updateStatus = (id, status, note) => store.updateStatus(id, status, note);

export async function getSummary() {
  const items = await getAllItems();
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