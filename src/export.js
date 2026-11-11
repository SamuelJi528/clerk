// Pure file formatting is separate from the browser download for easy testing.
const escapeCell = (value) => {
  let text = String(value ?? "");
  // Neutralize spreadsheet formulas, including leading whitespace/control chars.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
export function buildExport(workspace, action) {
  const { scope, format } = action;
  const data =
    scope === "workspace"
      ? { tasks: workspace.tasks, notes: workspace.notes }
      : workspace[scope === "activity" ? "logs" : scope];
  let text;
  if (format === "json") text = JSON.stringify(data, null, 2);
  else if (format === "csv") {
    const rows =
      scope === "workspace"
        ? [
            ...workspace.tasks.map((item) => ({ kind: "task", ...item })),
            ...workspace.notes.map((item) => ({ kind: "note", ...item })),
          ]
        : data;
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    text = headers.length
      ? [
          headers.map(escapeCell).join(","),
          ...rows.map((row) =>
            headers
              .map((key) =>
                escapeCell(
                  typeof row[key] === "object"
                    ? JSON.stringify(row[key])
                    : row[key],
                ),
              )
              .join(","),
          ),
        ].join("\r\n")
      : '"No records"\r\n';
  } else {
    const tasks = (items) =>
      items
        .map(
          (item) =>
            `- [${item.status === "done" ? "x" : " "}] ${item.title}\n  Priority: ${item.priority}${item.dueDate ? ` | Due: ${item.dueDate}` : ""}${item.description ? `\n  ${item.description}` : ""}`,
        )
        .join("\n\n");
    const notes = (items) =>
      items
        .map((item) => `## ${item.title}\n\n${item.content}`)
        .join("\n\n---\n\n");
    const body =
      scope === "tasks"
        ? tasks(data)
        : scope === "notes"
          ? notes(data)
          : scope === "activity"
            ? data
                .map(
                  (item) => `- ${item.time} | ${item.status} | ${item.summary}`,
                )
                .join("\n")
            : `## Tasks\n\n${tasks(data.tasks)}\n\n## Notes\n\n${notes(data.notes)}`;
    text = `# Clerk / ${scope.charAt(0).toUpperCase() + scope.slice(1)}\n\n${body || "No records yet."}\n`;
  }
  const extension = { markdown: "md", csv: "csv", json: "json" }[format];
  const base =
    (action.filename || `clerk-${scope}`)
      .replace(/\.(md|csv|json)$/i, "")
      .replace(/[^a-zA-Z0-9 _.-]/g, "-")
      .slice(0, 75)
      .replace(/^[. ]+|[. ]+$/g, "") || "clerk-export";
  return {
    text,
    filename: `${base}.${extension}`,
    mime: {
      markdown: "text/markdown",
      csv: "text/csv",
      json: "application/json",
    }[format],
  };
}
export function downloadFile(file) {
  const url = URL.createObjectURL(
    new Blob([file.text], { type: `${file.mime};charset=utf-8` }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
