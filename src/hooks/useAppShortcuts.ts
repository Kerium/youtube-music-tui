import { useKeyboard, useRenderer } from "@opentui/react";

import { matchesShortcut } from "../app/shortcuts";
import { useAppStore } from "../state/app-store";
import { useFocusRing } from "./useFocusRing";

export function useAppShortcuts() {
  const renderer = useRenderer();
  const {
    activateResult,
    adjustVolume,
    clearQueue,
    enqueueResult,
    returnToSearchResults,
    state,
    dispatch,
    importAuthCookie,
    nextTrack,
    playQueueIndex,
    previousTrack,
    removeQueueIndex,
    retryLyrics,
    retrySearch,
    seekPlayback,
    signOut,
    togglePause,
  } = useAppStore();
  const { getDefaultPane, getNextPane } = useFocusRing();

  useKeyboard((key) => {
    const inputFocused = state.ui.focusedPane === "searchInput";
    const overlayOpen = state.ui.helpOpen || state.ui.lyricsOpen || state.ui.authImportOpen;
    const bindings = state.preferences.keybindings;

    if (key.name === "escape") {
      if (overlayOpen) {
        dispatch({ type: "closeOverlays" });
        return;
      }
    }

    if (matchesShortcut(key, bindings.focusPreviousPane)) {
      dispatch({
        type: "setFocusedPane",
        pane: getNextPane(
          state.ui.activeScreen,
          state.ui.focusedPane,
          "backward",
        ),
      });
      return;
    }

    if (matchesShortcut(key, bindings.focusNextPane)) {
      dispatch({
        type: "setFocusedPane",
        pane: getNextPane(
          state.ui.activeScreen,
          state.ui.focusedPane,
          "forward",
        ),
      });
      return;
    }

    if (matchesShortcut(key, bindings.screenSearch)) {
      dispatch({ type: "setActiveScreen", screen: "search", focusedPane: getDefaultPane("search") });
      return;
    }

    if (matchesShortcut(key, bindings.screenNowPlaying)) {
      dispatch({
        type: "setActiveScreen",
        screen: "nowPlaying",
        focusedPane: getDefaultPane("nowPlaying"),
      });
      return;
    }

    if (matchesShortcut(key, bindings.focusSearch)) {
      dispatch({ type: "setActiveScreen", screen: "search", focusedPane: "searchInput" });
      return;
    }

    if (matchesShortcut(key, bindings.toggleHelp) && !inputFocused) {
      dispatch({ type: "toggleHelp" });
      return;
    }

    if (matchesShortcut(key, bindings.toggleLyrics) && !inputFocused) {
      dispatch({ type: "toggleLyrics" });
      return;
    }

    if (matchesShortcut(key, bindings.quit) && !inputFocused) {
      renderer.destroy();
      return;
    }

    if (state.ui.authImportOpen) {
      if (matchesShortcut(key, bindings.saveAuth)) {
        void importAuthCookie(state.ui.authCookieDraft);
      }

      return;
    }

    if (state.ui.lyricsOpen && matchesShortcut(key, bindings.retry) && !inputFocused) {
      retryLyrics();
      return;
    }

    if (overlayOpen) {
      return;
    }

    if (matchesShortcut(key, bindings.openAuth) && !inputFocused) {
      dispatch({ type: "openAuthImport" });
      return;
    }

    if (matchesShortcut(key, bindings.signOut) && state.session.mode === "authenticated") {
      void signOut();
      return;
    }

    if (matchesShortcut(key, bindings.moveDown) && !inputFocused) {
      if (state.ui.focusedPane === "results") {
        dispatch({ type: "moveResultSelection", delta: 1 });
      }

      if (state.ui.focusedPane === "queue") {
        dispatch({ type: "moveQueueSelection", delta: 1 });
      }

      return;
    }

    if (matchesShortcut(key, bindings.moveUp) && !inputFocused) {
      if (state.ui.focusedPane === "results") {
        dispatch({ type: "moveResultSelection", delta: -1 });
      }

      if (state.ui.focusedPane === "queue") {
        dispatch({ type: "moveQueueSelection", delta: -1 });
      }

      return;
    }

    if (matchesShortcut(key, bindings.back) && state.search.context && state.ui.focusedPane === "results" && !inputFocused) {
      returnToSearchResults();
      return;
    }

    if (matchesShortcut(key, bindings.activate)) {
      if (state.ui.focusedPane === "results") {
        void activateResult();
      }

      if (state.ui.focusedPane === "queue") {
        void playQueueIndex();
      }

      if (state.ui.focusedPane === "miniPlayer") {
        dispatch({
          type: "setActiveScreen",
          screen: "nowPlaying",
          focusedPane: getDefaultPane("nowPlaying"),
        });
      }

      return;
    }

    if (matchesShortcut(key, bindings.enqueue) && state.ui.focusedPane === "results" && !inputFocused) {
      void enqueueResult();
      return;
    }

    if (matchesShortcut(key, bindings.nextTrack) && !inputFocused) {
      void nextTrack();
      return;
    }

    if (matchesShortcut(key, bindings.previousTrack) && !inputFocused) {
      void previousTrack();
      return;
    }

    if (matchesShortcut(key, bindings.seekBackward) && !inputFocused) {
      void seekPlayback(-5);
      return;
    }

    if (matchesShortcut(key, bindings.seekForward) && !inputFocused) {
      void seekPlayback(5);
      return;
    }

    if (matchesShortcut(key, bindings.volumeDown) && !inputFocused) {
      void adjustVolume(-5);
      return;
    }

    if (matchesShortcut(key, bindings.volumeUp) && !inputFocused) {
      void adjustVolume(5);
      return;
    }

    if (matchesShortcut(key, bindings.removeQueueItem) && state.ui.focusedPane === "queue") {
      void removeQueueIndex();
      return;
    }

    if (matchesShortcut(key, bindings.clearQueue) && state.ui.focusedPane === "queue" && !inputFocused) {
      void clearQueue();
      return;
    }

    if (matchesShortcut(key, bindings.retry) && !inputFocused) {
      retrySearch();
      return;
    }

    if (matchesShortcut(key, bindings.togglePause) && !inputFocused) {
      void togglePause();
      return;
    }
  });
}