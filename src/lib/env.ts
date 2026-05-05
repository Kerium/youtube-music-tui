import os from "node:os";
import path from "node:path";

export const APP_DIRECTORY_NAME = "y-music-player";
export const AUTH_COOKIE_ENV_VARS = [
  "YMP_YOUTUBE_COOKIE",
  "Y_MUSIC_PLAYER_YT_COOKIE",
] as const;

export function getConfigHome(): string {
  return process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), ".config");
}

export function getCacheHome(): string {
  return process.env.XDG_CACHE_HOME?.trim() || path.join(os.homedir(), ".cache");
}

export function getDataHome(): string {
  return process.env.XDG_DATA_HOME?.trim() || path.join(os.homedir(), ".local", "share");
}

export function getAppConfigDirectory(): string {
  return path.join(getConfigHome(), APP_DIRECTORY_NAME);
}

export function getAppCacheDirectory(): string {
  return path.join(getCacheHome(), APP_DIRECTORY_NAME);
}

export function getAppDataDirectory(): string {
  return path.join(getDataHome(), APP_DIRECTORY_NAME);
}

export function getSessionStoragePath(): string {
  return path.join(getAppConfigDirectory(), "session.json");
}

export function getCoverCacheDirectory(): string {
  return path.join(getAppCacheDirectory(), "covers");
}

export function getPreferencesStoragePath(): string {
  return path.join(getAppConfigDirectory(), "preferences.json");
}

export function getActivityStoragePath(): string {
  return path.join(getAppDataDirectory(), "activity.json");
}

export function getEnvCookieSource(): {
  cookie: string;
  key: (typeof AUTH_COOKIE_ENV_VARS)[number];
} | null {
  for (const key of AUTH_COOKIE_ENV_VARS) {
    const value = process.env[key]?.trim();

    if (value) {
      return {
        cookie: value,
        key,
      };
    }
  }

  return null;
}