import test from "node:test";
import assert from "node:assert/strict";
import { getWeather } from "../server/weather.js";
test("calls the fixed geocoding and weather APIs with requested units", async () => {
  const urls = [];
  const result = await getWeather("Los Angeles", "celsius", async (url) => {
    urls.push(url.toString());
    return urls.length === 1
      ? Response.json({
          results: [
            {
              name: "Los Angeles",
              country: "United States",
              latitude: 34,
              longitude: -118,
            },
          ],
        })
      : Response.json({
          timezone: "America/Los_Angeles",
          current: { temperature_2m: 22 },
          daily: { time: ["2026-11-10"] },
        });
  });
  assert.equal(urls.length, 2);
  assert.ok(urls[0].startsWith("https://geocoding-api.open-meteo.com/"));
  assert.ok(urls[1].includes("temperature_unit=celsius"));
  assert.equal(result.current.temperature_2m, 22);
});
test("reports an unknown city and provider failure", async () => {
  await assert.rejects(
    getWeather("Unknown", "fahrenheit", async () =>
      Response.json({ results: [] }),
    ),
    (error) => error.status === 404,
  );
  await assert.rejects(
    getWeather(
      "Los Angeles",
      "fahrenheit",
      async () => new Response("", { status: 503 }),
    ),
    (error) => error.status === 502,
  );
});
