import { create } from "zustand";
import type { ActivePanel, AppStatus, GameProfile, StatusLogEntry, WindowInfo } from "../types";

interface AppState {
  activePanel: ActivePanel;
  status: AppStatus;
  statusLog: StatusLogEntry[];
  selectedWindow: WindowInfo | null;
  isCapturing: boolean;
  captureFrameCount: number;
  pttKey: string | null;
  isListening: boolean;
  selectedInputDevice: string | null;
  selectedOutputDevice: string | null;
  activeGameId: string;
  gameProfiles: GameProfile[];
  isFirstLaunch: boolean;
  ttsVoice: string;

  setActivePanel: (panel: ActivePanel) => void;
  setStatus: (status: AppStatus) => void;
  addLogEntry: (level: StatusLogEntry["level"], message: string) => void;
  clearLog: () => void;
  setSelectedWindow: (window: WindowInfo | null) => void;
  setIsCapturing: (capturing: boolean) => void;
  setCaptureFrameCount: (count: number) => void;
  setPttKey: (key: string | null) => void;
  setIsListening: (listening: boolean) => void;
  setSelectedInputDevice: (device: string | null) => void;
  setSelectedOutputDevice: (device: string | null) => void;
  setActiveGameId: (gameId: string) => void;
  setGameProfiles: (profiles: GameProfile[]) => void;
  setIsFirstLaunch: (first: boolean) => void;
  setTtsVoice: (voice: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activePanel: "home",
  status: "ready",
  statusLog: [],
  selectedWindow: null,
  isCapturing: false,
  captureFrameCount: 0,
  pttKey: null,
  isListening: false,
  selectedInputDevice: null,
  selectedOutputDevice: null,
  activeGameId: "generic",
  gameProfiles: [],
  isFirstLaunch: true,
  ttsVoice: "nova",

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
  setSelectedWindow: (window) => set({ selectedWindow: window }),
  setIsCapturing: (capturing) => set({ isCapturing: capturing }),
  setCaptureFrameCount: (count) => set({ captureFrameCount: count }),
  setPttKey: (key) => set({ pttKey: key }),
  setIsListening: (listening) => set({ isListening: listening }),
  setSelectedInputDevice: (device) => set({ selectedInputDevice: device }),
  setSelectedOutputDevice: (device) => set({ selectedOutputDevice: device }),
  setActiveGameId: (gameId) => set({ activeGameId: gameId }),
  setGameProfiles: (profiles) => set({ gameProfiles: profiles }),
  setIsFirstLaunch: (first) => set({ isFirstLaunch: first }),
  setTtsVoice: (voice) => set({ ttsVoice: voice }),
}));
