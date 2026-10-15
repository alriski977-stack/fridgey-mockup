// Unified async data store untuk Fridgey.
// - Mode CLOUD (Supabase/Postgres): dipakai bila env SUPABASE_URL terisi
//   + salah satu key (service_role untuk produksi, atau publishable/anon
//   bila RLS diberi kebijakan izin - lihat supabase/schema.sql).
// - Mode LOKAL (node:sqlite): fallback otomatis bila env Supabase tidak ada (dev di mesin sendiri).

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

const USING_SUPABASE = Boolean(process.env.SUPABASE_URL && SUPABASE_KEY);

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

function nowIso() {
  return new Date().toISOString();
}

async function getSupabase() {
  if (!supabaseClient) {
    const { createClient } = await import("@supabase/supabase-js");
    supabaseClient = createClient(process.env.SUPABASE_URL, SUPABASE_KEY);
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
        photo_url TEXT DEFAULT '',
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
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        name TEXT DEFAULT '',
        business_name TEXT DEFAULT '',
        email TEXT DEFAULT '',
        photo_url TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS otp_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        consumed INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    // Migrasi kolom photo_url untuk database yang sudah ada sebelumnya.
    try {
      sqliteDb.exec("ALTER TABLE items ADD COLUMN photo_url TEXT DEFAULT ''");
    } catch {
      // kolom sudah ada
    }
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
    photoUrl: r.photo_url || "",
  };
}

function mapUser(r) {
  if (!r) return null;
  return {
    id: r.id,
    phone: r.phone,
    name: r.name || "",
    businessName: r.business_name || "",
    email: r.email || "",
    photoUrl: r.photo_url || "",
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
    }
  }
}

export const store = {
  backend() {
    return USING_SUPABASE ? "supabase" : "sqlite";
  },

  // ---------- Items ----------
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

  async addItem({ name, qty, unit, unitCost, expiry, category, source, photoUrl }) {
    await ensureSeeded();
    const cat = category || "Lainnya";
    const src = source || "manual";
    const photo = photoUrl || "";
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("items")
        .insert({
          name, qty, unit, unit_cost: unitCost, expiry,
          category: cat, source: src, photo_url: photo,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    }
    const db = await getSqlite();
    const r = db
      .prepare(
        `INSERT INTO items (name, qty, unit, unit_cost, expiry, category, source, photo_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name, qty, unit, unitCost, expiry, cat, src, photo);
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

  // ---------- Users ----------
  async getUserByPhone(phone) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("users")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw new Error(error.message);
      return mapUser(data);
    }
    const db = await getSqlite();
    const row = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
    return mapUser(row);
  },

  async getUserById(id) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("users")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw new Error(error.message);
      return mapUser(data);
    }
    const db = await getSqlite();
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    return mapUser(row);
  },

  async ensureUser(phone, fields = {}) {
    const existing = await this.getUserByPhone(phone);
    if (existing) return existing;
    const name = fields.name || "";
    const businessName = fields.businessName || "";
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("users")
        .insert({ phone, name, business_name: businessName })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return mapUser(data);
    }
    const db = await getSqlite();
    const r = db
      .prepare("INSERT INTO users (phone, name, business_name) VALUES (?, ?, ?)")
      .run(phone, name, businessName);
    return this.getUserById(Number(r.lastInsertRowid));
  },

  async updateUser(id, { name, businessName, email, photoUrl }) {
    const patch = {
      name,
      business_name: businessName,
      email,
      photo_url: photoUrl,
      updated_at: nowIso(),
    };
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("users")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return mapUser(data);
    }
    const db = await getSqlite();
    db.prepare(
      `UPDATE users
         SET name = ?, business_name = ?, email = ?, photo_url = ?, updated_at = ?
       WHERE id = ?`
    ).run(name, businessName, email, photoUrl, nowIso(), id);
    return this.getUserById(id);
  },

  // ---------- OTP ----------
  async clearActiveOtps(phone) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { error } = await sb
        .from("otp_codes")
        .update({ consumed: true })
        .eq("phone", phone)
        .eq("consumed", false);
      if (error) throw new Error(error.message);
      return;
    }
    const db = await getSqlite();
    db.prepare("UPDATE otp_codes SET consumed = 1 WHERE phone = ? AND consumed = 0").run(phone);
  },

  async createOtp({ phone, codeHash, expiresAt }) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("otp_codes")
        .insert({ phone, code_hash: codeHash, expires_at: expiresAt })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    }
    const db = await getSqlite();
    const r = db
      .prepare("INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES (?, ?, ?)")
      .run(phone, codeHash, expiresAt);
    return Number(r.lastInsertRowid);
  },

  async getLatestOtp(phone) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("otp_codes")
        .select("*")
        .eq("phone", phone)
        .eq("consumed", false)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw new Error(error.message);
      return data || null;
    }
    const db = await getSqlite();
    const row = db
      .prepare("SELECT * FROM otp_codes WHERE phone = ? AND consumed = 0 ORDER BY id DESC LIMIT 1")
      .get(phone);
    return row || null;
  },

  async incrementOtpAttempts(id) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("otp_codes")
        .select("attempts")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const next = (data?.attempts || 0) + 1;
      const { error: upErr } = await sb
        .from("otp_codes")
        .update({ attempts: next })
        .eq("id", id);
      if (upErr) throw new Error(upErr.message);
      return next;
    }
    const db = await getSqlite();
    db.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?").run(id);
    const row = db.prepare("SELECT attempts FROM otp_codes WHERE id = ?").get(id);
    return row?.attempts || 0;
  },

  async deleteOtp(id) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { error } = await sb.from("otp_codes").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    const db = await getSqlite();
    db.prepare("DELETE FROM otp_codes WHERE id = ?").run(id);
  },

  async consumeOtp(id) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { error } = await sb.from("otp_codes").update({ consumed: true }).eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    const db = await getSqlite();
    db.prepare("UPDATE otp_codes SET consumed = 1 WHERE id = ?").run(id);
  },

  async countOtpsSince(phone, sinceIso) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { count, error } = await sb
        .from("otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("phone", phone)
        .gte("created_at", sinceIso);
      if (error) throw new Error(error.message);
      return count || 0;
    }
    const db = await getSqlite();
    // created_at default SQLite memakai format "YYYY-MM-DD HH:MM:SS" sedangkan
    // argumen sinceIso berformat ISO-8601 ("...T...Z"). datetime() menormalkan
    // keduanya, tanpa itu batas cooldown & rate limit OTP tidak pernah aktif.
    const row = db
      .prepare(
        "SELECT COUNT(*) AS c FROM otp_codes WHERE phone = ? AND datetime(created_at) >= datetime(?)"
      )
      .get(phone, sinceIso);
    return row?.c || 0;
  },

  // ---------- Sessions ----------
  async createSession({ userId, tokenHash, expiresAt }) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { error } = await sb
        .from("sessions")
        .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
      if (error) throw new Error(error.message);
      return;
    }
    const db = await getSqlite();
    db.prepare("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)").run(
      userId,
      tokenHash,
      expiresAt
    );
  },

  async getSessionUser(tokenHash) {
    const now = nowIso();
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("sessions")
        .select("*")
        .eq("token_hash", tokenHash)
        .gt("expires_at", now)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw new Error(error.message);
      if (!data) return null;
      return this.getUserById(data.user_id);
    }
    const db = await getSqlite();
    const row = db
      .prepare("SELECT * FROM sessions WHERE token_hash = ? AND datetime(expires_at) > datetime(?)")
      .get(tokenHash, now);
    if (!row) return null;
    return this.getUserById(row.user_id);
  },

  async deleteSession(tokenHash) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { error } = await sb.from("sessions").delete().eq("token_hash", tokenHash);
      if (error) throw new Error(error.message);
      return;
    }
    const db = await getSqlite();
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  },

  // ---------- Subscriptions ----------
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

export { USING_SUPABASE as usingSupabase };

export async function getSupabaseClient() {
  return getSupabase();
}

export default store;
