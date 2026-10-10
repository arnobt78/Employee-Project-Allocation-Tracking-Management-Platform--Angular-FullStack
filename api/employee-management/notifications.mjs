import nodemailer from "nodemailer";
import { recordDelivery } from "./notification-log.mjs";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_TOKEN = process.env.RESEND_TOKEN;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT
  ? Number(process.env.SMTP_PORT)
  : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  process.env.SMTP_USER ||
  "Employee Management <no-reply@example.com>";

const EMAIL_DRY_RUN = process.env.EMAIL_DRY_RUN === "true";

/** Bounded so a dead SMTP host fails fast instead of holding the function open (nodemailer defaults to 2 min). */
const SMTP_TIMEOUTS_MS = { connection: 8_000, greeting: 8_000, socket: 15_000 };
const RESEND_TIMEOUT_MS = 10_000;

function hasResendConfig() {
  return typeof RESEND_TOKEN === "string" && RESEND_TOKEN.length > 0;
}

function hasSmtpConfig() {
  return (
    typeof SMTP_HOST === "string" &&
    SMTP_HOST.length > 0 &&
    typeof SMTP_PORT === "number" &&
    !Number.isNaN(SMTP_PORT) &&
    typeof SMTP_USER === "string" &&
    SMTP_USER.length > 0 &&
    typeof SMTP_PASS === "string" &&
    SMTP_PASS.length > 0
  );
}

async function sendViaResend(payload) {
  if (!hasResendConfig()) {
    throw new Error("Resend configuration missing.");
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_TOKEN}`,
    },
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    body: JSON.stringify({
      from: payload.from,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html ?? undefined,
      text: payload.text ?? undefined,
      cc: payload.cc ?? undefined,
      bcc: payload.bcc ?? undefined,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(
      `Resend request failed (${response.status}): ${text || "No response body"}`
    );
    error.status = response.status;
    error.responseText = text;
    throw error;
  }

  const body = await response.json().catch(() => ({}));
  
  // Check if response indicates testing mode limitation
  // In testing mode, Resend may succeed but only send to verified emails
  // If we have multiple recipients (TO + CC + BCC), we should use SMTP to ensure all get emails
  const allRecipients = [
    ...(Array.isArray(payload.to) ? payload.to : [payload.to]),
    ...(Array.isArray(payload.cc) ? payload.cc : payload.cc ? [payload.cc] : []),
    ...(Array.isArray(payload.bcc) ? payload.bcc : payload.bcc ? [payload.bcc] : []),
  ];
  
  // If we have multiple recipients, Resend testing mode might not send to all
  // Return a special flag to indicate we should fall back to SMTP
  if (allRecipients.length > 1) {
    return {
      provider: "resend",
      messageId: body?.id ?? null,
      response: body,
      shouldFallbackToSmtp: true, // Flag to indicate we should also use SMTP for all recipients
    };
  }

  return {
    provider: "resend",
    messageId: body?.id ?? null,
    response: body,
  };
}

async function sendViaSmtp(payload) {
  if (!hasSmtpConfig()) {
    throw new Error("SMTP configuration missing.");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    connectionTimeout: SMTP_TIMEOUTS_MS.connection,
    greetingTimeout: SMTP_TIMEOUTS_MS.greeting,
    socketTimeout: SMTP_TIMEOUTS_MS.socket,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: payload.from,
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  return {
    provider: "smtp",
    messageId: info?.messageId ?? null,
    response: info,
  };
}

/** Reserved names (RFC 2606 / RFC 6761) can never receive mail; providers reject them. */
const RESERVED_DOMAINS = ["example.com", "example.net", "example.org"];
const RESERVED_TLDS = [".example", ".test", ".invalid", ".localhost"];

export function isDeliverableAddress(address) {
  const value = String(address ?? "").trim().toLowerCase();
  const at = value.lastIndexOf("@");
  const domain = at === -1 ? "" : value.slice(at + 1).replace(/>$/, "").replace(/\.$/, "");
  if (!domain) {
    return false;
  }
  return (
    !RESERVED_DOMAINS.some((reserved) => domain === reserved || domain.endsWith(`.${reserved}`)) &&
    !RESERVED_TLDS.some((tld) => domain.endsWith(tld) || domain === tld.slice(1))
  );
}

function deliverableOnly(list) {
  const entries = Array.isArray(list) ? list : list ? [list] : [];
  return entries.filter(isDeliverableAddress);
}

/**
 * Sends one notification (Resend first, SMTP fallback) and records the outcome
 * in the NotificationLog. Recipients on reserved test domains are dropped;
 * with no deliverable To address nothing is sent and the outcome is `skipped`.
 * Resolves `{ status, provider, ... }`; rethrows when no provider succeeded.
 */
export async function sendNotification(options) {
  const { metadata = {} } = options;
  const to = deliverableOnly(options.to);
  // CC/BCC are never promoted: their wording addresses the primary recipient.
  const cc = to.length ? deliverableOnly(options.cc) : [];
  const bcc = to.length ? deliverableOnly(options.bcc) : [];
  try {
    const result = await deliver({ ...options, to, cc, bcc });
    const status = result.skipped ? "skipped" : "sent";
    await recordDelivery({ metadata, to, cc, bcc, status, provider: result.provider });
    return { ...result, status, error: null };
  } catch (error) {
    await recordDelivery({ metadata, to, cc, bcc, status: "failed", error });
    throw error;
  }
}

async function deliver({
  to,
  cc,
  bcc,
  subject,
  html,
  text,
  from = EMAIL_FROM,
  metadata = {},
}) {
  if (to.length === 0) {
    console.info("[Notification] Skipped: no deliverable recipient.", {
      action: metadata?.action,
    });
    return { provider: null, messageId: null, response: null, skipped: true };
  }

  const payload = {
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject,
    html,
    text,
    from,
    metadata,
  };

  if (EMAIL_DRY_RUN) {
    console.log("[Notification] DRY RUN enabled. Payload:", payload);
    return { provider: "dry-run", messageId: null, response: null };
  }

  if (!hasResendConfig() && !hasSmtpConfig()) {
    console.warn("[Notification] Skipped sending email: no provider configured.");
    return { provider: null, messageId: null, response: null, skipped: true };
  }

  let resendResult = null;
  let resendFailed = false;
  const failures = [];

  // Try Resend first
  try {
    if (hasResendConfig()) {
      resendResult = await sendViaResend(payload);
      
      // If Resend succeeded but we have multiple recipients, also send via SMTP
      // to ensure all recipients (including non-verified emails) get the email
      if (resendResult?.shouldFallbackToSmtp && hasSmtpConfig()) {
        console.log("[Notification] Resend succeeded but multiple recipients detected. Also sending via SMTP to ensure all recipients receive email.");
        // Continue to SMTP fallback below
      } else {
        console.log("[Notification] Sent via Resend", {
          to,
          cc: payload.cc,
          bcc: payload.bcc,
          subject,
          metadata,
          messageId: resendResult?.messageId,
        });
        return resendResult;
      }
    }
  } catch (error) {
    resendFailed = true;
    failures.push(error.message);
    // Check if it's a testing mode restriction (403) or other error
    if (error?.status === 403 || error?.responseText?.includes("testing emails")) {
      console.log("[Notification] Resend testing mode restriction detected. Falling back to SMTP for all recipients.", {
        to,
        cc: payload.cc,
        bcc: payload.bcc,
        error: error.message,
      });
    } else {
      console.error("[Notification] Resend failed", {
        to,
        cc: payload.cc,
        bcc: payload.bcc,
        subject,
        metadata,
        error: error.message,
      });
    }
  }

  // Fall back to SMTP (either Resend failed, or we have multiple recipients)
  try {
    if (hasSmtpConfig()) {
      const result = await sendViaSmtp(payload);
      console.log("[Notification] Sent via SMTP", {
        to,
        cc: payload.cc,
        bcc: payload.bcc,
        subject,
        metadata,
        messageId: result.messageId,
        fallbackReason: resendFailed ? "Resend failed" : "Multiple recipients",
      });
      return result;
    }
  } catch (error) {
    failures.push(error.message);
    console.error("[Notification] SMTP failed", {
      to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject,
      metadata,
      error: error.message,
    });
  }

  // If we got here and Resend succeeded but SMTP failed, return Resend result
  if (resendResult && !resendFailed) {
    console.warn("[Notification] Resend succeeded but SMTP fallback failed. Some recipients may not have received email.");
    return resendResult;
  }

  throw new Error(`No available email provider succeeded: ${failures.join("; ")}`);
}

export function buildNotificationTemplate({
  title,
  intro,
  sections = [],
  footer,
}) {
  const sectionRows = sections
    .map(
      (section) => `
        <tr>
          <td style="padding:0 32px 18px 32px;">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#818cf8;">
              ${section.label}
            </p>
            <div style="background-color:#1f2937;border-radius:14px;padding:14px 18px;border:1px solid rgba(148,163,184,0.25);">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#e2e8f0;">
                ${section.content}
              </p>
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#0f172a;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#0f172a;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background-color:#111827;border-radius:18px;border:1px solid rgba(255,255,255,0.08);font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#e2e8f0;">
              <tr>
                <td style="padding:28px 32px 12px 32px;">
                  <p style="margin:0;font-size:12px;letter-spacing:0.35em;text-transform:uppercase;color:rgba(148,163,184,0.75);">
                    Employee Management
                  </p>
                  <h1 style="margin:10px 0 14px;font-size:24px;font-weight:600;color:#f8fafc;">
                    ${title}
                  </h1>
                  <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:rgba(226,232,240,0.85);">
                    ${intro}
                  </p>
                </td>
              </tr>
              ${sectionRows}
              <tr>
                <td style="padding:0 32px 28px;border-top:1px solid rgba(148,163,184,0.25);">
                  <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:rgba(148,163,184,0.75);">
                    ${
                      footer ??
                      "You received this update because you're listed as a stakeholder for this initiative."
                    }
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

