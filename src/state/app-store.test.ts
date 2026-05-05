import { describe, expect, test } from "bun:test";

import {
  appReducer,
  createInitialAppState,
  ensureQueuedItem,
  pushRecentTrackEntry,
  pushSearchHistoryEntry,
  removeQueuedItem,
  type MediaItem,
  type RecentTrackEntry,
} from "./app-store";

function createMediaItem(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "song:test-track",
    sourceId: "test-track",
    isPlayable: true,
    title: "Test Track",
    artist: "Test Artist",
    album: "Test Album",
    thumbnailUrl: null,
    duration: "3:45",
    year: "2026",
    kind: "song",
    subtitle: "Test Artist · Test Album",
    trailingLabel: "3:45",
    ...overrides,
  };
}

function createRecentTrack(overrides: Partial<RecentTrackEntry> = {}): RecentTrackEntry {
  return {
    album: "Test Album",
    artist: "Test Artist",
    playedAt: "2026-04-25T10:00:00.000Z",
    title: "Test Track",
    ...overrides,
  };
}

describe("app-store queue helpers", () => {
  test("ensureQueuedItem appends new items and deduplicates existing items", () => {
    const first = createMediaItem({ id: "song:first", title: "First" });
    const second = createMediaItem({ id: "song:second", title: "Second" });

    expect(ensureQueuedItem([], first)).toEqual({
      items: [first],
      index: 0,
    });

    expect(ensureQueuedItem([first, second], first)).toEqual({
      items: [first, second],
      index: 0,
    });
  });

  test("removeQueuedItem keeps indexes in range when removing the current item", () => {
    const first = createMediaItem({ id: "song:first", title: "First" });
    const second = createMediaItem({ id: "song:second", title: "Second" });
    const third = createMediaItem({ id: "song:third", title: "Third" });

    expect(removeQueuedItem([first, second, third], 1, 2, 1)).toEqual({
      items: [first, third],
      currentIndex: 1,
      selectedIndex: 1,
    });
  });
});

describe("app-store history helpers", () => {
  test("pushSearchHistoryEntry trims, deduplicates, and caps history", () => {
    const history = Array.from({ length: 8 }, (_, index) => `Query ${index}`);
    const nextHistory = pushSearchHistoryEntry(history, "  query 3  ");

    expect(nextHistory).toHaveLength(8);
    expect(nextHistory[0]).toBe("query 3");
    expect(nextHistory.filter((entry) => entry.toLowerCase() === "query 3")).toHaveLength(1);
  });

  test("pushRecentTrackEntry keeps the latest unique track first", () => {
    const older = createRecentTrack({ playedAt: "2026-04-24T10:00:00.000Z" });
    const newer = createRecentTrack({ playedAt: "2026-04-25T10:00:00.000Z" });
    const other = createRecentTrack({ title: "Other", artist: "Elsewhere" });
    const nextRecentTracks = pushRecentTrackEntry([older, other], newer);

    expect(nextRecentTracks[0]).toEqual(newer);
    expect(nextRecentTracks[1]).toEqual(other);
    expect(nextRecentTracks).toHaveLength(2);
  });
});

describe("app-store reducer", () => {
  test("enqueueResult updates queue state and quotes the queued title", () => {
    const queuedItem = createMediaItem();
    const state = createInitialAppState();
    state.search.results = [queuedItem];

    const nextState = appReducer(state, { type: "enqueueResult", index: 0 });

    expect(nextState.queue.items).toEqual([queuedItem]);
    expect(nextState.queue.selectedIndex).toBe(0);
    expect(nextState.ui.status).toBe('Queued "Test Track".');
  });

  test("retrySearch increments the retry token and sets loading", () => {
    const state = createInitialAppState();
    state.search.query = "midnight";
    state.search.error = "network down";

    const nextState = appReducer(state, { type: "retrySearch" });

    expect(nextState.search.retryToken).toBe(1);
    expect(nextState.search.isLoading).toBe(true);
    expect(nextState.search.error).toBeNull();
  });

  test("recordRecentTrack stores the newest unique track first", () => {
    const state = createInitialAppState();
    state.history.recentTracks = [createRecentTrack({ title: "Old" })];

    const nextState = appReducer(state, {
      type: "recordRecentTrack",
      track: createRecentTrack({ title: "Fresh" }),
    });

    expect(nextState.history.recentTracks[0]?.title).toBe("Fresh");
    expect(nextState.history.recentTracks).toHaveLength(2);
  });
});