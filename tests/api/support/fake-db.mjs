import { randomBytes } from "node:crypto";
import { mock } from "node:test";
import bcrypt from "bcryptjs";

const apiModule = (path) => new URL(`../../../api/${path}`, import.meta.url).href;

const SESSION_LOOKUP = {
  from: "AppUser",
  localField: "userId",
  foreignField: "_id",
  as: "user",
};

/**
 * Pins env the auth layer reads so ambient shell values cannot change results.
 * Each test file runs in its own process, so no restore is needed.
 */
export function pinTestEnv() {
  process.env.NODE_ENV = "test";
  for (const name of [
    "VERCEL",
    "SESSION_CACHE_TTL_SECONDS",
    "SESSION_TTL_HOURS",
    "SENTRY_DSN",
    "NG_APP_SENTRY_DSN",
    "NEXT_PUBLIC_SENTRY_DSN",
  ]) {
    delete process.env[name];
  }
}

/**
 * Applies the `$project.user.$let.in` stage of the session pipeline to a
 * stored user, so a wrong field name in the real pipeline surfaces in tests.
 */
function projectUser(projection, found) {
  const fields = projection.user?.$let?.in;
  if (!fields) {
    throw new Error("fake mongo: session pipeline must project `user` via $let");
  }
  const user = {};
  for (const [key, expr] of Object.entries(fields)) {
    const source = typeof expr === "string" && expr.startsWith("$$found.") ? expr.slice(8) : null;
    if (!source || !found) {
      continue;
    }
    user[key] = source === "_id" ? { toString: () => found.id } : found[source];
  }
  return user;
}

/**
 * In-memory stand-ins for the Prisma client and native Mongo collections used
 * by the auth layer. Unknown Prisma models/methods throw, so a test fails
 * loudly if code under test reaches for data it should not need.
 */
export function createFakeDb() {
  const users = new Map();
  const sessions = new Map();
  const stats = { aggregateCalls: 0 };
  let aggregateGate = null;

  const prisma = {
    appUser: {
      async findUnique({ where }) {
        return [...users.values()].find((user) => user.username === where.username) ?? null;
      },
    },
    session: {
      async create({ data }) {
        sessions.set(data.token, { ...data });
        return { ...data };
      },
      /** Like Prisma, an `undefined` filter value matches every row. */
      async deleteMany({ where }) {
        if (where?.token === undefined) {
          const count = sessions.size;
          sessions.clear();
          return { count };
        }
        const existed = sessions.delete(where.token);
        return { count: existed ? 1 : 0 };
      },
    },
    notificationLog: {
      async findMany() {
        return [];
      },
    },
  };

  const guardedPrisma = new Proxy(prisma, {
    get(target, model) {
      if (!(model in target)) {
        throw new Error(`fake prisma: unexpected model "${String(model)}"`);
      }
      return new Proxy(target[model], {
        get(methods, method) {
          if (!(method in methods)) {
            throw new Error(`fake prisma: unexpected ${String(model)}.${String(method)}`);
          }
          return methods[method];
        },
      });
    },
  });

  async function aggregateSession(pipeline) {
    stats.aggregateCalls += 1;
    const lookup = pipeline.find((stage) => stage.$lookup)?.$lookup;
    const projection = pipeline.find((stage) => stage.$project)?.$project;
    if (JSON.stringify(lookup) !== JSON.stringify(SESSION_LOOKUP) || projection?.expiresAt !== 1) {
      throw new Error("fake mongo: unexpected session pipeline shape");
    }
    const token = pipeline.find((stage) => stage.$match)?.$match.token;
    const row = sessions.get(token);
    if (aggregateGate) {
      aggregateGate.onRead();
      await aggregateGate.released;
    }
    if (!row) {
      return [];
    }
    return [{ expiresAt: row.expiresAt, user: projectUser(projection, users.get(row.userId)) }];
  }

  async function mongoCollection(name) {
    if (name !== "Session") {
      throw new Error(`fake mongo: unexpected collection "${name}"`);
    }
    return { aggregate: (pipeline) => ({ toArray: () => aggregateSession(pipeline) }) };
  }

  function releaseLookups() {
    const gate = aggregateGate;
    aggregateGate = null;
    gate?.release();
  }

  return {
    prisma: guardedPrisma,
    mongoCollection,
    users,
    sessions,
    stats,
    /**
     * Holds session lookups open after they have read the row, until
     * `release()`. `rowRead` resolves once a lookup has read its row.
     */
    holdLookups() {
      let release;
      let onRead;
      const released = new Promise((resolve) => {
        release = resolve;
      });
      const rowRead = new Promise((resolve) => {
        onRead = resolve;
      });
      aggregateGate = { released, release, onRead };
      return { rowRead, release: releaseLookups };
    },
    async seedUser({ username, password, isActive = true, role = "admin" }) {
      const user = {
        id: randomBytes(12).toString("hex"),
        username,
        displayName: `${username} user`,
        role,
        isActive,
        passwordHash: await bcrypt.hash(password, 4),
      };
      users.set(user.id, user);
      return user;
    },
    reset() {
      releaseLookups();
      users.clear();
      sessions.clear();
      stats.aggregateCalls = 0;
    },
  };
}

/**
 * Must run before the API modules are imported (use dynamic `import()`
 * afterwards). Also pins env and silences dev timing logs.
 */
export function installFakeDb(db) {
  pinTestEnv();
  mock.module(apiModule("_lib/prisma-client.mjs"), { namedExports: { prisma: db.prisma } });
  mock.module(apiModule("_lib/mongo-client.mjs"), {
    namedExports: { mongoCollection: db.mongoCollection },
  });
  mock.module(apiModule("_lib/timing.mjs"), {
    namedExports: { logTiming: () => {}, timed: (_label, task) => task() },
  });
}

export const importApi = (path) => import(apiModule(path));
