import { useRef, useEffect } from "react";
import { useAppStore } from "../stores/appStore";

const LEVEL_COLORS: Record<string, string> = {
  info: "text-[var(--gc-info)]",
  success: "text-[var(--gc-success)]",
  warning: "text-[var(--gc-warning)]",
  error: "text-[var(--gc-error)]",
};

const LEVEL_LABELS: Record<string, string> = {
  info: "INFO",
  success: "OK",
  warning: "WARN",
  error: "ERR",
};

export function StatusLog() {
  const { statusLog, clearLog } = useAppStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [statusLog.length]);

  if (statusLog.length === 0) {
    return (
      <div className="text-xs text-[var(--gc-text-muted)] italic p-3 text-center bg-[var(--gc-surface)] rounded-lg border border-[var(--gc-border)]">
        No activity yet
      </div>
    );
  }

  return (
    <div className="bg-[var(--gc-surface)] rounded-lg border border-[var(--gc-border)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--gc-border)]">
        <span className="text-xs text-[var(--gc-text-muted)]">
          {statusLog.length} entries
        </span>
        <button
          onClick={clearLog}
          className="text-xs text-[var(--gc-text-muted)] hover:text-[var(--gc-text)] transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto" role="log" aria-live="polite">
        {statusLog.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-2 px-3 py-1.5 text-xs border-b border-[var(--gc-border)] last:border-b-0"
          >
            <span className="text-[var(--gc-text-muted)] shrink-0 tabular-nums">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
            <span
              className={`shrink-0 font-mono font-semibold ${LEVEL_COLORS[entry.level]}`}
            >
              {LEVEL_LABELS[entry.level]}
            </span>
            <span className="text-[var(--gc-text)] break-words">
              {entry.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
