import { useState, useEffect, useCallback } from "react";
import { Mic, Keyboard, Gamepad2, Monitor, ChevronRight, Check } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import {
  listAudioDevices,
  setInputDevice,
  testMicrophone,
  getPTTKey,
  setPTTKey,
  listGameProfiles,
  setActiveProfile,
  listWindows,
  selectWindow,
  saveSetting,
} from "../lib/tauri";
import type { AudioDeviceInfo, GameProfile, WindowInfo } from "../types";

const STEPS = ["Microphone", "PTT Key", "Game", "Game Window"] as const;

const KEY_MAP: Record<string, string> = {
  Backquote: "BackQuote",
  F1: "F1", F2: "F2", F3: "F3", F4: "F4",
  F5: "F5", F6: "F6", F7: "F7", F8: "F8",
  F9: "F9", F10: "F10", F11: "F11", F12: "F12",
  CapsLock: "CapsLock", NumLock: "NumLock", ScrollLock: "ScrollLock",
  Pause: "Pause", Insert: "Insert", Home: "Home", End: "End",
  PageUp: "PageUp", PageDown: "PageDown", PrintScreen: "PrintScreen",
};

const MOUSE_MAP: Record<number, string> = {
  3: "Mouse4",
  4: "Mouse5",
  1: "MiddleMouse",
};

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const { setIsFirstLaunch, setActiveGameId, setGameProfiles, addLogEntry } = useAppStore();

  const handleComplete = async () => {
    try {
      await saveSetting("setupComplete", true);
    } catch {}
    setIsFirstLaunch(false);
    addLogEntry("success", "Setup complete! Start coaching.");
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

  return (
    <div className="flex flex-col h-screen bg-[var(--gc-bg)]">
      <header className="flex items-center justify-center px-4 py-4 border-b border-[var(--gc-border)] bg-[var(--gc-surface)]">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-[var(--gc-primary)]" />
          <h1 className="text-sm font-bold tracking-wide text-[var(--gc-text)]">
            GamerClone Setup
          </h1>
        </div>
      </header>

      {/* Progress */}
      <div className="flex items-center gap-1 px-4 py-3">
        {STEPS.map((name, i) => (
          <div key={name} className="flex items-center gap-1 flex-1">
            <div
              className={`w-full h-1 rounded-full transition-colors ${
                i <= step ? "bg-[var(--gc-primary)]" : "bg-[var(--gc-border)]"
              }`}
            />
          </div>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-4">
        {step === 0 && <MicStep onNext={next} />}
        {step === 1 && <PTTStep onNext={next} />}
        {step === 2 && (
          <GameStep
            onNext={next}
            setActiveGameId={setActiveGameId}
            setGameProfiles={setGameProfiles}
          />
        )}
        {step === 3 && <WindowStep onComplete={handleComplete} />}
      </main>

      {/* Footer with step indicator */}
      <footer className="px-4 py-3 border-t border-[var(--gc-border)] bg-[var(--gc-surface)]">
        <div className="text-xs text-center text-[var(--gc-text-muted)]">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </div>
      </footer>
    </div>
  );
}

// --- Step 1: Microphone ---

function MicStep({ onNext }: { onNext: () => void }) {
  const [devices, setDevices] = useState<AudioDeviceInfo[]>([]);
  const [selected, setSelected] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    listAudioDevices("input").then(setDevices).catch(() => {});
  }, []);

  const handleSelect = async (name: string) => {
    setSelected(name);
    try {
      await setInputDevice(name);
      await saveSetting("inputDevice", name);
    } catch {}
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testMicrophone();
      setTestResult(result);
    } catch (e) {
      setTestResult(`Error: ${e}`);
    }
    setTesting(false);
  };

  return (
    <StepLayout
      icon={<Mic className="w-6 h-6" />}
      title="Select Microphone"
      description="Choose the microphone you'll use for voice commands."
      onNext={onNext}
    >
      <select
        aria-label="Microphone"
        className="w-full text-sm bg-[var(--gc-bg)] text-[var(--gc-text)] border border-[var(--gc-border)] rounded-lg px-3 py-2"
        value={selected}
        onChange={(e) => handleSelect(e.target.value)}
      >
        <option value="">Default</option>
        {devices.map((d) => (
          <option key={d.name} value={d.name}>
            {d.name} {d.isDefault ? "(Default)" : ""}
          </option>
        ))}
      </select>
      <button
        onClick={handleTest}
        disabled={testing}
        className="w-full mt-2 text-sm py-2 rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-border)] text-[var(--gc-text)] hover:bg-[var(--gc-surface-hover)] disabled:opacity-50"
      >
        {testing ? "Recording..." : "Test Microphone"}
      </button>
      {testResult && (
        <div className="mt-2 text-xs text-[var(--gc-text-muted)]">{testResult}</div>
      )}
    </StepLayout>
  );
}

// --- Step 2: PTT Key ---

function PTTStep({ onNext }: { onNext: () => void }) {
  const [currentKey, setCurrentKey] = useState("Mouse4");
  const [isBinding, setIsBinding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPTTKey().then(setCurrentKey).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isBinding) return;
    setError(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") { setIsBinding(false); return; }
      const mapped = KEY_MAP[e.code];
      if (mapped) {
        setPTTKey(mapped).then(() => {
          getPTTKey().then(setCurrentKey);
          saveSetting("pttKey", mapped).catch(() => {});
        }).catch(() => {});
        setIsBinding(false);
      } else {
        setError(`"${e.code}" is not supported`);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const mapped = MOUSE_MAP[e.button];
      if (mapped) {
        e.preventDefault();
        setPTTKey(mapped).then(() => {
          getPTTKey().then(setCurrentKey);
          saveSetting("pttKey", mapped).catch(() => {});
        }).catch(() => {});
        setIsBinding(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("mousedown", handleMouseDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [isBinding]);

  return (
    <StepLayout
      icon={<Keyboard className="w-6 h-6" />}
      title="Push-to-Talk Key"
      description="Choose a key or mouse button for voice activation."
      onNext={onNext}
    >
      <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--gc-bg)] border border-[var(--gc-border)]">
        <span className="text-sm text-[var(--gc-text)]">
          {isBinding ? (
            <span className="text-[var(--gc-warning)] animate-pulse">
              Press a key or mouse button...
            </span>
          ) : (
            currentKey
          )}
        </span>
        <button
          onClick={() => setIsBinding(!isBinding)}
          className="text-xs px-3 py-1 rounded bg-[var(--gc-surface-hover)] text-[var(--gc-text-muted)] hover:text-[var(--gc-text)]"
        >
          {isBinding ? "Cancel" : "Rebind"}
        </button>
      </div>
      {error && <div className="text-xs text-[var(--gc-error)] mt-1">{error}</div>}
    </StepLayout>
  );
}

// --- Step 3: Game ---

function GameStep({
  onNext,
  setActiveGameId,
  setGameProfiles,
}: {
  onNext: () => void;
  setActiveGameId: (id: string) => void;
  setGameProfiles: (profiles: GameProfile[]) => void;
}) {
  const [profiles, setProfiles] = useState<GameProfile[]>([]);
  const [selected, setSelected] = useState("generic");

  useEffect(() => {
    listGameProfiles().then((p) => {
      setProfiles(p);
      setGameProfiles(p);
    }).catch(() => {});
  }, [setGameProfiles]);

  const handleSelect = async (gameId: string) => {
    setSelected(gameId);
    try {
      await setActiveProfile(gameId);
      setActiveGameId(gameId);
      await saveSetting("activeGameId", gameId);
    } catch {}
  };

  return (
    <StepLayout
      icon={<Gamepad2 className="w-6 h-6" />}
      title="Select Game"
      description="Choose the game you're playing for tailored coaching."
      onNext={onNext}
    >
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelect(p.id)}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
              p.id === selected
                ? "bg-[var(--gc-primary)]/10 border border-[var(--gc-primary)]/30"
                : "bg-[var(--gc-bg)] border border-[var(--gc-border)] hover:bg-[var(--gc-surface-hover)]"
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--gc-text)]">{p.name}</div>
              <div className="text-xs text-[var(--gc-text-muted)]">{p.genre}</div>
            </div>
            {p.id === selected && (
              <Check className="w-4 h-4 text-[var(--gc-primary)]" />
            )}
          </button>
        ))}
      </div>
    </StepLayout>
  );
}

// --- Step 4: Window ---

function WindowStep({ onComplete }: { onComplete: () => void }) {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [selected, setSelected] = useState<WindowInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshWindows = useCallback(async () => {
    setLoading(true);
    try {
      const wins = await listWindows();
      setWindows(wins);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshWindows();
  }, [refreshWindows]);

  const handleSelect = async (win: WindowInfo) => {
    try {
      await selectWindow(win.hwnd, win.captureType);
      setSelected(win);
    } catch {}
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--gc-primary)]/10 text-[var(--gc-primary)]">
          <Monitor className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-[var(--gc-text)]">Select Game Window</h2>
          <p className="text-xs text-[var(--gc-text-muted)]">
            Choose the window to capture screenshots from.
          </p>
        </div>
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {windows.map((win) => (
          <button
            key={win.hwnd}
            onClick={() => handleSelect(win)}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
              selected?.hwnd === win.hwnd
                ? "bg-[var(--gc-primary)]/10 border border-[var(--gc-primary)]/30"
                : "bg-[var(--gc-bg)] border border-[var(--gc-border)] hover:bg-[var(--gc-surface-hover)]"
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--gc-text)] truncate">
                {win.title}
              </div>
              <div className="text-xs text-[var(--gc-text-muted)]">{win.processName}</div>
            </div>
            {selected?.hwnd === win.hwnd && (
              <Check className="w-4 h-4 text-[var(--gc-primary)]" />
            )}
          </button>
        ))}
        {windows.length === 0 && !loading && (
          <div className="text-xs text-center text-[var(--gc-text-muted)] py-4">
            No windows found. Open a game first.
          </div>
        )}
      </div>

      <button
        onClick={refreshWindows}
        disabled={loading}
        className="text-xs py-1.5 rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-border)] text-[var(--gc-text-muted)] hover:text-[var(--gc-text)] disabled:opacity-50"
      >
        {loading ? "Scanning..." : "Refresh Windows"}
      </button>

      <button
        onClick={onComplete}
        className="w-full py-2.5 rounded-lg bg-[var(--gc-primary)] text-[var(--gc-bg)] font-medium hover:bg-[var(--gc-primary-hover)] transition-colors"
      >
        Start Coaching
      </button>
    </div>
  );
}

// --- Shared step layout ---

function StepLayout({
  icon,
  title,
  description,
  onNext,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onNext: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--gc-primary)]/10 text-[var(--gc-primary)]">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold text-[var(--gc-text)]">{title}</h2>
          <p className="text-xs text-[var(--gc-text-muted)]">{description}</p>
        </div>
      </div>

      {children}

      <button
        onClick={onNext}
        className="flex items-center justify-center gap-1 w-full py-2.5 rounded-lg bg-[var(--gc-primary)] text-[var(--gc-bg)] font-medium hover:bg-[var(--gc-primary-hover)] transition-colors"
      >
        Continue
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
