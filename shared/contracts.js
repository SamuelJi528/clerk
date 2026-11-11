// The same allowlist validates Gemini's plan on the server and in the browser.
import { z } from "zod";

const title = z.string().trim().min(1).max(160);
const id = z.string().min(1).max(80);
const date = z
  .string()
  .refine(
    (value) =>
      value === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value),
    "Use a real date in YYYY-MM-DD format.",
  );
const priority = z.enum(["low", "medium", "high"]);
const status = z.enum(["open", "done"]);
const taskFields = {
  title,
  description: z.string().max(2000),
  priority,
  dueDate: date,
  status,
};

export const actionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("create_task"),
      title,
      description: taskFields.description.optional(),
      priority: priority.optional(),
      dueDate: date.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("update_task"),
      id,
      title: title.optional(),
      description: taskFields.description.optional(),
      priority: priority.optional(),
      dueDate: date.optional(),
      status: status.optional(),
    })
    .strict(),
  z.object({ type: z.literal("delete_task"), id }).strict(),
  z
    .object({
      type: z.literal("create_note"),
      title,
      content: z.string().min(1).max(8000),
    })
    .strict(),
  z
    .object({
      type: z.literal("update_note"),
      id,
      title: title.optional(),
      content: z.string().min(1).max(8000).optional(),
    })
    .strict(),
  z.object({ type: z.literal("delete_note"), id }).strict(),
  z
    .object({
      type: z.literal("search_workspace"),
      query: z.string().trim().min(1).max(200),
    })
    .strict(),
  z
    .object({
      type: z.literal("get_weather"),
      city: z.string().trim().min(2).max(120),
      units: z.enum(["fahrenheit", "celsius"]).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("export_file"),
      scope: z.enum(["tasks", "notes", "workspace", "activity"]),
      format: z.enum(["markdown", "csv", "json"]),
      filename: z
        .string()
        .regex(/^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,79}$/)
        .optional(),
    })
    .strict(),
]);

export const planSchema = z
  .object({
    message: z.string().trim().min(1).max(1600),
    actions: z.array(actionSchema).max(12),
  })
  .strict();

export const taskSchema = z
  .object({
    id,
    ...taskFields,
    createdAt: z.string().max(40),
    updatedAt: z.string().max(40),
  })
  .strict();
export const noteSchema = z
  .object({
    id,
    title,
    content: z.string().max(8000),
    createdAt: z.string().max(40),
    updatedAt: z.string().max(40),
  })
  .strict();
export const requestSchema = z
  .object({
    message: z.string().trim().min(1).max(3000),
    context: z
      .object({
        tasks: z.array(taskSchema).max(100),
        notes: z.array(noteSchema).max(40),
        today: date.refine((value) => value !== ""),
        timezone: z.string().max(80),
      })
      .strict(),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            text: z.string().max(4000),
          })
          .strict(),
      )
      .max(8)
      .optional(),
  })
  .strict();

export function validatePlan(input, workspace) {
  const plan = planSchema.parse(input);
  // Simulate IDs in order: a plan cannot modify an item after deleting it.
  const taskIds = new Set(workspace.tasks.map((item) => item.id));
  const noteIds = new Set(workspace.notes.map((item) => item.id));
  for (const action of plan.actions) {
    const ids = action.type.endsWith("_task") ? taskIds : noteIds;
    if (
      action.type.startsWith("update_") ||
      action.type.startsWith("delete_")
    ) {
      if (!ids.has(action.id))
        throw new Error(
          "An action refers to an item that no longer exists. Please try again.",
        );
      if (action.type.startsWith("delete_")) ids.delete(action.id);
    }
    if (action.type.startsWith("update_") && Object.keys(action).length === 2) {
      throw new Error("An update must include at least one changed field.");
    }
  }
  return plan;
}

export const needsConfirmation = (action) =>
  ["delete_task", "delete_note", "update_note"].includes(action.type);

export function describeAction(action, workspace = { tasks: [], notes: [] }) {
  const item = [...workspace.tasks, ...workspace.notes].find(
    (item) => item.id === action.id,
  );
  const label = item?.title || action.title || "item";
  const labels = {
    create_task: `Add task: ${action.title}`,
    update_task: `Update task: ${label}`,
    delete_task: `Delete task: ${label}`,
    create_note: `Save note: ${action.title}`,
    update_note: `Replace note: ${label}`,
    delete_note: `Delete note: ${label}`,
    search_workspace: `Search for “${action.query}”`,
    get_weather: `Check weather in ${action.city}`,
    export_file: `Export ${action.scope} as ${action.format?.toUpperCase()}`,
  };
  return labels[action.type];
}

// Gemini supports a subset of JSON Schema. Runtime validation remains stricter.
// Array bounds multiply the action union's grammar size; enforce them locally.
function googleSchema(value) {
  if (Array.isArray(value)) return value.map(googleSchema);
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (
        ["$schema", "minLength", "maxLength", "pattern", "default", "maxItems"].includes(
          key,
        )
      )
        continue;
      if (key === "const") result.enum = [child];
      else result[key] = googleSchema(child);
    }
    return result;
  }
  return value;
}
export const planJsonSchema = googleSchema(z.toJSONSchema(planSchema));
