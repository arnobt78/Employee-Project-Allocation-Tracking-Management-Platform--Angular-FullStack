import assert from "node:assert/strict";
import { after, afterEach, before, describe, mock, test } from "node:test";
import { sessionCookie, startApiServer } from "./support/api-server.mjs";
import { createFakeDb, importApi, installFakeDb } from "./support/fake-db.mjs";

const db = createFakeDb();
installFakeDb(db);

process.env.CMS_SPACE_ID = "space1";
process.env.CMS_DELIVERY_TOKEN = "delivery-token";
const repository = await importApi("employee-management/repository.mjs");

const realFetch = globalThis.fetch;
let contentfulCalls = [];

/** Answers Contentful requests with `status`/`body`; local API calls still hit the test server. */
function stubContentful(status, body) {
  contentfulCalls = [];
  globalThis.fetch = mock.fn(async (input, init) => {
    const url = String(input);
    if (!url.includes("contentful.com")) {
      return realFetch(input, init);
    }
    contentfulCalls.push(url);
    return new Response(JSON.stringify(body), { status });
  });
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("fetchContentfulBrief", () => {
  test("maps a Contentful 404 to a client 404 without the upstream body", async () => {
    stubContentful(404, { sys: { id: "NotFound" }, requestId: "secret-request-id" });
    await assert.rejects(repository.fetchContentfulBrief({ entryId: "missing" }), (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.expose, true);
      assert.equal(error.message, "Contentful entry not found.");
      return true;
    });
  });

  test("maps a rejected query to a client 400", async () => {
    stubContentful(400, { sys: { id: "InvalidQuery" } });
    await assert.rejects(repository.fetchContentfulBrief({ contentType: "nope" }), (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.expose, true);
      return true;
    });
  });

  test("keeps upstream outages internal", async () => {
    stubContentful(503, { message: "upstream down" });
    await assert.rejects(repository.fetchContentfulBrief({ entryId: "abc" }), (error) => {
      assert.equal(error.expose, undefined);
      return true;
    });
  });

  test("returns 404 when a content type query has no entries", async () => {
    stubContentful(200, { items: [] });
    await assert.rejects(repository.fetchContentfulBrief({ contentType: "brief" }), (error) => {
      assert.equal(error.status, 404);
      return true;
    });
  });

  test("encodes the entry id into a single path segment", async () => {
    stubContentful(404, {});
    await assert.rejects(repository.fetchContentfulBrief({ entryId: "a/../b?x=1" }));
    const url = new URL(contentfulCalls[0]);
    assert.equal(url.pathname, "/spaces/space1/environments/master/entries/a%2F..%2Fb%3Fx%3D1");
  });
});

describe("GetContentfulBrief HTTP", () => {
  let api;
  let cookie;

  before(async () => {
    api = await startApiServer();
    await db.seedUser({ username: "contentful-admin", password: "pw" });
    const login = await api.call("Login", {
      method: "POST",
      body: { username: "contentful-admin", password: "pw" },
    });
    assert.equal(login.status, 200);
    cookie = sessionCookie(login);
  });

  after(() => api.close());

  test("returns 400 without an identifier", async () => {
    const response = await api.call("GetContentfulBrief", { cookie });
    assert.equal(response.status, 400);
  });

  test("returns 404 with a safe message when the entry does not exist", async () => {
    stubContentful(404, { sys: { id: "NotFound" }, requestId: "secret-request-id" });
    const response = await api.call("GetContentfulBrief?entryId=missing", { cookie });
    assert.equal(response.status, 404);
    const text = await response.text();
    assert.match(text, /Contentful entry not found\./);
    assert.doesNotMatch(text, /secret-request-id|space1/);
  });

  test("returns 400 when Contentful rejects the query", async () => {
    stubContentful(422, { sys: { id: "InvalidQuery" } });
    const response = await api.call("GetContentfulBrief?contentType=nope", { cookie });
    assert.equal(response.status, 400);
  });

  test("returns 502 with a generic message when Contentful is down", async () => {
    stubContentful(503, { message: "upstream down", requestId: "secret-request-id" });
    const response = await api.call("GetContentfulBrief?entryId=abc", { cookie });
    assert.equal(response.status, 502);
    const json = await response.json();
    assert.equal(json.message, "Contentful is unavailable right now. Try again later.");
    assert.doesNotMatch(JSON.stringify(json), /secret-request-id|upstream down/);
  });
});
