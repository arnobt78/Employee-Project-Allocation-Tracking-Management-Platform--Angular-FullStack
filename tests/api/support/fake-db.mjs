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

/** Per model: the field rows are keyed by, unique fields, and schema defaults. */
const MODELS = {
  appUser: { key: "id", unique: ["id", "username"], defaults: { role: "admin", isActive: true } },
  session: { key: "token", unique: ["token"], defaults: {} },
  notificationLog: { key: "id", unique: ["id"], defaults: { recipientCount: 0 } },
  counter: { key: "key", unique: ["key"], defaults: {} },
  departmentParent: { key: "departmentId", unique: ["departmentId"], defaults: {} },
  departmentChild: { key: "childDeptId", unique: ["childDeptId"], defaults: {} },
  employee: { key: "employeeId", unique: ["employeeId"], defaults: { isActive: true } },
  project: {
    key: "projectId",
    unique: ["projectId"],
    defaults: { status: "draft", approvalStatus: "draft" },
  },
  projectEmployee: {
    key: "empProjectId",
    unique: ["empProjectId", ["projectId", "empId"]],
    defaults: { isActive: true },
  },
};

/**
 * Rows flagged with this field mimic documents whose `_id` is not an ObjectId:
 * real Prisma `deleteMany` silently skips them, the native driver does not.
 */
export const LEGACY_ID_FLAG = "legacyStringId";

/** Native collection name -> Prisma model, for `updateWithMongoFallback` and cascade deletes. */
const COLLECTION_MODELS = {
  Employee: "employee",
  Project: "project",
  ProjectEmployee: "projectEmployee",
};

const ENV_TO_CLEAR = [
  "VERCEL",
  "SESSION_CACHE_TTL_SECONDS",
  "SESSION_TTL_HOURS",
  "SENTRY_DSN",
  "NG_APP_SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "RESEND_TOKEN",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
  "EMAIL_DRY_RUN",
  "NOTIFY_APPROVAL_TO",
  "CMS_SPACE_ID",
  "CMS_ENVIRONMENT",
  "CMS_DELIVERY_TOKEN",
  "CMS_PREVIEW_TOKEN",
];

/**
 * Pins env the API reads so ambient shell values cannot change results and no
 * real email provider is configured. Each test file runs in its own process,
 * so no restore is needed.
 */
export function pinTestEnv() {
  process.env.NODE_ENV = "test";
  for (const name of ENV_TO_CLEAR) {
    delete process.env[name];
  }
}

const prismaError = (code, message) => Object.assign(new Error(message), { code });
const clone = (value) => structuredClone(value);
const sameValue = (a, b) =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;

/** Supports the filters the API uses: equality, `in`, `gt`/`lt`. `undefined` matches all, as in Prisma. */
function matches(row, where = {}) {
  return Object.entries(where).every(([field, condition]) => {
    if (condition === undefined) {
      return true;
    }
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      return Object.entries(condition).every(([op, value]) => {
        switch (op) {
          case "in":
            return value.some((item) => sameValue(row[field], item));
          case "gt":
            return row[field] > value;
          case "lt":
            return row[field] < value;
          default:
            throw new Error(`fake prisma: unsupported filter "${op}" on ${field}`);
        }
      });
    }
    return sameValue(row[field], condition);
  });
}

function pick(row, select) {
  if (!row) {
    return null;
  }
  if (!select) {
    return clone(row);
  }
  return Object.fromEntries(
    Object.entries(select)
      .filter(([, include]) => include)
      .map(([field]) => [field, clone(row[field] ?? null)])
  );
}

function sortRows(rows, orderBy) {
  if (!orderBy) {
    return rows;
  }
  const [[field, direction]] = Object.entries(orderBy);
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => (a[field] > b[field] ? sign : a[field] < b[field] ? -sign : 0));
}

const withoutUndefined = (data) =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

function createModel(name, { key, unique, defaults }) {
  const rows = new Map();

  const findRows = (where) => [...rows.values()].filter((row) => matches(row, where));

  /** Each entry is one field or a compound list of fields. */
  const assertUnique = (candidate, ignore) => {
    for (const entry of unique) {
      const fields = [entry].flat();
      if (fields.some((field) => candidate[field] === undefined)) {
        continue;
      }
      const clash = [...rows.values()].find(
        (row) => row !== ignore && fields.every((field) => sameValue(row[field], candidate[field]))
      );
      if (clash) {
        throw prismaError("P2002", `Unique constraint failed on ${name}.${fields.join("+")}`);
      }
    }
  };

  const findUniqueRow = (where) => {
    const fields = Object.keys(where ?? {});
    if (fields.length !== 1 || !unique.includes(fields[0]) || where[fields[0]] === undefined) {
      throw new Error(`fake prisma: ${name} unique lookup needs one defined unique field`);
    }
    return findRows(where)[0] ?? null;
  };

  const insert = (data) => {
    const now = new Date();
    const row = {
      id: randomBytes(12).toString("hex"),
      ...defaults,
      createdAt: now,
      updatedAt: now,
      ...withoutUndefined(clone(data)),
    };
    if (row[key] === undefined || row[key] === null || Number.isNaN(row[key])) {
      throw new Error(`fake prisma: ${name}.${key} is required`);
    }
    assertUnique(row);
    rows.set(row[key], row);
    return row;
  };

  const updateRow = (row, data) => {
    const next = { ...row, ...withoutUndefined(clone(data)), updatedAt: new Date() };
    assertUnique(next, row);
    rows.delete(row[key]);
    rows.set(next[key], next);
    return next;
  };

  const methods = {
    async findMany({ where, select, orderBy, take } = {}) {
      const sorted = sortRows(findRows(where), orderBy);
      return (take ? sorted.slice(0, take) : sorted).map((row) => pick(row, select));
    },
    async findUnique({ where, select }) {
      return pick(findUniqueRow(where), select);
    },
    async findFirst({ where, select, orderBy } = {}) {
      return pick(sortRows(findRows(where), orderBy)[0], select);
    },
    async count({ where } = {}) {
      return findRows(where).length;
    },
    async create({ data, select }) {
      return pick(insert(data), select);
    },
    async createMany({ data }) {
      data.forEach(insert);
      return { count: data.length };
    },
    async update({ where, data, select }) {
      const row = findUniqueRow(where);
      if (!row) {
        throw prismaError("P2025", `${name} to update not found`);
      }
      return pick(updateRow(row, data), select);
    },
    async upsert({ where, create, update, select }) {
      const row = findUniqueRow(where);
      return pick(row ? updateRow(row, update) : insert(create), select);
    },
    async delete({ where, select }) {
      const row = findUniqueRow(where);
      if (!row) {
        throw prismaError("P2025", `${name} to delete not found`);
      }
      rows.delete(row[key]);
      return pick(row, select);
    },
    async deleteMany({ where } = {}) {
      const doomed = findRows(where).filter((row) => !row[LEGACY_ID_FLAG]);
      doomed.forEach((row) => rows.delete(row[key]));
      return { count: doomed.length };
    },
  };

  return { rows, methods, updateRow };
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
  for (const [field, expr] of Object.entries(fields)) {
    const source = typeof expr === "string" && expr.startsWith("$$found.") ? expr.slice(8) : null;
    if (!source || !found) {
      continue;
    }
    user[field] = source === "_id" ? { toString: () => found.id } : found[source];
  }
  return user;
}

/**
 * In-memory stand-ins for the Prisma client and the native Mongo collections
 * the API uses. Unknown models, methods, filters or collections throw, so a
 * test fails loudly if code reaches for something the fake does not model.
 */
export function createFakeDb() {
  const models = Object.fromEntries(
    Object.entries(MODELS).map(([name, spec]) => [name, createModel(name, spec)])
  );
  const tables = Object.fromEntries(Object.entries(models).map(([name, m]) => [name, m.rows]));
  const users = tables.appUser;
  const sessions = tables.session;
  const stats = { aggregateCalls: 0 };
  let aggregateGate = null;

  const prisma = {
    ...Object.fromEntries(Object.entries(models).map(([name, m]) => [name, m.methods])),
    /** Array form only; operations run in order. */
    async $transaction(operations) {
      if (!Array.isArray(operations)) {
        throw new Error("fake prisma: only array $transaction is supported");
      }
      const results = [];
      for (const operation of operations) {
        results.push(await operation);
      }
      return results;
    },
  };

  const guardedPrisma = new Proxy(prisma, {
    get(target, model) {
      if (!(model in target)) {
        throw new Error(`fake prisma: unexpected model "${String(model)}"`);
      }
      if (typeof target[model] === "function") {
        return target[model];
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

  /** Mirrors the counter pipeline: `value = ($value ?? seed - 1) + 1`, upserting. */
  async function incrementCounter(filter, pipeline, options) {
    const seedMinusOne = pipeline?.[0]?.$set?.value?.$add?.[0]?.$ifNull?.[1];
    if (
      typeof filter?.key !== "string" ||
      typeof seedMinusOne !== "number" ||
      !options?.upsert ||
      options.returnDocument !== "after"
    ) {
      throw new Error("fake mongo: unexpected counter update shape");
    }
    const counter = models.counter;
    const existing = counter.rows.get(filter.key);
    const value = (existing?.value ?? seedMinusOne) + 1;
    return existing
      ? clone(counter.updateRow(existing, { value }))
      : counter.methods.create({ data: { key: filter.key, value } });
  }

  async function mongoCollection(name) {
    if (name === "Session") {
      return { aggregate: (pipeline) => ({ toArray: () => aggregateSession(pipeline) }) };
    }
    if (name === "Counter") {
      return { findOneAndUpdate: incrementCounter };
    }
    const modelName = COLLECTION_MODELS[name];
    if (modelName) {
      const model = models[modelName];
      const find = (filter) => [...model.rows.values()].filter((item) => matches(item, filter));
      const remove = (rows) => {
        rows.forEach((row) => model.rows.delete(row[MODELS[modelName].key]));
        return { deletedCount: rows.length };
      };
      return {
        async updateOne(filter, update) {
          const [row] = find(filter);
          if (row) {
            model.updateRow(row, update.$set ?? {});
          }
          return { matchedCount: row ? 1 : 0, modifiedCount: row ? 1 : 0 };
        },
        async deleteOne(filter) {
          return remove(find(filter).slice(0, 1));
        },
        async deleteMany(filter) {
          return remove(find(filter));
        },
        async countDocuments(filter) {
          return find(filter).length;
        },
      };
    }
    throw new Error(`fake mongo: unexpected collection "${name}"`);
  }

  function releaseLookups() {
    const gate = aggregateGate;
    aggregateGate = null;
    gate?.release();
  }

  return {
    prisma: guardedPrisma,
    mongoCollection,
    tables,
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
      const passwordHash = await bcrypt.hash(password, 4);
      const row = await models.appUser.methods.create({
        data: { username, displayName: `${username} user`, role, isActive, passwordHash },
      });
      return row;
    },
    /** Clears every table. */
    reset() {
      releaseLookups();
      Object.values(tables).forEach((rows) => rows.clear());
      stats.aggregateCalls = 0;
    },
  };
}

/**
 * Must run before the API modules are imported (use dynamic `import()`
 * afterwards). Also pins env and silences dev timing logs.
 */
export function installFakeDb(db) {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 24) {
    throw new Error(
      `API tests need Node 24 (Vercel runtime, see .nvmrc); running ${process.version}. Use \`fnm use\` or \`nvm use\`.`
    );
  }
  pinTestEnv();
  mock.module(apiModule("_lib/prisma-client.mjs"), { exports: { prisma: db.prisma } });
  mock.module(apiModule("_lib/mongo-client.mjs"), {
    exports: { mongoCollection: db.mongoCollection },
  });
  mock.module(apiModule("_lib/timing.mjs"), {
    exports: { logTiming: () => {}, timed: (_label, task) => task() },
  });
}

export const importApi = (path) => import(apiModule(path));
