import { createServer } from "node:http";
import { importApi } from "./fake-db.mjs";

let ipCounter = 0;

/**
 * Serves the real Vercel entry (`[...segments].js`) on an ephemeral local
 * port. Import only after `installFakeDb()`.
 */
export async function startApiServer() {
  const { default: vercelHandler } = await importApi("employee-management/[...segments].js");
  const server = createServer(vercelHandler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/employee-management`;

  /** Each call gets its own client IP unless `ip` is given, so the login rate limiter stays isolated. */
  function call(action, { method = "GET", cookie, body, ip } = {}) {
    const headers = { "x-forwarded-for": ip ?? `198.51.100.${(++ipCounter % 250) + 1}` };
    if (cookie) {
      headers.cookie = cookie;
    }
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }
    return fetch(`${baseUrl}/${action}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  return {
    call,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** `eh_session=<token>` from a Set-Cookie header. */
export const sessionCookie = (response) => response.headers.get("set-cookie").split(";")[0];

/** List/detail payloads are either raw or wrapped in `{ result, message, data }`. */
export const unwrap = (json) => json?.data ?? json;
