# Y Music Player

> **Note:** This project was built entirely with AI (GitHub Copilot) as an experiment. The code, tests, and documentation were generated through AI-assisted development with minimal manual intervention.

A terminal-based YouTube Music client built with [Bun](https://bun.sh) and [OpenTUI](https://github.com/create-tui). Search, queue, and play music from YouTube Music directly in your terminal, with cover art rendering, lyrics lookup, and persistent history — no browser required.



## Features

- **YouTube Music search** — search songs, albums, artists, and playlists
- **Album browsing** — expand album results to see and play individual tracks
- **Queue management** — add tracks to a queue, skip, jump, and remove items
- **Playback via mpv** — real audio playback with seek, volume, pause, and automatic track advancement
- **Terminal cover art** — album art rendered as Unicode block characters; degrades gracefully when unsupported
- **Lyrics** — automatic lyrics lookup via [LRCLIB](https://lrclib.net), displayed in a scrollable overlay
- **Auth support** — authenticate with a YouTube cookie for access to your personal library; 
- **Persistent history** — search queries and recently played tracks survive app restarts
- **Configurable keybindings** — remap any action via `preferences.json`
- **Themeable** — override colors and border styles through `preferences.json`
- **Mouse support** — click to focus panes, select results, control playback



## Requirements

| Dependency | Notes |
|---|---|
| [Bun](https://bun.sh) ≥ 1.1 | Runtime and package manager |
| [mpv](https://mpv.io) | Required for audio playback |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Strongly recommended — improves stream extraction reliability |
| A terminal with RGB/Kitty graphics | Optional — needed for cover art rendering |

**Install mpv and yt-dlp:**

```bash
# macOS
brew install mpv yt-dlp

# Debian/Ubuntu
sudo apt install mpv yt-dlp

# Arch
sudo pacman -S mpv yt-dlp
```



## Installation

```bash
git clone https://github.com/your-username/y-music-player.git
cd y-music-player
bun install
```



## Running

```bash
# Production
bun run start

# Watch mode (auto-restart on file changes)
bun run dev
```


## Keybindings

| Key | Action |
|---|---|
| `1` | Switch to Search screen |
| `2` | Switch to Now Playing screen |
| `/` | Focus the search input |
| `Tab` / `Shift+Tab` | Cycle focus between panes |
| `J` / `↓` | Move selection down |
| `K` / `↑` | Move selection up |
| `Enter` | Play selected item / open album |
| `E` | Enqueue selected track |
| `Backspace` / `←` | Back to search results (from album view) |
| `Space` | Toggle pause |
| `N` | Next track |
| `P` | Previous track |
| `[` / `]` | Seek backward / forward 5s |
| `-` / `=` | Volume down / up |
| `Delete` | Remove selected queue item |
| `C` | Clear queue |
| `R` | Retry failed search or lyrics |
| `L` | Open/close lyrics overlay |
| `F1` / `H` / `Shift+/` | Open command help |
| `A` | Open auth import modal |
| `Ctrl+D` | Sign out |
| `Q` | Quit |

All keybindings are remappable. See [Configuration](#configuration).



## Authentication

The app works anonymously by default. Authenticating with a YouTube cookie unlocks your personal library and reduces rate limiting.

**Option 1 — In-app import:**

1. Export your YouTube cookie header from a browser (e.g. using a browser extension like *Get cookies.txt* or DevTools)
2. Press `A` in the app to open the import modal
3. Paste the full cookie string and press `Ctrl+S` to validate and save

**Option 2 — Environment variable:**

```bash
YMP_YOUTUBE_COOKIE="SAPISID=...; HSID=...; SID=..." bun run start
```

The `Y_MUSIC_PLAYER_YT_COOKIE` variable is also accepted as an alias.

The session is stored at `~/.config/y-music-player/session.json` with `0600` permissions. Press `Ctrl+D` or click **Sign Out** to clear it.



## Local Storage

All persistent data is stored outside the repository under standard XDG paths:

| File | Default location |
|---|---|
| Auth session | `~/.config/y-music-player/session.json` |
| Preferences | `~/.config/y-music-player/preferences.json` |
| Activity (history) | `~/.local/share/y-music-player/activity.json` |
| Cover art cache | `~/.cache/y-music-player/covers/` |

Override the base directories with `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, or `XDG_CACHE_HOME`.

---

## Environment Variables

| Variable | Description |
|---|---|
| `YMP_YOUTUBE_COOKIE` | YouTube cookie string for authentication |
| `Y_MUSIC_PLAYER_YT_COOKIE` | Alias for `YMP_YOUTUBE_COOKIE` |
| `OPENTUI_NO_GRAPHICS=true` | Disable terminal cover art rendering |
| `XDG_CONFIG_HOME` | Override config directory |
| `XDG_DATA_HOME` | Override data directory |
| `XDG_CACHE_HOME` | Override cache directory |

---

## Development

```bash
# Type-check
bun run typecheck

# Run tests
bun test

# Watch mode
bun run dev
```


## Tech Stack

- **[Bun](https://bun.sh)** — runtime, bundler, and test runner
- **[OpenTUI](https://github.com/create-tui)** — terminal UI framework with a React reconciler
- **[React 19](https://react.dev)** — component model for the TUI
- **[youtubei.js](https://github.com/LuanRT/YouTube.js)** — YouTube Music API client
- **[mpv](https://mpv.io)** — audio playback backend via IPC
- **[LRCLIB](https://lrclib.net)** — free, open lyrics API
- **[Zod](https://zod.dev)** — runtime schema validation for persistence
