import { useState } from "react";
import { Monitor, RefreshCw, Square } from "lucide-react";
import { useCapture } from "../hooks/useCapture";
import type { WindowInfo } from "../types";

export function WindowPicker() {
  const {
    windows,
    loading,
    error,
    selectedWindow,
    isCapturing,
    captureFrameCount,
    refreshWindows,
    handleSelectWindow,
    handleStopCapture,
  } = useCapture();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const onSelect = async (window: WindowInfo) => {
    setDropdownOpen(false);
    await handleSelectWindow(window);
  };

  if (isCapturing && selectedWindow) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-success)] transition-colors">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--gc-surface-hover)] text-[var(--gc-success)]">
          <Monitor className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--gc-text)] truncate">
            {selectedWindow.title}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--gc-text-muted)]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--gc-success)] animate-pulse" />
            Capturing &middot; {captureFrameCount} frames
          </div>
        </div>
        <button
          title="Stop capturing this window"
          onClick={handleStopCapture}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--gc-error)]/10 text-[var(--gc-error)] hover:bg-[var(--gc-error)]/20 transition-colors"
        >
          <Square className="w-3 h-3" />
          Stop
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-border)] hover:border-[var(--gc-primary)] transition-colors">
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--gc-surface-hover)] text-[var(--gc-primary)]">
        <Monitor className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 relative">
        <button
          aria-label="Select game window"
          onClick={() => {
            if (!dropdownOpen) refreshWindows();
            setDropdownOpen(!dropdownOpen);
          }}
          className="w-full text-left"
        >
          <div className="text-sm font-medium text-[var(--gc-text)]">
            Game Window
          </div>
          <div className="text-xs text-[var(--gc-text-muted)]">
            {loading ? "Loading..." : "Click to select a window"}
          </div>
          {error && (
            <div className="text-xs text-[var(--gc-error)] mt-0.5">{error}</div>
          )}
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 top-full mt-2 w-72 max-h-60 overflow-y-auto rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-border)] shadow-lg z-50">
            {windows.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--gc-text-muted)]">
                {loading ? "Scanning..." : "No windows found"}
              </div>
            ) : (
              windows.map((w) => (
                <button
                  key={w.hwnd}
                  onClick={() => onSelect(w)}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--gc-surface-hover)] transition-colors border-b border-[var(--gc-border)] last:border-b-0"
                >
                  <div className="text-xs font-medium text-[var(--gc-text)] truncate">
                    {w.title}
                  </div>
                  <div className="text-[10px] text-[var(--gc-text-muted)]">
                    {w.processName}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          refreshWindows();
        }}
        disabled={loading}
        className="p-1.5 rounded text-[var(--gc-text-muted)] hover:bg-[var(--gc-surface-hover)] transition-colors disabled:opacity-50"
        title="Refresh window list"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
      </button>

      <span className="text-xs text-[var(--gc-text-muted)] whitespace-nowrap">
        Not selected
      </span>
    </div>
  );
}
