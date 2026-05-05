export const SCREENS = ["search", "nowPlaying"] as const;

export type AppScreen = (typeof SCREENS)[number];

export type FocusPane =
  | "searchInput"
  | "results"
  | "miniPlayer"
  | "nowPlaying"
  | "queue";

export const DEFAULT_PANE_BY_SCREEN: Record<AppScreen, FocusPane> = {
  search: "searchInput",
  nowPlaying: "nowPlaying",
};

export const FOCUS_ORDER_BY_SCREEN: Record<AppScreen, FocusPane[]> = {
  search: ["searchInput", "results", "miniPlayer"],
  nowPlaying: ["nowPlaying", "queue"],
};