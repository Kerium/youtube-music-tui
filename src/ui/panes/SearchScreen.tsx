import type { MediaItem } from "../../state/app-store";

import { getCurrentTrack, useAppStore } from "../../state/app-store";
import { useMouseActions } from "../../hooks/useMouseActions";
import { paneBorderColor, progressBar, theme } from "../theme/theme";

interface SearchScreenProps {
  height: number;
  width: number;
}

function ResultRow({
  item,
  isSelected,
  onSelect,
  onPlay,
}: {
  item: MediaItem;
  isSelected: boolean;
  onSelect: () => void;
  onPlay: () => void;
}) {
  return (
    <box
      width="100%"
      flexDirection="column"
      paddingY={0}
      paddingX={1}
      height={3}
      backgroundColor={isSelected ? theme.colors.panelActive : theme.colors.panel}
      onMouseDown={onSelect}
      onMouseUp={onPlay}
    >
      <box width="100%" flexDirection="row" justifyContent="space-between">
        <text fg={theme.colors.text}>
          {isSelected ? "▸ " : "  "}
          {item.title}
        </text>
        <text fg={theme.colors.accentSoft}>{item.trailingLabel}</text>
      </box>
      <text fg={theme.colors.textMuted}>{item.subtitle}</text>
    </box>
  );
}

function getResultsSummary(query: string, isLoading: boolean, count: number) {
  if (!query.trim()) {
    return "Type a query to search YouTube Music.";
  }

  if (isLoading) {
    return `Searching YouTube Music for \"${query.trim()}\"…`;
  }

  return `${count} results for \"${query.trim()}\"`;
}

function formatPlayedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return date.toLocaleDateString();
}

function HistoryRow({
  label,
  meta,
  onPress,
}: {
  label: string;
  meta?: string;
  onPress: () => void;
}) {
  return (
    <box
      width="100%"
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      marginBottom={1}
      backgroundColor={theme.colors.panelMuted}
      onMouseDown={onPress}
    >
      <text fg={theme.colors.text}>{label}</text>
      {meta ? <text fg={theme.colors.textMuted}>{meta}</text> : null}
    </box>
  );
}

export function SearchScreen({ height, width }: SearchScreenProps) {
  const { state, dispatch } = useAppStore();
  const actions = useMouseActions();
  const currentTrack = getCurrentTrack(state);
  const inputWidth = Math.max(24, width - 18);
  const playbackProgress = state.player.durationSeconds && state.player.durationSeconds > 0
    ? state.player.positionSeconds / state.player.durationSeconds
    : 0;
  const playbackStatusLabel = state.player.backendStatus === "missing"
    ? "mpv missing"
    : state.player.backendStatus === "error"
      ? "playback error"
      : state.player.currentItemId
        ? state.player.paused
          ? "▐▐ paused"
          : "▶ playing"
        : "idle";
  const visibleResultCount = Math.max(4, Math.floor((height - 16) / 3));
  const firstVisibleIndex = Math.max(
    0,
    Math.min(
      state.search.selectedIndex - Math.floor(visibleResultCount / 2),
      Math.max(0, state.search.results.length - visibleResultCount),
    ),
  );
  const visibleResults = state.search.results.slice(
    firstVisibleIndex,
    firstVisibleIndex + visibleResultCount,
  );

  function handleResultScroll(direction?: string) {
    dispatch({ type: "setFocusedPane", pane: "results" });

    if (direction === "down") {
      dispatch({ type: "moveResultSelection", delta: 1 });
      return;
    }

    if (direction === "up") {
      dispatch({ type: "moveResultSelection", delta: -1 });
    }
  }

  return (
    <box width="100%" flexDirection="column" flexGrow={1} gap={1}>
      <box
        width="100%"
        flexDirection="row"
        height={4}
        alignItems="center"
        gap={1}
        border
        borderStyle="rounded"
        borderColor={paneBorderColor(state.ui.focusedPane === "searchInput")}
        backgroundColor={theme.colors.panel}
        padding={1}
        onMouseDown={actions.focusPane("searchInput")}
      >
        <text fg={theme.colors.accentSoft}>Search</text>
        <input
          value={state.search.query}
          onChange={actions.updateSearchQuery}
          placeholder="Search YouTube Music"
          width={inputWidth}
          focused={state.ui.focusedPane === "searchInput"}
          backgroundColor={theme.colors.panelMuted}
          focusedBackgroundColor={theme.colors.panelActive}
          textColor={theme.colors.text}
          cursorColor={theme.colors.accent}
          placeholderColor={theme.colors.textMuted}
        />
      </box>

      <box
        width="100%"
        flexGrow={1}
        flexDirection="column"
        border
        borderStyle="double"
        borderColor={paneBorderColor(state.ui.focusedPane === "results")}
        title="Results"
        backgroundColor={theme.colors.panel}
        padding={1}
        focusable
        focused={state.ui.focusedPane === "results"}
        onMouseDown={actions.focusPane("results")}
        onMouseScroll={(event) => handleResultScroll(event.scroll?.direction)}
      >
        {state.search.context ? (
          <box width="100%" marginBottom={1} justifyContent="space-between">
            <box
              paddingX={1}
              backgroundColor={theme.colors.panelActive}
              onMouseDown={actions.returnToSearchResults()}
            >
              <text fg={theme.colors.accentSoft}>← Back to results</text>
            </box>
            <text fg={theme.colors.textMuted}>Album · {state.search.context.title}</text>
          </box>
        ) : null}

        <box width="100%" marginBottom={1} justifyContent="space-between">
          <text fg={theme.colors.textMuted}>
            {state.search.context
              ? `${state.search.results.length} tracks from "${state.search.context.title}"`
              : getResultsSummary(
                state.search.query,
                state.search.isLoading,
                state.search.results.length,
              )}
          </text>
        </box>

        {state.search.error ? (
          <box flexDirection="column" gap={1}>
            <text fg={theme.colors.danger}>{state.search.error}</text>
            <box
              paddingX={1}
              backgroundColor={theme.colors.panelActive}
              onMouseDown={actions.retrySearch()}
            >
              <text fg={theme.colors.accentSoft}>Retry Search</text>
            </box>
          </box>
        ) : !state.search.query.trim() ? (
          <box flexDirection={width >= 92 ? "row" : "column"} gap={1} width="100%">
            <box flexDirection="column" width={width >= 92 ? "50%" : "100%"}>
              <text fg={theme.colors.accentSoft}>Recent Searches</text>
              <text fg={theme.colors.textMuted}>Click a saved query to rerun it immediately.</text>
              <box marginTop={1}>
                <box flexDirection="column" width="100%">
                  {state.history.searchHistory.length > 0 ? state.history.searchHistory.map((query) => (
                    <HistoryRow
                      key={query}
                      label={query}
                      onPress={actions.runSearchQuery(query)}
                    />
                  )) : (
                    <text fg={theme.colors.textMuted}>No searches saved yet.</text>
                  )}
                </box>
              </box>
            </box>
            <box flexDirection="column" width={width >= 92 ? "50%" : "100%"}>
              <text fg={theme.colors.accentSoft}>Recently Played</text>
              <text fg={theme.colors.textMuted}>Recent playback persists across app restarts.</text>
              <box marginTop={1}>
                <box flexDirection="column" width="100%">
                  {state.history.recentTracks.length > 0 ? state.history.recentTracks.map((track) => (
                    <HistoryRow
                      key={`${track.title}-${track.artist}-${track.playedAt}`}
                      label={`${track.title} · ${track.artist}`}
                      meta={`${track.album} · ${formatPlayedAt(track.playedAt)}`}
                      onPress={actions.runSearchQuery(`${track.title} ${track.artist}`)}
                    />
                  )) : (
                    <text fg={theme.colors.textMuted}>No tracks played yet.</text>
                  )}
                </box>
              </box>
            </box>
          </box>
        ) : state.search.isLoading && state.search.results.length === 0 ? (
          <text fg={theme.colors.textMuted}>Loading search results…</text>
        ) : state.search.results.length === 0 ? (
          <text fg={theme.colors.textMuted}>No results matched this query.</text>
        ) : (
          visibleResults.map((item, index) => (
            <ResultRow
              key={item.id}
              item={item}
              isSelected={state.search.selectedIndex === firstVisibleIndex + index}
              onSelect={actions.selectResult(firstVisibleIndex + index)}
              onPlay={actions.activateResult(firstVisibleIndex + index)}
            />
          ))
        )}
      </box>

      <box
        width="100%"
        height={4}
        border
        borderStyle="rounded"
        borderColor={paneBorderColor(state.ui.focusedPane === "miniPlayer")}
        backgroundColor={theme.colors.panelMuted}
        padding={1}
        justifyContent="space-between"
        onMouseDown={actions.switchScreen("nowPlaying", "nowPlaying")}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between">
          <text fg={theme.colors.text}>
            {currentTrack.title} · {currentTrack.artist}
          </text>
          <text fg={theme.colors.textMuted}>{playbackStatusLabel}</text>
        </box>
        <box width="100%" flexDirection="row" justifyContent="space-between">
          <text fg={theme.colors.textMuted}>
            {progressBar(playbackProgress)} {state.player.positionLabel} / {state.player.durationLabel}
          </text>
          <text fg={theme.colors.accentSoft}>Queue: {state.queue.items.length}</text>
        </box>
      </box>
    </box>
  );
}