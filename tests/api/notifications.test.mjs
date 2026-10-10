import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { createFakeDb, importApi, installFakeDb } from "./support/fake-db.mjs";

const db = createFakeDb();
installFakeDb(db);
mock.module("nodemailer", {
  exports: {
    default: {
      createTransport() {
        throw new Error("nodemailer must not be used in tests");
      },
    },
  },
});

process.env.RESEND_TOKEN = "test-token";
const withResend = await importApi("employee-management/notifications.mjs");
delete process.env.RESEND_TOKEN;
const withoutProvider = await importApi("employee-management/notifications.mjs?no-provider");

const REAL = "person@company.io";
const realFetch = globalThis.fetch;
let fetchMock;

function stubResend(status = 200) {
  fetchMock = mock.fn(async () =>
    status === 200
      ? new Response(JSON.stringify({ id: "msg_1" }), { status })
      : new Response(JSON.stringify({ message: `Invalid \`to\` field: ${REAL}` }), { status })
  );
  globalThis.fetch = fetchMock;
}

const sentBody = (call = 0) => JSON.parse(fetchMock.mock.calls[call].arguments[1].body);
const deliveries = () => [...db.tables.notificationLog.values()];
const notify = (sender, recipients) =>
  sender.sendNotification({
    subject: "Hello",
    text: "Body",
    metadata: { action: "test_event", employeeId: 1001 },
    ...recipients,
  });

describe("isDeliverableAddress", () => {
  test("rejects reserved test domains and malformed addresses", () => {
    for (const address of [
      "a@example.com",
      "a@EXAMPLE.ORG",
      "a@mail.example.net",
      "a@acme.test",
      "a@host.invalid",
      "a@foo.localhost",
      "a@corp.example",
      "Name <a@example.com>",
      "a@example.com.",
      "no-at-sign",
      "",
      null,
    ]) {
      assert.equal(withResend.isDeliverableAddress(address), false, String(address));
    }
  });

  test("accepts real domains, including look-alikes", () => {
    for (const address of [
      REAL,
      `Person <${REAL}>`,
      "a@gmail.com",
      "a@myexample.com",
      "a@example.co",
      "a@testing.io",
    ]) {
      assert.equal(withResend.isDeliverableAddress(address), true, address);
    }
  });
});

describe("sendNotification", () => {
  beforeEach(() => db.reset());
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("only test-domain recipients: no provider call, logged as skipped", async () => {
    stubResend();
    const result = await notify(withResend, {
      to: ["a@example.com"],
      cc: ["b@acme.test"],
    });
    assert.equal(result.status, "skipped");
    assert.equal(fetchMock.mock.callCount(), 0);
    const [entry] = deliveries();
    assert.equal(entry.status, "skipped");
    assert.equal(entry.recipientCount, 0);
  });

  test("mixed recipients: sends only to real addresses", async () => {
    stubResend();
    const result = await notify(withResend, {
      to: [REAL, "a@example.com"],
      cc: ["b@example.org"],
      bcc: [],
    });
    assert.equal(result.status, "sent");
    assert.equal(fetchMock.mock.callCount(), 1);
    const body = sentBody();
    assert.deepEqual(body.to, [REAL]);
    assert.equal(body.cc, undefined);
    assert.equal(body.bcc, undefined);
    const [entry] = deliveries();
    assert.equal(entry.status, "sent");
    assert.equal(entry.recipientCount, 1);
  });

  test("when every To recipient is a test address, nothing is sent even with a real CC or BCC", async () => {
    stubResend();
    const result = await notify(withResend, { to: ["a@example.com"], cc: [REAL], bcc: [REAL] });
    assert.equal(result.status, "skipped");
    assert.equal(fetchMock.mock.callCount(), 0);
    const [entry] = deliveries();
    assert.equal(entry.status, "skipped");
    assert.equal(entry.recipientCount, 0);
  });

  test("a single string recipient is filtered the same way", async () => {
    stubResend();
    assert.equal((await notify(withResend, { to: "a@example.com" })).status, "skipped");
    assert.equal((await notify(withResend, { to: REAL })).status, "sent");
    assert.deepEqual(sentBody().to, [REAL]);
  });

  test("a provider rejection is recorded as failed with the address redacted", async () => {
    stubResend(422);
    await assert.rejects(notify(withResend, { to: [REAL] }), /No available email provider/);
    const [entry] = deliveries();
    assert.equal(entry.status, "failed");
    assert.match(entry.error, /422.*\[redacted\]/);
    assert.doesNotMatch(entry.error, /company\.io/);
  });

  test("no provider configured: skipped without any network call", async () => {
    stubResend();
    const result = await notify(withoutProvider, { to: [REAL] });
    assert.equal(result.status, "skipped");
    assert.equal(fetchMock.mock.callCount(), 0);
    assert.equal(deliveries()[0].status, "skipped");
  });
});
