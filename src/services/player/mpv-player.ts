import { rm } from "node:fs/promises";
import { connect, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PlaybackSource, PlayerService, PlayerSnapshot } from "./player";

const SOCKET_RETRY_COUNT = 40;
const SOCKET_RETRY_DELAY_MS = 100;

const DEFAULT_SNAPSHOT: PlayerSnapshot = {
  backendStatus: "idle",
  backendMessage: null,
  currentItemId: null,
  idleActive: true,
  paused: true,
  volume: 68,
  positionSeconds: 0,
  durationSeconds: null,
};

interface MpvMessage {
  data?: unknown;
  error?: string;
  event?: string;
  name?: string;
  request_id?: number;
}

interface PendingCommand {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

class MpvPlayerService implements PlayerService {
  private buffer = "";
  private commandId = 0;
  private connectPromise: Promise<void> | null = null;
  private currentLoadToken = 0;
  private lastBackendError: string | null = null;
  private mpvPath = typeof Bun.which === "function" ? Bun.which("mpv") : null;
  private ytDlpPath = typeof Bun.which === "function" ? Bun.which("yt-dlp") : null;
  private pending = new Map<number, PendingCommand>();
  private process: ReturnType<typeof Bun.spawn> | null = null;
  private snapshot: PlayerSnapshot = {
    ...DEFAULT_SNAPSHOT,
    backendStatus: this.mpvPath ? "idle" : "missing",
    backendMessage: this.mpvPath ? null : "mpv is not installed.",
  };
  private socket: Socket | null = null;
  private socketPath = join(tmpdir(), `y-music-player-${process.pid}-${Date.now()}.sock`);
  private subscribers = new Set<(snapshot: PlayerSnapshot) => void>();

  subscribe(listener: (snapshot: PlayerSnapshot) => void) {
    this.subscribers.add(listener);
    listener(this.getSnapshot());

    return () => {
      this.subscribers.delete(listener);
    };
  }

  getSnapshot() {
    return { ...this.snapshot };
  }

  async load(source: PlaybackSource) {
    await this.ensureReady();

    const loadToken = ++this.currentLoadToken;
    const loadTarget = this.ytDlpPath && source.watchUrl ? source.watchUrl : source.url;

    this.updateSnapshot({
      backendMessage: null,
      backendStatus: "ready",
      currentItemId: source.item.id,
      durationSeconds: source.durationSeconds,
      idleActive: false,
      paused: false,
      positionSeconds: 0,
    });

    await this.sendCommand(["loadfile", loadTarget, "replace"]);

    if (loadToken !== this.currentLoadToken) {
      return;
    }

    await this.sendCommand(["set_property", "pause", false]);
  }

  async clear() {
    if (!this.mpvPath) {
      this.updateSnapshot({
        backendMessage: "mpv is not installed.",
        backendStatus: "missing",
      });
      return;
    }

    await this.ensureReady();
    await this.sendCommand(["stop"]);
    this.updateSnapshot({
      currentItemId: null,
      durationSeconds: null,
      idleActive: true,
      paused: true,
      positionSeconds: 0,
    });
  }

  async pause() {
    await this.ensureReady();
    await this.sendCommand(["set_property", "pause", true]);
    this.updateSnapshot({ paused: true });
  }

  async play() {
    await this.ensureReady();
    await this.sendCommand(["set_property", "pause", false]);
    this.updateSnapshot({ paused: false });
  }

  async togglePause() {
    if (this.snapshot.paused) {
      await this.play();
      return;
    }

    await this.pause();
  }

  async seekBy(seconds: number) {
    await this.ensureReady();
    await this.sendCommand(["seek", seconds, "relative"]);
  }

  async setVolume(volume: number) {
    await this.ensureReady();

    const nextVolume = Math.max(0, Math.min(100, Math.round(volume)));
    await this.sendCommand(["set_property", "volume", nextVolume]);
    this.updateSnapshot({ volume: nextVolume });
  }

  async dispose() {
    this.currentLoadToken += 1;
    this.connectPromise = null;

    for (const pending of this.pending.values()) {
      pending.reject(new Error("mpv player disposed."));
    }
    this.pending.clear();

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    await rm(this.socketPath, { force: true }).catch(() => undefined);
  }

  private emitSnapshot() {
    const snapshot = this.getSnapshot();

    for (const listener of this.subscribers) {
      listener(snapshot);
    }
  }

  private updateSnapshot(patch: Partial<PlayerSnapshot>) {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
    };

    this.emitSnapshot();
  }

  private createBackendError(message: string) {
    this.lastBackendError = message;
    this.updateSnapshot({
      backendMessage: message,
      backendStatus: this.mpvPath ? "error" : "missing",
    });

    return new Error(message);
  }

  private async ensureReady() {
    if (!this.mpvPath) {
      throw this.createBackendError("mpv is not installed. Install mpv to enable playback.");
    }

    if (this.socket && !this.socket.destroyed) {
      return;
    }

    this.connectPromise ??= this.startProcess();
    await this.connectPromise;
  }

  private async startProcess() {
    await rm(this.socketPath, { force: true }).catch(() => undefined);

    this.process = Bun.spawn(
      [
        this.mpvPath!,
        `--input-ipc-server=${this.socketPath}`,
        "--idle=yes",
        "--force-window=no",
        "--audio-display=no",
        "--no-terminal",
        ...(this.ytDlpPath ? ["--ytdl=yes", "--ytdl-format=bestaudio"] : []),
      ],
      {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "pipe",
      },
    );

    void this.captureStderr();
    void this.watchProcessExit();

    try {
      this.socket = await this.connectSocket();
      this.attachSocketHandlers(this.socket);
      await this.observeProperties();
      this.updateSnapshot({
        backendMessage: null,
        backendStatus: "ready",
      });
    } catch (error) {
      this.connectPromise = null;
      throw this.createBackendError(
        error instanceof Error ? error.message : "Failed to connect to mpv IPC.",
      );
    }
  }

  private async connectSocket() {
    for (let attempt = 0; attempt < SOCKET_RETRY_COUNT; attempt += 1) {
      try {
        const socket = await new Promise<Socket>((resolve, reject) => {
          const nextSocket = connect(this.socketPath);

          const handleError = (error: Error) => {
            nextSocket.removeListener("connect", handleConnect);
            reject(error);
          };

          const handleConnect = () => {
            nextSocket.removeListener("error", handleError);
            resolve(nextSocket);
          };

          nextSocket.once("error", handleError);
          nextSocket.once("connect", handleConnect);
        });

        return socket;
      } catch {
        await wait(SOCKET_RETRY_DELAY_MS);
      }
    }

    throw new Error("Timed out waiting for mpv IPC socket.");
  }

  private attachSocketHandlers(socket: Socket) {
    socket.setEncoding("utf8");

    socket.on("data", (chunk: string) => {
      this.buffer += chunk;

      let newlineIndex = this.buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = this.buffer.slice(0, newlineIndex).trim();
        this.buffer = this.buffer.slice(newlineIndex + 1);

        if (line) {
          this.handleMessage(line);
        }

        newlineIndex = this.buffer.indexOf("\n");
      }
    });

    socket.on("close", () => {
      this.socket = null;
      this.connectPromise = null;
    });

    socket.on("error", (error) => {
      this.createBackendError(`mpv IPC error: ${error.message}`);
    });
  }

  private handleMessage(line: string) {
    let message: MpvMessage;

    try {
      message = JSON.parse(line) as MpvMessage;
    } catch {
      return;
    }

    if (typeof message.request_id === "number") {
      const pending = this.pending.get(message.request_id);

      if (pending) {
        this.pending.delete(message.request_id);

        if (message.error && message.error !== "success") {
          pending.reject(new Error(`mpv command failed: ${message.error}`));
        } else {
          pending.resolve(message.data);
        }
      }
    }

    if (message.event === "property-change") {
      this.handlePropertyChange(message.name, message.data);
    }
  }

  private handlePropertyChange(name: string | undefined, data: unknown) {
    switch (name) {
      case "pause": {
        if (typeof data === "boolean") {
          this.updateSnapshot({ paused: data });
        }
        break;
      }
      case "time-pos": {
        const positionSeconds = toNumber(data);
        if (positionSeconds !== null) {
          this.updateSnapshot({ positionSeconds });
        }
        break;
      }
      case "duration": {
        const durationSeconds = toNumber(data);
        this.updateSnapshot({ durationSeconds });
        break;
      }
      case "volume": {
        const volume = toNumber(data);
        if (volume !== null) {
          this.updateSnapshot({ volume: Math.max(0, Math.min(100, Math.round(volume))) });
        }
        break;
      }
      case "idle-active": {
        if (typeof data === "boolean") {
          this.updateSnapshot(
            data
              ? { idleActive: true, paused: true, positionSeconds: 0 }
              : { idleActive: false },
          );
        }
        break;
      }
    }
  }

  private async observeProperties() {
    await this.sendCommand(["observe_property", 1, "pause"]);
    await this.sendCommand(["observe_property", 2, "time-pos"]);
    await this.sendCommand(["observe_property", 3, "duration"]);
    await this.sendCommand(["observe_property", 4, "volume"]);
    await this.sendCommand(["observe_property", 5, "idle-active"]);
    await this.sendCommand(["get_property", "volume"]);
  }

  private async sendCommand(command: unknown[]) {
    await this.ensureReady();

    if (!this.socket) {
      throw this.createBackendError("mpv IPC socket is unavailable.");
    }

    const requestId = ++this.commandId;
    const payload = JSON.stringify({ command, request_id: requestId }) + "\n";

    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(requestId, { reject, resolve });
      this.socket!.write(payload, (error) => {
        if (error) {
          this.pending.delete(requestId);
          reject(error);
        }
      });
    });
  }

  private async captureStderr() {
    if (!this.process?.stderr || typeof this.process.stderr === "number") {
      return;
    }

    const stderrText = await new Response(this.process.stderr).text();
    const trimmed = stderrText.trim();

    if (trimmed) {
      this.lastBackendError = trimmed.split("\n").at(-1) ?? trimmed;
    }
  }

  private async watchProcessExit() {
    if (!this.process) {
      return;
    }

    const exitCode = await this.process.exited;

    if (exitCode !== 0) {
      this.createBackendError(
        this.lastBackendError ?? `mpv exited unexpectedly with code ${exitCode}.`,
      );
    }
  }
}

export function createMpvPlayerService(): PlayerService {
  return new MpvPlayerService();
}
