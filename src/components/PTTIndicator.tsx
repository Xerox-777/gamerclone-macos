import { Mic, Radio, Loader2, MicOff } from "lucide-react";
import { useAppStore } from "../stores/appStore";

const STATES = {
  ready: {
    icon: Mic,
    color: "text-[var(--gc-success)]",
    dot: "bg-[var(--gc-success)]",
    bg: "bg-[var(--gc-success)]/10",
    border: "border-[var(--gc-success)]/30",
    label: "Ready",
    animate: "",
  },
  listening: {
    icon: Radio,
    color: "text-[var(--gc-warning)]",
    dot: "bg-[var(--gc-warning)]",
    bg: "bg-[var(--gc-warning)]/10",
    border: "border-[var(--gc-warning)]/30",
    label: "Listening...",
    animate: "animate-pulse",
  },
  processing: {
    icon: Loader2,
    color: "text-[var(--gc-info)]",
    dot: "bg-[var(--gc-info)]",
    bg: "bg-[var(--gc-info)]/10",
    border: "border-[var(--gc-info)]/30",
    label: "Processing...",
    animate: "animate-spin",
  },
  error: {
    icon: MicOff,
    color: "text-[var(--gc-error)]",
    dot: "bg-[var(--gc-error)]",
    bg: "bg-[var(--gc-error)]/10",
    border: "border-[var(--gc-error)]/30",
    label: "Error",
    animate: "",
  },
} as const;

export function PTTIndicator() {
  const { status, pttKey } = useAppStore();

  const stateKey = status === "initializing" ? "ready" : status;
  const state = STATES[stateKey as keyof typeof STATES] ?? STATES.ready;
  const Icon = state.icon;

  return (
    <div
      aria-label={`Push-to-talk status: ${state.label}`}
      className={`flex items-center gap-3 p-3 rounded-lg bg-[var(--gc-surface)] border ${state.border} transition-colors cursor-default`}
    >
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-md ${state.bg} ${state.color}`}
      >
        <Icon className={`w-4 h-4 ${state.animate}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--gc-text)]">
          Push-to-Talk
        </div>
        <div className="text-xs text-[var(--gc-text-muted)]">
          {state.label}
          {pttKey && ` — ${pttKey}`}
        </div>
      </div>
      <div className={`w-2 h-2 rounded-full ${state.dot} ${state.animate === "animate-pulse" ? "animate-pulse" : ""}`} />
    </div>
  );
}
