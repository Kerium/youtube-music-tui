import { useRenderer } from "@opentui/react";
import { createContext, useContext, useEffect, useReducer, useRef, useState } from "react";
import type { Dispatch, ReactNode } from "react";

import {
  DEFAULT_PANE_BY_SCREEN,
  type AppScreen,
  type FocusPane,
} from "../app/routes";
import {
  resolveShortcutConfig,
  sanitizeShortcutConfig,
  type ResolvedShortcutConfig,
} from "../app/shortcuts";
import { createAuthService } from "../services/auth/auth-service";
import { createDisabledCoverRenderer } from "../services/covers/disabled-renderer";
import type { CoverArtCell, CoverArtPayload, CoverArtStatus } from "../services/covers/renderer";
import { createLrclibLyricsProvider } from "../services/lyrics/lrclib-provider";
import type { LyricsLookupResult } from "../services/lyrics/provider";
import { createTerminalCoverRenderer } from "../services/covers/terminal-cover-renderer";
import { createYoutubeMusicProvider } from "../services/music/youtubei-provider";
import {
  createActivityStorageService,
  type StoredRecentTrack,
} from "../services/persistence/activity-storage";
import { createPreferencesStorageService } from "../services/persistence/preferences-storage";
import { createMpvPlayerService } from "../services/player/mpv-player";
import type { PlayerBackendStatus, PlayerSnapshot } from "../services/player/player";
import {
  createGuestSessionState,
  createRestoringSessionState,
  type SessionState,
} from "./session-store";
import {
  applyThemeOverrides,
  sanitizeThemeOverrides,
  type ThemeOverrides,
} from "../ui/theme/theme";

const SEARCH_DEBOUNCE_MS = 350;
const MAX_SEARCH_HISTORY = 8;
const MAX_RECENT_TRACKS = 8;
const MAX_NOTIFICATIONS = 4;
const NOTIFICATION_TIMEOUT_MS = 4500;
const ERROR_NOTIFICATION_TIMEOUT_MS = 6500;

export type MediaKind = "song" | "album" | "playlist" | "artist";

export interface MediaItem {
  id: string;
  sourceId: string | null;
  isPlayable: boolean;
  title: string;
  artist: string;
  album: string;
  thumbnailUrl: string | null;
  duration: string;
  year: string;
  kind: MediaKind;
  subtitle: string;
  trailingLabel: string;
}

export interface RecentTrackEntry {
  album: string;
  artist: string;
  playedAt: string;
  title: string;
}

export type NotificationLevel = "info" | "success" | "error";

export interface AppNotification {
  id: string;
  level: NotificationLevel;
  message: string;
}

interface SearchAlbumContext {
  mode: "album";
  title: string;
  subtitle: string;
  previousResults: MediaItem[];
  previousSelectedIndex: number;
}

export type LyricsStatus = "idle" | "loading" | "ready" | "not-found" | "error";

export interface AppState {
  cover: {
    bytesPerRow: number | null;
    cachedPath: string | null;
    message: string;
    pixelData: Uint8Array | null;
    pixelHeight: number | null;
    pixelWidth: number | null;
    rows: CoverArtCell[][] | null;
    status: CoverArtStatus;
  };
  session: SessionState;
  search: {
    context: SearchAlbumContext | null;
    query: string;
    results: MediaItem[];
    retryToken: number;
    selectedIndex: number;
    error: string | null;
    isLoading: boolean;
  };
  player: {
    backendStatus: PlayerBackendStatus;
    backendMessage: string | null;
    currentItemId: string | null;
    paused: boolean;
    positionSeconds: number;
    positionLabel: string;
    durationSeconds: number | null;
    durationLabel: string;
    volume: number;
  };
  lyrics: {
    lines: string[];
    message: string;
    retryToken: number;
    source: string | null;
    status: LyricsStatus;
    trackKey: string | null;
  };
  history: {
    hydrated: boolean;
    recentTracks: RecentTrackEntry[];
    searchHistory: string[];
  };
  preferences: {
    hydrated: boolean;
    keybindings: ResolvedShortcutConfig;
    theme: ThemeOverrides | null;
  };
  queue: {
    items: MediaItem[];
    currentIndex: number;
    selectedIndex: number;
  };
  ui: {
    activeScreen: AppScreen;
    focusedPane: FocusPane;
    graphicsEnabled: boolean;
    graphicsMessage: string;
    helpOpen: boolean;
    lyricsOpen: boolean;
    authImportOpen: boolean;
    authCookieDraft: string;
    notifications: AppNotification[];
    status: string;
  };
}

type AppAction =
  | { type: "setGraphicsSupport"; enabled: boolean; message: string }
  | { type: "setActiveScreen"; screen: AppScreen; focusedPane?: FocusPane }
  | { type: "setFocusedPane"; pane: FocusPane }
  | { type: "toggleHelp" }
  | { type: "toggleLyrics" }
  | { type: "openAuthImport" }
  | { type: "closeAuthImport" }
  | { type: "setAuthCookieDraft"; value: string }
  | { type: "setSessionState"; session: SessionState }
  | { type: "startSessionRestore" }
  | { type: "closeOverlays" }
  | { type: "hydratePreferences"; keybindings: ResolvedShortcutConfig; theme: ThemeOverrides | null }
  | { type: "hydrateActivity"; recentTracks: RecentTrackEntry[]; searchHistory: string[] }
  | { type: "setSearchQuery"; query: string }
  | { type: "retrySearch" }
  | { type: "startSearchRequest"; query: string }
  | { type: "openAlbumResults"; album: MediaItem; tracks: MediaItem[] }
  | { type: "resolveSearchRequest"; query: string; results: MediaItem[] }
  | { type: "rejectSearchRequest"; query: string; error: string }
  | { type: "returnToSearchResults" }
  | { type: "clearSearchResults" }
  | { type: "recordSearchHistory"; query: string }
  | { type: "syncPlayerSnapshot"; snapshot: PlayerSnapshot }
  | { type: "startCoverLoad"; title: string }
  | { type: "resolveCoverLoad"; cover: CoverArtPayload }
  | { type: "disableCoverArt"; message: string }
  | { type: "rejectCoverLoad"; error: string }
  | { type: "resetLyrics"; message: string }
  | { type: "retryLyrics" }
  | { type: "startLyricsLoad"; trackKey: string; title: string }
  | { type: "resolveLyricsLoad"; trackKey: string; lyrics: LyricsLookupResult }
  | { type: "missLyrics"; trackKey: string; message: string }
  | { type: "rejectLyricsLoad"; trackKey: string; error: string }
  | { type: "recordRecentTrack"; track: RecentTrackEntry }
  | { type: "selectResult"; index: number }
  | { type: "moveResultSelection"; delta: number }
  | { type: "activateResult"; index?: number }
  | { type: "enqueueResult"; index?: number }
  | { type: "selectQueueIndex"; index: number }
  | { type: "moveQueueSelection"; delta: number }
  | { type: "playQueueIndex"; index?: number }
  | { type: "removeQueueIndex"; index: number }
  | { type: "clearQueue" }
  | { type: "finishQueuePlayback" }
  | { type: "togglePause" }
  | { type: "playNext" }
  | { type: "playPrevious" }
  | { type: "pushNotification"; notification: AppNotification }
  | { type: "dismissNotification"; id: string }
  | { type: "setStatus"; status: string };

export const MEDIA_LIBRARY: MediaItem[] = [
  {
    id: "night-drive",
    sourceId: null,
    isPlayable: false,
    title: "Night Drive",
    artist: "The Midnight",
    album: "Endless Roads",
    thumbnailUrl: null,
    duration: "3:41",
    year: "2024",
    kind: "song",
    subtitle: "The Midnight · Endless Roads",
    trailingLabel: "3:41",
  },
  {
    id: "midnight-city",
    sourceId: null,
    isPlayable: false,
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up, We're Dreaming",
    thumbnailUrl: null,
    duration: "4:02",
    year: "2011",
    kind: "song",
    subtitle: "M83 · Hurry Up, We're Dreaming",
    trailingLabel: "4:02",
  },
  {
    id: "afterglow",
    sourceId: null,
    isPlayable: false,
    title: "Afterglow",
    artist: "CHVRCHES",
    album: "Every Open Eye",
    thumbnailUrl: null,
    duration: "3:55",
    year: "2015",
    kind: "song",
    subtitle: "CHVRCHES · Every Open Eye",
    trailingLabel: "3:55",
  },
  {
    id: "blinding-lights",
    sourceId: null,
    isPlayable: false,
    title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    thumbnailUrl: null,
    duration: "3:20",
    year: "2020",
    kind: "song",
    subtitle: "The Weeknd · After Hours",
    trailingLabel: "3:20",
  },
  {
    id: "levitating",
    sourceId: null,
    isPlayable: false,
    title: "Levitating",
    artist: "Dua Lipa",
    album: "Future Nostalgia",
    thumbnailUrl: null,
    duration: "3:23",
    year: "2020",
    kind: "song",
    subtitle: "Dua Lipa · Future Nostalgia",
    trailingLabel: "3:23",
  },
  {
    id: "random-access-memories",
    sourceId: null,
    isPlayable: false,
    title: "Random Access Memories",
    artist: "Daft Punk",
    album: "Album",
    thumbnailUrl: null,
    duration: "--:--",
    year: "2013",
    kind: "album",
    subtitle: "Daft Punk · 2013",
    trailingLabel: "ALBUM",
  },
];

const INITIAL_QUEUE: MediaItem[] = [];

const INITIAL_PLAYER_SNAPSHOT: PlayerSnapshot = {
  backendStatus: "idle",
  backendMessage: null,
  currentItemId: null,
  idleActive: true,
  paused: true,
  volume: 68,
  positionSeconds: 0,
  durationSeconds: null,
};

export function clampIndex(index: number, length: number): number {
  if (length === 0) {
    return 0;
  }

  return Math.max(0, Math.min(index, length - 1));
}

export function ensureQueuedItem(queueItems: MediaItem[], item: MediaItem) {
  const existingIndex = queueItems.findIndex((queueItem) => queueItem.id === item.id);

  if (existingIndex >= 0) {
    return { items: queueItems, index: existingIndex };
  }

  return {
    items: [...queueItems, item],
    index: queueItems.length,
  };
}

export function removeQueuedItem(
  queueItems: MediaItem[],
  currentIndex: number,
  selectedIndex: number,
  removeIndex: number,
) {
  const items = queueItems.filter((_, index) => index !== removeIndex);

  if (items.length === 0) {
    return {
      items,
      currentIndex: 0,
      selectedIndex: 0,
    };
  }

  const nextCurrentIndex = removeIndex < currentIndex
    ? currentIndex - 1
    : removeIndex === currentIndex
      ? Math.min(removeIndex, items.length - 1)
      : currentIndex;
  const nextSelectedIndex = removeIndex < selectedIndex
    ? selectedIndex - 1
    : removeIndex === selectedIndex
      ? Math.min(removeIndex, items.length - 1)
      : selectedIndex;

  return {
    items,
    currentIndex: clampIndex(nextCurrentIndex, items.length),
    selectedIndex: clampIndex(nextSelectedIndex, items.length),
  };
}

export function getPlaybackDurationLabel(item: MediaItem) {
  return item.isPlayable ? item.duration : "--:--";
}

export function pushSearchHistoryEntry(searchHistory: string[], query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return searchHistory;
  }

  return [normalizedQuery, ...searchHistory.filter((entry) => entry.toLowerCase() !== normalizedQuery.toLowerCase())]
    .slice(0, MAX_SEARCH_HISTORY);
}

export function pushRecentTrackEntry(recentTracks: RecentTrackEntry[], track: RecentTrackEntry) {
  const trackKey = `${track.title}\u0000${track.artist}\u0000${track.album}`.toLowerCase();

  return [track, ...recentTracks.filter((entry) => {
    const entryKey = `${entry.title}\u0000${entry.artist}\u0000${entry.album}`.toLowerCase();
    return entryKey !== trackKey;
  })].slice(0, MAX_RECENT_TRACKS);
}

export function formatPlaybackTime(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "--:--";
  }

  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function parseDurationLabel(label: string) {
  const trimmedLabel = label.trim();

  if (!trimmedLabel || trimmedLabel === "--:--") {
    return null;
  }

  const segments = trimmedLabel.split(":").map((segment) => Number.parseInt(segment, 10));

  if (segments.length < 2 || segments.some((segment) => Number.isNaN(segment))) {
    return null;
  }

  return segments.reduce((total, segment) => total * 60 + segment, 0);
}

export function createLyricsTrackKey(item: MediaItem, durationSeconds: number | null) {
  return [
    item.id,
    item.title.trim().toLowerCase(),
    item.artist.trim().toLowerCase(),
    item.album.trim().toLowerCase(),
    durationSeconds ?? "unknown",
  ].join("::");
}

export function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown application error.";
}

const initialState: AppState = {
  cover: {
    bytesPerRow: null,
    cachedPath: null,
    message: "Waiting for cover art.",
    pixelData: null,
    pixelHeight: null,
    pixelWidth: null,
    rows: null,
    status: "idle",
  },
  session: createGuestSessionState(),
  search: {
    context: null,
    query: "",
    results: [],
    retryToken: 0,
    selectedIndex: 0,
    error: null,
    isLoading: false,
  },
  player: {
    backendStatus: INITIAL_PLAYER_SNAPSHOT.backendStatus,
    backendMessage: INITIAL_PLAYER_SNAPSHOT.backendMessage,
    currentItemId: INITIAL_PLAYER_SNAPSHOT.currentItemId,
    paused: INITIAL_PLAYER_SNAPSHOT.paused,
    positionSeconds: INITIAL_PLAYER_SNAPSHOT.positionSeconds,
    positionLabel: formatPlaybackTime(INITIAL_PLAYER_SNAPSHOT.positionSeconds),
    durationSeconds: INITIAL_PLAYER_SNAPSHOT.durationSeconds,
    durationLabel: formatPlaybackTime(INITIAL_PLAYER_SNAPSHOT.durationSeconds),
    volume: INITIAL_PLAYER_SNAPSHOT.volume,
  },
  lyrics: {
    lines: [],
    message: "Queue a track to load lyrics.",
    retryToken: 0,
    source: null,
    status: "idle",
    trackKey: null,
  },
  history: {
    hydrated: false,
    recentTracks: [],
    searchHistory: [],
  },
  preferences: {
    hydrated: false,
    keybindings: resolveShortcutConfig(null),
    theme: null,
  },
  queue: {
    items: INITIAL_QUEUE,
    currentIndex: 0,
    selectedIndex: 0,
  },
  ui: {
    activeScreen: "search",
    focusedPane: DEFAULT_PANE_BY_SCREEN.search,
    graphicsEnabled: false,
    graphicsMessage: "Checking cover-art support…",
    helpOpen: false,
    lyricsOpen: false,
    authImportOpen: false,
    authCookieDraft: "",
    notifications: [],
    status: "Phase 7 shell ready. Local history and preferences load on startup.",
  },
};

export function createInitialAppState(): AppState {
  return structuredClone(initialState);
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "setGraphicsSupport": {
      return {
        ...state,
        ui: {
          ...state.ui,
          graphicsEnabled: action.enabled,
          graphicsMessage: action.message,
        },
      };
    }
    case "setActiveScreen": {
      return {
        ...state,
        ui: {
          ...state.ui,
          activeScreen: action.screen,
          focusedPane: action.focusedPane ?? DEFAULT_PANE_BY_SCREEN[action.screen],
          status:
            action.screen === "search"
              ? "Search screen active. Type to search YouTube Music."
              : "Now playing screen active. Queue and transport are interactive.",
        },
      };
    }
    case "setFocusedPane": {
      return {
        ...state,
        ui: {
          ...state.ui,
          focusedPane: action.pane,
        },
      };
    }
    case "toggleHelp": {
      return {
        ...state,
        ui: {
          ...state.ui,
          helpOpen: !state.ui.helpOpen,
          status: state.ui.helpOpen ? state.ui.status : "Command help open.",
        },
      };
    }
    case "toggleLyrics": {
      return {
        ...state,
        ui: {
          ...state.ui,
          lyricsOpen: !state.ui.lyricsOpen,
          status: state.ui.lyricsOpen ? state.ui.status : "Lyrics window open.",
        },
      };
    }
    case "openAuthImport": {
      return {
        ...state,
        ui: {
          ...state.ui,
          authImportOpen: true,
          status: "Paste a YouTube cookie header and save it locally.",
        },
      };
    }
    case "closeAuthImport": {
      return {
        ...state,
        ui: {
          ...state.ui,
          authImportOpen: false,
        },
      };
    }
    case "setAuthCookieDraft": {
      return {
        ...state,
        ui: {
          ...state.ui,
          authCookieDraft: action.value,
        },
      };
    }
    case "setSessionState": {
      return {
        ...state,
        session: action.session,
        ui: {
          ...state.ui,
          authImportOpen: action.session.mode === "authenticated" ? false : state.ui.authImportOpen,
          authCookieDraft: action.session.mode === "authenticated" ? "" : state.ui.authCookieDraft,
        },
      };
    }
    case "startSessionRestore": {
      return {
        ...state,
        session: createRestoringSessionState(),
        ui: {
          ...state.ui,
          status: "Restoring authenticated session…",
        },
      };
    }
    case "closeOverlays": {
      return {
        ...state,
        ui: {
          ...state.ui,
          helpOpen: false,
          lyricsOpen: false,
          authImportOpen: false,
          status: "Overlay closed.",
        },
      };
    }
    case "hydratePreferences": {
      return {
        ...state,
        preferences: {
          hydrated: true,
          keybindings: action.keybindings,
          theme: action.theme,
        },
      };
    }
    case "hydrateActivity": {
      return {
        ...state,
        history: {
          hydrated: true,
          recentTracks: action.recentTracks,
          searchHistory: action.searchHistory,
        },
      };
    }
    case "setSearchQuery": {
      return {
        ...state,
        search: {
          ...state.search,
          context: null,
          query: action.query,
          retryToken: 0,
          selectedIndex: 0,
          error: null,
        },
        ui: {
          ...state.ui,
          status: action.query.trim()
            ? `Queued YouTube Music search for "${action.query.trim()}".`
            : "Type a query to search YouTube Music.",
        },
      };
    }
    case "retrySearch": {
      return {
        ...state,
        search: {
          ...state.search,
          retryToken: state.search.retryToken + 1,
          error: null,
          isLoading: true,
        },
        ui: {
          ...state.ui,
          status: state.search.query.trim()
            ? `Retrying search for "${state.search.query.trim()}"…`
            : state.ui.status,
        },
      };
    }
    case "startSearchRequest": {
      return {
        ...state,
        search: {
          ...state.search,
          context: null,
          error: null,
          isLoading: true,
          retryToken: 0,
        },
        ui: {
          ...state.ui,
          status: `Searching YouTube Music for "${action.query}"…`,
        },
      };
    }
    case "openAlbumResults": {
      return {
        ...state,
        search: {
          ...state.search,
          context: {
            mode: "album",
            title: action.album.title,
            subtitle: action.album.subtitle,
            previousResults: state.search.results,
            previousSelectedIndex: state.search.selectedIndex,
          },
          results: action.tracks,
          retryToken: 0,
          selectedIndex: 0,
          error: null,
          isLoading: false,
        },
        ui: {
          ...state.ui,
          status: `Opened ${action.album.title}.`,
        },
      };
    }
    case "resolveSearchRequest": {
      return {
        ...state,
        search: {
          ...state.search,
          context: null,
          results: action.results,
          retryToken: 0,
          selectedIndex: 0,
          error: null,
          isLoading: false,
        },
        ui: {
          ...state.ui,
          status: action.results.length > 0
            ? `Found ${action.results.length} YouTube Music results for "${action.query}".`
            : `No YouTube Music results for "${action.query}".`,
        },
      };
    }
    case "rejectSearchRequest": {
      return {
        ...state,
        search: {
          ...state.search,
          context: null,
          results: [],
          retryToken: 0,
          selectedIndex: 0,
          error: action.error,
          isLoading: false,
        },
        ui: {
          ...state.ui,
          status: `Search failed for "${action.query}".`,
        },
      };
    }
    case "returnToSearchResults": {
      if (!state.search.context) {
        return state;
      }

      return {
        ...state,
        search: {
          ...state.search,
          context: null,
          results: state.search.context.previousResults,
          retryToken: 0,
          selectedIndex: clampIndex(
            state.search.context.previousSelectedIndex,
            state.search.context.previousResults.length,
          ),
          error: null,
          isLoading: false,
        },
        ui: {
          ...state.ui,
          status: `Returned to results for "${state.search.query}".`,
        },
      };
    }
    case "clearSearchResults": {
      return {
        ...state,
        search: {
          ...state.search,
          context: null,
          results: [],
          retryToken: 0,
          selectedIndex: 0,
          error: null,
          isLoading: false,
        },
        ui: {
          ...state.ui,
          status: "Type a query to search YouTube Music.",
        },
      };
    }
    case "recordSearchHistory": {
      return {
        ...state,
        history: {
          ...state.history,
          searchHistory: pushSearchHistoryEntry(state.history.searchHistory, action.query),
        },
      };
    }
    case "syncPlayerSnapshot": {
      return {
        ...state,
        player: {
          ...state.player,
          backendStatus: action.snapshot.backendStatus,
          backendMessage: action.snapshot.backendMessage,
          currentItemId: action.snapshot.currentItemId,
          paused: action.snapshot.paused,
          positionSeconds: action.snapshot.positionSeconds,
          positionLabel: formatPlaybackTime(action.snapshot.positionSeconds),
          durationSeconds: action.snapshot.durationSeconds,
          durationLabel: formatPlaybackTime(action.snapshot.durationSeconds),
          volume: action.snapshot.volume,
        },
      };
    }
    case "startCoverLoad": {
      return {
        ...state,
        cover: {
          ...state.cover,
          message: `Loading cover art for ${action.title}…`,
          rows: null,
          status: "loading",
        },
      };
    }
    case "resolveCoverLoad": {
      return {
        ...state,
        cover: {
          bytesPerRow: action.cover.bytesPerRow,
          cachedPath: action.cover.cachedPath,
          message: "Cover art ready.",
          pixelData: action.cover.pixelData,
          pixelHeight: action.cover.pixelHeight,
          pixelWidth: action.cover.pixelWidth,
          rows: action.cover.rows,
          status: "ready",
        },
      };
    }
    case "disableCoverArt": {
      return {
        ...state,
        cover: {
          bytesPerRow: null,
          cachedPath: null,
          message: action.message,
          pixelData: null,
          pixelHeight: null,
          pixelWidth: null,
          rows: null,
          status: "disabled",
        },
      };
    }
    case "rejectCoverLoad": {
      return {
        ...state,
        cover: {
          bytesPerRow: null,
          cachedPath: null,
          message: action.error,
          pixelData: null,
          pixelHeight: null,
          pixelWidth: null,
          rows: null,
          status: "error",
        },
      };
    }
    case "resetLyrics": {
      return {
        ...state,
        lyrics: {
          lines: [],
          message: action.message,
          retryToken: 0,
          source: null,
          status: "idle",
          trackKey: null,
        },
      };
    }
    case "retryLyrics": {
      return {
        ...state,
        lyrics: {
          ...state.lyrics,
          retryToken: state.lyrics.retryToken + 1,
        },
        ui: {
          ...state.ui,
          status: "Retrying lyrics lookup…",
        },
      };
    }
    case "startLyricsLoad": {
      return {
        ...state,
        lyrics: {
          lines: [],
          message: `Loading lyrics for ${action.title}…`,
          retryToken: 0,
          source: null,
          status: "loading",
          trackKey: action.trackKey,
        },
      };
    }
    case "resolveLyricsLoad": {
      if (state.lyrics.trackKey !== action.trackKey) {
        return state;
      }

      return {
        ...state,
        lyrics: {
          lines: action.lyrics.text
            .split(/\r?\n/)
            .map((line) => line.trimEnd())
            .filter((line, index, lines) => line.length > 0 || index === 0 || lines[index - 1] !== ""),
          message: `Lyrics ready from ${action.lyrics.source}.`,
          retryToken: 0,
          source: action.lyrics.source,
          status: "ready",
          trackKey: action.trackKey,
        },
      };
    }
    case "missLyrics": {
      if (state.lyrics.trackKey !== action.trackKey) {
        return state;
      }

      return {
        ...state,
        lyrics: {
          lines: [],
          message: action.message,
          retryToken: 0,
          source: null,
          status: "not-found",
          trackKey: action.trackKey,
        },
      };
    }
    case "rejectLyricsLoad": {
      if (state.lyrics.trackKey !== action.trackKey) {
        return state;
      }

      return {
        ...state,
        lyrics: {
          lines: [],
          message: action.error,
          retryToken: 0,
          source: null,
          status: "error",
          trackKey: action.trackKey,
        },
      };
    }
    case "recordRecentTrack": {
      return {
        ...state,
        history: {
          ...state.history,
          recentTracks: pushRecentTrackEntry(state.history.recentTracks, action.track),
        },
      };
    }
    case "selectResult": {
      return {
        ...state,
        search: {
          ...state.search,
          selectedIndex: clampIndex(action.index, state.search.results.length),
        },
        ui: {
          ...state.ui,
          focusedPane: "results",
        },
      };
    }
    case "moveResultSelection": {
      return {
        ...state,
        search: {
          ...state.search,
          selectedIndex: clampIndex(
            state.search.selectedIndex + action.delta,
            state.search.results.length,
          ),
        },
      };
    }
    case "activateResult": {
      const index = clampIndex(
        action.index ?? state.search.selectedIndex,
        state.search.results.length,
      );
      const selectedItem = state.search.results[index];

      if (!selectedItem) {
        return state;
      }

      if (!selectedItem.isPlayable) {
        return {
          ...state,
          ui: {
            ...state.ui,
            status: `${selectedItem.kind} results are browse-only for now. Pick a track to play it.`,
          },
        };
      }

      const nextQueue = ensureQueuedItem(state.queue.items, selectedItem);

      return {
        ...state,
        queue: {
          items: nextQueue.items,
          currentIndex: nextQueue.index,
          selectedIndex: nextQueue.index,
        },
        ui: {
          ...state.ui,
          status: `Loaded ${selectedItem.title} into the queue shell.`,
        },
      };
    }
    case "enqueueResult": {
      const index = clampIndex(
        action.index ?? state.search.selectedIndex,
        state.search.results.length,
      );
      const selectedItem = state.search.results[index];

      if (!selectedItem) {
        return state;
      }

      if (!selectedItem.isPlayable) {
        return {
          ...state,
          ui: {
            ...state.ui,
            status: `${selectedItem.kind} results are browse-only for now. Pick a track to queue it.`,
          },
        };
      }

      const existingIndex = state.queue.items.findIndex((queueItem) => queueItem.id === selectedItem.id);
      const nextQueue = ensureQueuedItem(state.queue.items, selectedItem);

      return {
        ...state,
        queue: {
          ...state.queue,
          items: nextQueue.items,
          selectedIndex: nextQueue.index,
        },
        ui: {
          ...state.ui,
          status: existingIndex >= 0
            ? `${selectedItem.title} is already in the queue.`
            : `Queued "${selectedItem.title}".`,
        },
      };
    }
    case "selectQueueIndex": {
      return {
        ...state,
        queue: {
          ...state.queue,
          selectedIndex: clampIndex(action.index, state.queue.items.length),
        },
        ui: {
          ...state.ui,
          focusedPane: "queue",
        },
      };
    }
    case "moveQueueSelection": {
      return {
        ...state,
        queue: {
          ...state.queue,
          selectedIndex: clampIndex(
            state.queue.selectedIndex + action.delta,
            state.queue.items.length,
          ),
        },
      };
    }
    case "playQueueIndex": {
      const nextIndex = clampIndex(
        action.index ?? state.queue.selectedIndex,
        state.queue.items.length,
      );
      const queuedItem = state.queue.items[nextIndex];

      if (!queuedItem) {
        return state;
      }

      return {
        ...state,
        queue: {
          ...state.queue,
          currentIndex: nextIndex,
          selectedIndex: nextIndex,
        },
        ui: {
          ...state.ui,
          status: `Queue jumped to ${queuedItem.title}.`,
        },
      };
    }
    case "removeQueueIndex": {
      return {
        ...state,
        queue: removeQueuedItem(
          state.queue.items,
          state.queue.currentIndex,
          state.queue.selectedIndex,
          action.index,
        ),
      };
    }
    case "clearQueue": {
      return {
        ...state,
        queue: {
          items: [],
          currentIndex: 0,
          selectedIndex: 0,
        },
        player: {
          ...state.player,
          currentItemId: null,
          paused: true,
          positionSeconds: 0,
          positionLabel: "0:00",
          durationSeconds: null,
          durationLabel: "--:--",
        },
      };
    }
    case "finishQueuePlayback": {
      return {
        ...state,
        player: {
          ...state.player,
          currentItemId: null,
          paused: true,
          positionSeconds: 0,
          positionLabel: "0:00",
        },
      };
    }
    case "togglePause": {
      return {
        ...state,
        player: {
          ...state.player,
          paused: !state.player.paused,
        },
        ui: {
          ...state.ui,
          status: state.player.paused ? "Playback resumed." : "Playback paused.",
        },
      };
    }
    case "playNext": {
      return appReducer(state, {
        type: "playQueueIndex",
        index: clampIndex(state.queue.currentIndex + 1, state.queue.items.length),
      });
    }
    case "playPrevious": {
      return appReducer(state, {
        type: "playQueueIndex",
        index: clampIndex(state.queue.currentIndex - 1, state.queue.items.length),
      });
    }
    case "pushNotification": {
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: [action.notification, ...state.ui.notifications]
            .slice(0, MAX_NOTIFICATIONS),
        },
      };
    }
    case "dismissNotification": {
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.filter((notification) => notification.id !== action.id),
        },
      };
    }
    case "setStatus": {
      return {
        ...state,
        ui: {
          ...state.ui,
          status: action.status,
        },
      };
    }
    default: {
      return state;
    }
  }
}

export function getCurrentTrack(state: AppState): MediaItem {
  return state.queue.items[state.queue.currentIndex] ?? MEDIA_LIBRARY[0]!;
}

export interface AppStoreContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  activateResult: (index?: number) => Promise<void>;
  adjustVolume: (delta: number) => Promise<void>;
  returnToSearchResults: () => void;
  clearQueue: () => Promise<void>;
  enqueueResult: (index?: number) => Promise<void>;
  importAuthCookie: (cookie: string) => Promise<void>;
  nextTrack: () => Promise<void>;
  playQueueIndex: (index?: number) => Promise<void>;
  previousTrack: () => Promise<void>;
  removeQueueIndex: (index?: number) => Promise<void>;
  restoreSession: () => Promise<void>;
  retryLyrics: () => void;
  retrySearch: () => void;
  runSearchQuery: (query: string) => void;
  seekPlayback: (seconds: number) => Promise<void>;
  signOut: () => Promise<void>;
  togglePause: () => Promise<void>;
}

export const AppStoreContext = createContext<AppStoreContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const renderer = useRenderer();
  const [activityStorage] = useState(() => createActivityStorageService());
  const [authService] = useState(() => createAuthService());
  const [coverRenderer] = useState(() => createTerminalCoverRenderer());
  const [lyricsProvider] = useState(() => createLrclibLyricsProvider());
  const [musicProvider] = useState(() =>
    createYoutubeMusicProvider({
      getActiveClient: () => authService.getActiveClient(),
    }),
  );
  const [playerService] = useState(() => createMpvPlayerService());
  const [preferencesStorage] = useState(() => createPreferencesStorageService());
  const [state, dispatch] = useReducer(appReducer, initialState);
  const latestStateRef = useRef(state);
  const latestLoadPlaybackItemRef = useRef(loadPlaybackItem);
  const notificationTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const previousPlayerSnapshotRef = useRef(INITIAL_PLAYER_SNAPSHOT);
  const coverRequestIdRef = useRef(0);
  const lyricsRequestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);
  const currentTrack = getCurrentTrack(state);

  latestStateRef.current = state;
  latestLoadPlaybackItemRef.current = loadPlaybackItem;

  function pushNotification(
    message: string,
    level: NotificationLevel = "info",
    sticky = false,
  ) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    dispatch({
      type: "pushNotification",
      notification: {
        id,
        level,
        message,
      },
    });

    if (sticky) {
      return;
    }

    const timeoutId = setTimeout(() => {
      dispatch({ type: "dismissNotification", id });
      notificationTimeoutsRef.current.delete(id);
    }, level === "error" ? ERROR_NOTIFICATION_TIMEOUT_MS : NOTIFICATION_TIMEOUT_MS);

    notificationTimeoutsRef.current.set(id, timeoutId);
  }

  function updateStatus(
    status: string,
    notification?: { level: NotificationLevel; sticky?: boolean },
  ) {
    dispatch({ type: "setStatus", status });

    if (notification) {
      pushNotification(status, notification.level, notification.sticky);
    }
  }

  async function loadPlaybackItem(item: MediaItem, successMessage: string) {
    updateStatus(`Resolving playback for ${item.title}…`);

    try {
      const source = await musicProvider.resolvePlayback(item);
      await playerService.load(source);
      dispatch({
        type: "recordRecentTrack",
        track: {
          album: item.album,
          artist: item.artist,
          playedAt: new Date().toISOString(),
          title: item.title,
        },
      });
      updateStatus(successMessage);
    } catch (error) {
      updateStatus(`Playback failed for ${item.title}. ${toErrorMessage(error)}`, {
        level: "error",
        sticky: true,
      });
    }
  }

  async function restoreSession() {
    dispatch({ type: "startSessionRestore" });
    const result = await authService.restoreSession();
    dispatch({ type: "setSessionState", session: result.session });
    updateStatus(result.message, result.session.mode === "error"
      ? { level: "error", sticky: true }
      : undefined);
  }

  async function importAuthCookie(cookie: string) {
    dispatch({ type: "startSessionRestore" });
    const result = await authService.importCookie(cookie);
    dispatch({ type: "setSessionState", session: result.session });
    updateStatus(result.message, result.session.mode === "error"
      ? { level: "error", sticky: true }
      : { level: "success" });
  }

  async function signOut() {
    const result = await authService.signOut();
    dispatch({ type: "setSessionState", session: result.session });
    updateStatus(result.message, { level: "info" });
  }

  async function activateResult(index?: number) {
    const currentState = latestStateRef.current;
    const nextIndex = clampIndex(
      index ?? currentState.search.selectedIndex,
      currentState.search.results.length,
    );
    const selectedItem = currentState.search.results[nextIndex];

    if (!selectedItem) {
      return;
    }

    if (selectedItem.kind === "album") {
      updateStatus(`Loading ${selectedItem.title}…`);

      try {
        const tracks = await musicProvider.browseAlbum(selectedItem);

        if (tracks.length === 0) {
          updateStatus(`${selectedItem.title} has no playable tracks.`);
          return;
        }

        dispatch({ type: "openAlbumResults", album: selectedItem, tracks });
      } catch (error) {
        updateStatus(`Album load failed. ${toErrorMessage(error)}`, {
          level: "error",
          sticky: true,
        });
      }

      return;
    }

    if (!selectedItem.isPlayable) {
      updateStatus(`${selectedItem.kind} results are browse-only for now. Pick a track to play it.`);
      return;
    }

    dispatch({ type: "activateResult", index: nextIndex });
    await loadPlaybackItem(selectedItem, `Playing ${selectedItem.title}.`);
  }

  async function enqueueResult(index?: number) {
    const currentState = latestStateRef.current;
    const nextIndex = clampIndex(
      index ?? currentState.search.selectedIndex,
      currentState.search.results.length,
    );
    const selectedItem = currentState.search.results[nextIndex];

    if (!selectedItem) {
      return;
    }

    dispatch({ type: "enqueueResult", index: nextIndex });
  }

  function returnToSearchResults() {
    dispatch({ type: "returnToSearchResults" });
  }

  function retrySearch() {
    const query = latestStateRef.current.search.query.trim();

    if (!query) {
      return;
    }

    dispatch({ type: "retrySearch" });
  }

  function runSearchQuery(query: string) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    if (latestStateRef.current.search.query.trim().toLowerCase() === normalizedQuery.toLowerCase()) {
      retrySearch();
      return;
    }

    dispatch({ type: "setSearchQuery", query: normalizedQuery });
    dispatch({ type: "setFocusedPane", pane: "results" });
  }

  function retryLyrics() {
    if (latestStateRef.current.queue.items.length === 0) {
      return;
    }

    dispatch({ type: "retryLyrics" });
  }

  async function playQueueIndex(index?: number) {
    const currentState = latestStateRef.current;
    const nextIndex = clampIndex(
      index ?? currentState.queue.selectedIndex,
      currentState.queue.items.length,
    );
    const queuedItem = currentState.queue.items[nextIndex];

    if (!queuedItem) {
      return;
    }

    dispatch({ type: "playQueueIndex", index: nextIndex });
    await loadPlaybackItem(queuedItem, `Playing ${queuedItem.title}.`);
  }

  async function togglePause() {
    const currentState = latestStateRef.current;

    try {
      await playerService.togglePause();
      updateStatus(currentState.player.paused ? "Playback resumed." : "Playback paused.");
    } catch (error) {
      updateStatus(`Playback toggle failed. ${toErrorMessage(error)}`, {
        level: "error",
        sticky: true,
      });
    }
  }

  async function nextTrack() {
    const currentState = latestStateRef.current;

    if (currentState.queue.items.length === 0) {
      return;
    }

    const nextIndex = currentState.queue.currentIndex + 1;

    if (nextIndex >= currentState.queue.items.length) {
      updateStatus("Already at the end of the queue.");
      return;
    }

    await playQueueIndex(nextIndex);
  }

  async function previousTrack() {
    const currentState = latestStateRef.current;

    if (currentState.queue.items.length === 0) {
      return;
    }

    const nextIndex = currentState.queue.currentIndex - 1;

    if (nextIndex < 0) {
      updateStatus("Already at the start of the queue.");
      return;
    }

    await playQueueIndex(nextIndex);
  }

  async function seekPlayback(seconds: number) {
    try {
      await playerService.seekBy(seconds);
      updateStatus(`${seconds < 0 ? "Seeked backward" : "Seeked forward"} ${Math.abs(seconds)}s.`);
    } catch (error) {
      updateStatus(`Seek failed. ${toErrorMessage(error)}`, {
        level: "error",
        sticky: true,
      });
    }
  }

  async function adjustVolume(delta: number) {
    const currentState = latestStateRef.current;
    const nextVolume = Math.max(0, Math.min(100, currentState.player.volume + delta));

    try {
      await playerService.setVolume(nextVolume);
      updateStatus(`Volume ${nextVolume}%.`);
    } catch (error) {
      updateStatus(`Volume update failed. ${toErrorMessage(error)}`, {
        level: "error",
        sticky: true,
      });
    }
  }

  async function clearQueue() {
    dispatch({ type: "clearQueue" });

    try {
      await playerService.clear();
      updateStatus("Queue cleared.");
    } catch (error) {
      updateStatus(`Queue clear failed. ${toErrorMessage(error)}`, {
        level: "error",
        sticky: true,
      });
    }
  }

  async function removeQueueIndex(index?: number) {
    const currentState = latestStateRef.current;
    const removeIndex = clampIndex(
      index ?? currentState.queue.selectedIndex,
      currentState.queue.items.length,
    );
    const removedItem = currentState.queue.items[removeIndex];

    if (!removedItem) {
      return;
    }

    const nextQueue = removeQueuedItem(
      currentState.queue.items,
      currentState.queue.currentIndex,
      currentState.queue.selectedIndex,
      removeIndex,
    );

    dispatch({ type: "removeQueueIndex", index: removeIndex });

    if (nextQueue.items.length === 0) {
      try {
        await playerService.clear();
      } catch {
        // The queue state has already been cleared; keep the UI moving.
      }

      updateStatus(`Removed ${removedItem.title}. Queue is empty.`);
      return;
    }

    if (removeIndex === currentState.queue.currentIndex) {
      await loadPlaybackItem(
        nextQueue.items[nextQueue.currentIndex]!,
        `Removed ${removedItem.title}. Now playing ${nextQueue.items[nextQueue.currentIndex]!.title}.`,
      );
      return;
    }

    updateStatus(`Removed ${removedItem.title} from the queue.`);
  }

  useEffect(() => {
    return () => {
      for (const timeoutId of notificationTimeoutsRef.current.values()) {
        clearTimeout(timeoutId);
      }

      notificationTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    let active = true;

    void Promise.allSettled([preferencesStorage.read(), activityStorage.read()])
      .then(([storedPreferences, storedActivity]) => {
        if (!active) {
          return;
        }

        const keybindings = storedPreferences.status === "fulfilled"
          ? resolveShortcutConfig(sanitizeShortcutConfig(storedPreferences.value?.keybindings))
          : resolveShortcutConfig(null);
        const themeOverrides = storedPreferences.status === "fulfilled"
          ? sanitizeThemeOverrides(storedPreferences.value?.theme ?? null)
          : null;
        const recentTracks = storedActivity.status === "fulfilled"
          ? (storedActivity.value?.recentTracks ?? [])
          : [];
        const searchHistory = storedActivity.status === "fulfilled"
          ? (storedActivity.value?.searchHistory ?? [])
          : [];

        applyThemeOverrides(themeOverrides);
        dispatch({ type: "hydratePreferences", keybindings, theme: themeOverrides });
        dispatch({ type: "hydrateActivity", recentTracks, searchHistory });

        if (storedPreferences.status === "rejected") {
          updateStatus(`Preferences failed to load. ${toErrorMessage(storedPreferences.reason)}`, {
            level: "error",
            sticky: true,
          });
        }

        if (storedActivity.status === "rejected") {
          updateStatus(`Local activity failed to load. ${toErrorMessage(storedActivity.reason)}`, {
            level: "error",
            sticky: true,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [activityStorage, preferencesStorage]);

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (!state.preferences.hydrated) {
      return;
    }

    applyThemeOverrides(state.preferences.theme);

    void preferencesStorage.write({
      keybindings: state.preferences.keybindings,
      theme: state.preferences.theme,
    }).catch((error) => {
      updateStatus(`Preferences save failed. ${toErrorMessage(error)}`, {
        level: "error",
        sticky: true,
      });
    });
  }, [preferencesStorage, state.preferences.hydrated, state.preferences.keybindings, state.preferences.theme]);

  useEffect(() => {
    if (!state.history.hydrated) {
      return;
    }

    void activityStorage.write({
      recentTracks: state.history.recentTracks.map<StoredRecentTrack>((track) => ({
        album: track.album,
        artist: track.artist,
        playedAt: track.playedAt,
        title: track.title,
      })),
      searchHistory: state.history.searchHistory,
    }).catch((error) => {
      updateStatus(`Local activity save failed. ${toErrorMessage(error)}`, {
        level: "error",
        sticky: true,
      });
    });
  }, [activityStorage, state.history.hydrated, state.history.recentTracks, state.history.searchHistory]);

  useEffect(() => {
    const capabilities = renderer.capabilities as
      | { kitty_graphics?: boolean; rgb?: boolean }
      | null;
    const graphicsDisabled = process.env.OPENTUI_NO_GRAPHICS === "true";
    const supportsGraphics = !graphicsDisabled && Boolean(capabilities?.kitty_graphics || capabilities?.rgb);
    const message = graphicsDisabled
      ? "Cover art disabled by OPENTUI_NO_GRAPHICS."
      : supportsGraphics
        ? capabilities?.kitty_graphics
          ? "Cover art enabled for this terminal."
          : "Cover art enabled in RGB preview mode."
        : "Terminal graphics are unavailable here.";

    dispatch({ type: "setGraphicsSupport", enabled: supportsGraphics, message });
  }, [renderer]);

  useEffect(() => {
    coverRequestIdRef.current += 1;
    const requestId = coverRequestIdRef.current;

    if (!state.ui.graphicsEnabled) {
      void createDisabledCoverRenderer(state.ui.graphicsMessage)
        .render({ sourceUrl: currentTrack.thumbnailUrl ?? "", title: currentTrack.title })
        .catch((error) => {
          if (requestId !== coverRequestIdRef.current) {
            return;
          }

          dispatch({ type: "disableCoverArt", message: toErrorMessage(error) });
        });
      return;
    }

    if (!currentTrack.thumbnailUrl) {
      dispatch({
        type: "disableCoverArt",
        message:
          state.queue.items.length === 0
            ? "Queue a track to load cover art."
            : "Cover art unavailable for this track.",
      });
      return;
    }

    dispatch({ type: "startCoverLoad", title: currentTrack.title });

    void coverRenderer
      .render({ sourceUrl: currentTrack.thumbnailUrl, title: currentTrack.title })
      .then((cover) => {
        if (requestId !== coverRequestIdRef.current) {
          return;
        }

        dispatch({ type: "resolveCoverLoad", cover });
      })
      .catch((error) => {
        if (requestId !== coverRequestIdRef.current) {
          return;
        }

        dispatch({
          type: "rejectCoverLoad",
          error: `Cover art failed. ${toErrorMessage(error)}`,
        });
        pushNotification(`Cover art failed. ${toErrorMessage(error)}`, "error");
      });
  }, [
    coverRenderer,
    currentTrack.id,
    currentTrack.thumbnailUrl,
    currentTrack.title,
    state.queue.items.length,
    state.ui.graphicsEnabled,
    state.ui.graphicsMessage,
  ]);

  useEffect(() => {
    lyricsRequestIdRef.current += 1;
    const requestId = lyricsRequestIdRef.current;

    if (state.queue.items.length === 0) {
      dispatch({ type: "resetLyrics", message: "Queue a track to load lyrics." });
      return;
    }

    const durationSeconds = state.player.currentItemId === currentTrack.id && state.player.durationSeconds
      ? state.player.durationSeconds
      : parseDurationLabel(currentTrack.duration);
    const trackKey = createLyricsTrackKey(currentTrack, durationSeconds);

    if (state.lyrics.trackKey === trackKey && state.lyrics.retryToken === 0) {
      return;
    }

    dispatch({ type: "startLyricsLoad", trackKey, title: currentTrack.title });

    void lyricsProvider
      .getLyrics({
        album: currentTrack.album,
        artist: currentTrack.artist,
        durationSeconds,
        title: currentTrack.title,
      })
      .then((lyrics) => {
        if (requestId !== lyricsRequestIdRef.current) {
          return;
        }

        if (!lyrics) {
          dispatch({
            type: "missLyrics",
            trackKey,
            message: `Lyrics unavailable for ${currentTrack.title}.`,
          });
          return;
        }

        dispatch({ type: "resolveLyricsLoad", trackKey, lyrics });
      })
      .catch((error) => {
        if (requestId !== lyricsRequestIdRef.current) {
          return;
        }

        dispatch({
          type: "rejectLyricsLoad",
          trackKey,
          error: `Lyrics lookup failed. ${toErrorMessage(error)}`,
        });
        pushNotification(`Lyrics lookup failed. ${toErrorMessage(error)}`, "error");
      });
  }, [
    currentTrack.album,
    currentTrack.artist,
    currentTrack.duration,
    currentTrack.id,
    currentTrack.title,
    lyricsProvider,
    state.lyrics.retryToken,
    state.player.currentItemId,
    state.player.durationSeconds,
    state.queue.items.length,
  ]);

  useEffect(() => {
    const unsubscribe = playerService.subscribe((snapshot) => {
      const previousSnapshot = previousPlayerSnapshotRef.current;
      previousPlayerSnapshotRef.current = snapshot;

      dispatch({ type: "syncPlayerSnapshot", snapshot });

      const currentState = latestStateRef.current;
      const currentQueueItem = currentState.queue.items[currentState.queue.currentIndex] ?? null;
      const reachedIdleAfterPlayback =
        previousSnapshot.currentItemId !== null &&
        previousSnapshot.currentItemId === snapshot.currentItemId &&
        !previousSnapshot.idleActive &&
        snapshot.idleActive &&
        previousSnapshot.positionSeconds > 0 &&
        currentQueueItem?.id === snapshot.currentItemId;

      if (!reachedIdleAfterPlayback) {
        return;
      }

      const nextIndex = currentState.queue.currentIndex + 1;
      const nextItem = currentState.queue.items[nextIndex];

      if (!nextItem) {
        dispatch({ type: "finishQueuePlayback" });
        updateStatus("Reached the end of the queue.");
        return;
      }

      dispatch({ type: "playQueueIndex", index: nextIndex });
      void latestLoadPlaybackItemRef.current(nextItem, `Playing ${nextItem.title}.`);
    });

    return () => {
      unsubscribe();
      void playerService.dispose();
    };
  }, [playerService]);

  useEffect(() => {
    const query = state.search.query.trim();

    searchRequestIdRef.current += 1;
    const requestId = searchRequestIdRef.current;

    if (!query) {
      dispatch({ type: "clearSearchResults" });
      return;
    }

    const timeoutId = setTimeout(() => {
      dispatch({ type: "startSearchRequest", query });
      dispatch({ type: "recordSearchHistory", query });

      void musicProvider.search(query)
        .then((results) => {
          if (requestId !== searchRequestIdRef.current) {
            return;
          }

          dispatch({ type: "resolveSearchRequest", query, results });
        })
        .catch((error) => {
          if (requestId !== searchRequestIdRef.current) {
            return;
          }

          dispatch({
            type: "rejectSearchRequest",
            query,
            error: toErrorMessage(error),
          });
          pushNotification(`Search failed for "${query}". ${toErrorMessage(error)}`, "error");
        });
    }, state.search.retryToken > 0 ? 0 : SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [musicProvider, state.search.query, state.search.retryToken]);

  return (
    <AppStoreContext.Provider
      value={{
        state,
        dispatch,
        activateResult,
        adjustVolume,
        returnToSearchResults,
        clearQueue,
        enqueueResult,
        importAuthCookie,
        nextTrack,
        playQueueIndex,
        previousTrack,
        removeQueueIndex,
        restoreSession,
        retryLyrics,
        retrySearch,
        runSearchQuery,
        seekPlayback,
        signOut,
        togglePause,
      }}
    >
      {children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppStoreContext);

  if (!context) {
    throw new Error("useAppStore must be used within AppStateProvider");
  }

  return context;
}