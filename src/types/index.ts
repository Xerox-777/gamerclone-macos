export interface GameProfile {
  id: string;
  name: string;
  genre: string;
  description: string;
  systemPromptTemplate: string;
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

export type ActivePanel = "home" | "settings";

export interface StatusLogEntry {
  id: string;
  timestamp: number;
  level: "info" | "success" | "warning" | "error";
  message: string;
}
