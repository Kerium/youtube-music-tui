export const SHORTCUT_ACTIONS = [
  "screenSearch",
  "screenNowPlaying",
  "focusSearch",
  "toggleHelp",
  "toggleLyrics",
  "quit",
  "openAuth",
  "signOut",
  "focusNextPane",
  "focusPreviousPane",
  "moveDown",
  "moveUp",
  "back",
  "activate",
  "enqueue",
  "togglePause",
  "nextTrack",
  "previousTrack",
  "seekBackward",
  "seekForward",
  "volumeDown",
  "volumeUp",
  "removeQueueItem",
  "clearQueue",
  "retry",
  "saveAuth",
] as const;

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];
export type ShortcutConfig = Partial<Record<ShortcutAction, string[]>>;
export type ResolvedShortcutConfig = Record<ShortcutAction, string[]>;

interface ShortcutBinding {
  ctrl: boolean;
  key: string;
  meta: boolean;
  option: boolean;
  shift: boolean;
}

const DEFAULT_SHORTCUTS: ResolvedShortcutConfig = {
  screenSearch: ["1"],
  screenNowPlaying: ["2"],
  focusSearch: ["/"],
  toggleHelp: ["F1", "Shift+/", "H"],
  toggleLyrics: ["L"],
  quit: ["Q"],
  openAuth: ["A"],
  signOut: ["Ctrl+D"],
  focusNextPane: ["Tab"],
  focusPreviousPane: ["Shift+Tab"],
  moveDown: ["J", "Down"],
  moveUp: ["K", "Up"],
  back: ["Backspace", "Left"],
  activate: ["Enter"],
  enqueue: ["E"],
  togglePause: ["Space"],
  nextTrack: ["N"],
  previousTrack: ["P"],
  seekBackward: ["["],
  seekForward: ["]"],
  volumeDown: ["-"],
  volumeUp: ["=", "Shift+="],
  removeQueueItem: ["Delete", "Backspace"],
  clearQueue: ["C"],
  retry: ["R"],
  saveAuth: ["Ctrl+S"],
};

function uniqueBindings(bindings: string[]) {
  return Array.from(new Set(bindings.map((binding) => binding.trim()).filter(Boolean)));
}

function normalizeBindingKey(value: string) {
  switch (value.trim().toLowerCase()) {
    case "return":
      return "enter";
    case "del":
      return "delete";
    case "esc":
      return "escape";
    case "spacebar":
      return "space";
    default:
      return value.trim().toLowerCase();
  }
}

function parseBinding(binding: string): ShortcutBinding | null {
  const trimmedBinding = binding.trim();

  if (!trimmedBinding) {
    return null;
  }

  if (trimmedBinding === "+") {
    return {
      ctrl: false,
      key: "+",
      meta: false,
      option: false,
      shift: false,
    };
  }

  const parts = trimmedBinding.split("+").map((part) => part.trim()).filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  let ctrl = false;
  let meta = false;
  let option = false;
  let shift = false;
  let key = "";

  for (const part of parts) {
    const normalizedPart = normalizeBindingKey(part);

    if (normalizedPart === "ctrl" || normalizedPart === "control") {
      ctrl = true;
      continue;
    }

    if (normalizedPart === "meta" || normalizedPart === "alt" || normalizedPart === "cmd") {
      meta = true;
      continue;
    }

    if (normalizedPart === "option") {
      option = true;
      continue;
    }

    if (normalizedPart === "shift") {
      shift = true;
      continue;
    }

    key = normalizedPart;
  }

  if (!key) {
    return null;
  }

  return {
    ctrl,
    key,
    meta,
    option,
    shift,
  };
}

function getEventKeyCandidates(key: {
  name: string;
  sequence?: string;
}) {
  const candidates = new Set<string>();

  candidates.add(normalizeBindingKey(key.name));

  if (key.sequence?.trim()) {
    candidates.add(normalizeBindingKey(key.sequence));
  }

  return candidates;
}

export function resolveShortcutConfig(overrides: ShortcutConfig | null | undefined): ResolvedShortcutConfig {
  const resolved = {} as ResolvedShortcutConfig;

  for (const action of SHORTCUT_ACTIONS) {
    const overrideBindings = uniqueBindings(overrides?.[action] ?? []);
    resolved[action] = overrideBindings.length > 0
      ? overrideBindings
      : DEFAULT_SHORTCUTS[action];
  }

  return resolved;
}

export function sanitizeShortcutConfig(input: Record<string, string[]> | null | undefined): ShortcutConfig {
  const sanitized: ShortcutConfig = {};

  if (!input) {
    return sanitized;
  }

  for (const action of SHORTCUT_ACTIONS) {
    const value = input[action];

    if (!Array.isArray(value)) {
      continue;
    }

    const nextBindings = uniqueBindings(value);

    if (nextBindings.length > 0) {
      sanitized[action] = nextBindings;
    }
  }

  return sanitized;
}

export function matchesShortcut(
  key: {
    ctrl: boolean;
    meta: boolean;
    name: string;
    option: boolean;
    sequence?: string;
    shift: boolean;
  },
  bindings: string[],
) {
  const candidates = getEventKeyCandidates(key);

  return bindings.some((bindingLabel) => {
    const binding = parseBinding(bindingLabel);

    if (!binding) {
      return false;
    }

    return binding.ctrl === key.ctrl
      && binding.meta === key.meta
      && binding.option === key.option
      && binding.shift === key.shift
      && candidates.has(binding.key);
  });
}

export function formatShortcut(bindings: ResolvedShortcutConfig, action: ShortcutAction) {
  return bindings[action].join(" / ");
}

export function formatPrimaryShortcut(bindings: ResolvedShortcutConfig, action: ShortcutAction) {
  return bindings[action][0] ?? "";
}