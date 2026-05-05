import { Innertube } from "youtubei.js";

import { createInnertubeClient } from "../../lib/youtubei";
import type { MediaItem, MediaKind } from "../../state/app-store";
import type { MusicProvider } from "./provider";
import type { PlaybackSource } from "../player/player";

type SearchType = "song" | "album" | "artist" | "playlist";

interface MusicPerson {
  name: string;
}

interface ThumbnailLike {
  height?: number;
  url?: string;
  width?: number;
}

interface MusicResponsiveListItemLike {
  type?: string;
  id?: string;
  title?: string;
  name?: string;
  item_type?: string;
  duration?: {
    text: string;
    seconds: number;
  };
  album?: {
    id?: string;
    name: string;
  };
  artists?: MusicPerson[];
  authors?: MusicPerson[];
  author?: MusicPerson;
  subtitle?: {
    toString(): string;
  };
  subscribers?: string;
  song_count?: string;
  item_count?: string;
  year?: string;
  thumbnail?: unknown;
  thumbnails?: unknown;
}

interface MusicShelfLike {
  type: string;
  contents: MusicResponsiveListItemLike[];
}

interface MusicSearchLike {
  contents?: Array<MusicShelfLike | { type?: string }>;
}

const SEARCH_TYPES = ["song", "album", "artist", "playlist"] as const;
const RESULT_LIMITS: Record<SearchType, number> = {
  song: 6,
  album: 4,
  artist: 4,
  playlist: 4,
};

export function normalizeArtists(item: MusicResponsiveListItemLike) {
  const artistNames = item.artists?.map((artist) => artist.name).filter(Boolean);

  if (artistNames && artistNames.length > 0) {
    return artistNames.join(", ");
  }

  const authorNames = item.authors?.map((author) => author.name).filter(Boolean);

  if (authorNames && authorNames.length > 0) {
    return authorNames.join(", ");
  }

  return item.author?.name ?? "";
}

export function normalizeThumbnailGroup(source: unknown): ThumbnailLike[] {
  if (!source) {
    return [];
  }

  if (Array.isArray(source)) {
    return source;
  }

  if (typeof source === "object" && source !== null) {
    const candidate = source as { contents?: unknown; thumbnails?: unknown };

    if (Array.isArray(candidate.contents)) {
      return candidate.contents as ThumbnailLike[];
    }

    if (Array.isArray(candidate.thumbnails)) {
      return candidate.thumbnails as ThumbnailLike[];
    }

    return [source as ThumbnailLike];
  }

  return [];
}

export function normalizeThumbnailUrl(item: MusicResponsiveListItemLike) {
  const thumbnails = [item.thumbnail, item.thumbnails]
    .flatMap((group) => normalizeThumbnailGroup(group))
    .filter((thumbnail): thumbnail is ThumbnailLike & { url: string } => Boolean(thumbnail?.url));

  if (thumbnails.length === 0) {
    return null;
  }

  const bestThumbnail = thumbnails.reduce((selected, candidate) => {
    const selectedArea = (selected.width ?? 0) * (selected.height ?? 0);
    const candidateArea = (candidate.width ?? 0) * (candidate.height ?? 0);
    return candidateArea > selectedArea ? candidate : selected;
  });

  return bestThumbnail.url ?? null;
}

export function normalizeSong(item: MusicResponsiveListItemLike): MediaItem | null {
  const title = item.title ?? item.name;

  if (!title) {
    return null;
  }

  const artist = normalizeArtists(item) || "Unknown artist";
  const album = item.album?.name ?? "Single";
  const duration = item.duration?.text ?? "--:--";

  return {
    id: `song:${item.id ?? title}`,
    sourceId: item.id ?? null,
    isPlayable: Boolean(item.id),
    title,
    artist,
    album,
    thumbnailUrl: normalizeThumbnailUrl(item),
    duration,
    year: item.year ?? "",
    kind: "song",
    subtitle: [artist, album].filter(Boolean).join(" · "),
    trailingLabel: duration,
  };
}

export function normalizeAlbum(item: MusicResponsiveListItemLike): MediaItem | null {
  const title = item.title ?? item.name;

  if (!title) {
    return null;
  }

  const artist = normalizeArtists(item) || "Unknown artist";
  const year = item.year ?? "";

  return {
    id: `album:${item.id ?? title}`,
    sourceId: item.id ?? null,
    isPlayable: false,
    title,
    artist,
    album: title,
    thumbnailUrl: normalizeThumbnailUrl(item),
    duration: "--:--",
    year,
    kind: "album",
    subtitle: [artist, year].filter(Boolean).join(" · ") || "Album",
    trailingLabel: "ALBUM",
  };
}

export function normalizeAlbumTrack(
  item: MusicResponsiveListItemLike,
  albumItem: MediaItem,
): MediaItem | null {
  const title = item.title ?? item.name;

  if (!title || !item.id) {
    return null;
  }

  const artist = normalizeArtists(item) || albumItem.artist || "Unknown artist";
  const duration = item.duration?.text ?? "--:--";

  return {
    id: `song:${item.id}`,
    sourceId: item.id,
    isPlayable: true,
    title,
    artist,
    album: albumItem.title,
    thumbnailUrl: normalizeThumbnailUrl(item) ?? albumItem.thumbnailUrl,
    duration,
    year: albumItem.year,
    kind: "song",
    subtitle: [artist, albumItem.title].filter(Boolean).join(" · "),
    trailingLabel: duration,
  };
}

export function normalizeArtist(item: MusicResponsiveListItemLike): MediaItem | null {
  const title = item.name ?? item.title;

  if (!title) {
    return null;
  }

  return {
    id: `artist:${item.id ?? title}`,
    sourceId: item.id ?? null,
    isPlayable: false,
    title,
    artist: title,
    album: "Artist",
    thumbnailUrl: normalizeThumbnailUrl(item),
    duration: "--:--",
    year: "",
    kind: "artist",
    subtitle: item.subtitle?.toString() || "Artist",
    trailingLabel: "ARTIST",
  };
}

export function normalizePlaylist(item: MusicResponsiveListItemLike): MediaItem | null {
  const title = item.title ?? item.name;

  if (!title) {
    return null;
  }

  const owner = item.author?.name ?? (normalizeArtists(item) || "YouTube Music");
  const itemCount = item.item_count ?? item.song_count ?? "Playlist";

  return {
    id: `playlist:${item.id ?? title}`,
    sourceId: item.id ?? null,
    isPlayable: false,
    title,
    artist: owner,
    album: itemCount,
    thumbnailUrl: normalizeThumbnailUrl(item),
    duration: "--:--",
    year: item.year ?? "",
    kind: "playlist",
    subtitle: [owner, itemCount].filter(Boolean).join(" · "),
    trailingLabel: "PLAYLIST",
  };
}

export function normalizeItem(item: MusicResponsiveListItemLike, kind: MediaKind): MediaItem | null {
  switch (kind) {
    case "song":
      return normalizeSong(item);
    case "album":
      return normalizeAlbum(item);
    case "artist":
      return normalizeArtist(item);
    case "playlist":
      return normalizePlaylist(item);
  }
}

function getFirstShelf(result: MusicSearchLike) {
  return result.contents?.find(
    (item): item is MusicShelfLike =>
      item.type === "MusicShelf" && "contents" in item,
  );
}

function searchTypeToMediaKind(type: SearchType): MediaKind {
  switch (type) {
    case "song":
      return "song";
    case "album":
      return "album";
    case "artist":
      return "artist";
    case "playlist":
      return "playlist";
  }
}

function normalizeSearchResult(result: MusicSearchLike, type: SearchType) {
  const shelf = getFirstShelf(result);

  if (!shelf) {
    return [];
  }

  const kind = searchTypeToMediaKind(type);

  return shelf.contents
    .slice(0, RESULT_LIMITS[type])
    .map((item) => normalizeItem(item, kind))
    .filter((item): item is MediaItem => item !== null);
}

interface YoutubeMusicProviderOptions {
  getActiveClient?: () => Innertube | null;
}

export function createYoutubeMusicProvider(
  options: YoutubeMusicProviderOptions = {},
): MusicProvider {
  let anonymousClientPromise: Promise<Innertube> | null = null;

  async function getClient() {
    const activeClient = options.getActiveClient?.();

    if (activeClient) {
      return activeClient;
    }

    anonymousClientPromise ??= createInnertubeClient({
      generate_session_locally: true,
    });

    return anonymousClientPromise;
  }

  async function resolvePlayback(item: MediaItem): Promise<PlaybackSource> {
    if (!item.isPlayable || !item.sourceId) {
      throw new Error(`Playback is only available for playable tracks. ${item.title} is not supported yet.`);
    }

    const client = await getClient();
    const info = await client.getInfo(item.sourceId, { client: "YTMUSIC" });
    const format = info.chooseFormat({
      type: "audio",
      quality: "best",
    });

    if (!client.session.player) {
      throw new Error("YouTube player data is unavailable for stream deciphering.");
    }

    const url = await format.decipher(client.session.player);

    return {
      item,
      url,
      watchUrl: `https://music.youtube.com/watch?v=${item.sourceId}`,
      durationSeconds: info.basic_info.duration ?? null,
      mimeType: format.mime_type,
    };
  }

  return {
    async browseAlbum(item: MediaItem) {
      if (item.kind !== "album" || !item.sourceId) {
        throw new Error(`${item.title} is not a browsable album result.`);
      }

      const client = await getClient();
      const album = await client.music.getAlbum(item.sourceId);

      return (album.contents ?? [])
        .map((track) => normalizeAlbumTrack(track, item))
        .filter((track): track is MediaItem => track !== null);
    },

    async resolvePlayback(item: MediaItem) {
      return resolvePlayback(item);
    },

    async search(query: string) {
      const normalizedQuery = query.trim();

      if (!normalizedQuery) {
        return [];
      }

      const client = await getClient();
      const searches = await Promise.all(
        SEARCH_TYPES.map((type) => client.music.search(normalizedQuery, { type })),
      );

      return searches.flatMap((result, index) => {
        const type = SEARCH_TYPES[index] as SearchType;
        return normalizeSearchResult(result, type);
      });
    },
  };
}
