import test from "node:test";
import assert from "node:assert/strict";
import { indexedDB } from "fake-indexeddb";
globalThis.indexedDB = indexedDB;
globalThis.window = new EventTarget();
const { executeAction } = await import("../src/executor.js");
const { readWorkspace, changeWorkspace } = await import("../src/database.js");

test("executor: real database writes, required confirmation, stale plans, searches, and exports", async () => {
  const created = await executeAction(
    { type: "create_task", title: "Prepare demo", priority: "high" },
    { expectedRevision: 0 },
  );
  assert.equal(created.revision, 1);
  await executeAction(
    {
      type: "create_note",
      title: "Demo ideas",
      content: "Explain structured action plans.",
    },
    { expectedRevision: 1 },
  );
  let state = await readWorkspace();
  const taskId = state.tasks[0].id;
  const noteId = state.notes[0].id;
  await executeAction(
    { type: "update_task", id: taskId, status: "done" },
    { expectedRevision: 2 },
  );
  await assert.rejects(
    executeAction({ type: "delete_note", id: noteId }),
    /confirmation/,
  );
  assert.equal((await readWorkspace()).notes.length, 1);
  await assert.rejects(
    executeAction({ type: "update_note", id: noteId, content: "Overwritten" }),
    /confirmation/,
  );
  assert.equal(
    (await readWorkspace()).notes[0].content,
    "Explain structured action plans.",
  );
  await assert.rejects(
    executeAction(
      { type: "create_task", title: "Stale action" },
      { expectedRevision: 0 },
    ),
    /workspace changed/,
  );
  assert.equal((await readWorkspace()).tasks.length, 1);
  const search = await executeAction({
    type: "search_workspace",
    query: "structured",
  });
  assert.equal(search.result.items.length, 1);
  const file = await executeAction({
    type: "export_file",
    scope: "tasks",
    format: "markdown",
  });
  assert.match(file.result.file.text, /- \[x\] Prepare demo/);
  await executeAction({ type: "delete_note", id: noteId }, { confirmed: true });
  state = await readWorkspace();
  assert.equal(state.notes.length, 0);
  assert.ok(
    state.logs.some(
      (item) => item.type === "delete_note" && item.status === "success",
    ),
  );
  await assert.rejects(
    changeWorkspace((workspace) => {
      workspace.tasks.push(
        ...Array.from({ length: 100 }, () => ({ id: "extra" })),
      );
    }),
    /100 tasks/,
  );
  assert.equal(
    (await readWorkspace()).tasks.length,
    1,
    "The failed transaction must not change saved data.",
  );
});
