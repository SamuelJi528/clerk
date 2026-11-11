import React, { useState } from "react";
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CloudSun,
  LoaderCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { describeAction } from "../../shared/contracts.js";
import { downloadFile } from "../export.js";

export function weatherLabel(code) {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}
function Weather({ data }) {
  const unit = data.units === "celsius" ? "°C" : "°F";
  const current = data.current;
  return (
    <div className="weather-result">
      <div className="weather-top">
        <div>
          <div className="eyebrow">CURRENT WEATHER</div>
          <strong>{data.location}</strong>
          <span>
            {weatherLabel(current.weather_code)} · Feels like{" "}
            {Math.round(current.apparent_temperature)}
            {unit}
          </span>
        </div>
        <div className="weather-temp">
          <CloudSun size={29} strokeWidth={1.2} />
          {Math.round(current.temperature_2m)}
          <small>{unit}</small>
        </div>
      </div>
      <div className="weather-days">
        {data.daily.time.map((date, i) => (
          <div key={date}>
            <span>
              {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
              })}
            </span>
            <strong>
              {Math.round(data.daily.temperature_2m_max[i])}°{" "}
              <em>{Math.round(data.daily.temperature_2m_min[i])}°</em>
            </strong>
            <span>
              {data.daily.precipitation_probability_max[i] ?? "—"}% rain
            </span>
          </div>
        ))}
      </div>
      <a
        className="attribution"
        href="https://open-meteo.com/"
        target="_blank"
        rel="noreferrer"
      >
        Weather data by Open-Meteo
      </a>
    </div>
  );
}
function Result({ result }) {
  if (!result) return null;
  if (result.kind === "weather") return <Weather data={result.data} />;
  if (result.kind === "file")
    return (
      <div className="file-result">
        <div>
          <strong>{result.file.filename}</strong>
          <span>
            {(new Blob([result.file.text]).size / 1024).toFixed(1)} KB · Ready
            to download
          </span>
        </div>
        <button
          className="button button-small"
          onClick={() => downloadFile(result.file)}
        >
          <ArrowDownToLine size={15} />
          Download
        </button>
      </div>
    );
  if (result.kind === "search")
    return (
      <div className="search-result">
        <p>{result.text}</p>
        {result.items.slice(0, 10).map((item) => (
          <div key={item.id}>
            <span className="eyebrow">{item.kind}</span>
            <strong>{item.title}</strong>
            <p>
              {(item.description || item.content || "No description.").slice(
                0,
                240,
              )}
            </p>
          </div>
        ))}
      </div>
    );
  return null;
}
const statusIcons = {
  success: CheckCircle2,
  error: XCircle,
  running: LoaderCircle,
  pending: Circle,
  cancelled: XCircle,
  skipped: Circle,
};
export default function RunCard({ run, workspace }) {
  const [showDetails, setShowDetails] = useState(false);
  const label =
    run.status === "complete" && !run.steps?.length
      ? "Clerk replied"
      : {
          planning: "Understanding your request",
          running: "Taking care of it",
          waiting: "Your confirmation is needed",
          complete: "All taken care of",
          error: "This request needs attention",
          cancelled: "Plan cancelled",
        }[run.status];
  return (
    <section
      className="run-card"
      aria-live="polite"
      aria-label="Agent execution results"
    >
      <div className="run-header">
        <div className="agent-mark">
          <Check size={15} />
        </div>
        <strong>Clerk</strong>
        <span className={`run-status ${run.status}`}>
          {run.status === "planning" || run.status === "running" ? (
            <LoaderCircle size={13} className="spin" />
          ) : run.status === "waiting" ? (
            <ShieldCheck size={14} />
          ) : null}
          {label}
        </span>
      </div>
      <div className="request-quote">{run.request}</div>
      {run.message && <p className="run-message">{run.message}</p>}
      {run.error && <p className="inline-error">{run.error}</p>}
      {run.steps?.length > 0 && (
        <div className="run-steps">
          {run.steps.map((step, i) => {
            const Icon = statusIcons[step.status] || Circle;
            return (
              <div className={`run-step ${step.status}`} key={i}>
                <div className="step-line">
                  <Icon
                    size={16}
                    className={step.status === "running" ? "spin" : ""}
                  />
                  <span>
                    {step.label || describeAction(step.action, workspace)}
                  </span>
                  <small>
                    {step.status === "skipped"
                      ? "Skipped"
                      : step.status === "cancelled"
                        ? "Cancelled"
                        : step.status === "pending"
                          ? "Queued"
                          : ""}
                  </small>
                </div>
                {step.error && <p className="inline-error">{step.error}</p>}
                <Result result={step.result} />
              </div>
            );
          })}
        </div>
      )}
      {run.steps?.length > 0 && (
        <>
          <button
            className="text-button details-toggle"
            onClick={() => setShowDetails(!showDetails)}
            aria-expanded={showDetails}
          >
            Action details
            <ChevronDown size={14} className={showDetails ? "flipped" : ""} />
          </button>
          {showDetails && (
            <pre className="code-block">
              {JSON.stringify(
                run.steps.map((step) => ({
                  action: step.action,
                  status: step.status,
                  error: step.error,
                })),
                null,
                2,
              )}
            </pre>
          )}
        </>
      )}
    </section>
  );
}
