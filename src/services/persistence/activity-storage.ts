import fs from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { getActivityStoragePath } from "../../lib/env";

const recentTrackSchema = z.object({
  album: z.string(),
  artist: z.string(),
  playedAt: z.string().min(1),
  title: z.string().min(1),
});

const storedActivitySchema = z.object({
  recentTracks: z.array(recentTrackSchema).default([]),
  savedAt: z.string().min(1),
  searchHistory: z.array(z.string().min(1)).default([]),
  version: z.literal(1),
});

export type StoredRecentTrack = z.infer<typeof recentTrackSchema>;
export type StoredActivity = z.infer<typeof storedActivitySchema>;

export interface ActivityStorageService {
  read(): Promise<StoredActivity | null>;
  write(input: {
    recentTracks: StoredRecentTrack[];
    searchHistory: string[];
  }): Promise<StoredActivity>;
}

export function createActivityStorageService(
  filePath = getActivityStoragePath(),
): ActivityStorageService {
  async function ensureDirectory() {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  return {
    async read() {
      try {
        const raw = await fs.readFile(filePath, "utf8");
        return storedActivitySchema.parse(JSON.parse(raw));
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : null;

        if (code === "ENOENT") {
          return null;
        }

        throw error;
      }
    },

    async write(input) {
      await ensureDirectory();

      const storedActivity = storedActivitySchema.parse({
        recentTracks: input.recentTracks,
        savedAt: new Date().toISOString(),
        searchHistory: input.searchHistory,
        version: 1,
      });

      await fs.writeFile(filePath, JSON.stringify(storedActivity, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      });

      return storedActivity;
    },
  };
}