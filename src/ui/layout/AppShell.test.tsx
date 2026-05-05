import { afterEach, describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";

import { resolveShortcutConfig } from "../../app/shortcuts";
import { useAppShortcuts } from "../../hooks/useAppShortcuts";
import {
  AppStoreContext,
  createInitialAppState,
  type AppStoreContextValue,
  type AppState,
  type MediaItem,
} from "../../state/app-store";
import { AppShell } from "./AppShell";
import { SearchScreen } from "../panes/SearchScreen";

let testSetup: Awaited<ReturnType<typeof testRender>> | undefined;

afterEach(() => {
  act(() => {
    testSetup?.renderer.destroy();
  });
  testSetup = undefined;
});

function createMediaItem(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "song:test-track",
    sourceId: "song:test-track",
    isPlayable: true,
    title: "Night Drive",
    artist: "The Midnight",
    album: "Endless Roads",
    thumbnailUrl: null,
    duration: "3:41",
    year: "2024",
    kind: "song",
    subtitle: "The Midnight · Endless Roads",
    trailingLabel: "3:41",
    ...overrides,
  };
}

function createMockStoreValue(
  configure?: (state: AppState) => void,
  dispatch?: (action: { type: string }) => void,
): AppStoreContextValue {
  const state = createInitialAppState();
  state.preferences.keybindings = resolveShortcutConfig(null);
  state.preferences.hydrated = true;
  state.history.hydrated = true;

  configure?.(state);

  return {
    state,
    dispatch: ((action) => dispatch?.(action as { type: string })) as AppStoreContextValue["dispatch"],
    activateResult: async () => undefined,
    adjustVolume: async () => undefined,
    returnToSearchResults: () => undefined,
    clearQueue: async () => undefined,
    enqueueResult: async () => undefined,
    importAuthCookie: async () => undefined,
    nextTrack: async () => undefined,
    playQueueIndex: async () => undefined,
    previousTrack: async () => undefined,
    removeQueueIndex: async () => undefined,
    restoreSession: async () => undefined,
    retryLyrics: () => undefined,
    retrySearch: () => undefined,
    runSearchQuery: () => undefined,
    seekPlayback: async () => undefined,
    signOut: async () => undefined,
    togglePause: async () => undefined,
  };
}

function StoreHarness({ value }: { value: AppStoreContextValue }) {
  return (
    <AppStoreContext.Provider value={value}>
      <AppShell />
    </AppStoreContext.Provider>
  );
}

function SearchHarness({ value }: { value: AppStoreContextValue }) {
  return (
    <AppStoreContext.Provider value={value}>
      <SearchScreen width={120} height={30} />
    </AppStoreContext.Provider>
  );
}

function ShortcutHarness({ value }: { value: AppStoreContextValue }) {
  useAppShortcuts();

  return <AppShell />;
}

describe("AppShell render smoke tests", () => {
  test("renders the search pane bootstrap with saved history", async () => {
    const value = createMockStoreValue((state) => {
      state.history.searchHistory = ["lo-fi study mix"];
      state.history.recentTracks = [
        {
          album: "Endless Roads",
          artist: "The Midnight",
          playedAt: "2026-04-25T10:00:00.000Z",
          title: "Night Drive",
        },
      ];
      state.ui.activeScreen = "search";
      state.ui.focusedPane = "searchInput";
    });

    testSetup = await testRender(<SearchHarness value={value} />, {
      width: 120,
      height: 30,
    });

    await testSetup.renderOnce();
    const frame = testSetup.captureCharFrame();

    expect(frame).toContain("Type a query to search YouTube Music.");
    expect(frame).toContain("lo-fi study mix");
    expect(frame).toContain("Endless Roads");
  });

  test("renders app bootstrap with graphics disabled", async () => {
    const disabledValue = createMockStoreValue((state) => {
      state.ui.activeScreen = "nowPlaying";
      state.ui.focusedPane = "nowPlaying";
      state.queue.items = [createMediaItem()];
      state.cover.status = "disabled";
      state.cover.message = "Graphics disabled for this terminal.";
    });

    testSetup = await testRender(<StoreHarness value={disabledValue} />, {
      width: 120,
      height: 30,
    });

    await testSetup.renderOnce();
    const frame = testSetup.captureCharFrame();

    expect(frame).toContain("Now Playing");
    expect(frame).toContain("Graphics disabled for this");
  });

  test("renders app bootstrap with cover art ready", async () => {
    const enabledValue = createMockStoreValue((state) => {
      state.ui.activeScreen = "nowPlaying";
      state.ui.focusedPane = "nowPlaying";
      state.queue.items = [createMediaItem()];
      state.cover.status = "ready";
      state.cover.message = "Cover art ready.";
      state.cover.rows = [[{ char: "▀", fg: "#ffffff", bg: "#000000" }]];
      state.cover.bytesPerRow = 4;
      state.cover.pixelData = new Uint8Array([255, 255, 255, 255]);
      state.cover.pixelWidth = 1;
      state.cover.pixelHeight = 1;
    });

    testSetup = await testRender(<StoreHarness value={enabledValue} />, {
      width: 120,
      height: 30,
    });

    await testSetup.renderOnce();
    const frame = testSetup.captureCharFrame();

    expect(frame).toContain("Cover art ready.");
    expect(frame).toContain("Night Drive");
  });
});

describe("shortcut integration", () => {
  test("pressing r dispatches retrySearch when a query is active", async () => {
    let retryCount = 0;
    const value = createMockStoreValue((state) => {
      state.search.query = "midnight";
      state.search.error = "network down";
      state.ui.activeScreen = "search";
      state.ui.focusedPane = "results";
    });
    value.retrySearch = () => {
      retryCount += 1;
    };

    testSetup = await testRender(
      <AppStoreContext.Provider value={value}>
        <ShortcutHarness value={value} />
      </AppStoreContext.Provider>,
      {
        width: 100,
        height: 30,
      },
    );

    await testSetup.mockInput.pressKeys(["r"]);
    await testSetup.renderOnce();

    expect(retryCount).toBe(1);
  });
});