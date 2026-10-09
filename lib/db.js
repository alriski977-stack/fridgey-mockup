// Unified async data store untuk Fridgey.
// - Mode CLOUD (Supabase/Postgres): dipakai bila env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY terisi
//   (paling cocok untuk hosting Netlify/Vercel agar data persisten).
// - Mode LOKAL (node:sqlite): fallback otomatis bila env Supabase tidak ada (dev di mesin sendiri).

const USING_SUPABASE = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SEEDS = [
  ["Daging Ayam", 2.5, "kg", 35000, "2026-10-05", "Protein", "manual"],
  ["Susu UHT", 6, "pcs", 18000, "2026-10-03", "Minuman", "barcode"],
  ["Bayam Segar", 3, "ikat", 5000, "2026-10-02", "Sayur", "photo"],
  ["Tempe", 5, "papan", 6000, "2026-10-04", "Protein", "manual"],
  ["Tomat", 1, "kg", 15000, "2026-10-08", "Sayur", "photo"],
  ["Telur", 20, "pcs", 2200, "2026-10-12", "Protein", "barcode"],
  ["Saus Sambal", 3, "botol", 12000, "2026-12-01", "Bumbu", "manual"],
  ["Mie Instan", 24, "pcs", 3200, "2027-01-15", "Karbohidrat", "barcode"],
];

let sqliteDb = null;
let supabaseClient = null;
let seeded = false;

async function getSupabase() {
  if (!supabaseClient) {
    const { createClient } = await import("@supabase/supabase-js");
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabaseClient;
}

async function getSqlite() {
  if (!sqliteDb) {
    const { DatabaseSync } = await import("node:sqlite");
    const path = (await import("node:path")).default;
    const fs = (await import("node:fs")).default;
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    sqliteDb = new DatabaseSync(path.join(dataDir, "fridgey.db"));
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        qty REAL NOT NULL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT 'pcs',
        unit_cost REAL NOT NULL DEFAULT 0,
        expiry TEXT NOT NULL,
        category TEXT DEFAULT 'Lainnya',
        source TEXT DEFAULT 'manual',
        status TEXT DEFAULT 'tersimpan',
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payment_ref TEXT DEFAULT '',
        amount REAL NOT NULL DEFAULT 0,
        method TEXT DEFAULT '',
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }
  return sqliteDb;
}

function mapRow(r) {
  return {
    id: r.id,
    name: r.name,
    qty: Number(r.qty),
    unit: r.unit,
    unitCost: Number(r.unit_cost),
    expiry: r.expiry,
    category: r.category,
    source: r.source,
    status: r.status,
    note: r.note || "",
  };
}

async function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  if (USING_SUPABASE) {
    const sb = await getSupabase();
    const { count } = await sb
      .from("items")
      .select("id", { count: "exact", head: true });
    if (count === 0) {
      const rows = SEEDS.map((s) => ({
        name: s[0], qty: s[1], unit: s[2], unit_cost: s[3],
        expiry: s[4], category: s[5], source: s[6],
      }));
      const { error } = await sb.from("items").insert(rows);
      if (error) console.warn("[seed supabase]", error.message);
    }
  } else {
    const db = await getSqlite();
    const row = db.prepare("SELECT COUNT(*) AS c FROM items").get();
    if (row.c === 0) {
      const ins = db.prepare(
        "INSERT INTO items (name, qty, unit, unit_cost, expiry, category, source) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const s of SEEDS) ins.run(s[0], s[1], s[2], s[3], s[4], s[5], s[6]);
      console.log("[seed] 8 item contoh dimasukkan");
    }
  }
}

export const store = {
  backend() {
    return USING_SUPABASE ? "supabase" : "sqlite";
  },

  async getAllItems() {
    await ensureSeeded();
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("items")
        .select("*")
        .order("expiry", { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []).map(mapRow);
    }
    const db = await getSqlite();
    return db.prepare("SELECT * FROM items ORDER BY expiry ASC").all().map(mapRow);
  },

  async addItem({ name, qty, unit, unitCost, expiry, category, source }) {
    await ensureSeeded();
    const cat = category || "Lainnya";
    const src = source || "manual";
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("items")
        .insert({ name, qty, unit, unit_cost: unitCost, expiry, category: cat, source: src })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    }
    const db = await getSqlite();
    const r = db
      .prepare(
        `INSERT INTO items (name, qty, unit, unit_cost, expiry, category, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name, qty, unit, unitCost, expiry, cat, src);
    return Number(r.lastInsertRowid);
  },

  async updateStatus(id, status, note = "") {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { error } = await sb.from("items").update({ status, note }).eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    const db = await getSqlite();
    db.prepare("UPDATE items SET status = ?, note = ? WHERE id = ?").run(status, note, id);
  },

  async savePayment({ plan, status, paymentRef, amount, method, note }) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { error } = await sb.from("subscriptions").insert({
        plan, status, payment_ref: paymentRef || "", amount: amount || 0,
        method: method || "", note: note || "",
      });
      if (error) throw new Error(error.message);
      return;
    }
    const db = await getSqlite();
    db.prepare(
      `INSERT INTO subscriptions (plan, status, payment_ref, amount, method, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(plan, status, paymentRef || "", amount || 0, method || "", note || "");
  },

  async getSubscription() {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("subscriptions")
        .select("*")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw new Error(error.message);
      return data || null;
    }
    const db = await getSqlite();
    const row = db.prepare("SELECT * FROM subscriptions ORDER BY id DESC LIMIT 1").get();
    return row ? { ...row } : null;
  },
};

export default store;