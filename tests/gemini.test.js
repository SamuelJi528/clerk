import test from "node:test";
import assert from "node:assert/strict";
import { generatePlan } from "../server/gemini.js";
const input = {
  message: "Add a task",
  context: {
    tasks: [],
    notes: [],
    today: "2026-11-10",
    timezone: "America/Los_Angeles",
  },
};
const success = () =>
  Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [
            {
              text: JSON.stringify({
                message: "I'll add a task.",
                actions: [{ type: "create_task", title: "Review slides" }],
              }),
            },
          ],
        },
      },
    ],
  });
const options = { apiKey: "test-only-key", wait: async () => {} };

test("requests structured JSON and keeps the API key in a server header", async () => {
  let body;
  const { plan } = await generatePlan(input, {
    ...options,
    fetchFn: async (url, request) => {
      assert.equal(url.includes("test-only-key"), false);
      assert.equal(request.headers["x-goog-api-key"], "test-only-key");
      body = JSON.parse(request.body);
      return success();
    },
  });
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.ok(body.generationConfig.responseJsonSchema.properties.actions);
  assert.equal(plan.actions[0].title, "Review slides");
});
test("omits array bounds that make Gemini's action schema too complex", async () => {
  let schema;
  await generatePlan(input, {
    ...options,
    fetchFn: async (url, request) => {
      schema = JSON.parse(request.body).generationConfig.responseJsonSchema;
      return success();
    },
  });
  assert.equal(schema.properties.actions.maxItems, undefined);
});

test("retries a transient rate limit once with backoff", async () => {
  let calls = 0;
  const delays = [];
  await generatePlan(input, {
    ...options,
    wait: async (ms) => delays.push(ms),
    fetchFn: async () =>
      ++calls === 1
        ? new Response("", { status: 429, headers: { "Retry-After": "2" } })
        : success(),
  });
  assert.equal(calls, 2);
  assert.deepEqual(delays, [2000]);
});
test("respects longer Retry-After values without premature retry", async () => {
  let calls = 0;
  await assert.rejects(
    generatePlan(input, {
      ...options,
      fetchFn: async () => {
        calls++;
        return new Response("", {
          status: 429,
          headers: { "Retry-After": "30" },
        });
      },
    }),
    (error) => error.status === 429 && error.retryAfter === 30,
  );
  assert.equal(calls, 1);
});
test("retries network failures and returns a useful error", async () => {
  let calls = 0;
  await assert.rejects(
    generatePlan(input, {
      ...options,
      fetchFn: async () => {
        calls++;
        throw new TypeError("Network");
      },
    }),
    (error) => error.status === 504,
  );
  assert.equal(calls, 2);
});
test("rejects malformed, truncated, and unsafe model outputs", async () => {
  for (const data of [
    {
      candidates: [
        { finishReason: "STOP", content: { parts: [{ text: "not json" }] } },
      ],
    },
    {
      candidates: [
        { finishReason: "MAX_TOKENS", content: { parts: [{ text: "{}" }] } },
      ],
    },
    {
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              {
                text: JSON.stringify({
                  message: "Execute",
                  actions: [{ type: "shell", command: "rm -rf /" }],
                }),
              },
            ],
          },
        },
      ],
    },
  ])
    await assert.rejects(
      generatePlan(input, {
        ...options,
        fetchFn: async () => Response.json(data),
      }),
      (error) => error.status === 502,
    );
});
test("missing key and unavailable model have actionable errors", async () => {
  await assert.rejects(
    generatePlan(input, { apiKey: "" }),
    (error) => error.status === 503,
  );
  await assert.rejects(
    generatePlan(input, {
      ...options,
      fetchFn: async () => new Response("", { status: 404 }),
    }),
    /GEMINI_MODEL/,
  );
});
