export type CoverArtStatus = "idle" | "loading" | "ready" | "disabled" | "error";

export interface CoverArtCell {
  char: string;
  fg: string;
  bg: string;
}

export const COVER_PREVIEW_CELL_WIDTH = 32;
export const COVER_PREVIEW_CELL_HEIGHT = 16;
export const COVER_PREVIEW_PIXEL_WIDTH = COVER_PREVIEW_CELL_WIDTH * 2;
export const COVER_PREVIEW_PIXEL_HEIGHT = COVER_PREVIEW_CELL_HEIGHT * 4;

export interface CoverArtPayload {
  bytesPerRow: number;
  cachedPath: string;
  height: number;
  pixelData: Uint8Array;
  pixelHeight: number;
  pixelWidth: number;
  rows: CoverArtCell[][];
  sourceUrl: string;
  width: number;
}

export interface CoverRenderRequest {
  sourceUrl: string;
  title: string;
}

export interface CoverRenderer {
  render(request: CoverRenderRequest): Promise<CoverArtPayload>;
}