import { randomBytes } from "node:crypto";
import { ServerResponse } from "node:http";
import bcrypt from "bcryptjs";
import { prisma } from "../_lib/prisma-client.mjs";

export const SESSION_COOKIE_NAME = "eh_session";

const DEFAULT_SESSION_TTL_HOURS = 24;

function getSessionTtlMs() {
  const hours = Number(process.env.SESSION_TTL_HOURS || DEFAULT_SESSION_TTL_HOURS);
  if (!Number.isFinite(hours) || hours <= 0) {
    return DEFAULT_SESSION_TTL_HOURS * 60 * 60 * 1000;
  }
  return hours * 60 * 60 * 1000;
}

function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export function parseCookies(headerValue) {
  if (!headerValue || typeof headerValue !== "string") {
    return {};
  }
  return headerValue.split(";").reduce((cookies, part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) {
      return cookies;
    }
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash) {
    return false;
  }
  return bcrypt.compare(password, passwordHash);
}

export function setSessionCookie(response, token) {
  const maxAgeSeconds = Math.floor(getSessionTtlMs() / 1000);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProduction()) {
    parts.push("Secure");
  }
  response.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(response) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isProduction()) {
    parts.push("Secure");
  }
  response.setHeader("Set-Cookie", parts.join("; "));
}

export async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + getSessionTtlMs());
  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });
  return token;
}

export async function deleteSessionByToken(token) {
  if (!token) {
    return;
  }
  await prisma.session.deleteMany({ where: { token } });
}

export async function getSessionFromRequest(request) {
  const cookies = parseCookies(request.headers?.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: true,
    },
  });

  if (!session || session.expiresAt <= new Date() || !session.user?.isActive) {
    if (session) {
      await prisma.session.deleteMany({ where: { token } });
    }
    return null;
  }

  return {
    token: session.token,
    user: {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
      displayName: session.user.displayName,
    },
  };
}

export async function authenticateUser(username, password) {
  const user = await prisma.appUser.findUnique({
    where: { username },
  });
  if (!user || !user.isActive) {
    return null;
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
  };
}

export async function listDemoAccounts() {
  const users = await prisma.appUser.findMany({
    where: { isActive: true },
    orderBy: { username: "asc" },
    select: {
      username: true,
      displayName: true,
      role: true,
    },
  });
  return users.map((user) => ({
    id: user.username,
    label: user.displayName || user.username,
    username: user.username,
    role: user.role,
  }));
}

const loginAttempts = new Map();

export function isLoginRateLimited(request) {
  const ip =
    request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    request.socket?.remoteAddress ||
    "unknown";
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(ip, { count: 0, resetAt: now + windowMs });
    return false;
  }
  return entry.count >= maxAttempts;
}

export function recordFailedLogin(request) {
  const ip =
    request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    request.socket?.remoteAddress ||
    "unknown";
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
}

export function clearLoginAttempts(request) {
  const ip =
    request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    request.socket?.remoteAddress ||
    "unknown";
  loginAttempts.delete(ip);
}

export function sendUnauthorized(response, message = "Authentication required") {
  if (!(response instanceof ServerResponse)) {
    throw new Error("Invalid response object");
  }
  response.statusCode = 401;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ result: false, message, data: null }));
  return 401;
}

export const PUBLIC_ACTIONS = new Set([
  "",
  "Login",
  "Logout",
  "GetDemoAccounts",
  "Session",
]);

export function isPublicAction(method, action) {
  if (method === "GET" && (!action || action === "")) {
    return true;
  }
  return PUBLIC_ACTIONS.has(action);
}

export async function requireAuth(request, response) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    sendUnauthorized(response);
    return null;
  }
  return session;
}
