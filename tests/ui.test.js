// DOM-level workflows exercise the real React UI and real IndexedDB adapter.
// Network responses are controlled; this is not a live Gemini or visual test.
import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, unlink } from "node:fs/promises";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import React from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://clerk.test",
});
for (const name of [
  "window",
  "document",
  "HTMLElement",
  "HTMLDialogElement",
  "Node",
  "MutationObserver",
  "Event",
  "getComputedStyle",
])
  globalThis[name] =
    name === "getComputedStyle"
      ? dom.window[name].bind(dom.window)
      : dom.window[name];
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
dom.window.HTMLElement.prototype.scrollIntoView = function () {};
const { render, screen, fireEvent, waitFor, cleanup, within } =
  await import("@testing-library/react");
const compiled = await build({
  entryPoints: ["src/App.jsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  write: false,
});
const modulePath = new URL("../.ui-test-app.mjs", import.meta.url);
await writeFile(modulePath, compiled.outputFiles[0].text);
const { default: App } = await import(modulePath.href);
await unlink(modulePath);
let responder;
globalThis.fetch = async (url, request) => {
  if (url === "/api/status") return Response.json({ configured: true });
  if (url === "/api/agent") return responder(JSON.parse(request.body));
  throw new Error(`Unexpected endpoint ${url}`);
};
const send = async (text) => {
  fireEvent.change(
    screen.getByRole("textbox", { name: "What would you like Clerk to do?" }),
    { target: { value: text } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Send request to Clerk" }),
  );
};

test("UI: multi-action execution, cancellation, confirmation, exports, persistence, and provider errors", async (t) => {
  t.after(() => {
    cleanup();
    dom.window.close();
  });
  render(React.createElement(App));
  await screen.findByRole("heading", { name: /Your day/ });
  responder = () =>
    Response.json({
      plan: {
        message: "I'll create a task and a note.",
        actions: [
          {
            type: "create_task",
            title: "UI workflow task",
            priority: "high",
            dueDate: "2026-11-11",
          },
          {
            type: "create_note",
            title: "UI workflow note",
            content: "A saved test idea.",
          },
        ],
      },
    });
  await send("Create a task and a note");
  await screen.findByText("All taken care of");
  assert.ok(
    screen.getByRole("button", { name: /UI workflow task.*high priority/ }),
  );
  assert.ok(
    screen.getByRole("button", { name: /UI workflow note.*A saved test idea/ }),
  );

  // The submitted context contains the real IDs, and a delete must wait.
  responder = (body) =>
    Response.json({
      plan: {
        message: "I'll ask for confirmation.",
        actions: [{ type: "delete_note", id: body.context.notes[0].id }],
      },
    });
  await send("Delete my note");
  let dialog = await screen.findByRole("dialog");
  assert.match(dialog.textContent, /UI workflow note/);
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Cancel", exact: true }),
  );
  await screen.findByText("Plan cancelled");
  assert.ok(
    screen.getByRole("button", { name: /UI workflow note.*A saved test idea/ }),
  );

  await send("Delete my note");
  dialog = await screen.findByRole("dialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: /Confirm & continue/ }),
  );
  await waitFor(() =>
    assert.equal(
      Boolean(
        screen.queryByRole("button", {
          name: /UI workflow note.*A saved test idea/,
        }),
      ),
      false,
    ),
  );
  await screen.findByText("All taken care of");

  responder = () =>
    Response.json({
      plan: {
        message: "I'll prepare a file.",
        actions: [{ type: "export_file", scope: "tasks", format: "csv" }],
      },
    });
  await send("Export my tasks");
  await screen.findByText("clerk-tasks.csv");
  assert.equal(
    screen.getByRole("button", { name: "Download", exact: true }).disabled,
    false,
  );

  responder = () =>
    Response.json(
      { error: "Gemini rate limit reached.", retryAfter: 2 },
      { status: 429 },
    );
  await send("Add another task");
  await screen.findByText("Gemini rate limit reached.");
  assert.ok(
    screen
      .getByRole("textbox", { name: "What would you like Clerk to do?" })
      .value.includes("Add another task"),
  );

  cleanup();
  render(React.createElement(App));
  await screen.findByRole("button", {
    name: /UI workflow task.*high priority/,
  });
  assert.equal(
    screen.queryByRole("button", {
      name: /UI workflow note.*A saved test idea/,
    }),
    null,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Activity", exact: true }),
  );
  await screen.findByRole("heading", { name: "Activity log" });
  assert.ok(
    screen.getAllByRole("button", { name: /delete note.*cancelled/i }).length >
      0,
  );
  cleanup();
});
