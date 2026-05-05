import { z } from "zod";

import type { LyricsLookupInput, LyricsLookupResult, LyricsProvider } from "./provider";

const LRCLIB_BASE_URL = "https://lrclib.net/api";
const REQUEST_HEADERS = {
  "User-Agent": "y-music-player/0.1",
} as const;

const lyricsRecordSchema = z.object({
  albumName: z.string().nullish(),
  artistName: z.string().nullish(),
  duration: z.number().nullish(),
  instrumental: z.boolean().nullish(),
  plainLyrics: z.string().nullish(),
  syncedLyrics: z.string().nullish(),
  trackName: z.string().nullish(),
});

const lyricsSearchSchema = z.array(lyricsRecordSchema);

type LyricsRecord = z.infer<typeof lyricsRecordSchema>;

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\((feat\.?|ft\.?|with|live|remaster(ed)?|version|mono|stereo|official[^)]*)[^)]*\)/g, " ")
    .replace(/\[(feat\.?|ft\.?|with|live|remaster(ed)?|version|mono|stereo|official[^\]]*)[^\]]*\]/g, " ")
    .replace(/\b(feat\.?|ft\.?|with)\b.*$/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildCacheKey(input: LyricsLookupInput) {
  return [
    normalizeText(input.title),
    normalizeText(input.artist),
    normalizeText(input.album),
    input.durationSeconds ?? "unknown",
  ].join("::");
}

function buildUrl(path: string, params: Record<string, string | number | null | undefined>) {
  const url = new URL(`${LRCLIB_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
}

async function fetchRecord(url: URL) {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(8000),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`LRCLIB request failed with ${response.status}.`);
  }

  return lyricsRecordSchema.parse(await response.json());
}

async function fetchSearchResults(url: URL) {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`LRCLIB search failed with ${response.status}.`);
  }

  return lyricsSearchSchema.parse(await response.json());
}

function getLyricsText(record: LyricsRecord) {
  const plainLyrics = record.plainLyrics?.trim();

  if (plainLyrics) {
    return plainLyrics;
  }

  const syncedLyrics = record.syncedLyrics?.trim();

  if (!syncedLyrics) {
    return null;
  }

  const unsyncedLyrics = syncedLyrics.replace(/\[[0-9:.]+\]\s*/g, "").trim();
  return unsyncedLyrics || null;
}

function scoreRecord(record: LyricsRecord, input: LyricsLookupInput) {
  if (record.instrumental) {
    return Number.NEGATIVE_INFINITY;
  }

  const expectedTitle = normalizeText(input.title);
  const expectedArtist = normalizeText(input.artist);
  const expectedAlbum = normalizeText(input.album);
  const actualTitle = normalizeText(record.trackName ?? "");
  const actualArtist = normalizeText(record.artistName ?? "");
  const actualAlbum = normalizeText(record.albumName ?? "");

  if (!actualTitle || !actualArtist) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  if (actualTitle === expectedTitle) {
    score += 10;
  } else if (actualTitle.includes(expectedTitle) || expectedTitle.includes(actualTitle)) {
    score += 6;
  } else {
    return Number.NEGATIVE_INFINITY;
  }

  if (actualArtist === expectedArtist) {
    score += 8;
  } else if (actualArtist.includes(expectedArtist) || expectedArtist.includes(actualArtist)) {
    score += 4;
  } else {
    return Number.NEGATIVE_INFINITY;
  }

  if (expectedAlbum && actualAlbum) {
    if (actualAlbum === expectedAlbum) {
      score += 4;
    } else if (actualAlbum.includes(expectedAlbum) || expectedAlbum.includes(actualAlbum)) {
      score += 2;
    }
  }

  if (typeof input.durationSeconds === "number" && typeof record.duration === "number") {
    const delta = Math.abs(record.duration - input.durationSeconds);

    if (delta <= 2) {
      score += 6;
    } else if (delta <= 6) {
      score += 2;
    } else {
      score -= 3;
    }
  }

  if (getLyricsText(record)) {
    score += 1;
  }

  return score;
}

function toLookupResult(record: LyricsRecord): LyricsLookupResult | null {
  const text = getLyricsText(record);

  if (!text) {
    return null;
  }

  return {
    source: "LRCLIB",
    text,
  };
}

export function createLrclibLyricsProvider(): LyricsProvider {
  const cache = new Map<string, LyricsLookupResult | null>();

  return {
    async getLyrics(input) {
      const cacheKey = buildCacheKey(input);

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey) ?? null;
      }

      const normalizedAlbum = normalizeText(input.album);
      const exactLookupUrl = buildUrl("/get", {
        album_name: normalizedAlbum ? input.album : null,
        artist_name: input.artist,
        duration: input.durationSeconds,
        track_name: input.title,
      });
      const exactMatch = input.durationSeconds !== null
        ? await fetchRecord(exactLookupUrl)
        : null;

      const exactLyrics = exactMatch ? toLookupResult(exactMatch) : null;

      if (exactLyrics) {
        cache.set(cacheKey, exactLyrics);
        return exactLyrics;
      }

      const searchResults = await fetchSearchResults(
        buildUrl("/search", {
          album_name: normalizedAlbum ? input.album : null,
          artist_name: input.artist,
          track_name: input.title,
        }),
      );
      const bestMatch = searchResults
        .map((record) => ({ record, score: scoreRecord(record, input) }))
        .filter((candidate) => Number.isFinite(candidate.score) && candidate.score >= 12)
        .sort((left, right) => right.score - left.score)[0]?.record;
      const bestMatchLyrics = bestMatch ? toLookupResult(bestMatch) : null;

      cache.set(cacheKey, bestMatchLyrics ?? null);
      return bestMatchLyrics;
    },
  };
}