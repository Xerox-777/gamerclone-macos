import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import logoImg from "../images/logo.png";
import { useAppStore } from "../stores/appStore";
import { listGameProfiles, getActiveProfile, setActiveProfile, saveSetting } from "../lib/tauri";

export function GameSelector() {
  const { activeGameId, gameProfiles, setActiveGameId, setGameProfiles, addLogEntry } =
    useAppStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const profiles = await listGameProfiles();
        setGameProfiles(profiles);
        const current = await getActiveProfile();
        setActiveGameId(current);
      } catch (e) {
        addLogEntry("error", `Failed to load profiles: ${e}`);
      }
    })();
  }, [setGameProfiles, setActiveGameId, addLogEntry]);

  const currentProfile = gameProfiles.find((p) => p.id === activeGameId);

  const handleSelect = async (gameId: string) => {
    try {
      await setActiveProfile(gameId);
      setActiveGameId(gameId);
      await saveSetting("activeGameId", gameId);
      const profile = gameProfiles.find((p) => p.id === gameId);
      addLogEntry("success", `Game profile: ${profile?.name ?? gameId}`);
    } catch (e) {
      addLogEntry("error", `Failed to set profile: ${e}`);
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full p-3 rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-border)] hover:border-[var(--gc-primary)] transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--gc-surface-hover)] text-[var(--gc-primary)]">
          <img src={logoImg} alt="" className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--gc-text)]">
            {currentProfile?.name ?? "Select Game"}
          </div>
          <div className="text-xs text-[var(--gc-text-muted)]">
            {currentProfile?.genre ?? "Choose your game for tailored coaching"}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[var(--gc-text-muted)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-lg bg-[var(--gc-surface)] border border-[var(--gc-border)] shadow-lg overflow-hidden">
          {gameProfiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleSelect(profile.id)}
              className={`flex items-center gap-3 w-full px-3 py-2 text-left transition-colors cursor-pointer ${
                profile.id === activeGameId
                  ? "bg-[var(--gc-primary)]/10 text-[var(--gc-primary)]"
                  : "hover:bg-[var(--gc-surface-hover)] text-[var(--gc-text)]"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{profile.name}</div>
                <div className="text-xs text-[var(--gc-text-muted)]">
                  {profile.description}
                </div>
              </div>
              {profile.id === activeGameId && (
                <div className="w-2 h-2 rounded-full bg-[var(--gc-primary)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
