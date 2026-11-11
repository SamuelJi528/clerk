import React, { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleCheck,
  FileText,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Modal from "./Modal.jsx";
import { localDate } from "../database.js";

export function dueLabel(value) {
  if (!value) return "No date";
  if (value === localDate()) return "Today";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (value === localDate(tomorrow)) return "Tomorrow";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
export function TaskList({
  tasks,
  compact,
  busy,
  onToggle,
  onEdit,
  onDelete,
  onNew,
  onViewAll,
}) {
  const sorted = [...tasks].sort(
    (a, b) =>
      Number(a.status === "done") - Number(b.status === "done") ||
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
  );
  const shown = compact ? sorted.slice(0, 5) : sorted;
  return (
    <section className="workspace-card task-card">
      <div className="card-heading">
        <div>
          <span className="section-number">01</span>
          <h2>Tasks</h2>
          <span className="count">
            {tasks.filter((task) => task.status === "open").length} open
          </span>
        </div>
        <button
          className="icon-button"
          aria-label="Add a task"
          onClick={onNew}
          disabled={busy}
        >
          <Plus size={18} />
        </button>
      </div>
      {!shown.length ? (
        <div className="empty-state">
          <CircleCheck size={31} strokeWidth={1} />
          <h3>A clear slate.</h3>
          <p>
            Add a task yourself, or ask Clerk
            <br />
            to take care of the details.
          </p>
          <button className="text-button" onClick={onNew} disabled={busy}>
            Add your first task
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <div className="task-list">
          {shown.map((task) => (
            <div
              className={`task-row ${task.status === "done" ? "done" : ""}`}
              key={task.id}
            >
              <button
                className="task-check"
                role="checkbox"
                aria-checked={task.status === "done"}
                aria-label={`Mark ${task.title} ${task.status === "done" ? "open" : "done"}`}
                onClick={() => onToggle(task)}
                disabled={busy}
              >
                {task.status === "done" && (
                  <Check size={12} strokeWidth={2.5} />
                )}
              </button>
              <button
                className="task-main"
                onClick={() => onEdit(task)}
                disabled={busy}
              >
                <strong>{task.title}</strong>
                <span>
                  <i className={`priority-dot ${task.priority}`} />
                  {task.priority} priority
                  <span className="meta-separator">·</span>
                  <span
                    className={
                      task.dueDate &&
                      task.dueDate < localDate() &&
                      task.status !== "done"
                        ? "overdue"
                        : ""
                    }
                  >
                    {dueLabel(task.dueDate)}
                  </span>
                </span>
              </button>
              <button
                className="icon-button row-delete"
                aria-label={`Delete task ${task.title}`}
                onClick={() => onDelete({ type: "delete_task", id: task.id })}
                disabled={busy}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {compact && shown.length > 0 && (
        <button className="card-footer" onClick={onViewAll}>
          View all tasks
          <ArrowUpRight size={15} />
        </button>
      )}
    </section>
  );
}
export function NoteList({
  notes,
  compact,
  busy,
  onEdit,
  onDelete,
  onNew,
  onViewAll,
}) {
  const shown = compact ? notes.slice(0, 2) : notes;
  return (
    <section className="workspace-card notes-card">
      <div className="card-heading">
        <div>
          <span className="section-number">02</span>
          <h2>Notes</h2>
          <span className="count">{notes.length} saved</span>
        </div>
        <button
          className="icon-button"
          aria-label="Add a note"
          onClick={onNew}
          disabled={busy}
        >
          <Plus size={18} />
        </button>
      </div>
      {!shown.length ? (
        <div className="empty-state">
          <FileText size={31} strokeWidth={1} />
          <h3>Make room for an idea.</h3>
          <p>
            A thought, a checklist, a rough draft.
            <br />
            Keep it somewhere you can find it.
          </p>
          <button className="text-button" onClick={onNew} disabled={busy}>
            Write your first note
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <div className={compact ? "note-list" : "note-list note-grid"}>
          {shown.map((note) => (
            <div className="note-preview" key={note.id}>
              <button
                className="note-open"
                onClick={() => onEdit(note)}
                disabled={busy}
              >
                <div className="note-meta">
                  <FileText size={13} />
                  <span>
                    {new Date(note.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <ArrowUpRight size={14} />
                </div>
                <h3>{note.title}</h3>
                <p>{note.content}</p>
              </button>
              <button
                className="icon-button note-delete"
                aria-label={`Delete note ${note.title}`}
                onClick={() => onDelete({ type: "delete_note", id: note.id })}
                disabled={busy}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {compact && shown.length > 0 && (
        <button className="card-footer" onClick={onViewAll}>
          View all notes
          <ArrowUpRight size={15} />
        </button>
      )}
    </section>
  );
}
export function Editor({ kind, item, onSave, onClose }) {
  const [title, setTitle] = useState(item?.title || "");
  const [body, setBody] = useState(item?.content || item?.description || "");
  const [priority, setPriority] = useState(item?.priority || "medium");
  const [dueDate, setDueDate] = useState(item?.dueDate || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={`${item ? "Edit" : "New"} ${kind}`}
      onClose={onClose}
      wide={kind === "note"}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving) return;
          setSaving(true);
          setError("");
          try {
            const action = {
              type: `${item ? "update" : "create"}_${kind}`,
              ...(item ? { id: item.id } : {}),
              title: title.trim(),
              ...(kind === "note"
                ? { content: body }
                : { description: body, priority, dueDate }),
            };
            await onSave(action);
            onClose();
          } catch (error) {
            setError(error.message);
            setSaving(false);
          }
        }}
      >
        <label className="field">
          Title
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            placeholder={
              kind === "task" ? "What needs doing?" : "Give this idea a name"
            }
            required
          />
        </label>
        <label className="field">
          {kind === "note" ? "Content" : "Details"}
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={kind === "note" ? 12 : 4}
            maxLength={kind === "note" ? 8000 : 2000}
            placeholder={
              kind === "note"
                ? "Start writing…"
                : "A few helpful details (optional)"
            }
            required={kind === "note"}
          />
        </label>
        {kind === "task" && (
          <div className="form-row">
            <label className="field">
              Priority
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="field">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
          </div>
        )}
        {kind === "note" && item && (
          <p className="form-hint">
            Saving replaces this note’s current title and content.
          </p>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button" disabled={saving || !title.trim()}>
            {saving ? "Saving…" : item ? "Save changes" : `Create ${kind}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Activity({ logs, onExport }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const shown = logs.filter((log) =>
    `${log.summary} ${log.status} ${log.type}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="workspace-card activity-card">
      <div className="card-heading">
        <div>
          <h2>Activity log</h2>
          <span className="count">{logs.length} entries</span>
        </div>
        <button className="button button-small button-quiet" onClick={onExport}>
          <ArrowDownToLine size={14} />
          Export log
        </button>
      </div>
      <div className="activity-search">
        <Search size={16} />
        <input
          aria-label="Search activity"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find an action…"
        />
      </div>
      {!shown.length ? (
        <div className="empty-state">
          <h3>{query ? "No matching actions." : "The story starts here."}</h3>
          <p>
            {query
              ? "Try a different search."
              : "Every request, action, and result is recorded here."}
          </p>
        </div>
      ) : (
        <div className="activity-list">
          {shown.map((log) => (
            <button
              className="activity-row"
              key={log.id}
              onClick={() => setSelected(log)}
            >
              <span className={`activity-dot ${log.status}`} />
              <div>
                <strong>{log.summary}</strong>
                <span>
                  {log.type.replaceAll("_", " ")} · {log.status}
                </span>
              </div>
              <time>
                {new Date(log.time).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      )}
      {selected && (
        <Modal title="Action details" onClose={() => setSelected(null)}>
          <p className="form-hint">{selected.summary}</p>
          <pre className="code-block">{JSON.stringify(selected, null, 2)}</pre>
        </Modal>
      )}
      <p className="activity-footnote">
        The latest 500 entries are kept in this browser. Export the log to keep
        a copy.
      </p>
    </section>
  );
}
