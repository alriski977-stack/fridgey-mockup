// Unified async data store untuk Fridgey.
// - Mode CLOUD (Supabase/Postgres): dipakai bila env SUPABASE_URL terisi
//   + salah satu key (service_role untuk produksi, atau publishable/anon
//   bila RLS diberi kebijakan izin - lihat supabase/schema.sql).
// - Mode LOKAL (node:sqlite): fallback otomatis bila env Supabase tidak ada (dev di mesin sendiri).
// Identitas akun memakai EMAIL; nomor telepon hanya info profil opsional.

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

const USING_SUPABASE = Boolean(process.env.SUPABASE_URL && SUPABASE_KEY);

const OTP_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`;

let sqliteDb = null;
let supabaseClient = null;

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

function migrateAuthTables(db) {
  // users versi lama memakai identitas telepon (phone NOT NULL). Bangun ulang
  // ke bentuk baru berbasis email bila terdeteksi.
  const ucols = db.prepare("PRAGMA table_info(users)").all();
  const phoneCol = ucols.find((c) => c.name === "phone");
  if (phoneCol && phoneCol.notnull === 1) {
    db.exec("ALTER TABLE users RENAME TO users_legacy");
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        phone TEXT DEFAULT '',
        name TEXT DEFAULT '',
        business_name TEXT DEFAULT '',
        photo_url TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      INSERT INTO users (email, phone, name, business_name, photo_url, created_at, updated_at)
      SELECT
        CASE WHEN email IS NOT NULL AND email <> '' THEN email ELSE ('user' || id || '@local.invalid') END,
        phone, name, business_name, photo_url, created_at, updated_at
      FROM users_legacy;
    `);
    db.exec("DROP TABLE users_legacy");
  }
  // otp_codes lama (kolom phone) tidak relevan; kode OTP bersifat sementara.
  const ocols = db.prepare("PRAGMA table_info(otp_codes)").all();
  if (ocols.length && !ocols.some((c) => c.name === "email")) {
    db.exec("DROP TABLE otp_codes");
    db.exec(OTP_TABLE_SQL);
  }
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
        user_id INTEGER,
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
        email TEXT UNIQUE NOT NULL,
        phone TEXT DEFAULT '',
        name TEXT DEFAULT '',
        business_name TEXT DEFAULT '',
        photo_url TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    sqliteDb.exec(OTP_TABLE_SQL);
    migrateAuthTables(sqliteDb);
    // Migrasi kolom photo_url & user_id untuk database yang sudah ada sebelumnya.
    try {
      sqliteDb.exec("ALTER TABLE items ADD COLUMN photo_url TEXT DEFAULT ''");
    } catch {
      // kolom sudah ada
    }
    try {
      sqliteDb.exec("ALTER TABLE items ADD COLUMN user_id INTEGER");
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
    email: r.email || "",
    phone: r.phone || "",
    name: r.name || "",
    businessName: r.business_name || "",
    photoUrl: r.photo_url || "",
  };
}

export const store = {
  backend() {
    return USING_SUPABASE ? "supabase" : "sqlite";
  },

  // ---------- Items (per akun / per user_id) ----------
  async getAllItems(userId) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("items")
        .select("*")
        .eq("user_id", userId)
        .order("expiry", { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []).map(mapRow);
    }
    const db = await getSqlite();
    return db
      .prepare("SELECT * FROM items WHERE user_id = ? ORDER BY expiry ASC")
      .all(userId)
      .map(mapRow);
  },

  async addItem(userId, { name, qty, unit, unitCost, expiry, category, source, photoUrl }) {
    const cat = category || "Lainnya";
    const src = source || "manual";
    const photo = photoUrl || "";
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("items")
        .insert({
          user_id: userId, name, qty, unit, unit_cost: unitCost, expiry,
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
        `INSERT INTO items (user_id, name, qty, unit, unit_cost, expiry, category, source, photo_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(userId, name, qty, unit, unitCost, expiry, cat, src, photo);
    return Number(r.lastInsertRowid);
  },

  async updateStatus(userId, id, status, note = "") {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { error } = await sb
        .from("items")
        .update({ status, note })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return;
    }
    const db = await getSqlite();
    db.prepare("UPDATE items SET status = ?, note = ? WHERE id = ? AND user_id = ?").run(
      status,
      note,
      id,
      userId
    );
  },

  // ---------- Users ----------
  async getUserByEmail(email) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw new Error(error.message);
      return mapUser(data);
    }
    const db = await getSqlite();
    const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
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

  async ensureUser(email, fields = {}) {
    const existing = await this.getUserByEmail(email);
    if (existing) return existing;
    const name = fields.name || "";
    const businessName = fields.businessName || "";
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("users")
        .insert({ email, name, business_name: businessName })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return mapUser(data);
    }
    const db = await getSqlite();
    const r = db
      .prepare("INSERT INTO users (email, name, business_name) VALUES (?, ?, ?)")
      .run(email, name, businessName);
    return this.getUserById(Number(r.lastInsertRowid));
  },

  async updateUser(id, { name, businessName, phone, photoUrl }) {
    const patch = {
      name,
      business_name: businessName,
      phone,
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
         SET name = ?, business_name = ?, phone = ?, photo_url = ?, updated_at = ?
       WHERE id = ?`
    ).run(name, businessName, phone, photoUrl, nowIso(), id);
    return this.getUserById(id);
  },

  // ---------- OTP ----------
  async clearActiveOtps(email) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { error } = await sb
        .from("otp_codes")
        .update({ consumed: true })
        .eq("email", email)
        .eq("consumed", false);
      if (error) throw new Error(error.message);
      return;
    }
    const db = await getSqlite();
    db.prepare("UPDATE otp_codes SET consumed = 1 WHERE email = ? AND consumed = 0").run(email);
  },

  async createOtp({ email, codeHash, expiresAt }) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("otp_codes")
        .insert({ email, code_hash: codeHash, expires_at: expiresAt })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    }
    const db = await getSqlite();
    const r = db
      .prepare("INSERT INTO otp_codes (email, code_hash, expires_at) VALUES (?, ?, ?)")
      .run(email, codeHash, expiresAt);
    return Number(r.lastInsertRowid);
  },

  async getLatestOtp(email) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("otp_codes")
        .select("*")
        .eq("email", email)
        .eq("consumed", false)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw new Error(error.message);
      return data || null;
    }
    const db = await getSqlite();
    const row = db
      .prepare("SELECT * FROM otp_codes WHERE email = ? AND consumed = 0 ORDER BY id DESC LIMIT 1")
      .get(email);
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

  async countOtpsSince(email, sinceIso) {
    if (USING_SUPABASE) {
      const sb = await getSupabase();
      const { count, error } = await sb
        .from("otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
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
        "SELECT COUNT(*) AS c FROM otp_codes WHERE email = ? AND datetime(created_at) >= datetime(?)"
      )
      .get(email, sinceIso);
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
