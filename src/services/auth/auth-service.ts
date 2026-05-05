import { AUTH_COOKIE_ENV_VARS, getEnvCookieSource, getSessionStoragePath } from "../../lib/env";
import { createInnertubeClient } from "../../lib/youtubei";
import {
  createAuthenticatedSessionState,
  createGuestSessionState,
  createSessionErrorState,
  type SessionSource,
  type SessionState,
} from "../../state/session-store";
import {
  createSessionStorageService,
  type SessionStorageService,
} from "./session-storage";

interface AuthenticatedSession {
  client: Awaited<ReturnType<typeof createInnertubeClient>>;
  cookie: string;
  label: string;
  source: Exclude<SessionSource, "anonymous">;
}

export interface AuthResolution {
  message: string;
  session: SessionState;
}

export interface AuthService {
  getActiveClient(): Awaited<ReturnType<typeof createInnertubeClient>> | null;
  importCookie(cookie: string): Promise<AuthResolution>;
  restoreSession(): Promise<AuthResolution>;
  signOut(): Promise<AuthResolution>;
}

function normalizeCookie(cookie: string): string {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("; ");
}

function sessionLabelForSource(source: Exclude<SessionSource, "anonymous">): string {
  switch (source) {
    case "env":
      return "Authenticated Session (env)";
    case "file":
      return "Authenticated Session (saved)";
    case "manual":
      return "Authenticated Session (manual)";
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown authentication error.";
}

async function createAuthenticatedClient(
  cookie: string,
  source: Exclude<SessionSource, "anonymous">,
): Promise<AuthenticatedSession> {
  const client = await createInnertubeClient({
    cookie,
    generate_session_locally: true,
  });

  try {
    await client.getLibrary();
  } catch (error) {
    throw new Error(
      `Cookie session validation failed for ${source}. ${toErrorMessage(error)}`,
    );
  }

  return {
    client,
    cookie,
    label: sessionLabelForSource(source),
    source,
  };
}

export function createAuthService(
  storage: SessionStorageService = createSessionStorageService(),
): AuthService {
  let activeSession: AuthenticatedSession | null = null;

  async function activate(
    cookie: string,
    source: Exclude<SessionSource, "anonymous">,
    persist: boolean,
  ): Promise<AuthResolution> {
    const normalizedCookie = normalizeCookie(cookie);

    if (!normalizedCookie) {
      throw new Error("Cookie input is empty.");
    }

    const session = await createAuthenticatedClient(normalizedCookie, source);

    activeSession = session;

    if (persist) {
      await storage.write({
        cookie: normalizedCookie,
        label: session.label,
      });
    }

    return {
      message:
        source === "env"
          ? `Authenticated from ${AUTH_COOKIE_ENV_VARS.join(" or ")}.`
          : source === "file"
            ? `Restored authenticated session from ${getSessionStoragePath()}.`
            : `Authenticated and saved local cookie session to ${getSessionStoragePath()}.`,
      session: createAuthenticatedSessionState(source, session.label),
    };
  }

  return {
    getActiveClient() {
      return activeSession?.client ?? null;
    },

    async importCookie(cookie: string) {
      try {
        return await activate(cookie, "manual", true);
      } catch (error) {
        activeSession = null;

        return {
          message: "Cookie import failed. Continuing in anonymous mode.",
          session: createSessionErrorState(toErrorMessage(error), "manual"),
        };
      }
    },

    async restoreSession() {
      const envCookie = getEnvCookieSource();

      if (envCookie) {
        try {
          return await activate(envCookie.cookie, "env", false);
        } catch (error) {
          activeSession = null;

          return {
            message: `Authentication from ${envCookie.key} failed. Falling back to anonymous mode.`,
            session: createSessionErrorState(toErrorMessage(error), "env"),
          };
        }
      }

      const storedSession = await storage.read();

      if (!storedSession) {
        activeSession = null;

        return {
          message: "No saved auth session found. Running in anonymous mode.",
          session: createGuestSessionState(),
        };
      }

      try {
        return await activate(storedSession.cookie, "file", false);
      } catch (error) {
        activeSession = null;

        return {
          message: "Saved auth session could not be restored. Running in anonymous mode.",
          session: createSessionErrorState(toErrorMessage(error), "file"),
        };
      }
    },

    async signOut() {
      activeSession = null;
      await storage.clear();

      return {
        message: "Signed out and cleared the locally stored session.",
        session: createGuestSessionState(),
      };
    },
  };
}