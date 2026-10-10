import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import {
  cacheSession,
  forgetRevocation,
  getCachedSession,
  isRevoked,
  revokeSession,
} from "../../api/_lib/session-cache.mjs";
import { pinTestEnv } from "./support/fake-db.mjs";

pinTestEnv();

const START = Date.UTC(2026, 0, 1);
const HOUR_LATER = new Date(START + 3_600_000);
const user = { id: "u1", username: "alice", role: "admin", displayName: "Alice" };

let counter = 0;
const freshToken = () => `token-${++counter}`;

describe("session cache", () => {
  beforeEach(() => {
    delete process.env.SESSION_CACHE_TTL_SECONDS;
    mock.timers.enable({ apis: ["Date"], now: START });
  });

  afterEach(() => {
    mock.timers.reset();
    delete process.env.SESSION_CACHE_TTL_SECONDS;
  });

  test("returns a cached user within the default 30s TTL", () => {
    const token = freshToken();
    cacheSession(token, user, HOUR_LATER);
    mock.timers.tick(29_999);
    assert.deepEqual(getCachedSession(token), user);
  });

  test("drops the entry once the TTL elapses", () => {
    const token = freshToken();
    cacheSession(token, user, HOUR_LATER);
    mock.timers.tick(30_000);
    assert.equal(getCachedSession(token), null);
  });

  test("never outlives the session expiry", () => {
    const token = freshToken();
    cacheSession(token, user, new Date(START + 5_000));
    mock.timers.tick(5_000);
    assert.equal(getCachedSession(token), null);
  });

  test("stores a frozen copy, isolated from the caller's object", () => {
    const token = freshToken();
    const source = { ...user };
    cacheSession(token, source, HOUR_LATER);
    source.role = "viewer";
    const cached = getCachedSession(token);
    assert.equal(cached.role, "admin");
    assert.ok(Object.isFrozen(cached));
  });

  test("respects SESSION_CACHE_TTL_SECONDS", () => {
    process.env.SESSION_CACHE_TTL_SECONDS = "5";
    const token = freshToken();
    cacheSession(token, user, HOUR_LATER);
    mock.timers.tick(4_999);
    assert.ok(getCachedSession(token));
    mock.timers.tick(1);
    assert.equal(getCachedSession(token), null);
  });

  test("SESSION_CACHE_TTL_SECONDS=0 disables caching", () => {
    process.env.SESSION_CACHE_TTL_SECONDS = "0";
    const token = freshToken();
    cacheSession(token, user, HOUR_LATER);
    assert.equal(getCachedSession(token), null);
  });

  test("a blank or invalid TTL falls back to the default / disables", () => {
    process.env.SESSION_CACHE_TTL_SECONDS = "   ";
    const blank = freshToken();
    cacheSession(blank, user, HOUR_LATER);
    mock.timers.tick(29_000);
    assert.ok(getCachedSession(blank));

    process.env.SESSION_CACHE_TTL_SECONDS = "abc";
    const invalid = freshToken();
    cacheSession(invalid, user, HOUR_LATER);
    assert.equal(getCachedSession(invalid), null);
  });

  test("caps the cache at 1000 entries, evicting the oldest", () => {
    const tokens = Array.from({ length: 1001 }, freshToken);
    for (const token of tokens) {
      cacheSession(token, user, HOUR_LATER);
    }
    assert.equal(getCachedSession(tokens[0]), null);
    assert.ok(getCachedSession(tokens[1]));
    assert.ok(getCachedSession(tokens[1000]));
  });

  test("revokeSession evicts the entry and blocks re-caching", () => {
    const token = freshToken();
    cacheSession(token, user, HOUR_LATER);
    revokeSession(token);
    assert.equal(getCachedSession(token), null);
    assert.ok(isRevoked(token));
    cacheSession(token, user, HOUR_LATER);
    assert.equal(getCachedSession(token), null);
  });

  test("revocation tombstones expire after 60s", () => {
    const token = freshToken();
    revokeSession(token);
    mock.timers.tick(59_999);
    assert.ok(isRevoked(token));
    mock.timers.tick(1);
    assert.equal(isRevoked(token), false);
  });

  test("forgetRevocation clears the tombstone", () => {
    const token = freshToken();
    revokeSession(token);
    forgetRevocation(token);
    assert.equal(isRevoked(token), false);
  });

  test("unknown tokens are neither cached nor revoked", () => {
    const token = freshToken();
    assert.equal(getCachedSession(token), null);
    assert.equal(isRevoked(token), false);
  });
});
