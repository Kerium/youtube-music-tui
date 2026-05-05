import { Innertube, Platform } from "youtubei.js";

let isYoutubeJsConfigured = false;

interface BuildScriptResultLike {
  output: string;
}

interface ScriptEnvironmentLike {
  n?: string;
  sig?: string;
}

export function ensureYoutubeJsConfigured() {
  if (isYoutubeJsConfigured) {
    return;
  }

  Platform.shim.eval = async (
    data: BuildScriptResultLike,
    env: ScriptEnvironmentLike,
  ) => {
    const properties: string[] = [];

    if (env.n) {
      properties.push(`n: exportedVars.nFunction(${JSON.stringify(env.n)})`);
    }

    if (env.sig) {
      properties.push(`sig: exportedVars.sigFunction(${JSON.stringify(env.sig)})`);
    }

    const code = `${data.output}\nreturn { ${properties.join(", ")} }`;

    return new Function(code)();
  };

  isYoutubeJsConfigured = true;
}

export async function createInnertubeClient(
  config?: Parameters<typeof Innertube.create>[0],
) {
  ensureYoutubeJsConfigured();
  return Innertube.create(config);
}
