import type { AppScreen, FocusPane } from "../app/routes";
import { useAppStore } from "../state/app-store";
import { useFocusRing } from "./useFocusRing";

export function useMouseActions() {
  const {
    activateResult: activateResultAction,
    adjustVolume: adjustVolumeAction,
    clearQueue: clearQueueAction,
    dispatch,
    importAuthCookie,
    nextTrack: nextTrackAction,
    playQueueIndex: playQueueIndexAction,
    previousTrack: previousTrackAction,
    removeQueueIndex: removeQueueIndexAction,
    returnToSearchResults: returnToSearchResultsAction,
    retryLyrics: retryLyricsAction,
    retrySearch: retrySearchAction,
    runSearchQuery: runSearchQueryAction,
    seekPlayback: seekPlaybackAction,
    signOut,
    togglePause: togglePauseAction,
  } = useAppStore();
  const { getDefaultPane } = useFocusRing();

  function focusPane(pane: FocusPane) {
    return () => {
      dispatch({ type: "setFocusedPane", pane });
    };
  }

  function switchScreen(screen: AppScreen, pane?: FocusPane) {
    return () => {
      dispatch({ type: "setActiveScreen", screen, focusedPane: pane ?? getDefaultPane(screen) });
    };
  }

  function updateSearchQuery(query: string) {
    dispatch({ type: "setSearchQuery", query });
  }

  function runSearchQuery(query: string) {
    return () => {
      runSearchQueryAction(query);
    };
  }

  function selectResult(index: number) {
    return () => {
      dispatch({ type: "selectResult", index });
    };
  }

  function activateResult(index: number) {
    return () => {
      void activateResultAction(index);
    };
  }

  function selectQueueIndex(index: number) {
    return () => {
      dispatch({ type: "selectQueueIndex", index });
    };
  }

  function playQueueIndex(index: number) {
    return () => {
      void playQueueIndexAction(index);
    };
  }

  function toggleHelp() {
    return () => {
      dispatch({ type: "toggleHelp" });
    };
  }

  function toggleLyrics() {
    return () => {
      dispatch({ type: "toggleLyrics" });
    };
  }

  function togglePause() {
    return () => {
      void togglePauseAction();
    };
  }

  function retrySearch() {
    return () => {
      retrySearchAction();
    };
  }

  function retryLyrics() {
    return () => {
      retryLyricsAction();
    };
  }

  function seekPlayback(seconds: number) {
    return () => {
      void seekPlaybackAction(seconds);
    };
  }

  function adjustVolume(delta: number) {
    return () => {
      void adjustVolumeAction(delta);
    };
  }

  function openAuthImport() {
    return () => {
      dispatch({ type: "openAuthImport" });
    };
  }

  function closeAuthImport() {
    return () => {
      dispatch({ type: "closeAuthImport" });
    };
  }

  function updateAuthCookieDraft(value: string) {
    dispatch({ type: "setAuthCookieDraft", value });
  }

  function submitAuthImport(cookie: string) {
    return () => {
      void importAuthCookie(cookie);
    };
  }

  function clearSession() {
    return () => {
      void signOut();
    };
  }

  function nextTrack() {
    return () => {
      void nextTrackAction();
    };
  }

  function previousTrack() {
    return () => {
      void previousTrackAction();
    };
  }

  function removeQueueIndex(index?: number) {
    return () => {
      void removeQueueIndexAction(index);
    };
  }

  function clearQueue() {
    return () => {
      void clearQueueAction();
    };
  }

  function returnToSearchResults() {
    return () => {
      returnToSearchResultsAction();
    };
  }

  return {
    activateResult,
    adjustVolume,
    clearQueue,
    focusPane,
    nextTrack,
    playQueueIndex,
    previousTrack,
    removeQueueIndex,
    returnToSearchResults,
    retryLyrics,
    retrySearch,
    runSearchQuery,
    seekPlayback,
    selectQueueIndex,
    selectResult,
    switchScreen,
    clearSession,
    closeAuthImport,
    openAuthImport,
    submitAuthImport,
    toggleHelp,
    toggleLyrics,
    togglePause,
    updateAuthCookieDraft,
    updateSearchQuery,
  };
}