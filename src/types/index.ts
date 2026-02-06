export interface GameProfile {
  id: string;
  name: string;
  genre: string;
  description: string;
  systemPromptTemplate: string;
  screenshotCount: number;
  maxResponseTokens: number;
}

export interface WindowInfo {
  hwnd: number;
  title: string;
  processName: string;
}

export type AppStatus =
  | "initializing"
  | "ready"
  | "listening"
  | "processing"
  | "error";

export interface CaptureStatus {
  isCapturing: boolean;
  frameCount: number;
}

export interface AudioDeviceInfo {
  name: string;
  isDefault: boolean;
}

export interface AudioStatus {
  inputStreamActive: boolean;
  outputInitialized: boolean;
  isRecording: boolean;
}

export interface VoiceQueryResult {
  transcript: string;
  response: string;
  latencyMs: number;
}

export interface PipelineStageEvent {
  stage: "transcribing" | "searching" | "analyzing" | "speaking";
  message: string;
}

export interface PipelineCompleteEvent {
  transcript: string;
  response: string;
  latencyMs: number;
}

export interface PipelineErrorEvent {
  stage: string;
  message: string;
}

export type ActivePanel = "home" | "settings";

export interface StatusLogEntry {
  id: string;
  timestamp: number;
  level: "info" | "success" | "warning" | "error";
  message: string;
}
