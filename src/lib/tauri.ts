import { invoke } from "@tauri-apps/api/core";

export async function greet(name: string): Promise<string> {
  return invoke<string>("greet", { name });
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("get_all_settings");
}

export async function saveSetting(
  key: string,
  value: unknown
): Promise<void> {
  return invoke("save_setting", { key, value });
}
