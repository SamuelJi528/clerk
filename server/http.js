import { AppError } from "./gemini.js";

export function json(res, status, data) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(data);
}
export function requireMethod(req, res, method) {
  if (req.method === method) return true;
  res.setHeader("Allow", method);
  json(res, 405, { error: "Method not allowed." });
  return false;
}
export function requireSameOrigin(req) {
  // Blocks requests from another site's browser. This is not authentication.
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (origin && new URL(origin).host !== host)
    throw new AppError(
      "This request must come from the Clerk application.",
      403,
    );
}
export function sendError(res, error) {
  if (error.retryAfter) res.setHeader("Retry-After", String(error.retryAfter));
  return json(res, error.status || 500, {
    error: error.status
      ? error.message
      : "Something went wrong. Please try again.",
    ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
  });
}
