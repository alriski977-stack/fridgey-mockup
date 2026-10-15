// Sesi login Fridgey berbasis cookie HttpOnly.
// Token sesi acak; hanya hash-nya yang disimpan di database.

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { store } from "@/lib/db";

export const SESSION_COOKIE = "fridgey_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await store.createSession({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return store.getSessionUser(hashToken(token));
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await store.deleteSession(hashToken(token));
}
