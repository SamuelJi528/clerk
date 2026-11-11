import test from "node:test";
import assert from "node:assert/strict";
import {
  actionSchema,
  needsConfirmation,
  planSchema,
  requestSchema,
  validatePlan,
} from "../shared/contracts.js";
const workspace = { tasks: [{ id: "task-1" }], notes: [{ id: "note-1" }] };
const plan = (actions) => ({ message: "I'll take care of this.", actions });

test("accepts a mixed task, note, weather, export plan", () => {
  const result = validatePlan(
    plan([
      {
        type: "create_task",
        title: "Finish project",
        dueDate: "2026-11-11",
        priority: "high",
      },
      { type: "create_note", title: "Ideas", content: "Show real actions." },
      { type: "get_weather", city: "Los Angeles", units: "fahrenheit" },
      { type: "export_file", scope: "workspace", format: "json" },
    ]),
    workspace,
  );
  assert.equal(result.actions.length, 4);
});
test("rejects arbitrary commands, extra fields, and unapproved network actions", () => {
  for (const action of [
    { type: "run_shell", command: "rm -rf /" },
    { type: "create_task", title: "Task", command: "sh" },
    { type: "fetch_url", url: "http://localhost" },
  ])
    assert.equal(actionSchema.safeParse(action).success, false);
});
test("rejects hallucinated IDs and modifying a deleted item", () => {
  assert.throws(() =>
    validatePlan(plan([{ type: "delete_note", id: "made-up-id" }]), workspace),
  );
  assert.throws(() =>
    validatePlan(
      plan([
        { type: "delete_task", id: "task-1" },
        { type: "update_task", id: "task-1", status: "done" },
      ]),
      workspace,
    ),
  );
});
test("requires a changed field for updates", () =>
  assert.throws(() =>
    validatePlan(plan([{ type: "update_note", id: "note-1" }]), workspace),
  ));
test("rejects impossible dates, empty titles, traversal filenames, and oversized plans", () => {
  assert.equal(
    actionSchema.safeParse({
      type: "create_task",
      title: "Task",
      dueDate: "2026-02-30",
    }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({ type: "create_task", title: "   " }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({
      type: "export_file",
      scope: "tasks",
      format: "csv",
      filename: "../../secrets",
    }).success,
    false,
  );
  assert.equal(
    planSchema.safeParse(
      plan(
        Array.from({ length: 13 }, () => ({
          type: "create_task",
          title: "Task",
        })),
      ),
    ).success,
    false,
  );
});
test("all deletions and note replacements require confirmation", () => {
  for (const type of ["delete_task", "delete_note", "update_note"])
    assert.equal(needsConfirmation({ type }), true);
  assert.equal(needsConfirmation({ type: "create_task" }), false);
});
test("validates the client context and limits user requests", () => {
  assert.equal(
    requestSchema.safeParse({
      message: "x".repeat(3001),
      context: {
        tasks: [],
        notes: [],
        today: "2026-11-10",
        timezone: "America/Los_Angeles",
      },
    }).success,
    false,
  );
});
