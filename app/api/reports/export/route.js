import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAllItems } from "@/lib/items";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function daysLeft(expiry) {
  return Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
}

function statusLabel(days, status) {
  if (status === "terbuang") return "Terbuang";
  if (status === "dipakai") return "Dipakai";
  if (days <= 1) return "Basi/Hari ini";
  if (days <= 3) return "Hampir basi";
  return "Aman";
}

function labelFor(value, fallback) {
  const v = (value || "").trim();
  return v && v !== "all" ? v : fallback;
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = labelFor(searchParams.get("category"), "Semua kategori");
    const status = labelFor(searchParams.get("status"), "Semua status");
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    let items = await getAllItems();

    if (category !== "Semua kategori") {
      items = items.filter((i) => i.category === category);
    }
    if (status !== "Semua status") {
      items = items.filter((i) => i.status === status);
    }
    if (from) items = items.filter((i) => i.expiry >= from);
    if (to) items = items.filter((i) => i.expiry <= to);

    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Tidak ada data yang cocok dengan filter ini." },
        { status: 404 }
      );
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Fridgey Smart Pantry";
    wb.created = new Date();
    const ws = wb.addWorksheet("Laporan Dapur", {
      views: [{ state: "frozen", ySplit: 4 }],
    });

    const generated = new Date().toLocaleString("id-ID");
    ws.mergeCells("A1:L1");
    ws.getCell("A1").value = "LAPORAN DAPUR - FRIDGEY SMART PANTRY";
    ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF1B5E20" } };
    ws.getCell("A1").alignment = { horizontal: "center" };

    ws.mergeCells("A2:L2");
    ws.getCell("A2").value =
      `Kategori: ${category}  |  Status: ${status}  |  Expiry: ${from || "awal"} s/d ${to || "akhir"}  |  Dibuat: ${generated}`;
    ws.getCell("A2").font = { size: 10, italic: true, color: { argb: "FF6B7280" } };
    ws.getCell("A2").alignment = { horizontal: "center" };

    ws.getRow(3).height = 6;

    const headers = [
      "No", "Nama Bahan", "Kategori", "Qty", "Satuan", "Harga Satuan",
      "Total Nilai", "Tanggal Kedaluwarsa", "Sisa Hari", "Sumber", "Status", "Foto",
    ];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F7D32" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFB9D8BC" } },
        bottom: { style: "thin", color: { argb: "FFB9D8BC" } },
        left: { style: "thin", color: { argb: "FFB9D8BC" } },
        right: { style: "thin", color: { argb: "FFB9D8BC" } },
      };
    });

    let totalValue = 0;
    let nearCount = 0;

    items.forEach((it, idx) => {
      const days = daysLeft(it.expiry);
      const value = it.qty * it.unitCost;
      totalValue += value;
      if (days <= 3 && it.status !== "terbuang") nearCount += 1;

      const row = ws.addRow([
        idx + 1,
        it.name,
        it.category,
        it.qty,
        it.unit,
        it.unitCost,
        value,
        it.expiry,
        days,
        it.source,
        statusLabel(days, it.status),
        it.photoUrl ? "Ada" : "-",
      ]);
      row.getCell(6).numFmt = '"Rp"#,##0';
      row.getCell(7).numFmt = '"Rp"#,##0';
    });

    ws.addRow([]);
    const sum1 = ws.addRow(["", "Total jenis bahan", "", "", "", "", totalValue]);
    sum1.getCell(7).numFmt = '"Rp"#,##0';
    sum1.font = { bold: true };
    const sum2 = ws.addRow(["", "Hampir basi (<= 3 hari)", "", "", "", "", nearCount]);
    sum2.font = { bold: true };

    ws.columns.forEach((col, i) => {
      const widths = [5, 24, 14, 8, 9, 14, 14, 18, 10, 11, 14, 8];
      col.width = widths[i] || 12;
    });
    ws.autoFilter = { from: "A4", to: "L4" };

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const stamp = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const filename = `laporan_dapur_${stamp}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Gagal membuat berkas Excel: " + String(e) },
      { status: 500 }
    );
  }
}
