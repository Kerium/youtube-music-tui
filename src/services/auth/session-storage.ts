import fs from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { getSessionStoragePath } from "../../lib/env";

const storedSessionSchema = z.object({
  version: z.literal(1),
  cookie: z.string().min(1),
  label: z.string().min(1),
  savedAt: z.string().min(1),
});

export type StoredSession = z.infer<typeof storedSessionSchema>;

export interface SessionStorageService {
  clear(): Promise<void>;
  read(): Promise<StoredSession | null>;
  write(input: { cookie: string; label: string }): Promise<StoredSession>;
}

export function createSessionStorageService(
  sessionFilePath = getSessionStoragePath(),
): SessionStorageService {
  async function ensureDirectory() {
    await fs.mkdir(path.dirname(sessionFilePath), { recursive: true });
  }

  return {
    async clear() {
      await fs.rm(sessionFilePath, { force: true });
    },

    async read() {
      try {
        const raw = await fs.readFile(sessionFilePath, "utf8");
        const parsed = JSON.parse(raw);
        return storedSessionSchema.parse(parsed);
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

      const nextSession = storedSessionSchema.parse({
        version: 1,
        cookie: input.cookie,
        label: input.label,
        savedAt: new Date().toISOString(),
      });

      await fs.writeFile(sessionFilePath, JSON.stringify(nextSession, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      });

      return nextSession;
    },
  };
}