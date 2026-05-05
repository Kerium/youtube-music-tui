export type SessionMode = "guest" | "restoring" | "authenticated" | "error";
export type SessionSource = "anonymous" | "env" | "file" | "manual";
export type SessionRestoreStatus = "idle" | "restoring" | "ready" | "error";

export interface SessionState {
  mode: SessionMode;
  source: SessionSource;
  label: string;
  restoreStatus: SessionRestoreStatus;
  lastAuthError: string | null;
}

export function createGuestSessionState(): SessionState {
  return {
    mode: "guest",
    source: "anonymous",
    label: "Anonymous Session",
    restoreStatus: "idle",
    lastAuthError: null,
  };
}

export function createRestoringSessionState(): SessionState {
  return {
    mode: "restoring",
    source: "anonymous",
    label: "Restoring Session…",
    restoreStatus: "restoring",
    lastAuthError: null,
  };
}

export function createAuthenticatedSessionState(
  source: Exclude<SessionSource, "anonymous">,
  label: string,
): SessionState {
  return {
    mode: "authenticated",
    source,
    label,
    restoreStatus: "ready",
    lastAuthError: null,
  };
}

export function createSessionErrorState(
  message: string,
  source: SessionSource = "anonymous",
): SessionState {
  return {
    mode: "error",
    source,
    label: "Anonymous Session",
    restoreStatus: "error",
    lastAuthError: message,
  };
}