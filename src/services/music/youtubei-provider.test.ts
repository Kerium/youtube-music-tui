import { describe, expect, test } from "bun:test";

import {
  normalizeAlbumTrack,
  normalizeSong,
  normalizeThumbnailGroup,
  normalizeThumbnailUrl,
} from "./youtubei-provider";
import type { MediaItem } from "../../state/app-store";

function createAlbumItem(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "album:test",
    sourceId: "album:test",
    isPlayable: false,
    title: "Test Album",
    artist: "Album Artist",
    album: "Test Album",
    thumbnailUrl: "https://img.example/album-large.jpg",
    duration: "--:--",
    year: "2026",
    kind: "album",
    subtitle: "Album Artist · 2026",
    trailingLabel: "ALBUM",
    ...overrides,
  };
}

describe("youtubei normalization", () => {
  test("normalizeThumbnailGroup unwraps thumbnail collections", () => {
    expect(normalizeThumbnailGroup({
      contents: [{ url: "one" }, { url: "two" }],
    })).toEqual([{ url: "one" }, { url: "two" }]);

    expect(normalizeThumbnailGroup({
      thumbnails: [{ url: "three" }],
    })).toEqual([{ url: "three" }]);
  });

  test("normalizeThumbnailUrl picks the largest thumbnail across source shapes", () => {
    expect(normalizeThumbnailUrl({
      thumbnail: { contents: [{ url: "small", width: 80, height: 80 }] },
      thumbnails: [{ url: "large", width: 320, height: 320 }],
    })).toBe("large");
  });

  test("normalizeSong falls back to unknown artist and single when metadata is sparse", () => {
    expect(normalizeSong({
      title: "Loose Song",
    })).toEqual({
      id: "song:Loose Song",
      sourceId: null,
      isPlayable: false,
      title: "Loose Song",
      artist: "Unknown artist",
      album: "Single",
      thumbnailUrl: null,
      duration: "--:--",
      year: "",
      kind: "song",
      subtitle: "Unknown artist · Single",
      trailingLabel: "--:--",
    });
  });

  test("normalizeAlbumTrack falls back to the album thumbnail when the track has none", () => {
    expect(normalizeAlbumTrack({
      id: "track-1",
      title: "Track One",
      duration: { text: "4:01", seconds: 241 },
    }, createAlbumItem())).toEqual({
      id: "song:track-1",
      sourceId: "track-1",
      isPlayable: true,
      title: "Track One",
      artist: "Album Artist",
      album: "Test Album",
      thumbnailUrl: "https://img.example/album-large.jpg",
      duration: "4:01",
      year: "2026",
      kind: "song",
      subtitle: "Album Artist · Test Album",
      trailingLabel: "4:01",
    });
  });
});