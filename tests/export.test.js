import test from "node:test";
import assert from "node:assert/strict";
import { buildExport } from "../src/export.js";
const state = {
  tasks: [
    {
      id: "1",
      title: '=HYPERLINK("evil")',
      description: 'A comma, and a "quote"',
      priority: "high",
      dueDate: "",
      status: "done",
    },
  ],
  notes: [{ id: "2", title: "Idea", content: "Line 1\nLine 2" }],
  logs: [{ time: "2026-11-10", status: "success", summary: "Saved note" }],
};
test("exports round-trip JSON and completed Markdown checkboxes", () => {
  const file = buildExport(state, { scope: "workspace", format: "json" });
  assert.deepEqual(JSON.parse(file.text), {
    tasks: state.tasks,
    notes: state.notes,
  });
  assert.match(
    buildExport(state, { scope: "tasks", format: "markdown" }).text,
    /- \[x\]/,
  );
});
test("CSV escapes quotes, newlines, and spreadsheet formulas", () => {
  const file = buildExport(state, { scope: "tasks", format: "csv" });
  assert.ok(file.text.includes("' =") === false);
  assert.ok(file.text.includes("'=HYPERLINK"));
  assert.ok(file.text.includes('""quote""'));
});
test("filenames are local names and receive the correct extension", () => {
  const file = buildExport(state, {
    scope: "notes",
    format: "markdown",
    filename: "../../notes.json",
  });
  assert.equal(file.filename.includes("/"), false);
  assert.ok(file.filename.endsWith(".md"));
});
test("handles empty workspaces and activity exports", () => {
  assert.match(
    buildExport(
      { tasks: [], notes: [], logs: [] },
      { scope: "tasks", format: "csv" },
    ).text,
    /No records/,
  );
  assert.match(
    buildExport(state, { scope: "activity", format: "markdown" }).text,
    /Saved note/,
  );
});
