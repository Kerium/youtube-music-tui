import fs from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { getPreferencesStoragePath } from "../../lib/env";

const storedPreferencesSchema = z.object({
  version: z.literal(1),
  keybindings: z.record(z.string(), z.array(z.string().min(1))).default({}),
  savedAt: z.string().min(1),
  theme: z.object({
    border: z.record(z.string(), z.string()).optional(),
    colors: z.record(z.string(), z.string()).optional(),
  }).optional(),
});

export type StoredPreferences = z.infer<typeof storedPreferencesSchema>;

export interface PreferencesStorageService {
  read(): Promise<StoredPreferences | null>;
  write(input: {
    keybindings: Record<string, string[]>;
    theme?: {
      border?: Record<string, string>;
      colors?: Record<string, string>;
    } | null;
  }): Promise<StoredPreferences>;
}

export function createPreferencesStorageService(
  filePath = getPreferencesStoragePath(),
): PreferencesStorageService {
  async function ensureDirectory() {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  return {
    async read() {
      try {
        const raw = await fs.readFile(filePath, "utf8");
        return storedPreferencesSchema.parse(JSON.parse(raw));
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

      const storedPreferences = storedPreferencesSchema.parse({
        version: 1,
        keybindings: input.keybindings,
        savedAt: new Date().toISOString(),
        theme: input.theme ?? undefined,
      });

      await fs.writeFile(filePath, JSON.stringify(storedPreferences, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      });

      return storedPreferences;
    },
  };
}