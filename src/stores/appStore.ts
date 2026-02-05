import { create } from "zustand";
import type { ActivePanel, AppStatus, StatusLogEntry } from "../types";

interface AppState {
  activePanel: ActivePanel;
  status: AppStatus;
  statusLog: StatusLogEntry[];

  setActivePanel: (panel: ActivePanel) => void;
  setStatus: (status: AppStatus) => void;
  addLogEntry: (level: StatusLogEntry["level"], message: string) => void;
  clearLog: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activePanel: "home",
  status: "ready",
  statusLog: [],

  setActivePanel: (panel) => set({ activePanel: panel }),
  setStatus: (status) => set({ status }),
  addLogEntry: (level, message) =>
    set((state) => ({
      statusLog: [
        {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          level,
          message,
        },
        ...state.statusLog,
      ].slice(0, 100),
    })),
  clearLog: () => set({ statusLog: [] }),
}));
