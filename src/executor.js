import {
  actionSchema,
  describeAction,
  needsConfirmation,
} from "../shared/contracts.js";
import { changeWorkspace, logEvent, readWorkspace } from "./database.js";
import { buildExport } from "./export.js";

export async function executeAction(
  rawAction,
  { confirmed = false, expectedRevision } = {},
) {
  const action = actionSchema.parse(rawAction);
  if (needsConfirmation(action) && !confirmed)
    throw new Error("This action needs your confirmation.");
  let workspace = await readWorkspace();
  if (expectedRevision !== undefined && workspace.revision !== expectedRevision)
    throw new Error("Your workspace changed. Please send the request again.");
  const summary = describeAction(action, workspace);
  await logEvent({ type: action.type, status: "started", summary, action });
  try {
    let result;
    if (
      [
        "create_task",
        "create_note",
        "update_task",
        "update_note",
        "delete_task",
        "delete_note",
      ].includes(action.type)
    ) {
      workspace = await changeWorkspace(
        (state) => {
          const collection = action.type.endsWith("_task") ? "tasks" : "notes";
          const now = new Date().toISOString();
          const { type, id, ...fields } = action;
          if (type.startsWith("create_")) {
            const defaults =
              collection === "tasks"
                ? {
                    description: "",
                    priority: "medium",
                    dueDate: "",
                    status: "open",
                  }
                : {};
            state[collection].unshift({
              id: crypto.randomUUID(),
              ...defaults,
              ...fields,
              createdAt: now,
              updatedAt: now,
            });
          } else {
            const index = state[collection].findIndex((item) => item.id === id);
            if (index < 0)
              throw new Error(
                "That item no longer exists. Please send a new request.",
              );
            if (type.startsWith("delete_")) state[collection].splice(index, 1);
            else
              state[collection][index] = {
                ...state[collection][index],
                ...fields,
                updatedAt: now,
              };
          }
        },
        { expectedRevision },
      );
      result = {
        kind: "text",
        text: summary
          .replace(/^Add task:/, "Added task:")
          .replace(/^Save note:/, "Saved note:")
          .replace(/^Update task:/, "Updated task:")
          .replace(/^Replace note:/, "Updated note:")
          .replace(/^Delete/, "Deleted"),
      };
    } else if (action.type === "get_weather") {
      const response = await fetch("/api/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: action.city, units: action.units }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not check the weather.");
      result = { kind: "weather", data };
    } else if (action.type === "search_workspace") {
      const query = action.query.toLocaleLowerCase();
      const items = [
        ...workspace.tasks.map((item) => ({ ...item, kind: "task" })),
        ...workspace.notes.map((item) => ({ ...item, kind: "note" })),
      ].filter((item) =>
        `${item.title}\n${item.description ?? item.content ?? ""}`
          .toLocaleLowerCase()
          .includes(query),
      );
      result = {
        kind: "search",
        items,
        text: `Found ${items.length} ${items.length === 1 ? "match" : "matches"} for “${action.query}”.`,
      };
    } else if (action.type === "export_file") {
      result = {
        kind: "file",
        file: buildExport(workspace, action),
        text: "Your file is ready. Use the download button to save it.",
      };
    }
    await logEvent({
      type: action.type,
      status: "success",
      summary,
      action,
      detail:
        result.kind === "weather"
          ? `Retrieved live forecast for ${result.data.location}.`
          : result.text,
    });
    return { result, revision: workspace.revision };
  } catch (error) {
    await logEvent({
      type: action.type,
      status: "error",
      summary,
      action,
      detail: error.message,
    });
    throw error;
  }
}
