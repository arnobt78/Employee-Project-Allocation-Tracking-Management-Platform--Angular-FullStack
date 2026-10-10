import { createHash } from "node:crypto";

const DEFAULT_TTL_SECONDS = 30;
const MAX_ENTRIES = 1000;
const REVOKED_WINDOW_MS = 60_000;

/**
 * Per-instance cache of validated sessions, so warm requests skip the DB.
 * Keyed by SHA-256 of the token (raw tokens are never held as keys). Only
 * valid sessions are cached, so random tokens cannot fill memory. Revocation
 * on another instance (logout, deactivation) takes effect here within the TTL.
 */
const entries = new Map();

/**
 * Tokens revoked on this instance. A request racing the logout can read the
 * session row before it is deleted; this stops it from being accepted or
 * re-cached.
 */
const revoked = new Map();

function ttlMs() {
  const raw = process.env.SESSION_CACHE_TTL_SECONDS?.trim();
  const seconds = raw ? Number(raw) : DEFAULT_TTL_SECONDS;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

function keyFor(token) {
  return createHash("sha256").update(token).digest("hex");
}

function boundedSet(map, key, value) {
  map.delete(key);
  if (map.size >= MAX_ENTRIES) {
    map.delete(map.keys().next().value);
  }
  map.set(key, value);
}

export function getCachedSession(token) {
  const key = keyFor(token);
  const entry = entries.get(key);
  if (!entry) {
    return null;
  }
  if (entry.validUntil <= Date.now()) {
    entries.delete(key);
    return null;
  }
  return entry.user;
}

export function cacheSession(token, user, expiresAt) {
  const ttl = ttlMs();
  if (!ttl || isRevoked(token)) {
    return;
  }
  const validUntil = Math.min(Date.now() + ttl, new Date(expiresAt).getTime());
  if (!(validUntil > Date.now())) {
    return;
  }
  boundedSet(entries, keyFor(token), { user: Object.freeze({ ...user }), validUntil });
}

export function revokeSession(token) {
  const key = keyFor(token);
  entries.delete(key);
  boundedSet(revoked, key, Date.now() + REVOKED_WINDOW_MS);
}

/** For tokens with no session row, so junk logouts don't evict real tombstones. */
export function forgetRevocation(token) {
  revoked.delete(keyFor(token));
}

export function isRevoked(token) {
  const key = keyFor(token);
  const until = revoked.get(key);
  if (until === undefined) {
    return false;
  }
  if (until <= Date.now()) {
    revoked.delete(key);
    return false;
  }
  return true;
}
