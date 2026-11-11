import { json, requireMethod } from "../server/http.js";
export default function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  const key = process.env.GEMINI_API_KEY;
  return json(res, 200, {
    configured: Boolean(key && key !== "your_gemini_api_key_here"),
  });
}
