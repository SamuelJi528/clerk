import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CloudSun,
  FileText,
  Home,
  Info,
  ListChecks,
  LoaderCircle,
  Menu,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  describeAction,
  needsConfirmation,
  validatePlan,
} from "../shared/contracts.js";
import {
  addSampleWorkspace,
  localDate,
  logEvent,
  readWorkspace,
} from "./database.js";
import { executeAction } from "./executor.js";
import { buildExport, downloadFile } from "./export.js";
import Modal from "./components/Modal.jsx";
import RunCard from "./components/RunCard.jsx";
import {
  Activity,
  Editor,
  NoteList,
  TaskList,
} from "./components/Workspace.jsx";

const nav = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "activity", label: "Activity", icon: ClipboardList },
];
const suggestions = [
  {
    label: "Make a plan",
    icon: ListChecks,
    text: "Create three tasks for my agent project: finish testing tomorrow (high priority), record the demo in two days, and submit the project in three days.",
  },
  {
    label: "Capture an idea",
    icon: FileText,
    text: "Save a note titled Project demo ideas with a short checklist for showing an AI agent that manages tasks, exports files, and checks the weather.",
  },
  {
    label: "Check the weather",
    icon: CloudSun,
    text: "Check the current weather and five-day forecast for Los Angeles in Fahrenheit.",
  },
];

export default function App() {
  const [workspace, setWorkspace] = useState(null);
  const [storageError, setStorageError] = useState("");
  const [page, setPage] = useState("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [configured, setConfigured] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState(null);
  const [history, setHistory] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const [editor, setEditor] = useState(null);
  const [about, setAbout] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("open");
  const [query, setQuery] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const lock = useRef(false);
  const composer = useRef(null);
  const runRef = useRef(null);
  const toastTimer = useRef(null);
  const cooldown = Math.max(0, Math.ceil((retryAt - now) / 1000));

  function notify(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }
  async function refresh() {
    try {
      setWorkspace(await readWorkspace());
      setStorageError("");
    } catch (error) {
      setStorageError(error.message);
    }
  }
  useEffect(() => {
    refresh();
    window.addEventListener("clerk:changed", refresh);
    window.addEventListener("focus", refresh);
    fetch("/api/status")
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => setConfigured(data.configured))
      .catch(() => setConnectionError(true));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.removeEventListener("clerk:changed", refresh);
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    if (run)
      runRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "nearest",
      });
  }, [run?.status]);

  function navigate(id) {
    setPage(id);
    setMobileNav(false);
    setQuery("");
  }
  function focusComposer(text = "") {
    setPage("overview");
    if (text) setInput(text);
    setTimeout(() => composer.current?.focus(), 50);
  }
  function remember(request, steps, message) {
    const results = steps.map((step) => ({
      action: step.action,
      status: step.status,
      error: step.error,
      result:
        step.result?.kind === "file"
          ? { filename: step.result.file.filename }
          : step.result,
    }));
    setHistory((previous) =>
      [
        ...previous,
        { role: "user", text: request },
        {
          role: "assistant",
          text: JSON.stringify({
            message,
            actual_execution_results: results,
          }).slice(0, 4000),
        },
      ].slice(-8),
    );
  }
  async function runPlan(plan, snapshot, request) {
    const steps = plan.actions.map((action) => ({
      action,
      label: describeAction(action, snapshot),
      status: "pending",
    }));
    setRun({
      request,
      message: plan.message,
      status: steps.length ? "running" : "complete",
      steps: [...steps],
    });
    let revision = snapshot.revision;
    let failure = "";
    for (let i = 0; i < steps.length; i++) {
      steps[i] = { ...steps[i], status: "running" };
      setRun((previous) => ({ ...previous, steps: [...steps] }));
      try {
        const result = await executeAction(steps[i].action, {
          confirmed: true,
          expectedRevision: revision,
        });
        revision = result.revision;
        steps[i] = { ...steps[i], status: "success", result: result.result };
      } catch (error) {
        failure = error.message;
        steps[i] = { ...steps[i], status: "error", error: error.message };
        for (let j = i + 1; j < steps.length; j++) {
          steps[j] = { ...steps[j], status: "skipped" };
          await logEvent({
            type: steps[j].action.type,
            status: "skipped",
            summary: describeAction(steps[j].action, snapshot),
            detail: "Stopped after a previous action failed.",
            action: steps[j].action,
          });
        }
        break;
      }
      setRun((previous) => ({ ...previous, steps: [...steps] }));
    }
    setRun({
      request,
      message: plan.message,
      status: failure ? "error" : "complete",
      steps: [...steps],
      ...(failure
        ? {
            error:
              "Execution stopped. Earlier successful actions were saved; later actions were skipped.",
          }
        : {}),
    });
    remember(request, steps, plan.message);
    await refresh();
  }
  async function submit(event) {
    event?.preventDefault();
    if (!input.trim() || lock.current || cooldown || !workspace) return;
    lock.current = true;
    setBusy(true);
    const request = input.trim();
    setInput("");
    setPage("overview");
    setRun({ request, status: "planning", steps: [] });
    try {
      const snapshot = await readWorkspace();
      await logEvent({ type: "request", status: "started", summary: request });
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(55000),
        body: JSON.stringify({
          message: request,
          context: {
            tasks: snapshot.tasks,
            notes: snapshot.notes,
            today: localDate(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          },
          history,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.retryAfter)
          setRetryAt(Date.now() + Math.min(data.retryAfter, 3600) * 1000);
        throw new Error(
          data.error || "The agent could not process your request.",
        );
      }
      const plan = validatePlan(data.plan, snapshot);
      await logEvent({
        type: "plan",
        status: "success",
        summary: `Prepared ${plan.actions.length} ${plan.actions.length === 1 ? "action" : "actions"}.`,
        detail: plan.message,
      });
      if (plan.actions.some(needsConfirmation)) {
        setRun({
          request,
          status: "waiting",
          message: plan.message,
          steps: plan.actions.map((action) => ({
            action,
            label: describeAction(action, snapshot),
            status: "pending",
          })),
        });
        setConfirmation({ kind: "plan", plan, snapshot, request });
        return;
      }
      await runPlan(plan, snapshot, request);
    } catch (error) {
      const message =
        error.name === "TimeoutError"
          ? "This request timed out. Please try a shorter request."
          : error.message;
      setRun({ request, status: "error", steps: [], error: message });
      setInput(request);
      await logEvent({
        type: "request",
        status: "error",
        summary: request,
        detail: message,
      }).catch(() => {});
    }
    lock.current = false;
    setBusy(false);
  }
  async function approveConfirmation() {
    const pending = confirmation;
    setConfirmation(null);
    if (pending.kind === "plan") {
      try {
        await runPlan(pending.plan, pending.snapshot, pending.request);
      } catch (error) {
        notify(error.message);
        setRun((previous) => ({
          ...previous,
          status: "error",
          error: error.message,
        }));
      } finally {
        lock.current = false;
        setBusy(false);
      }
    } else {
      try {
        await manualAction(pending.action, true);
      } catch (error) {
        notify(error.message);
      }
    }
  }
  async function cancelConfirmation() {
    const pending = confirmation;
    setConfirmation(null);
    const actions =
      pending.kind === "plan" ? pending.plan.actions : [pending.action];
    for (const action of actions)
      await logEvent({
        type: action.type,
        status: "cancelled",
        summary: describeAction(action, workspace),
        action,
      }).catch(() => {});
    if (pending.kind === "plan") {
      setRun((previous) => ({
        ...previous,
        status: "cancelled",
        steps: previous.steps.map((step) => ({ ...step, status: "cancelled" })),
      }));
      remember(
        pending.request,
        actions.map((action) => ({ action, status: "cancelled" })),
        "The user cancelled the plan. No actions were executed.",
      );
      lock.current = false;
      setBusy(false);
    }
  }
  async function manualAction(action, confirmed = false) {
    if (lock.current)
      throw new Error("Please let the current request finish first.");
    if (needsConfirmation(action) && !confirmed) {
      setConfirmation({ kind: "manual", action });
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await executeAction(action, { confirmed });
      await refresh();
      notify("Workspace updated.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function exportWorkspace(scope = "workspace", format = "json") {
    try {
      const latest = await readWorkspace();
      downloadFile(buildExport(latest, { scope, format }));
      await logEvent({
        type: "export_file",
        status: "success",
        summary: `Downloaded ${scope} as ${format.toUpperCase()}.`,
      });
      setExportOpen(false);
      notify("Your download is ready.");
    } catch (error) {
      notify(error.message);
    }
  }

  const tasks = workspace?.tasks ?? [];
  const notes = workspace?.notes ?? [];
  const openTasks = tasks.filter((task) => task.status === "open");
  const doneTasks = tasks.length - openTasks.length;
  const filteredTasks = tasks.filter(
    (task) =>
      (filter === "all" || task.status === filter) &&
      `${task.title} ${task.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const filteredNotes = notes.filter((note) =>
    `${note.title} ${note.content}`.toLowerCase().includes(query.toLowerCase()),
  );
  const taskProps = {
    busy,
    onNew: () => setEditor({ kind: "task" }),
    onEdit: (item) => setEditor({ kind: "task", item }),
    onDelete: (action) =>
      manualAction(action).catch((error) => notify(error.message)),
    onToggle: (item) =>
      manualAction({
        type: "update_task",
        id: item.id,
        status: item.status === "done" ? "open" : "done",
      }).catch((error) => notify(error.message)),
    onViewAll: () => {
      setFilter("all");
      navigate("tasks");
    },
  };
  const noteProps = {
    busy,
    onNew: () => setEditor({ kind: "note" }),
    onEdit: (item) => setEditor({ kind: "note", item }),
    onDelete: (action) =>
      manualAction(action).catch((error) => notify(error.message)),
    onViewAll: () => navigate("notes"),
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobileNav && (
        <button
          className="nav-backdrop"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("overview")}
          aria-label="Clerk home"
        >
          <span className="brand-mark">
            c<span />
          </span>
          <span>
            clerk<span className="brand-period">.</span>
          </span>
        </button>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={17} strokeWidth={1.6} />
              <span>{item.label}</span>
              {item.id === "tasks" && openTasks.length > 0 && (
                <small>{openTasks.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="sidebar-scribble">
            A lighter day
            <br />
            starts here.
          </span>
          <span className="scribble-line" />
        </div>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => setExportOpen(true)}
            disabled={!workspace}
          >
            <ArrowDownToLine size={17} strokeWidth={1.6} />
            <span>Export workspace</span>
          </button>
          <button className="nav-item" onClick={() => setAbout(true)}>
            <CircleHelp size={17} strokeWidth={1.6} />
            <span>A quick introduction</span>
          </button>
          <div className="local-status">
            <i />
            Saved in this browser
            <ShieldCheck size={13} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-root">Workspace</span>
            <ChevronRight size={13} />
            <strong>{nav.find((item) => item.id === page)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className={`connection ${configured ? "ready" : ""}`}>
              <i />
              {connectionError
                ? "Connection unavailable"
                : configured === null
                  ? "Checking connection"
                  : configured
                    ? "Gemini configured"
                    : "Gemini setup needed"}
            </span>
            <button
              className="avatar"
              onClick={() => setAbout(true)}
              aria-label="About your workspace"
            >
              You
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {storageError && (
            <div className="error-banner" role="alert">
              <Info size={18} />
              <span>{storageError}</span>
              <button className="text-button" onClick={refresh}>
                Retry
              </button>
            </div>
          )}
          {!workspace && !storageError ? (
            <div className="loading-state">
              <LoaderCircle className="spin" size={24} />
              <p>Opening your workspace…</p>
            </div>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {page === "overview"
                      ? new Date(now)
                          .toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })
                          .toUpperCase()
                      : "YOUR WORKSPACE"}
                  </p>
                  <h1>
                    {page === "overview" ? (
                      <>
                        Your day, a little lighter<span>.</span>
                      </>
                    ) : page === "tasks" ? (
                      <>
                        One thing at a time<span>.</span>
                      </>
                    ) : page === "notes" ? (
                      <>
                        Good ideas live here<span>.</span>
                      </>
                    ) : (
                      <>
                        A record of the little things<span>.</span>
                      </>
                    )}
                  </h1>
                  <p className="page-description">
                    {page === "overview"
                      ? "A place for your tasks, your thoughts, and a helping hand."
                      : page === "tasks"
                        ? "A clear view of what’s next. Ask Clerk to handle the details."
                        : page === "notes"
                          ? "Capture a thought. Keep a checklist. Pick it up later."
                          : "See what happened, what changed, and what needs another look."}
                  </p>
                </div>
                {page === "overview" ? (
                  <div className="heading-note">
                    <span>Less busywork.</span>
                    <span>More breathing room.</span>
                    <ArrowDownToLine size={20} strokeWidth={1} />
                  </div>
                ) : (
                  page !== "activity" && (
                    <button
                      className="button"
                      disabled={busy || !workspace}
                      onClick={() =>
                        setEditor({ kind: page === "tasks" ? "task" : "note" })
                      }
                    >
                      <Plus size={16} />
                      New {page === "tasks" ? "task" : "note"}
                    </button>
                  )
                )}
              </div>
              {page === "overview" && (
                <>
                  <section className="composer-card" aria-label="Ask Clerk">
                    <div className="composer-heading">
                      <span className="eyebrow">
                        <span className="little-star">✳</span>A SMALL ASK GOES A
                        LONG WAY
                      </span>
                      <span className="agent-label">
                        YOUR WORKSPACE ASSISTANT
                      </span>
                    </div>
                    <form onSubmit={submit}>
                      <label className="sr-only" htmlFor="request">
                        What would you like Clerk to do?
                      </label>
                      <textarea
                        id="request"
                        ref={composer}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        maxLength={3000}
                        placeholder="What can I take off your plate?"
                        disabled={busy || !workspace}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            !event.shiftKey &&
                            !event.nativeEvent.isComposing
                          ) {
                            event.preventDefault();
                            submit();
                          }
                        }}
                      />
                      <div className="composer-bottom">
                        <span>
                          {busy ? (
                            <>
                              <LoaderCircle size={13} className="spin" />
                              {confirmation
                                ? "Waiting for your confirmation"
                                : "Working on your request…"}
                            </>
                          ) : cooldown ? (
                            `Try again in ${cooldown}s`
                          ) : (
                            "Tasks, notes, files, and a little more."
                          )}
                        </span>
                        <button
                          className="ask-button"
                          type="submit"
                          disabled={
                            !input.trim() || busy || !workspace || cooldown > 0
                          }
                          aria-label="Send request to Clerk"
                        >
                          {busy ? (
                            <LoaderCircle size={17} className="spin" />
                          ) : (
                            <ArrowRight size={19} />
                          )}
                          <span>Ask Clerk</span>
                        </button>
                      </div>
                    </form>
                  </section>
                  <div className="suggestions">
                    <span>A good place to start</span>
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.label}
                        onClick={() => focusComposer(suggestion.text)}
                        disabled={busy}
                      >
                        <suggestion.icon size={14} strokeWidth={1.5} />
                        {suggestion.label}
                        <ArrowUpRight size={13} />
                      </button>
                    ))}
                  </div>
                  {(configured === false || connectionError) && (
                    <div className="setup-notice">
                      <Info size={15} />
                      <span>
                        {connectionError
                          ? "The API is unreachable. Start the app with npm run dev or check your deployment."
                          : "Add your Gemini API key to enable the assistant. Your workspace already works."}
                      </span>
                      <button
                        className="text-button"
                        onClick={() => setAbout(true)}
                      >
                        Setup
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  )}
                  {run && (
                    <div ref={runRef}>
                      <RunCard
                        run={run}
                        workspace={workspace || { tasks: [], notes: [] }}
                      />
                    </div>
                  )}
                  <div className="workspace-summary">
                    <span>ON YOUR DESK</span>
                    <div>
                      <strong>{openTasks.length}</strong> open{" "}
                      {openTasks.length === 1 ? "task" : "tasks"}
                      <i />
                      <strong>{doneTasks}</strong> completed
                      <i />
                      <strong>{notes.length}</strong>{" "}
                      {notes.length === 1 ? "note" : "notes"}
                    </div>
                  </div>
                  <div className="workspace-columns">
                    <TaskList tasks={tasks} compact {...taskProps} />
                    <NoteList notes={notes} compact {...noteProps} />
                  </div>
                  {workspace && !tasks.length && !notes.length && (
                    <div className="sample-offer">
                      <span>Just looking around?</span>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          addSampleWorkspace().catch((error) =>
                            notify(error.message),
                          )
                        }
                      >
                        Add a few sample items
                        <ArrowRight size={14} />
                      </button>
                      <span className="sample-hint">
                        You can delete them anytime.
                      </span>
                    </div>
                  )}
                  <div className="desk-footer">
                    <span>
                      <ShieldCheck size={14} />
                      You’re in charge. Clerk asks before deleting or replacing
                      notes.
                    </span>
                    <span>Made for the everyday.</span>
                  </div>
                </>
              )}
              {(page === "tasks" || page === "notes") && (
                <>
                  <div className="list-toolbar">
                    {page === "tasks" ? (
                      <div className="tabs">
                        {["open", "done", "all"].map((value) => (
                          <button
                            className={filter === value ? "selected" : ""}
                            onClick={() => setFilter(value)}
                            key={value}
                          >
                            {value === "done"
                              ? "Completed"
                              : value.charAt(0).toUpperCase() + value.slice(1)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="list-count">
                        {notes.length} {notes.length === 1 ? "note" : "notes"}
                      </span>
                    )}
                    <input
                      className="search-input"
                      aria-label={`Search ${page}`}
                      placeholder={`Search ${page}…`}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                  {page === "tasks" ? (
                    <TaskList tasks={filteredTasks} {...taskProps} />
                  ) : (
                    <NoteList notes={filteredNotes} {...noteProps} />
                  )}
                  <button
                    className="assistant-nudge"
                    onClick={() => focusComposer()}
                  >
                    Want a hand with this? Ask Clerk
                    <ArrowUpRight size={15} />
                  </button>
                </>
              )}
              {page === "activity" && (
                <Activity
                  logs={workspace?.logs ?? []}
                  onExport={() => exportWorkspace("activity", "json")}
                />
              )}
            </>
          )}
        </main>
      </div>
      {editor && (
        <Editor
          {...editor}
          onSave={(action) => manualAction(action, true)}
          onClose={() => setEditor(null)}
        />
      )}
      {confirmation && (
        <Modal
          title="A quick check before we continue."
          onClose={cancelConfirmation}
        >
          <div className="confirmation-icon">
            <ShieldCheck size={26} strokeWidth={1.4} />
          </div>
          <p className="confirmation-copy">
            This{" "}
            {confirmation.kind === "plan"
              ? "plan includes changes"
              : "action makes a change"}{" "}
            that can’t be undone. Review{" "}
            {confirmation.kind === "plan" ? "the full plan" : "the item"} before
            continuing.
          </p>
          <div className="confirmation-actions">
            {(confirmation.kind === "plan"
              ? confirmation.plan.actions
              : [confirmation.action]
            ).map((action, i) => (
              <div key={i}>
                <span
                  className={
                    needsConfirmation(action)
                      ? "destructive-marker"
                      : "normal-marker"
                  }
                >
                  {i + 1}
                </span>
                <span>
                  {describeAction(
                    action,
                    workspace || { tasks: [], notes: [] },
                  )}
                  {action.type === "update_note" && (
                    <small>
                      {action.content
                        ? `New content: ${action.content}`
                        : `New title: ${action.title}`}
                    </small>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="form-hint">
            Cancel keeps your workspace as it is. Clerk will record your
            decision.
          </p>
          <div className="modal-actions">
            <button
              className="button button-quiet"
              onClick={cancelConfirmation}
            >
              Cancel
            </button>
            <button
              className="button button-danger"
              onClick={approveConfirmation}
            >
              Confirm & continue
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {exportOpen && (
        <Modal
          title="Take your workspace with you."
          onClose={() => setExportOpen(false)}
        >
          <p className="form-hint">
            Download a copy of your tasks and notes. Files are created from your
            current saved workspace.
          </p>
          <div className="export-options">
            {[
              {
                format: "json",
                label: "JSON",
                text: "A structured copy of tasks and notes.",
              },
              {
                format: "markdown",
                label: "Markdown",
                text: "A readable document with checklists.",
              },
              {
                format: "csv",
                label: "CSV",
                text: "Rows you can open in a spreadsheet.",
              },
            ].map((option) => (
              <button
                onClick={() => exportWorkspace("workspace", option.format)}
                key={option.format}
              >
                <FileText size={21} strokeWidth={1.3} />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.text}</small>
                </span>
                <ArrowDownToLine size={17} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {about && (
        <Modal
          title="Meet your extra pair of hands."
          onClose={() => setAbout(false)}
          wide
        >
          <div className="about-intro">
            <span className="brand-mark">
              c<span />
            </span>
            <p>
              Clerk turns everyday requests into small, useful actions. Tell it
              what you need, and watch the work happen.
            </p>
          </div>
          <div className="about-grid">
            <div>
              <ListChecks size={20} />
              <strong>Keep things moving</strong>
              <p>
                Create, update, and complete tasks with priorities and
                deadlines.
              </p>
            </div>
            <div>
              <FileText size={20} />
              <strong>Give ideas a home</strong>
              <p>
                Write, find, and edit notes. Export your work as Markdown, CSV,
                or JSON.
              </p>
            </div>
            <div>
              <CloudSun size={20} />
              <strong>Check what’s outside</strong>
              <p>Get current weather and a five-day forecast for any city.</p>
            </div>
            <div>
              <ShieldCheck size={20} />
              <strong>Stay in control</strong>
              <p>
                Review deletions and note replacements before they happen. Every
                action is logged.
              </p>
            </div>
          </div>
          <details className="setup-details" open={configured === false}>
            <summary>
              Connect Gemini & deploy
              <ChevronRight size={15} />
            </summary>
            <ol>
              <li>
                Get a Gemini API key from{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google AI Studio
                </a>
                .
              </li>
              <li>
                Locally: copy <code>.env.example</code> to <code>.env</code>,
                add the key, then run <code>npm install</code> and{" "}
                <code>npm run dev</code>.
              </li>
              <li>
                On Vercel: import the GitHub project, add{" "}
                <code>GEMINI_API_KEY</code> in Environment Variables, and deploy
                with the included settings.
              </li>
              <li>
                If the default model is unavailable to your account, set{" "}
                <code>GEMINI_MODEL</code> to one you have access to and
                redeploy.
              </li>
            </ol>
          </details>
          <div className="privacy-note">
            <Info size={16} />
            <p>
              Tasks, notes, and the last 500 activity entries stay in this
              browser. Requests send workspace content and recent conversation
              to Gemini for planning. The API key stays on the server. Clearing
              site data removes this workspace; export a copy to keep it.
            </p>
          </div>
          <p className="project-credit">
            CS4680 · AI Agent Project<span>Gemini + React + Vercel</span>
          </p>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
