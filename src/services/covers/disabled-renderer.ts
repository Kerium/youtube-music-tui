import type { CoverArtPayload, CoverRenderRequest, CoverRenderer } from "./renderer";

export class DisabledCoverRendererError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DisabledCoverRendererError";
  }
}

export function createDisabledCoverRenderer(reason: string): CoverRenderer {
  return {
    async render(_request: CoverRenderRequest): Promise<CoverArtPayload> {
      throw new DisabledCoverRendererError(reason);
    },
  };
}