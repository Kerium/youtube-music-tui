import {
  COVER_PREVIEW_CELL_HEIGHT,
  COVER_PREVIEW_CELL_WIDTH,
  type CoverArtCell,
} from "../../services/covers/renderer";
import type { MediaItem } from "../../state/app-store";

import { useMouseActions } from "../../hooks/useMouseActions";
import { useAppStore, getCurrentTrack } from "../../state/app-store";
import { paneBorderColor, progressBar, theme } from "../theme/theme";

interface NowPlayingScreenProps {
  width: number;
}

function CoverArtPreview({
  bytesPerRow,
  pixelData,
  rows,
  status,
  message,
}: {
  bytesPerRow: number | null;
  pixelData: Uint8Array | null;
  rows: CoverArtCell[][] | null;
  status: "ready" | "loading" | "disabled" | "error" | "idle";
  message: string;
}) {
  const fallbackLabel = status === "loading" ? "loading cover" : message;
  const previewWidth = COVER_PREVIEW_CELL_WIDTH + 2;
  const previewHeight = COVER_PREVIEW_CELL_HEIGHT + 2;

  return (
    <box
      width={previewWidth}
      height={previewHeight}
      border
      borderStyle="rounded"
      borderColor={theme.border.subtle}
      justifyContent="center"
      alignItems="center"
      backgroundColor={theme.colors.background}
      flexDirection="column"
    >
      {status === "ready" && rows ? (
        rows.map((row, rowIndex) => (
          <text key={`cover-row-${rowIndex}`}>
            {row.map((cell, columnIndex) => (
              <span key={`cover-cell-${rowIndex}-${columnIndex}`} fg={cell.fg} bg={cell.bg}>
                {cell.char}
              </span>
            ))}
          </text>
        ))
      ) : (
        <>
          <text fg={theme.colors.textMuted}>cover art</text>
          <text fg={theme.colors.textMuted}>{fallbackLabel}</text>
        </>
      )}
    </box>
  );
}

function QueueRow({
  item,
  isCurrent,
  isSelected,
  onSelect,
  onPlay,
}: {
  item: MediaItem;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onPlay: () => void;
}) {
  return (
    <box
      width="100%"
      flexDirection="column"
      paddingY={1}
      paddingX={1}
      marginBottom={1}
      height={4}
      backgroundColor={isSelected ? theme.colors.panelActive : theme.colors.panel}
      onMouseDown={onSelect}
      onMouseUp={onPlay}
    >
      <box width="100%" flexDirection="row" justifyContent="space-between">
        <text fg={theme.colors.text}>
          {isCurrent ? "▸ " : "  "}
          {item.title}
        </text>
        <text fg={isCurrent ? theme.colors.success : theme.colors.textMuted}>
          {isCurrent ? "playing" : "queued"}
        </text>
      </box>
      <text fg={theme.colors.textMuted}>{item.artist}</text>
    </box>
  );
}

function ControlButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <box
      border
      borderStyle="rounded"
      borderColor={theme.border.subtle}
      backgroundColor={theme.colors.panelMuted}
      paddingX={1}
      onMouseDown={onPress}
    >
      <text fg={theme.colors.text}>{label}</text>
    </box>
  );
}

export function NowPlayingScreen({ width }: NowPlayingScreenProps) {
  const { state } = useAppStore();
  const actions = useMouseActions();
  const currentTrack = getCurrentTrack(state);
  const isWide = width >= 88;
  const playbackProgress = state.player.durationSeconds && state.player.durationSeconds > 0
    ? state.player.positionSeconds / state.player.durationSeconds
    : 0;
  const backendStatusLabel = state.player.backendStatus === "missing"
    ? "mpv missing"
    : state.player.backendStatus === "error"
      ? state.player.backendMessage ?? "Playback error"
      : state.player.currentItemId
        ? state.player.paused
          ? "Paused"
          : "Playing"
        : "Idle";

  return (
    <box
      width="100%"
      flexGrow={1}
      flexDirection={isWide ? "row" : "column"}
      gap={1}
      alignItems="stretch"
    >
      <box
        width={isWide ? "56%" : "100%"}
        flexGrow={1}
        flexDirection="column"
        border
        borderStyle="double"
        borderColor={paneBorderColor(state.ui.focusedPane === "nowPlaying")}
        title="Now Playing"
        backgroundColor={theme.colors.panel}
        padding={1}
        focusable
        focused={state.ui.focusedPane === "nowPlaying"}
        onMouseDown={actions.focusPane("nowPlaying")}
      >
        <box width="100%" flexDirection="row" gap={1}>
          <CoverArtPreview
            bytesPerRow={state.cover.bytesPerRow}
            pixelData={state.cover.pixelData}
            rows={state.cover.rows}
            status={state.cover.status}
            message={state.cover.message}
          />
          <box flexGrow={1} flexDirection="column" gap={1}>
            <text fg={theme.colors.text}>
              <strong>{currentTrack.title}</strong>
            </text>
            <text fg={theme.colors.textMuted}>{currentTrack.artist}</text>
            <text fg={theme.colors.textMuted}>
              {currentTrack.album} · {currentTrack.year}
            </text>
            <text
              fg={state.cover.status === "error" ? theme.colors.danger : theme.colors.textMuted}
            >
              {state.cover.message}
            </text>
            <text
              fg={state.player.backendStatus === "error" || state.player.backendStatus === "missing"
                ? theme.colors.danger
                : theme.colors.textMuted}
            >
              {backendStatusLabel}
            </text>
            <text fg={theme.colors.accentSoft}>
              {progressBar(playbackProgress)} {state.player.positionLabel} / {state.player.durationLabel}
            </text>
          </box>
        </box>

        <box width="100%" marginTop={1} flexDirection="row" gap={1}>
          <ControlButton label="◂◂" onPress={actions.previousTrack()} />
          <ControlButton
            label={state.player.paused ? "▶" : "▐▐"}
            onPress={actions.togglePause()}
          />
          <ControlButton label="▸▸" onPress={actions.nextTrack()} />
          <ControlButton label="-5s" onPress={actions.seekPlayback(-5)} />
          <ControlButton label="+5s" onPress={actions.seekPlayback(5)} />
          <ControlButton label="Vol-" onPress={actions.adjustVolume(-5)} />
          <ControlButton label="Vol+" onPress={actions.adjustVolume(5)} />
          <ControlButton label="Lyrics" onPress={actions.toggleLyrics()} />
        </box>

        <box width="100%" marginTop={1} flexDirection="row" justifyContent="space-between">
          <text fg={theme.colors.textMuted}>Volume {state.player.volume}%</text>
          <text fg={theme.colors.textMuted}>
            {state.queue.items.length === 0 ? "Queue empty" : `${state.queue.items.length} queued`}
          </text>
        </box>
      </box>

      <box
        width={isWide ? "44%" : "100%"}
        flexGrow={1}
        flexDirection="column"
        border
        borderStyle="double"
        borderColor={paneBorderColor(state.ui.focusedPane === "queue")}
        title="Queue"
        backgroundColor={theme.colors.panel}
        padding={1}
        focusable
        focused={state.ui.focusedPane === "queue"}
        onMouseDown={actions.focusPane("queue")}
      >
        {state.queue.items.length === 0 ? (
          <text fg={theme.colors.textMuted}>Queue is empty. Press e on a selected song to queue it, or Enter to play immediately.</text>
        ) : (
          state.queue.items.map((item, index) => (
            <QueueRow
              key={item.id}
              item={item}
              isCurrent={state.queue.currentIndex === index}
              isSelected={state.queue.selectedIndex === index}
              onSelect={actions.selectQueueIndex(index)}
              onPlay={actions.playQueueIndex(index)}
            />
          ))
        )}

        <box width="100%" marginTop={1} flexDirection="row" gap={1}>
          <ControlButton label="Remove" onPress={actions.removeQueueIndex()} />
          <ControlButton label="Clear Queue" onPress={actions.clearQueue()} />
        </box>
      </box>
    </box>
  );
}