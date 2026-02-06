import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  WindowInfo,
  CaptureStatus,
  AudioDeviceInfo,
  AudioStatus,
  GameProfile,
  VoiceQueryResult,
  PipelineStageEvent,
  PipelineCompleteEvent,
  PipelineErrorEvent,
} from "../types";

export async function greet(name: string): Promise<string> {
  return invoke<string>("greet", { name });
}

export async function listWindows(): Promise<WindowInfo[]> {
  return invoke<WindowInfo[]>("list_windows");
}

export async function selectWindow(hwnd: number): Promise<void> {
  return invoke("select_window", { hwnd });
}

export async function startCapture(): Promise<void> {
  return invoke("start_capture");
}

export async function stopCapture(): Promise<void> {
  return invoke("stop_capture");
}

export async function getCaptureStatus(): Promise<CaptureStatus> {
  return invoke<CaptureStatus>("get_capture_status");
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

// --- Audio ---

export async function listAudioDevices(kind: "input" | "output"): Promise<AudioDeviceInfo[]> {
  return invoke<AudioDeviceInfo[]>("list_audio_devices", { kind });
}

export async function setInputDevice(deviceName: string): Promise<void> {
  return invoke("set_input_device", { deviceName });
}

export async function setOutputDevice(deviceName: string): Promise<void> {
  return invoke("set_output_device", { deviceName });
}

export async function testMicrophone(): Promise<string> {
  return invoke<string>("test_microphone");
}

export async function getAudioStatus(): Promise<AudioStatus> {
  return invoke<AudioStatus>("get_audio_status");
}

// --- Hotkeys ---

export async function getPTTKey(): Promise<string> {
  return invoke<string>("get_ptt_key");
}

export async function setPTTKey(key: string): Promise<void> {
  return invoke("set_ptt_key", { key });
}

export async function getPTTStatus(): Promise<boolean> {
  return invoke<boolean>("get_ptt_status");
}

// --- Game Profiles ---

export async function listGameProfiles(): Promise<GameProfile[]> {
  return invoke<GameProfile[]>("list_game_profiles");
}

export async function getActiveProfile(): Promise<string> {
  return invoke<string>("get_active_profile");
}

export async function setActiveProfile(gameId: string): Promise<void> {
  return invoke("set_active_profile", { gameId });
}

// --- Voice Pipeline ---

export async function startRecording(): Promise<void> {
  return invoke("start_recording");
}

export async function processVoiceQuery(
  gameId?: string
): Promise<VoiceQueryResult> {
  return invoke<VoiceQueryResult>("process_voice_query", { gameId });
}

// --- PTT Events ---

export function onPTTStarted(callback: () => void): Promise<UnlistenFn> {
  return listen("ptt-started", () => callback());
}

export function onPTTStopped(callback: () => void): Promise<UnlistenFn> {
  return listen("ptt-stopped", () => callback());
}

// --- Pipeline Events ---

export function onPipelineStage(
  callback: (event: PipelineStageEvent) => void
): Promise<UnlistenFn> {
  return listen<PipelineStageEvent>("pipeline:stage", (e) => callback(e.payload));
}

export function onPipelineComplete(
  callback: (event: PipelineCompleteEvent) => void
): Promise<UnlistenFn> {
  return listen<PipelineCompleteEvent>("pipeline:complete", (e) =>
    callback(e.payload)
  );
}

export function onPipelineError(
  callback: (event: PipelineErrorEvent) => void
): Promise<UnlistenFn> {
  return listen<PipelineErrorEvent>("pipeline:error", (e) =>
    callback(e.payload)
  );
}
