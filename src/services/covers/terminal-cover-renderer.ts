import { ptr } from "bun:ffi";
import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { OptimizedBuffer } from "../../../node_modules/@opentui/react/node_modules/@opentui/core";
// Keep the decoder on the same OpenTUI core instance used by the renderer.
import { TextureUtils } from "../../../node_modules/@opentui/react/node_modules/@opentui/core/3d";
import { getCoverCacheDirectory } from "../../lib/env";

import {
  COVER_PREVIEW_CELL_HEIGHT,
  COVER_PREVIEW_CELL_WIDTH,
  COVER_PREVIEW_PIXEL_HEIGHT,
  COVER_PREVIEW_PIXEL_WIDTH,
  type CoverArtCell,
  type CoverArtPayload,
  type CoverRenderRequest,
  type CoverRenderer,
} from "./renderer";

const CHARACTER_WIDTH = COVER_PREVIEW_CELL_WIDTH;
const CHARACTER_HEIGHT = COVER_PREVIEW_CELL_HEIGHT;
const DEFAULT_BACKGROUND = { red: 11, green: 15, blue: 20 };

interface RgbColor {
  blue: number;
  green: number;
  red: number;
}

interface TerminalCoverRendererOptions {
  cacheDir?: string;
}

function getCacheDir() {
  return getCoverCacheDirectory();
}

function toHexChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function toHexColor(color: RgbColor) {
  return `#${toHexChannel(color.red)}${toHexChannel(color.green)}${toHexChannel(color.blue)}`;
}

function getContentExtension(contentType: string | null) {
  if (!contentType) {
    return ".img";
  }

  if (contentType.includes("png")) {
    return ".png";
  }

  if (contentType.includes("webp")) {
    return ".webp";
  }

  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return ".jpg";
  }

  return ".img";
}

function normalizedColorToHex(value: number | undefined) {
  return toHexChannel((value ?? 0) * 255);
}

function normalizedRgbaToHex(channels: Float32Array, offset: number) {
  return `#${normalizedColorToHex(channels[offset])}${normalizedColorToHex(channels[offset + 1])}${normalizedColorToHex(channels[offset + 2])}`;
}

function buildRowsFromSupersampledBuffer(
  pixelData: Uint8Array,
  pixelWidth: number,
  bytesPerRow: number,
): CoverArtCell[][] {
  const buffer = OptimizedBuffer.create(CHARACTER_WIDTH, CHARACTER_HEIGHT, "unicode", {
    respectAlpha: true,
    id: "cover-preview",
  });

  try {
    buffer.drawSuperSampleBuffer(
      0,
      0,
      ptr(pixelData),
      pixelData.length,
      "rgba8unorm",
      bytesPerRow,
    );

    const chars = buffer.buffers.char;
    const foreground = buffer.buffers.fg;
    const background = buffer.buffers.bg;

    return Array.from({ length: CHARACTER_HEIGHT }, (_, rowIndex) => {
      return Array.from({ length: CHARACTER_WIDTH }, (_, columnIndex) => {
        const cellIndex = rowIndex * CHARACTER_WIDTH + columnIndex;
        const colorOffset = cellIndex * 4;
        const character = chars[cellIndex] ? String.fromCodePoint(chars[cellIndex]!) : " ";

        return {
          char: character,
          fg: normalizedRgbaToHex(foreground, colorOffset),
          bg: normalizedRgbaToHex(background, colorOffset),
        };
      });
    });
  } finally {
    buffer.destroy();
  }
}

function sampleBilinear(
  data: Uint8Array | Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const clampedX = Math.max(0, Math.min(sourceWidth - 1, x));
  const clampedY = Math.max(0, Math.min(sourceHeight - 1, y));
  const left = Math.floor(clampedX);
  const top = Math.floor(clampedY);
  const right = Math.min(sourceWidth - 1, left + 1);
  const bottom = Math.min(sourceHeight - 1, top + 1);
  const xWeight = clampedX - left;
  const yWeight = clampedY - top;

  function readPixel(pixelX: number, pixelY: number): [number, number, number, number] {
    const offset = (pixelY * sourceWidth + pixelX) * 4;
    return [
      data[offset] ?? DEFAULT_BACKGROUND.red,
      data[offset + 1] ?? DEFAULT_BACKGROUND.green,
      data[offset + 2] ?? DEFAULT_BACKGROUND.blue,
      data[offset + 3] ?? 255,
    ];
  }

  const topLeft = readPixel(left, top);
  const topRight = readPixel(right, top);
  const bottomLeft = readPixel(left, bottom);
  const bottomRight = readPixel(right, bottom);

  const redTop = topLeft[0] * (1 - xWeight) + topRight[0] * xWeight;
  const redBottom = bottomLeft[0] * (1 - xWeight) + bottomRight[0] * xWeight;
  const greenTop = topLeft[1] * (1 - xWeight) + topRight[1] * xWeight;
  const greenBottom = bottomLeft[1] * (1 - xWeight) + bottomRight[1] * xWeight;
  const blueTop = topLeft[2] * (1 - xWeight) + topRight[2] * xWeight;
  const blueBottom = bottomLeft[2] * (1 - xWeight) + bottomRight[2] * xWeight;
  const alphaTop = topLeft[3] * (1 - xWeight) + topRight[3] * xWeight;
  const alphaBottom = bottomLeft[3] * (1 - xWeight) + bottomRight[3] * xWeight;

  return [
    Math.round(redTop * (1 - yWeight) + redBottom * yWeight),
    Math.round(greenTop * (1 - yWeight) + greenBottom * yWeight),
    Math.round(blueTop * (1 - yWeight) + blueBottom * yWeight),
    Math.round(alphaTop * (1 - yWeight) + alphaBottom * yWeight),
  ];
}

function resizeImageData(
  data: Uint8Array | Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  const output = new Uint8Array(targetWidth * targetHeight * 4);

  for (let targetY = 0; targetY < targetHeight; targetY += 1) {
    const sourceY = ((targetY + 0.5) / targetHeight) * sourceHeight - 0.5;

    for (let targetX = 0; targetX < targetWidth; targetX += 1) {
      const sourceX = ((targetX + 0.5) / targetWidth) * sourceWidth - 0.5;
      const [red, green, blue, alpha] = sampleBilinear(
        data,
        sourceWidth,
        sourceHeight,
        sourceX,
        sourceY,
      );
      const offset = (targetY * targetWidth + targetX) * 4;

      output[offset] = red;
      output[offset + 1] = green;
      output[offset + 2] = blue;
      output[offset + 3] = alpha;
    }
  }

  return output;
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadCoverFile(sourceUrl: string, cacheDir: string) {
  await mkdir(cacheDir, { recursive: true });

  const hash = createHash("sha1").update(sourceUrl).digest("hex");
  const urlPath = new URL(sourceUrl).pathname;
  const hintedExtension = extname(urlPath);
  const hintedPath = join(cacheDir, `${hash}${hintedExtension || ".img"}`);

  if (await fileExists(hintedPath)) {
    return hintedPath;
  }

  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(`Cover download failed with HTTP ${response.status}.`);
  }

  const extension = hintedExtension || getContentExtension(response.headers.get("content-type"));
  const filePath = join(cacheDir, `${hash}${extension}`);

  if (!(await fileExists(filePath))) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writeFile(filePath, bytes);
  }

  return filePath;
}

export function createTerminalCoverRenderer(
  options: TerminalCoverRendererOptions = {},
): CoverRenderer {
  const cacheDir = options.cacheDir ?? getCacheDir();

  return {
    async render(request: CoverRenderRequest): Promise<CoverArtPayload> {
      const cachedPath = await downloadCoverFile(request.sourceUrl, cacheDir);
      const texture = await TextureUtils.fromFile(cachedPath);

      if (!texture || !texture.image?.data || !texture.image.width || !texture.image.height) {
        throw new Error(`Could not decode cover art for ${request.title}.`);
      }

      const pixelData = resizeImageData(
        texture.image.data,
        texture.image.width,
        texture.image.height,
        COVER_PREVIEW_PIXEL_WIDTH,
        COVER_PREVIEW_PIXEL_HEIGHT,
      );
      const bytesPerRow = COVER_PREVIEW_PIXEL_WIDTH * 4;
      const rows = buildRowsFromSupersampledBuffer(
        pixelData,
        COVER_PREVIEW_PIXEL_WIDTH,
        bytesPerRow,
      );

      return {
        bytesPerRow,
        cachedPath,
        height: rows.length,
        pixelData,
        pixelHeight: COVER_PREVIEW_PIXEL_HEIGHT,
        pixelWidth: COVER_PREVIEW_PIXEL_WIDTH,
        rows,
        sourceUrl: request.sourceUrl,
        width: rows[0]?.length ?? 0,
      };
    },
  };
}