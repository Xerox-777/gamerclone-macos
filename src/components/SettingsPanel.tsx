import { useState, useEffect } from "react";
import { Volume2, Mic, Keyboard, Cpu, Info, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useAudio } from "../hooks/useAudio";
import { usePTT } from "../hooks/usePTT";
import { useAppStore } from "../stores/appStore";
import { saveSetting, getAllSettings } from "../lib/tauri";
import type { AudioDeviceInfo } from "../types";

export function SettingsPanel() {
  const audio = useAudio();
  const ptt = usePTT();

  return (
    <div className="flex flex-col gap-3">
      {audio.error && (
        <div className="text-xs text-[var(--gc-error)] bg-[var(--gc-error)]/10 rounded-lg px-3 py-2">
          {audio.error}
        </div>
      )}
      <AudioInputSection
        devices={audio.inputDevices}
        selected={audio.selectedInputDevice}
        loading={audio.loadingInputs}
        testingMic={audio.testingMic}
        onSelect={audio.handleSelectInputDevice}
        onRefresh={audio.refreshInputDevices}
        onTestMic={audio.handleTestMicrophone}
      />
      <AudioOutputSection
        devices={audio.outputDevices}
        selected={audio.selectedOutputDevice}
        loading={audio.loadingOutputs}
        onSelect={audio.handleSelectOutputDevice}
        onRefresh={audio.refreshOutputDevices}
      />
      <PTTKeySection
        currentKey={ptt.pttKey}
        isRebinding={ptt.isRebinding}
        onSetKey={ptt.handleSetPTTKey}
        onStartRebinding={ptt.startRebinding}
        onCancelRebinding={ptt.cancelRebinding}
      />
      <TTSVoiceSection />
      <SettingSection
        icon={<Info className="w-4 h-4" />}
        title="About"
        description="GamerClone v0.1.0 — POC Build"
        status=""
      />
    </div>
  );
}

// --- Audio Input ---

function AudioInputSection({
  devices,
  selected,
  loading,
  testingMic,
  onSelect,
  onRefresh,
  onTestMic,
}: {
  devices: AudioDeviceInfo[];
  selected: string | null;
  loading: boolean;
  testingMic: boolean;
  onSelect: (name: string) => void;
  onRefresh: () => void;
  onTestMic: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-border)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full p-3 text-left cursor-pointer"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--gc-surface-hover)] text-[var(--gc-primary)]">
          <Mic className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--gc-text)]">Audio Input</div>
          <div className="text-xs text-[var(--gc-text-muted)] truncate">
            {selected || "Default device"}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--gc-text-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--gc-text-muted)]" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex gap-2">
            <select
              aria-label="Audio input device"
              className="flex-1 text-xs bg-[var(--gc-bg)] text-[var(--gc-text)] border border-[var(--gc-border)] rounded px-2 py-1.5"
              value={selected || ""}
              onChange={(e) => onSelect(e.target.value)}
            >
              <option value="">Default</option>
              {devices.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} {d.isDefault ? "(Default)" : ""}
                </option>
              ))}
            </select>
            <button
              title="Refresh device list"
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded bg-[var(--gc-surface-hover)] text-[var(--gc-text-muted)] hover:text-[var(--gc-text)] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <button
            title="Record a short test clip"
            onClick={onTestMic}
            disabled={testingMic}
            className="w-full text-xs py-1.5 rounded bg-[var(--gc-primary)] text-[var(--gc-bg)] hover:bg-[var(--gc-primary-hover)] disabled:opacity-50"
          >
            {testingMic ? "Recording..." : "Test Microphone"}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Audio Output ---

function AudioOutputSection({
  devices,
  selected,
  loading,
  onSelect,
  onRefresh,
}: {
  devices: AudioDeviceInfo[];
  selected: string | null;
  loading: boolean;
  onSelect: (name: string) => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-border)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full p-3 text-left cursor-pointer"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--gc-surface-hover)] text-[var(--gc-primary)]">
          <Volume2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--gc-text)]">Audio Output</div>
          <div className="text-xs text-[var(--gc-text-muted)] truncate">
            {selected || "Default device"}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--gc-text-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--gc-text-muted)]" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <div className="flex gap-2">
            <select
              aria-label="Audio output device"
              className="flex-1 text-xs bg-[var(--gc-bg)] text-[var(--gc-text)] border border-[var(--gc-border)] rounded px-2 py-1.5"
              value={selected || ""}
              onChange={(e) => onSelect(e.target.value)}
            >
              <option value="">Default</option>
              {devices.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} {d.isDefault ? "(Default)" : ""}
                </option>
              ))}
            </select>
            <button
              title="Refresh device list"
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded bg-[var(--gc-surface-hover)] text-[var(--gc-text-muted)] hover:text-[var(--gc-text)] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- PTT Key ---

const MOUSE_BUTTON_MAP: Record<number, string> = {
  3: "Mouse4",
  4: "Mouse5",
  1: "MiddleMouse",
};

const KEY_MAP: Record<string, string> = {
  Backquote: "BackQuote",
  F1: "F1",
  F2: "F2",
  F3: "F3",
  F4: "F4",
  F5: "F5",
  F6: "F6",
  F7: "F7",
  F8: "F8",
  F9: "F9",
  F10: "F10",
  F11: "F11",
  F12: "F12",
  CapsLock: "CapsLock",
  NumLock: "NumLock",
  ScrollLock: "ScrollLock",
  Pause: "Pause",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  PrintScreen: "PrintScreen",
};

function PTTKeySection({
  currentKey,
  isRebinding,
  onSetKey,
  onStartRebinding,
  onCancelRebinding,
}: {
  currentKey: string | null;
  isRebinding: boolean;
  onSetKey: (key: string) => void;
  onStartRebinding: () => void;
  onCancelRebinding: () => void;
}) {
  const [rebindError, setRebindError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRebinding) return;

    setRebindError(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        onCancelRebinding();
        return;
      }

      const mapped = KEY_MAP[e.code];
      if (mapped) {
        onSetKey(mapped);
        onCancelRebinding();
      } else {
        setRebindError(`Key "${e.code}" is not supported or blocked`);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Only capture side buttons (Mouse4/Mouse5) and middle click
      const mapped = MOUSE_BUTTON_MAP[e.button];
      if (mapped) {
        e.preventDefault();
        e.stopPropagation();
        onSetKey(mapped);
        onCancelRebinding();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("mousedown", handleMouseDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [isRebinding, onSetKey, onCancelRebinding]);

  return (
    <div className="rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-border)]">
      <div className="flex items-center gap-3 p-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--gc-surface-hover)] text-[var(--gc-primary)]">
          <Keyboard className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--gc-text)]">Push-to-Talk Key</div>
          <div className="text-xs text-[var(--gc-text-muted)]">
            {isRebinding ? (
              <span className="text-[var(--gc-warning)] animate-pulse">
                Press a key or mouse button... (Esc to cancel)
              </span>
            ) : (
              currentKey || "Mouse4"
            )}
          </div>
          {rebindError && (
            <div className="text-xs text-[var(--gc-error)] mt-0.5">{rebindError}</div>
          )}
        </div>
        <button
          title={isRebinding ? "Cancel rebinding" : "Change push-to-talk key"}
          onClick={isRebinding ? onCancelRebinding : onStartRebinding}
          className="text-xs px-2.5 py-1 rounded bg-[var(--gc-surface-hover)] text-[var(--gc-text-muted)] hover:text-[var(--gc-text)]"
        >
          {isRebinding ? "Cancel" : "Rebind"}
        </button>
      </div>
    </div>
  );
}

// --- TTS Voice ---

const TTS_VOICES = [
  { id: "alloy", label: "Alloy", description: "Neutral, balanced" },
  { id: "echo", label: "Echo", description: "Warm, conversational" },
  { id: "fable", label: "Fable", description: "Expressive, narrative" },
  { id: "onyx", label: "Onyx", description: "Deep, authoritative" },
  { id: "nova", label: "Nova", description: "Friendly, energetic" },
  { id: "shimmer", label: "Shimmer", description: "Soft, clear" },
];

function TTSVoiceSection() {
  const { ttsVoice, setTtsVoice, addLogEntry } = useAppStore();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getAllSettings().then((settings) => {
      const saved = settings.ttsVoice as string | undefined;
      if (saved) setTtsVoice(saved);
    }).catch(() => {});
  }, [setTtsVoice]);

  const handleSelect = async (voice: string) => {
    setTtsVoice(voice);
    try {
      await saveSetting("ttsVoice", voice);
      addLogEntry("success", `TTS voice: ${voice}`);
    } catch (e) {
      addLogEntry("error", `Failed to save voice: ${e}`);
    }
  };

  const currentVoice = TTS_VOICES.find((v) => v.id === ttsVoice) ?? TTS_VOICES[4];

  return (
    <div className="rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-border)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full p-3 text-left cursor-pointer"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--gc-surface-hover)] text-[var(--gc-primary)]">
          <Cpu className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--gc-text)]">TTS Voice</div>
          <div className="text-xs text-[var(--gc-text-muted)]">
            {currentVoice.label} — {currentVoice.description}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--gc-text-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--gc-text-muted)]" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 gap-1.5">
            {TTS_VOICES.map((voice) => (
              <button
                key={voice.id}
                onClick={() => handleSelect(voice.id)}
                className={`text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                  voice.id === ttsVoice
                    ? "bg-[var(--gc-primary)]/15 text-[var(--gc-primary)] font-medium"
                    : "bg-[var(--gc-bg)] text-[var(--gc-text)] hover:bg-[var(--gc-surface-hover)]"
                }`}
              >
                <div className="font-medium">{voice.label}</div>
                <div className="text-[var(--gc-text-muted)]">{voice.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Generic placeholder section ---

function SettingSection({
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
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-border)] cursor-default">
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--gc-surface-hover)] text-[var(--gc-primary)]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--gc-text)]">{title}</div>
        <div className="text-xs text-[var(--gc-text-muted)]">{description}</div>
      </div>
      {status && <span className="text-xs text-[var(--gc-text-muted)]">{status}</span>}
    </div>
  );
}
