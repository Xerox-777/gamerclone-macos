import { useEffect } from "react";
import { Home, Settings, Gamepad2 } from "lucide-react";
import { useAppStore } from "./stores/appStore";
import { greet, getAllSettings } from "./lib/tauri";
import { StatusLog } from "./components/StatusLog";
import { SettingsPanel } from "./components/SettingsPanel";
import { WindowPicker } from "./components/WindowPicker";
import { GameSelector } from "./components/GameSelector";
import { PTTIndicator } from "./components/PTTIndicator";
import { SetupWizard } from "./components/SetupWizard";
import { usePTT } from "./hooks/usePTT";

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
  const { activePanel, setActivePanel, status, isFirstLaunch, setIsFirstLaunch, addLogEntry } =
    useAppStore();

  // Initialize PTT event subscriptions at app level
  usePTT();

  useEffect(() => {
    // Check if setup is complete
    getAllSettings()
      .then((settings) => {
        if (settings.setupComplete === true) {
          setIsFirstLaunch(false);
        }
      })
      .catch(() => {});

    // Test IPC on startup
    greet("Coach")
      .then((msg) => addLogEntry("success", msg))
      .catch((err) => addLogEntry("error", `IPC failed: ${err}`));
  }, []);

  // Show setup wizard on first launch
  if (isFirstLaunch) {
    return <SetupWizard />;
  }

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
              title="Home"
              onClick={() => setActivePanel("home")}
              className={`p-1.5 rounded transition-colors ${
                activePanel === "home"
                  ? "bg-[var(--gc-primary)] text-[var(--gc-bg)]"
                  : "text-[var(--gc-text-muted)] hover:bg-[var(--gc-surface-hover)]"
              }`}
            >
              <Home className="w-4 h-4" />
            </button>
            <button
              title="Settings"
              onClick={() => setActivePanel("settings")}
              className={`p-1.5 rounded transition-colors ${
                activePanel === "settings"
                  ? "bg-[var(--gc-primary)] text-[var(--gc-bg)]"
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
      <WindowPicker />
      <GameSelector />
      <PTTIndicator />

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

export default App;
