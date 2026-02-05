import { Volume2, Mic, Keyboard, Cpu, Info } from "lucide-react";

export function SettingsPanel() {
  return (
    <div className="flex flex-col gap-3">
      <SettingSection
        icon={<Mic className="w-4 h-4" />}
        title="Audio Input"
        description="Microphone selection and sensitivity"
      />
      <SettingSection
        icon={<Volume2 className="w-4 h-4" />}
        title="Audio Output"
        description="Speaker selection and volume"
      />
      <SettingSection
        icon={<Keyboard className="w-4 h-4" />}
        title="Push-to-Talk Key"
        description="Configure your hotkey binding"
      />
      <SettingSection
        icon={<Cpu className="w-4 h-4" />}
        title="AI Settings"
        description="Voice, model, and response preferences"
      />
      <SettingSection
        icon={<Info className="w-4 h-4" />}
        title="About"
        description="GamerClone v0.1.0 — POC Build"
      />
    </div>
  );
}

function SettingSection({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
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
      <span className="text-xs text-[var(--gc-text-muted)]">Phase 2+</span>
    </div>
  );
}
