import { planJsonSchema, validatePlan } from "../shared/contracts.js";
import { SYSTEM_PROMPT } from "./prompt.js";

export class AppError extends Error {
  constructor(message, status = 500, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generatePlan(input, options = {}) {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const model =
    options.model ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
  const fetchFn = options.fetchFn ?? fetch;
  const wait = options.wait ?? sleep;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new AppError(
      "Add GEMINI_API_KEY in your environment settings, then redeploy. Your tasks and notes still work without it.",
      503,
    );
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(model))
    throw new AppError(
      "GEMINI_MODEL must be a model ID, such as gemini-3.5-flash-lite.",
      503,
    );
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: JSON.stringify({
              request: input.message,
              workspace_context: input.context,
              previous_conversation_and_actual_results: input.history ?? [],
            }),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseJsonSchema: planJsonSchema,
    },
  };
  // A single retry with backoff keeps the total below the Vercel timeout.
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(22000),
        },
      );
    } catch (error) {
      if (attempt === 0) {
        await wait(1000);
        continue;
      }
      throw new AppError(
        error.name === "TimeoutError"
          ? "Gemini took too long. Please try a shorter request."
          : "Could not reach Gemini. Please try again.",
        504,
      );
    }
    if ([429, 500, 502, 503, 504].includes(response.status) && attempt === 0) {
      const retry = Number(response.headers.get("retry-after"));
      // Do not retry earlier than Google's requested delay.
      if (Number.isFinite(retry) && retry > 4)
        throw new AppError(
          "Gemini is busy or your quota is exhausted. Try again after the wait shown below.",
          429,
          Math.ceil(retry),
        );
      await wait(Number.isFinite(retry) && retry > 0 ? retry * 1000 : 1200);
      continue;
    }
    if (!response.ok) {
      if ([400, 401, 403].includes(response.status))
        throw new AppError(
          "Gemini rejected the request. Check your API key, model access, billing, and API restrictions in Google AI Studio.",
          502,
        );
      if (response.status === 404)
        throw new AppError(
          `The model ${model} is unavailable. Set GEMINI_MODEL to a model enabled for your Google AI Studio account, then redeploy.`,
          502,
        );
      if (response.status === 429)
        throw new AppError(
          "Gemini rate limit reached. Wait a minute, or check your Google AI Studio quota.",
          429,
          60,
        );
      throw new AppError(
        "Gemini is temporarily unavailable. Please try again shortly.",
        502,
      );
    }
    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate || candidate.finishReason !== "STOP")
      throw new AppError(
        "Gemini could not finish a valid plan. Try a shorter, more specific request.",
        502,
      );
    const text = candidate.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("");
    try {
      return { plan: validatePlan(JSON.parse(text), input.context), model };
    } catch {
      throw new AppError(
        "Gemini returned an invalid or outdated action plan. Nothing was executed. Please try again.",
        502,
      );
    }
  }
}
