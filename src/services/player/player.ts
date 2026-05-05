import type { MediaItem } from "../../state/app-store";

export type PlayerBackendStatus = "idle" | "ready" | "missing" | "error";

export interface PlaybackSource {
  item: MediaItem;
  url: string;
  watchUrl?: string | null;
  durationSeconds: number | null;
  mimeType: string;
}

export interface PlayerSnapshot {
  backendStatus: PlayerBackendStatus;
  backendMessage: string | null;
  currentItemId: string | null;
  idleActive: boolean;
  paused: boolean;
  volume: number;
  positionSeconds: number;
  durationSeconds: number | null;
}

export interface PlayerService {
  clear(): Promise<void>;
  dispose(): Promise<void>;
  getSnapshot(): PlayerSnapshot;
  load(source: PlaybackSource): Promise<void>;
  pause(): Promise<void>;
  play(): Promise<void>;
  seekBy(seconds: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  subscribe(listener: (snapshot: PlayerSnapshot) => void): () => void;
  togglePause(): Promise<void>;
}
