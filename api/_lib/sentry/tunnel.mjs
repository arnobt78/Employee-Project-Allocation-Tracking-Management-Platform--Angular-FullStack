import { handleTunnelRequest } from "@sentry/core";
import { getAllowedSentryDsns } from "./env.mjs";

/**
 * @param {unknown} body
 * @returns {string | null}
 */
export function envelopeFromBody(body) {
  if (typeof body === "string" && body.length > 0) {
    return body;
  }
  if (Buffer.isBuffer(body) && body.length > 0) {
    return body.toString("utf8");
  }
  if (body instanceof Uint8Array && body.length > 0) {
    return Buffer.from(body).toString("utf8");
  }
  return null;
}

/**
 * Read raw POST body from a Node IncomingMessage.
 * @param {import('node:http').IncomingMessage} request
 * @returns {Promise<string>}
 */
export function readRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

/**
 * Forward a Sentry envelope to ingest (DSN allowlisted).
 * Works with Node IncomingMessage / ServerResponse (dev + Vercel Node).
 *
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 */
export async function handleSentryTunnel(request, response) {
  const method = (request.method || "GET").toUpperCase();
  if (method !== "POST") {
    response.statusCode = 405;
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Allow", "POST");
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const allowedDsns = getAllowedSentryDsns();
  if (allowedDsns.length === 0) {
    response.statusCode = 204;
    response.end();
    return;
  }

  let envelope = null;
  try {
    // Vercel / frameworks may pre-attach body; Node http leaves a stream
    if (request.body != null) {
      envelope = envelopeFromBody(request.body);
    }
    if (
      !envelope &&
      typeof request.on === "function" &&
      !request.readableEnded
    ) {
      const raw = await readRawBody(request);
      envelope = envelopeFromBody(raw);
    }
  } catch {
    response.statusCode = 400;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ error: "Unable to read envelope" }));
    return;
  }

  if (!envelope) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ error: "Empty envelope" }));
    return;
  }

  try {
    const contentType =
      (typeof request.headers?.["content-type"] === "string"
        ? request.headers["content-type"]
        : null) || "application/x-sentry-envelope";

    const upstream = await handleTunnelRequest({
      request: new Request("http://localhost/api/monitoring", {
        method: "POST",
        headers: { "content-type": contentType },
        body: envelope,
      }),
      allowedDsns,
    });

    const text = await upstream.text();
    response.statusCode = upstream.status;
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) {
      response.setHeader("Content-Type", upstreamType);
    }
    response.end(text);
  } catch {
    response.statusCode = 502;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ error: "Tunnel forward failed" }));
  }
}
