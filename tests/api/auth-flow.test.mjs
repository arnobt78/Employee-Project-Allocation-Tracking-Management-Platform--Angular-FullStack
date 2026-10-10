import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { sessionCookie, startApiServer } from "./support/api-server.mjs";
import { createFakeDb, importApi, installFakeDb } from "./support/fake-db.mjs";

const db = createFakeDb();
installFakeDb(db);

const sessionCache = await importApi("_lib/session-cache.mjs");

const PASSWORD = "correct horse";
let api;

const call = (...args) => api.call(...args);
const login = (username, password, ip) =>
  call("Login", { method: "POST", body: { username, password }, ip });

describe("auth HTTP flow", () => {
  before(async () => {
    api = await startApiServer();
  });

  after(() => api.close());

  beforeEach(async () => {
    db.reset();
    await db.seedUser({ username: "alice", password: PASSWORD });
  });

  test("Login sets a hardened session cookie and returns the public user", async () => {
    const response = await login("alice", PASSWORD);
    assert.equal(response.status, 200);

    const setCookie = response.headers.get("set-cookie");
    assert.match(setCookie, /^eh_session=[0-9a-f]{64};/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    assert.match(setCookie, /Path=\//);
    assert.match(setCookie, /Max-Age=86400(;|$)/);

    const body = await response.json();
    assert.equal(body.result, true);
    assert.equal(body.data.username, "alice");
    assert.equal("passwordHash" in body.data, false);
  });

  test("Login rejects a wrong password with 401 and no cookie", async () => {
    const response = await login("alice", "nope");
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(db.sessions.size, 0);
  });

  test("Login rejects an invalid body with 400", async () => {
    const response = await call("Login", { method: "POST", body: { username: "alice" } });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).message, "Password is required");
  });

  test("Login is rate limited after 5 failures from one IP", async () => {
    const ip = "203.0.113.50";
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await login("alice", "nope", ip)).status, 401);
    }
    assert.equal((await login("alice", PASSWORD, ip)).status, 429);
    assert.equal((await login("alice", PASSWORD, "203.0.113.51")).status, 200);
  });

  test("Session is 401 without a cookie and 200 from cache after login", async () => {
    assert.equal((await call("Session")).status, 401);

    const cookie = sessionCookie(await login("alice", PASSWORD));
    const response = await call("Session", { cookie });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.username, "alice");
    assert.equal(db.stats.aggregateCalls, 0);
  });

  test("protected routes are 401 signed out and 200 signed in", async () => {
    assert.equal((await call("GetNotificationFailures")).status, 401);
    assert.equal(
      (await call("GetNotificationFailures", { cookie: "eh_session=forged" })).status,
      401
    );

    const cookie = sessionCookie(await login("alice", PASSWORD));
    const response = await call("GetNotificationFailures", { cookie });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  });

  test("a malformed cookie header is treated as signed out, not a server error", async () => {
    const response = await call("Session", { cookie: "x=%; eh_session=%E0%A4%A" });
    assert.equal(response.status, 401);
  });

  test("Logout clears the cookie and the old cookie is rejected on replay", async () => {
    const cookie = sessionCookie(await login("alice", PASSWORD));
    const token = cookie.split("=")[1];

    const response = await call("Logout", { method: "POST", cookie });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /^eh_session=;.*Max-Age=0/);
    assert.equal(db.sessions.has(token), false);

    assert.equal((await call("Session", { cookie })).status, 401);
    assert.equal((await call("GetNotificationFailures", { cookie })).status, 401);
  });

  test("Logout without a cookie still succeeds", async () => {
    const response = await call("Logout", { method: "POST" });
    assert.equal(response.status, 200);
  });

  test("Logout with a junk token leaves no tombstone", async () => {
    const response = await call("Logout", { method: "POST", cookie: "eh_session=junk-token" });
    assert.equal(response.status, 200);
    assert.equal(sessionCache.isRevoked("junk-token"), false);
  });

  test("a session of a since-deactivated user is rejected once the cache is bypassed", async () => {
    process.env.SESSION_CACHE_TTL_SECONDS = "0";
    try {
      const cookie = sessionCookie(await login("alice", PASSWORD));
      assert.equal((await call("Session", { cookie })).status, 200);

      for (const user of db.users.values()) {
        user.isActive = false;
      }
      assert.equal((await call("Session", { cookie })).status, 401);
    } finally {
      delete process.env.SESSION_CACHE_TTL_SECONDS;
    }
  });
});
