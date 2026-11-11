// Tiny local API server + Vite. Production uses the identical api/* handlers.
import http from "node:http";
import { existsSync } from "node:fs";
import { createServer } from "vite";
import agent from "../api/agent.js";
import weather from "../api/weather.js";
import status from "../api/status.js";
if (existsSync(".env")) process.loadEnvFile(".env");
const vite = await createServer({ server: { middlewareMode: true } });
const routes = {
  "/api/agent": agent,
  "/api/weather": weather,
  "/api/status": status,
};
const server = http.createServer(async (req, res) => {
  const route = routes[new URL(req.url, "http://localhost").pathname];
  if (!route) return vite.middlewares(req, res);
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (value) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(value));
  };
  try {
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      if (text.length > 450000) {
        res.status(413).json({ error: "Request too large." });
        return;
      }
    }
    req.body = text ? JSON.parse(text) : undefined;
    await route(req, res);
  } catch {
    res.status(400).json({ error: "Invalid request." });
  }
});
server.listen(Number(process.env.PORT) || 3000, "127.0.0.1", () =>
  console.log("Clerk is running at http://localhost:3000"),
);
