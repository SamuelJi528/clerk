// One small IndexedDB document; no database account or server filesystem needed.
const DB_NAME = "clerk-workspace";
let database;
const empty = () => ({ revision: 0, tasks: [], notes: [], logs: [] });
export async function openDatabase() {
  if (database) return database;
  database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Browser storage is unavailable. Allow site storage, then reload.",
        ),
      );
  });
  return database;
}
export async function readWorkspace() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("workspace")
      .objectStore("workspace")
      .get("current");
    request.onsuccess = () => resolve(request.result ?? empty());
    request.onerror = () =>
      reject(new Error("Could not read your workspace. Please reload."));
  });
}
export async function changeWorkspace(
  change,
  { expectedRevision, recordChange = true } = {},
) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    const store = tx.objectStore("workspace");
    const request = store.get("current");
    let next;
    let failure;
    request.onsuccess = () => {
      try {
        next = request.result ?? empty();
        if (
          expectedRevision !== undefined &&
          next.revision !== expectedRevision
        )
          throw new Error(
            "Your workspace changed while this plan was waiting. Please send the request again.",
          );
        change(next);
        if (next.tasks.length > 100 || next.notes.length > 40)
          throw new Error(
            "This workspace holds up to 100 tasks and 40 notes. Export or remove some items first.",
          );
        if (recordChange) next.revision++;
        store.put(next, "current");
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      window.dispatchEvent(new Event("clerk:changed"));
      resolve(next);
    };
    tx.onabort = tx.onerror = () =>
      reject(
        failure ??
          new Error(
            "Could not save your changes. Your browser storage may be full. Export a backup and try again.",
          ),
      );
  });
}
export function logEvent(event) {
  return changeWorkspace(
    (workspace) => {
      workspace.logs.unshift({
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        ...event,
      });
      workspace.logs = workspace.logs.slice(0, 500);
    },
    { recordChange: false },
  );
}
export function localDate(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}
export async function addSampleWorkspace() {
  const now = new Date().toISOString();
  await changeWorkspace((workspace) => {
    if (workspace.tasks.length || workspace.notes.length)
      throw new Error("Sample items can only be added to an empty workspace.");
    workspace.tasks = [
      {
        id: crypto.randomUUID(),
        title: "Outline the agent project",
        description: "Decide which everyday problem the agent will solve.",
        priority: "high",
        dueDate: localDate(),
        status: "open",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        title: "Record a short walkthrough",
        description:
          "Show a request, real execution, and a safety confirmation.",
        priority: "medium",
        dueDate: "",
        status: "open",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        title: "Choose a project name",
        description: "",
        priority: "low",
        dueDate: "",
        status: "done",
        createdAt: now,
        updatedAt: now,
      },
    ];
    workspace.notes = [
      {
        id: crypto.randomUUID(),
        title: "A few things to remember",
        content:
          "Keep the demo simple.\n\n1. Give Clerk a natural-language request.\n2. Show the task or note it creates.\n3. Export a file.\n4. Demonstrate confirmation before deleting a note.\n\nSmall, useful actions make the clearest story.",
        createdAt: now,
        updatedAt: now,
      },
    ];
  });
  await logEvent({
    type: "workspace",
    status: "success",
    summary: "Added sample tasks and a sample note.",
  });
}
