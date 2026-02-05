import { useEffect } from "react";
import { Home, Settings, Monitor, Gamepad2, Mic } from "lucide-react";
import { useAppStore } from "./stores/appStore";
import { greet } from "./lib/tauri";
import { StatusLog } from "./components/StatusLog";
import { SettingsPanel } from "./components/SettingsPanel";

const STATUS_COLORS: Record<string, string> = {
  ready: "bg-[var(--gc-success)]",
  listening: "bg-[var(--gc-warning)]",
  processing: "bg-[var(--gc-info)]",
  error: "bg-[var(--gc-error)]",
  initializing: "bg-[var(--gc-text-muted)]",
};

const STATUS_LABELS: Record<string, string> = {
  ready: "Ready",
  listening: "Listening...",
  processing: "Processing...",
  error: "Error",
  initializing: "Starting...",
};

function App() {
  const { activePanel, setActivePanel, status, addLogEntry } = useAppStore();

  useEffect(() => {
    // Test IPC on startup
    greet("Coach")
      .then((msg) => addLogEntry("success", msg))
      .catch((err) => addLogEntry("error", `IPC failed: ${err}`));
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[var(--gc-bg)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--gc-border)] bg-[var(--gc-surface)]">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-[var(--gc-primary)]" />
          <h1 className="text-sm font-bold tracking-wide text-[var(--gc-text)]">
            GamerClone
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]} animate-pulse`}
            />
            <span className="text-xs text-[var(--gc-text-muted)]">
              {STATUS_LABELS[status]}
            </span>
          </div>

          {/* Tab buttons */}
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => setActivePanel("home")}
              className={`p-1.5 rounded transition-colors ${
                activePanel === "home"
                  ? "bg-[var(--gc-primary)] text-white"
                  : "text-[var(--gc-text-muted)] hover:bg-[var(--gc-surface-hover)]"
              }`}
            >
              <Home className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActivePanel("settings")}
              className={`p-1.5 rounded transition-colors ${
                activePanel === "settings"
                  ? "bg-[var(--gc-primary)] text-white"
                  : "text-[var(--gc-text-muted)] hover:bg-[var(--gc-surface-hover)]"
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4">
        {activePanel === "home" ? <HomePanel /> : <SettingsPanel />}
      </main>
    </div>
  );
}

function HomePanel() {
  return (
    <div className="flex flex-col gap-3">
      {/* Placeholder cards */}
      <Card
        icon={<Monitor className="w-4 h-4" />}
        title="Game Window"
        description="Select a game window to capture"
        status="Not selected"
      />
      <Card
        icon={<Gamepad2 className="w-4 h-4" />}
        title="Game Profile"
        description="Choose your game for tailored coaching"
        status="Not selected"
      />
      <Card
        icon={<Mic className="w-4 h-4" />}
        title="Push-to-Talk"
        description="Press your hotkey to ask a question"
        status="Not configured"
      />

      {/* Activity Log */}
      <div className="mt-1">
        <h2 className="text-xs font-semibold text-[var(--gc-text-muted)] uppercase tracking-wider mb-2">
          Activity Log
        </h2>
        <StatusLog />
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  description,
  status,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-border)] hover:border-[var(--gc-primary)] transition-colors cursor-default">
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--gc-surface-hover)] text-[var(--gc-primary)]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--gc-text)]">{title}</div>
        <div className="text-xs text-[var(--gc-text-muted)]">{description}</div>
      </div>
      <span className="text-xs text-[var(--gc-text-muted)] whitespace-nowrap">
        {status}
      </span>
    </div>
  );
}

export default App;
