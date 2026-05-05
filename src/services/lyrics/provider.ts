export interface LyricsLookupInput {
  album: string;
  artist: string;
  durationSeconds: number | null;
  title: string;
}

export interface LyricsLookupResult {
  source: string;
  text: string;
}

export interface LyricsProvider {
  getLyrics(input: LyricsLookupInput): Promise<LyricsLookupResult | null>;
}