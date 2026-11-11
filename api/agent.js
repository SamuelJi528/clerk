import { requestSchema } from "../shared/contracts.js";
import { AppError, generatePlan } from "../server/gemini.js";
import {
  json,
  requireMethod,
  requireSameOrigin,
  sendError,
} from "../server/http.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  try {
    requireSameOrigin(req);
    if (!req.headers["content-type"]?.includes("application/json"))
      throw new AppError("Use an application/json request.", 415);
    if (JSON.stringify(req.body ?? {}).length > 450000)
      throw new AppError(
        "Your workspace is too large for one request. Export or shorten some notes first.",
        413,
      );
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success)
      throw new AppError(
        "Please enter a request of up to 3,000 characters and use a valid workspace.",
        400,
      );
    const result = await generatePlan(parsed.data);
    return json(res, 200, result);
  } catch (error) {
    return sendError(res, error);
  }
}
