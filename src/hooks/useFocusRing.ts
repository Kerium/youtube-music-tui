import {
  DEFAULT_PANE_BY_SCREEN,
  FOCUS_ORDER_BY_SCREEN,
  type AppScreen,
  type FocusPane,
} from "../app/routes";

export function useFocusRing() {
  function getPanesForScreen(screen: AppScreen): FocusPane[] {
    return FOCUS_ORDER_BY_SCREEN[screen];
  }

  function getDefaultPane(screen: AppScreen): FocusPane {
    return DEFAULT_PANE_BY_SCREEN[screen];
  }

  function getNextPane(
    screen: AppScreen,
    currentPane: FocusPane,
    direction: "forward" | "backward",
  ): FocusPane {
    const panes = getPanesForScreen(screen);
    const currentIndex = panes.indexOf(currentPane);

    if (currentIndex < 0) {
      return getDefaultPane(screen);
    }

    const delta = direction === "forward" ? 1 : -1;
    const nextIndex = (currentIndex + delta + panes.length) % panes.length;

    return panes[nextIndex] ?? getDefaultPane(screen);
  }

  return {
    getDefaultPane,
    getNextPane,
    getPanesForScreen,
  };
}