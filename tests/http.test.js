import test from "node:test";
import assert from "node:assert/strict";
import agent from "../api/agent.js";
import weather from "../api/weather.js";
import status from "../api/status.js";
const makeResponse = () => ({
  headers: {},
  statusCode: 200,
  setHeader(key, value) {
    this.headers[key] = value;
  },
  status(value) {
    this.statusCode = value;
    return this;
  },
  json(value) {
    this.body = value;
    return this;
  },
});
test("agent rejects wrong method, foreign browser origins, invalid requests, and missing key", async () => {
  for (const [request, expected] of [
    [{ method: "GET", headers: {} }, 405],
    [
      {
        method: "POST",
        headers: {
          origin: "https://other.test",
          host: "clerk.test",
          "content-type": "application/json",
        },
      },
      403,
    ],
    [{ method: "POST", headers: { host: "clerk.test" } }, 415],
    [
      {
        method: "POST",
        headers: { host: "clerk.test", "content-type": "application/json" },
        body: {},
      },
      400,
    ],
  ]) {
    const res = makeResponse();
    await agent(request, res);
    assert.equal(res.statusCode, expected);
  }
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "";
  try {
    const res = makeResponse();
    await agent(
      {
        method: "POST",
        headers: { host: "clerk.test", "content-type": "application/json" },
        body: {
          message: "Add a task",
          context: {
            tasks: [],
            notes: [],
            today: "2026-11-10",
            timezone: "UTC",
          },
        },
      },
      res,
    );
    assert.equal(res.statusCode, 503);
    assert.match(res.body.error, /GEMINI_API_KEY/);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
test("status never returns the key and weather validates its input", async () => {
  const res = makeResponse();
  status({ method: "GET" }, res);
  assert.deepEqual(Object.keys(res.body), ["configured"]);
  const bad = makeResponse();
  await weather(
    {
      method: "POST",
      headers: {},
      body: { city: "", url: "https://evil.test" },
    },
    bad,
  );
  assert.equal(bad.statusCode, 400);
});
