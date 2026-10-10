import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { createFakeDb, importApi, installFakeDb } from "./support/fake-db.mjs";

const db = createFakeDb();
installFakeDb(db);

const auth = await importApi("employee-management/auth.mjs");
const sessionCache = await importApi("_lib/session-cache.mjs");

const requestWith = (token, headers = {}) => ({
  headers: { ...(token ? { cookie: `${auth.SESSION_COOKIE_NAME}=${token}` } : {}), ...headers },
  socket: { remoteAddress: "127.0.0.1" },
});

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  role: user.role,
  displayName: user.displayName,
});

async function insertSession(user, expiresAt = new Date(Date.now() + 3_600_000)) {
  const token = `seeded-${Math.random().toString(16).slice(2)}`;
  await db.prisma.session.create({ data: { token, userId: user.id, expiresAt } });
  return token;
}

describe("getSessionFromRequest", () => {
  beforeEach(() => db.reset());

  test("returns null without a session cookie", async () => {
    assert.equal(await auth.getSessionFromRequest(requestWith(null)), null);
    assert.equal(db.stats.aggregateCalls, 0);
  });

  test("validates once via the DB, then serves from cache", async () => {
    const user = await db.seedUser({ username: "alice", password: "pw" });
    const token = await insertSession(user);

    const first = await auth.getSessionFromRequest(requestWith(token));
    assert.deepEqual(first, { token, user: publicUser(user) });
    assert.equal(db.stats.aggregateCalls, 1);

    const second = await auth.getSessionFromRequest(requestWith(token));
    assert.deepEqual(second.user, publicUser(user));
    assert.equal(db.stats.aggregateCalls, 1);
  });

  test("never exposes the password hash", async () => {
    const user = await db.seedUser({ username: "alice", password: "pw" });
    const token = await insertSession(user);
    const session = await auth.getSessionFromRequest(requestWith(token));
    assert.equal("passwordHash" in session.user, false);
    assert.equal("isActive" in session.user, false);
  });

  test("rejects and deletes an expired session", async () => {
    const user = await db.seedUser({ username: "alice", password: "pw" });
    const token = await insertSession(user, new Date(Date.now() - 1));
    assert.equal(await auth.getSessionFromRequest(requestWith(token)), null);
    assert.equal(db.sessions.has(token), false);
  });

  test("rejects and deletes a session of an inactive user", async () => {
    const user = await db.seedUser({ username: "bob", password: "pw", isActive: false });
    const token = await insertSession(user);
    assert.equal(await auth.getSessionFromRequest(requestWith(token)), null);
    assert.equal(db.sessions.has(token), false);
  });

  test("rejects and deletes a session whose user no longer exists", async () => {
    const user = await db.seedUser({ username: "ghost", password: "pw" });
    const token = await insertSession(user);
    db.users.delete(user.id);
    assert.equal(await auth.getSessionFromRequest(requestWith(token)), null);
    assert.equal(db.sessions.has(token), false);
  });

  test("a bogus token is not cached: every attempt hits the DB", async () => {
    const request = requestWith("bogus-token");
    assert.equal(await auth.getSessionFromRequest(request), null);
    assert.equal(await auth.getSessionFromRequest(request), null);
    assert.equal(db.stats.aggregateCalls, 2);
    assert.equal(sessionCache.getCachedSession("bogus-token"), null);
  });
});

describe("createSession", () => {
  beforeEach(() => db.reset());

  test("persists a random 64-hex token and primes the cache", async () => {
    const user = await db.seedUser({ username: "alice", password: "pw" });
    const token = await auth.createSession(publicUser(user));

    assert.match(token, /^[0-9a-f]{64}$/);
    assert.equal(db.sessions.get(token).userId, user.id);
    assert.ok(db.sessions.get(token).expiresAt > new Date());

    const session = await auth.getSessionFromRequest(requestWith(token));
    assert.deepEqual(session.user, publicUser(user));
    assert.equal(db.stats.aggregateCalls, 0);
  });

  test("issues a distinct token per login", async () => {
    const user = await db.seedUser({ username: "alice", password: "pw" });
    const a = await auth.createSession(publicUser(user));
    const b = await auth.createSession(publicUser(user));
    assert.notEqual(a, b);
  });
});

describe("deleteSessionByToken", () => {
  beforeEach(() => db.reset());

  test("deletes the row, evicts the cache and keeps a tombstone", async () => {
    const user = await db.seedUser({ username: "alice", password: "pw" });
    const token = await auth.createSession(publicUser(user));

    await auth.deleteSessionByToken(token);

    assert.equal(db.sessions.has(token), false);
    assert.equal(sessionCache.getCachedSession(token), null);
    assert.ok(sessionCache.isRevoked(token));
    assert.equal(await auth.getSessionFromRequest(requestWith(token)), null);
  });

  test("drops the tombstone when no session row existed", async () => {
    await auth.deleteSessionByToken("never-issued");
    assert.equal(sessionCache.isRevoked("never-issued"), false);
  });

  test("an empty token never reaches the DB (an undefined filter would delete every session)", async () => {
    const user = await db.seedUser({ username: "alice", password: "pw" });
    const token = await insertSession(user);
    await auth.deleteSessionByToken("");
    await auth.deleteSessionByToken(undefined);
    assert.ok(db.sessions.has(token));
  });

  test("a lookup racing the logout is neither accepted nor re-cached", async () => {
    const user = await db.seedUser({ username: "alice", password: "pw" });
    const token = await insertSession(user);

    const gate = db.holdLookups();
    const racing = auth.getSessionFromRequest(requestWith(token));
    await gate.rowRead;
    await auth.deleteSessionByToken(token);
    gate.release();

    assert.equal(await racing, null);
    assert.equal(sessionCache.getCachedSession(token), null);
    assert.equal(await auth.getSessionFromRequest(requestWith(token)), null);
  });
});

describe("authenticateUser", () => {
  beforeEach(() => db.reset());

  test("returns the public user for valid credentials", async () => {
    const user = await db.seedUser({ username: "alice", password: "s3cret" });
    assert.deepEqual(await auth.authenticateUser("alice", "s3cret"), publicUser(user));
  });

  test("rejects a wrong password, unknown user and inactive user", async () => {
    await db.seedUser({ username: "alice", password: "s3cret" });
    await db.seedUser({ username: "bob", password: "s3cret", isActive: false });
    assert.equal(await auth.authenticateUser("alice", "wrong"), null);
    assert.equal(await auth.authenticateUser("nobody", "s3cret"), null);
    assert.equal(await auth.authenticateUser("bob", "s3cret"), null);
  });
});

describe("parseCookies", () => {
  test("parses multiple cookies, trimming whitespace", () => {
    assert.deepEqual(auth.parseCookies("a=1; eh_session=abc ;b=2"), {
      a: "1",
      eh_session: "abc",
      b: "2",
    });
  });

  test("keeps '=' inside values and URL-decodes them", () => {
    assert.deepEqual(auth.parseCookies("k=a%20b=c"), { k: "a b=c" });
  });

  test("returns an empty object for missing or non-string headers", () => {
    assert.deepEqual(auth.parseCookies(undefined), {});
    assert.deepEqual(auth.parseCookies(""), {});
    assert.deepEqual(auth.parseCookies(["eh_session=x"]), {});
  });

  test("skips cookies with malformed percent-encoding instead of throwing", () => {
    assert.deepEqual(auth.parseCookies("bad=%; eh_session=abc"), { eh_session: "abc" });
  });
});

describe("session cookie headers", () => {
  const capture = (write) => {
    const headers = {};
    write({ setHeader: (name, value) => (headers[name] = value) });
    return headers["Set-Cookie"];
  };

  test("omits Secure outside production and adds it in production", () => {
    assert.doesNotMatch(capture((res) => auth.setSessionCookie(res, "t")), /Secure/);
    process.env.NODE_ENV = "production";
    try {
      assert.match(capture((res) => auth.setSessionCookie(res, "t")), /; Secure$/);
      assert.match(capture((res) => auth.clearSessionCookie(res)), /Max-Age=0.*; Secure$/);
    } finally {
      process.env.NODE_ENV = "test";
    }
  });

  test("Max-Age follows SESSION_TTL_HOURS", () => {
    process.env.SESSION_TTL_HOURS = "2";
    try {
      assert.match(capture((res) => auth.setSessionCookie(res, "t")), /Max-Age=7200(;|$)/);
    } finally {
      delete process.env.SESSION_TTL_HOURS;
    }
  });
});

describe("isPublicAction", () => {
  test("only login, logout, demo accounts and the API root skip auth", () => {
    assert.ok(auth.isPublicAction("GET", ""));
    assert.ok(auth.isPublicAction("POST", "Login"));
    assert.ok(auth.isPublicAction("POST", "Logout"));
    assert.ok(auth.isPublicAction("GET", "GetDemoAccounts"));
  });

  test("session and data routes require auth", () => {
    for (const action of ["Session", "GetAllEmployees", "GetNotificationFailures", "login"]) {
      assert.equal(auth.isPublicAction("GET", action), false, action);
    }
  });
});

describe("login rate limiter", () => {
  test("blocks an IP after 5 failures and resets on success", () => {
    const request = requestWith(null, { "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    assert.equal(auth.isLoginRateLimited(request), false);
    for (let i = 0; i < 5; i += 1) {
      auth.recordFailedLogin(request);
    }
    assert.equal(auth.isLoginRateLimited(request), true);

    const sameProxyOtherClient = requestWith(null, { "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    assert.equal(auth.isLoginRateLimited(sameProxyOtherClient), false);

    const otherIp = requestWith(null, { "x-forwarded-for": "203.0.113.8" });
    assert.equal(auth.isLoginRateLimited(otherIp), false);

    auth.clearLoginAttempts(request);
    assert.equal(auth.isLoginRateLimited(request), false);
  });
});
