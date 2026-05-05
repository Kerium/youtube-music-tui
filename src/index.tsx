import { createRoot } from "@opentui/react";

// Keep the renderer and reconciler on the same core instance.
import { createCliRenderer } from "../node_modules/@opentui/react/node_modules/@opentui/core";

import { App } from "./app/App";

const renderer = await createCliRenderer({
  autoFocus: true,
  exitOnCtrlC: true,
  useMouse: true,
});

createRoot(renderer).render(<App />);