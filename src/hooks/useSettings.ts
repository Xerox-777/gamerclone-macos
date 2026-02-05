// Phase 1+: Settings read/write via tauri-plugin-store
import { getAllSettings, saveSetting } from "../lib/tauri";

export function useSettings() {
  return {
    getAllSettings,
    saveSetting,
  };
}
