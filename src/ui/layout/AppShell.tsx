import type { PasteEvent } from "../../../node_modules/@opentui/react/node_modules/@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { useRef } from "react";

import { formatPrimaryShortcut, formatShortcut } from "../../app/shortcuts";
import { useMouseActions } from "../../hooks/useMouseActions";
import { useAppStore, getCurrentTrack } from "../../state/app-store";
import { ModalWindow } from "../components/ModalWindow";
import { SearchScreen } from "../panes/SearchScreen";
import { NowPlayingScreen } from "../panes/NowPlayingScreen";
import { theme } from "../theme/theme";

const cookieTextDecoder = new TextDecoder();

function sanitizeCookieDraft(value: string): string {
  return value.replace(/^cookie:\s*/i, "").replace(/[\r\n]+/g, " ").trim();
}

function HeaderTab({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <box
      border
      borderStyle="rounded"
      borderColor={active ? theme.colors.accent : theme.border.subtle}
      backgroundColor={active ? theme.colors.panelActive : theme.colors.panel}
      paddingX={1}
      onMouseDown={onPress}
    >
      <text fg={active ? theme.colors.text : theme.colors.textMuted}>{label}</text>
    </box>
  );
}

function HelpWindow({ width, height }: { width: number; height: number }) {
  const { state } = useAppStore();
  const bindings = state.preferences.keybindings;

  return (
    <ModalWindow
      title="Command Help"
      width={Math.min(72, Math.max(52, width - 8))}
      height={Math.min(18, Math.max(12, height - 6))}
      footer={<text fg={theme.colors.textMuted}>Esc close  Tab cycle panes  Mouse click focus</text>}
    >
      <box flexDirection="column" gap={1}>
        <text fg={theme.colors.text}>{formatShortcut(bindings, "screenSearch")} Search  {formatShortcut(bindings, "screenNowPlaying")} Now Playing  {formatShortcut(bindings, "focusSearch")} focus search</text>
        <text fg={theme.colors.text}>{formatShortcut(bindings, "focusNextPane")} next pane  {formatShortcut(bindings, "focusPreviousPane")} previous pane</text>
        <text fg={theme.colors.text}>{formatShortcut(bindings, "moveDown")} move down  {formatShortcut(bindings, "moveUp")} move up</text>
        <text fg={theme.colors.text}>{formatShortcut(bindings, "activate")} play or open  {formatShortcut(bindings, "enqueue")} queue selected song</text>
        <text fg={theme.colors.text}>{formatShortcut(bindings, "togglePause")} pause toggle  {formatShortcut(bindings, "nextTrack")} next  {formatShortcut(bindings, "previousTrack")} previous</text>
        <text fg={theme.colors.text}>{formatShortcut(bindings, "back")} back from album  {formatShortcut(bindings, "seekBackward")} or {formatShortcut(bindings, "seekForward")} seek</text>
        <text fg={theme.colors.text}>{formatShortcut(bindings, "volumeDown")} or {formatShortcut(bindings, "volumeUp")} volume  {formatShortcut(bindings, "removeQueueItem")} remove queue item</text>
        <text fg={theme.colors.text}>{formatShortcut(bindings, "clearQueue")} clear queue  {formatShortcut(bindings, "retry")} retry active network pane</text>
        <text fg={theme.colors.text}>{formatShortcut(bindings, "toggleLyrics")} lyrics  {formatShortcut(bindings, "openAuth")} auth import  {formatShortcut(bindings, "quit")} quit</text>
      </box>
    </ModalWindow>
  );
}

function AuthWindow({ width, height }: { width: number; height: number }) {
  const { state, importAuthCookie } = useAppStore();
  const actions = useMouseActions();
  const modalWidth = Math.min(84, Math.max(60, width - 8));
  const modalHeight = Math.min(20, Math.max(14, height - 4));
  const cookieDraftRef = useRef(state.ui.authCookieDraft);

  function handleAuthCookieChange(value: string) {
    const nextValue = sanitizeCookieDraft(value);

    cookieDraftRef.current = nextValue;
    actions.updateAuthCookieDraft(nextValue);
  }

  function handleAuthCookiePaste(event: PasteEvent) {
    event.preventDefault();
    handleAuthCookieChange(cookieTextDecoder.decode(event.bytes));
  }

  function handleAuthCookieSubmit() {
    void importAuthCookie(cookieDraftRef.current);
  }

  return (
    <ModalWindow
      title="Import YouTube Cookie Session"
      width={modalWidth}
      height={modalHeight}
      footer={
        <text fg={theme.colors.textMuted}>
          Paste the full Cookie header. Ctrl+S save  Esc close
        </text>
      }
    >
      <box flexDirection="column" gap={1} width="100%" height="100%">
        <text fg={theme.colors.text}>
          Use a browser-exported YouTube cookie string. This app stores it locally for this machine only.
        </text>
        <input
          value={state.ui.authCookieDraft}
          onChange={handleAuthCookieChange}
          onPaste={handleAuthCookiePaste}
          placeholder="SAPISID=...; HSID=...; SID=..."
          width="100%"
          focused
        />
        {state.session.lastAuthError ? (
          <text fg={theme.colors.danger}>{state.session.lastAuthError}</text>
        ) : (
          <text fg={theme.colors.textMuted}>No cookie validated yet in this session.</text>
        )}
        <box flexDirection="row" gap={1}>
          <HeaderTab label="Save Session" active onPress={handleAuthCookieSubmit} />
          <HeaderTab label="Cancel" active={false} onPress={actions.closeAuthImport()} />
        </box>
      </box>
    </ModalWindow>
  );
}

function LyricsWindow({ title, width, height }: { title: string; width: number; height: number }) {
  const { state } = useAppStore();
  const actions = useMouseActions();
  const modalWidth = Math.min(76, Math.max(54, width - 10));
  const modalHeight = Math.min(20, Math.max(12, height - 6));
  const footerLabel = state.lyrics.status === "ready"
    ? `Source ${state.lyrics.source ?? "unknown"}  Arrow keys or wheel scroll  Esc close  l toggle`
    : "Lyrics load in the background  Esc close  l toggle";

  return (
    <ModalWindow
      title={`Lyrics: ${title}`}
      width={modalWidth}
      height={modalHeight}
      footer={<text fg={theme.colors.textMuted}>{footerLabel}</text>}
    >
      {state.lyrics.status === "ready" ? (
        <scrollbox focused flexGrow={1} width="100%">
          <box flexDirection="column" width="100%">
            {state.lyrics.lines.map((line, index) => (
              <text key={`lyrics-line-${index}`} fg={line ? theme.colors.text : theme.colors.textMuted}>
                {line || " "}
              </text>
            ))}
          </box>
        </scrollbox>
      ) : (
        <box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column" gap={1}>
          <text fg={state.lyrics.status === "error" ? theme.colors.danger : theme.colors.text}>
            {state.lyrics.status === "loading"
              ? "Loading lyrics…"
              : state.lyrics.status === "not-found"
                ? "Lyrics unavailable"
                : "Lyrics idle"}
          </text>
          <text fg={theme.colors.textMuted}>{state.lyrics.message}</text>
            {state.queue.items.length > 0 && state.lyrics.status !== "loading" ? (
              <HeaderTab active={false} label="Retry Lyrics" onPress={actions.retryLyrics()} />
            ) : null}
        </box>
      )}
    </ModalWindow>
  );
}

  function getNotificationColor(level: "info" | "success" | "error") {
    switch (level) {
      case "success":
        return theme.colors.success;
      case "error":
        return theme.colors.danger;
      default:
        return theme.colors.accentSoft;
    }
  }

export function AppShell() {
  const { state } = useAppStore();
  const actions = useMouseActions();
  const { width, height } = useTerminalDimensions();
  const currentTrack = getCurrentTrack(state);
    const latestNotification = state.ui.notifications[0] ?? null;
    const bindings = state.preferences.keybindings;

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={theme.colors.background}>
      <box
        width="100%"
        height={3}
        border
        borderStyle="rounded"
        borderColor={theme.border.default}
        backgroundColor={theme.colors.panel}
        paddingX={1}
        paddingY={1}
        justifyContent="space-between"
      >
        <box flexDirection="row" gap={1}>
          <HeaderTab
            active={state.ui.activeScreen === "search"}
            label="Search"
            onPress={actions.switchScreen("search", "searchInput")}
          />
          <HeaderTab
            active={state.ui.activeScreen === "nowPlaying"}
            label="Now Playing"
            onPress={actions.switchScreen("nowPlaying", "nowPlaying")}
          />
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.colors.text}>
            <strong>Y Music Player</strong>
          </text>
          <text fg={theme.colors.textMuted}>{state.session.label}</text>
          <HeaderTab
            active={state.ui.authImportOpen}
            label={state.session.mode === "authenticated" ? "Replace Session" : "Import Session"}
            onPress={actions.openAuthImport()}
          />
          {state.session.mode === "authenticated" ? (
            <HeaderTab active={false} label="Sign Out" onPress={actions.clearSession()} />
          ) : null}
        </box>
      </box>

      <box flexGrow={1} paddingY={1}>
        {state.ui.activeScreen === "search" ? (
          <SearchScreen width={width} height={height} />
        ) : (
          <NowPlayingScreen width={width} />
        )}
      </box>

      <box
        width="100%"
        height={5}
        border
        borderStyle="rounded"
        borderColor={theme.border.default}
        backgroundColor={theme.colors.panel}
        paddingX={1}
        paddingY={1}
        flexDirection="column"
      >
        <box width="100%" justifyContent="space-between">
          <text fg={theme.colors.textMuted}>
            Screen {state.ui.activeScreen} · Focus {state.ui.focusedPane} · {width}x{height}
          </text>
          <text fg={state.session.mode === "error" ? theme.colors.danger : theme.colors.accentSoft}>
            {state.session.mode === "authenticated"
              ? `${state.session.label} · ${state.session.source}`
              : state.session.mode === "restoring"
                ? "Restoring auth…"
                : `${currentTrack.title} · ${currentTrack.artist}`}
          </text>
        </box>
        <box width="100%">
          <text fg={theme.colors.textMuted}>{state.ui.status}</text>
        </box>
        <box width="100%" justifyContent="space-between">
          <text fg={theme.colors.textMuted}>{formatPrimaryShortcut(bindings, "screenSearch")} Search  {formatPrimaryShortcut(bindings, "screenNowPlaying")} Now Playing  {formatPrimaryShortcut(bindings, "focusSearch")} search  {formatPrimaryShortcut(bindings, "activate")} play-open  {formatPrimaryShortcut(bindings, "enqueue")} queue  {formatPrimaryShortcut(bindings, "togglePause")} pause  {formatPrimaryShortcut(bindings, "retry")} retry  {formatPrimaryShortcut(bindings, "quit")} quit</text>
          <text fg={latestNotification ? getNotificationColor(latestNotification.level) : theme.colors.textMuted}>
            {latestNotification ? latestNotification.message : `Theme ${state.preferences.theme ? "custom" : "default"}`}
          </text>
        </box>
      </box>

      {state.ui.helpOpen ? <HelpWindow width={width} height={height} /> : null}
      {state.ui.authImportOpen ? <AuthWindow width={width} height={height} /> : null}
      {state.ui.lyricsOpen ? (
        <LyricsWindow title={`${currentTrack.title} - ${currentTrack.artist}`} width={width} height={height} />
      ) : null}
    </box>
  );
}