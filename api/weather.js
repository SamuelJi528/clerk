import { z } from "zod";
import { getWeather } from "../server/weather.js";
import { AppError } from "../server/gemini.js";
import {
  json,
  requireMethod,
  requireSameOrigin,
  sendError,
} from "../server/http.js";
const schema = z
  .object({
    city: z.string().trim().min(2).max(120),
    units: z.enum(["fahrenheit", "celsius"]).optional(),
  })
  .strict();
export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  try {
    requireSameOrigin(req);
    const input = schema.safeParse(req.body);
    if (!input.success)
      throw new AppError("Enter a city name to check the weather.", 400);
    return json(res, 200, await getWeather(input.data.city, input.data.units));
  } catch (error) {
    if (["TimeoutError", "TypeError"].includes(error.name))
      return sendError(
        res,
        new AppError(
          "Could not reach the weather service. Please try again.",
          502,
        ),
      );
    return sendError(res, error);
  }
}
