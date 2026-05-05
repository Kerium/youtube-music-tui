import type { MediaItem } from "../../state/app-store";
import type { PlaybackSource } from "../player/player";

export interface MusicProvider {
  browseAlbum(item: MediaItem): Promise<MediaItem[]>;
  resolvePlayback(item: MediaItem): Promise<PlaybackSource>;
  search(query: string): Promise<MediaItem[]>;
}
