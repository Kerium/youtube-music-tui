# Y Music Player TUI Implementation Plan

## Goal

Build a mouse-aware terminal application with OpenTUI that feels like a compact YouTube Music client:

- Search for songs, albums, artists, and playlists
- Show results with rich metadata
- Play audio and manage a queue
- Display cover art when the terminal supports graphics
- Show lyrics when they can be found
- Support both keyboard shortcuts and mouse interactions
- Stay usable when graphics or lyrics are unavailable

## Current Repo State

The project is currently a minimal OpenTUI core starter inside `y-music-player/`:

- Bun runtime is already set up
- `@opentui/core` is installed
- The entrypoint is still the default sample app
- `package.json` points `module` at `src/index.tsx`, but the script currently runs `src/index.ts`
- `tsconfig.json` is still generic Bun starter config rather than an OpenTUI-focused app config

The first implementation step should normalize the project around a React-based OpenTUI app.

## Technical Direction

### UI Framework

Use `@opentui/react` with `@opentui/core`.

Reasoning:

- This app will have multiple coordinated panes, focus management, async data fetching, queue state, and playback state
- React will make the UI tree, screen composition, and state transitions much easier to maintain than the current imperative core starter
- OpenTUI React already gives us the primitives we need for inputs, lists, scroll areas, keyboard handling, and responsive layout

### Music Data Source

Use `youtubei.js` as the primary provider behind a small internal adapter.

Reasoning:

- It is the more complete choice for YouTube private API access
- It can cover search, metadata lookup, and playback-oriented data in one integration path
- We should still wrap it in a provider interface so we can swap or augment it later if YouTube changes behavior

Optional fallback:

- Evaluate `ytmusic-api` only if we find specific YouTube Music metadata gaps during implementation

### Authentication

Treat authenticated YouTube sessions as a first-class capability, but keep them optional.

Initial approach:

- Use `youtubei.js` authenticated sessions behind an internal auth adapter
- Prefer cookie-based sign-in over the older TV OAuth flow
- Persist session material locally and restore it on startup
- Keep anonymous mode available as a fallback when auth is missing or invalid

Reasoning:

- Premium entitlements and account-specific playback behavior depend on an authenticated session
- `youtubei.js` supports cookies directly and also exposes sign-in flows, but its own docs now recommend cookies over the limited TV OAuth path
- Search, playback resolution, recommendations, and library-oriented features should all share the same session boundary
- Authentication must degrade cleanly so the app still works in a non-signed-in mode

Constraints:

- We should not ask for the user's Google password inside the TUI
- Cookie import and storage must be explicit, local-only, and easy to revoke
- We should not assume Premium guarantees perfect parity with official clients for every playback edge case
- Auth state should be visible in the UI so failures are understandable

Possible later enhancement:

- Add an explicit browser-profile cookie import helper for supported browsers and OSes, while keeping manual paste and env-based import as the baseline auth path

### Audio Playback

Use `mpv` as the playback backend, controlled through IPC.

Current implementation decision:

- Keep `mpv` as the Phase 4 backend for now, even though it is an external runtime dependency
- Prefer `mpv` playback through a normal YouTube Music watch URL plus `yt-dlp` extraction when `yt-dlp` is available locally, because direct Googlevideo stream URLs can be rejected even after they are successfully resolved
- Do not switch to lower-level audio libraries such as `libsoundio` for the current build, because they solve device output only and would still leave us responsible for decoding, buffering, seeking, volume handling, and stream lifecycle management
- If we later decide that users should not have to install `mpv` manually, the next step should be bundling or packaging the playback backend with releases rather than replacing the architecture with a custom low-level audio stack

Reasoning:

- It is much more reliable for pause, resume, seek, volume, and track transitions than trying to embed playback logic directly in the Bun process
- It keeps stream handling outside the TUI render loop
- IPC gives us a clean adapter layer for player state updates
- It lets the app stay focused on search, queueing, and UI state instead of taking ownership of codec and device-management details

Assumption:

- `mpv` will be a runtime dependency for the full app experience
- In local development, requiring `mpv` is acceptable; if we package the app later, we can revisit how that dependency is distributed

### Cover Art

Current implementation decision:

- The first Phase 5 pass should fetch and cache the best available YouTube thumbnail, then render it inline in the now-playing pane through a small terminal-safe preview renderer
- Respect `OPENTUI_NO_GRAPHICS=true` and disable cover rendering cleanly when the terminal does not advertise the capabilities we need
- Keep the cover renderer behind an adapter so a future Kitty-native image path can replace the initial preview renderer without touching the rest of the app

Implement cover rendering behind a `CoverRenderer` adapter with two modes:

1. Kitty graphics mode for supported terminals
2. Disabled graphics mode for unsupported terminals, SSH sessions, or explicitly disabled graphics

Reasoning:

- OpenTUI exposes graphics-related terminal support, but terminal graphics support is not universal
- For the first implementation, unsupported terminals should simply show a non-graphics state instead of attempting a visual fallback
- The adapter boundary should stay flexible so another fallback renderer can be added later without changing the rest of the app
- Cover art should be treated as an enhancement, not a hard requirement

### Lyrics

Implement lyrics as best-effort, not guaranteed.

Initial approach:

- Add a lyrics provider interface
- Start with a Genius-based lookup package or API-backed scraper
- Match on title plus artist, then normalize and rank candidates conservatively

Constraints:

- Lyrics availability will be inconsistent
- Matching will never be perfect
- The lyrics UI should be a separate toggleable window, not a permanently visible pane
- The window should clearly distinguish `loading`, `found`, and `not available`

## Product Scope for v1

### Core Features

- Optional YouTube sign-in with persisted session restore
- Search input with debounced queries
- Separate search and now-playing screens
- Search results pane with keyboard and mouse navigation
- Track metadata in now playing, including artist, album, duration, and cover status
- Queue management
- Playback controls: play, pause, next, previous, seek, volume
- Now playing view with embedded cover art, progress, and playback state
- Toggleable lyrics window with scrolling

### Nice-to-Have Features After v1

- Personalized home, library, and recommendations views
- Artist pages and album drill-down with playable album track lists from search results
- Playlist browsing
- Adaptive cover preview sizing that responds to available terminal width
- A true Kitty-native cover renderer path for higher-fidelity artwork on supported terminals
- A dynamic loading search results list instead of only rendering the current fixed visible slice
- Explicit browser-profile cookie import for supported browsers and OSes
- Search history and recent tracks
- Like/save shortcuts backed by local persistence
- Configurable themes and keybindings
- Background prefetching for thumbnails and lyrics
- Make the lyrics modal support explicit keyboard scrolling hints and page-style jumps
- Persist the lyrics cache on disk instead of only in memory

### Explicitly Out of Scope for First Pass

- Full private library sync parity with the official client
- Editing YouTube Music playlists remotely
- Multi-user sync
- Offline downloads

## Application Architecture

### High-Level Modules

Suggested structure:

```text
src/
  index.tsx
  app/
    App.tsx
    routes.ts
  ui/
    layout/
    panes/
    components/
    theme/
  state/
    app-store.ts
    player-store.ts
    search-store.ts
    queue-store.ts
    session-store.ts
  services/
    auth/
      auth-service.ts
      session-storage.ts
    music/
      provider.ts
      youtubei-provider.ts
      models.ts
    player/
      player.ts
      mpv-player.ts
      events.ts
    lyrics/
      provider.ts
      genius-provider.ts
      lyrics-window-state.ts
    covers/
      renderer.ts
      kitty-renderer.ts
      disabled-renderer.ts
    cache/
      cache.ts
      filesystem-cache.ts
  hooks/
    useAppShortcuts.ts
    useFocusRing.ts
    useMouseActions.ts
  lib/
    env.ts
    logger.ts
    text.ts
    errors.ts
```

### UI Layout

Use two primary application screens instead of showing search results and now playing side by side.

Primary screens:

- Search screen: search input, filters or tabs, results list, and a compact now-playing strip
- Now Playing screen: cover art, track metadata, and playback controls on the left; scrollable queue on the right inside the same panel
- Bottom: status bar and shortcut hints

Responsive fallback:

- Keep the search input and playback bar always visible
- Keep screen switching explicit and fast from keyboard or mouse
- Open lyrics in a separate floating window that can be shown or hidden on any layout

### UI Mockup

Wide terminal search screen (~100 cols):

```text
╭─ Y Music Player ────────────────────────────────────────────────────────────────────────────────╮
│ [Search]  Now Playing                                            🔍 Search: lo-fi study mix   │
╰─────────────────────────────────────────────────────────────────────────────────────────────────╯
┏━ Results ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ▸ Night Drive                                                                    3:41       ┃
┃    The Midnight · Endless Roads                                                             ┃
┃                                                                                             ┃
┃    Midnight City                                                                  4:02       ┃
┃    M83 · Hurry Up, We're Dreaming                                                          ┃
┃                                                                                             ┃
┃    Afterglow                                                                      3:55       ┃
┃    CHVRCHES · Every Open Eye                                                               ┃
┃                                                                                             ┃
┃    Blinding Lights                                                                3:20       ┃
┃    The Weeknd · After Hours                                                              ┃
┃                                                                                             ┃
┃    Levitating                                                                     3:23       ┃
┃    Dua Lipa · Future Nostalgia                                                           ┃
┃                                                                                             ┃
┃    Random Access Memories                                                         Album      ┃
┃    Daft Punk                                                                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
╭─ Now Playing Strip ────────────────────────────────────────────────────────────────────────────╮
│ Night Drive · The Midnight                     ▐▐  1:24 / 3:41  Queue: 4  Click to open     │
╰────────────────────────────────────────────────────────────────────────────────────────────────╯
╭────────────────────────────────────────────────────────────────────────────────────────────────╮
│ 1 Search  2 Now Playing  / search  Enter play  Space pause  l lyrics  q quit                │
╰────────────────────────────────────────────────────────────────────────────────────────────────╯
```

Wide terminal now playing screen (~100 cols):

```text
╭─ Y Music Player ────────────────────────────────────────────────────────────────────────────────╮
│ Search  [Now Playing]                                                   Night Drive · Active │
╰─────────────────────────────────────────────────────────────────────────────────────────────────╯
┏━ Now Playing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━ Queue ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ┌───────────────────┐  Night Drive                   ┃ ▸ Night Drive      The Midnight  playing  ┃
┃  │                   │  The Midnight                  ┃   Midnight City    M83              next  ┃
┃  │    cover art      │  Endless Roads · 2024          ┃   Afterglow        CHVRCHES               ┃
┃  │   (kitty gfx)     │                                ┃   Blinding Lights  The Weeknd             ┃
┃  │                   │  ━━━━━━━━╸──────── 1:24 / 3:41 ┃   Levitating       Dua Lipa               ┃
┃  └───────────────────┘                                ┃                                          ┃
┃                                                       ┃   Click to jump playback                 ┃
┃   ◂◂      ▐▐      ▸▸         🔊 ━━━━╸── 68%           ┃                                          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
╭────────────────────────────────────────────────────────────────────────────────────────────────╮
│ 1 Search  2 Now Playing  Space pause  n/p next/prev  l lyrics  q quit                        │
╰────────────────────────────────────────────────────────────────────────────────────────────────╯
```

Wide terminal now playing screen with graphics disabled:

```text
╭─ Y Music Player ────────────────────────────────────────────────────────────────────────────────╮
│ Search  [Now Playing]                                                   Night Drive · Active │
╰─────────────────────────────────────────────────────────────────────────────────────────────────╯
┏━ Now Playing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━ Queue ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ┌───────────────────┐  Night Drive                   ┃ ▸ Night Drive      The Midnight  playing  ┃
┃  │                   │  The Midnight                  ┃   Midnight City    M83              next  ┃
┃  │   graphics off    │  Endless Roads · 2024          ┃   Afterglow        CHVRCHES               ┃
┃  │                   │                                ┃   Blinding Lights  The Weeknd             ┃
┃  │   unsupported     │  ━━━━━━━━╸──────── 1:24 / 3:41 ┃   Levitating       Dua Lipa               ┃
┃  └───────────────────┘                                ┃                                          ┃
┃                                                       ┃   Click to jump playback                 ┃
┃   ◂◂      ▐▐      ▸▸         🔊 ━━━━╸── 68%           ┃                                          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
╭────────────────────────────────────────────────────────────────────────────────────────────────╮
│ 1 Search  2 Now Playing  Space pause  n/p next/prev  l lyrics  q quit                        │
╰────────────────────────────────────────────────────────────────────────────────────────────────╯
```

Lyrics window when opened:

```text
╭─ Lyrics: Night Drive - The Midnight ───────────────────────────────────────────────────────────╮
│                                                                                               │
│  I was looking for a sign                                                                     │
│  in the static and the streetlight glow                                                       │
│                                                                                               │
│  Running through the midnight rain                                                            │
│  trying to hear what the silence knows                                                        │
│                                                                                               │
│  ...                                                                                          │
│                                                                                               │
│                                                                                               │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ Scroll lyrics  Esc close  l toggle  Mouse wheel scroll                                       │
╰───────────────────────────────────────────────────────────────────────────────────────────────╯
```

Narrow terminal search screen (~60 cols):

```text
╭─ Y Music Player ──────────────────────────────────────╮
│ [Search]  Now Playing   🔍 lo-fi study mix            │
╰───────────────────────────────────────────────────────╯
┏━ Results ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                       ┃
┃  ▸ Night Drive                                   3:41 ┃
┃    The Midnight · Endless Roads                       ┃
┃                                                       ┃
┃    Midnight City                                 4:02 ┃
┃    M83 · Hurry Up, We're Dreaming                     ┃
┃                                                       ┃
┃    Afterglow                                     3:55 ┃
┃    CHVRCHES · Every Open Eye                          ┃
┃                                                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
╭─ Now Playing Strip ──────────────────────────────────╮
│ Night Drive · 1:24 / 3:41 · ▐▐ · Queue 4            │
╰──────────────────────────────────────────────────────╯
╭──────────────────────────────────────────────────────╮
│ 1 Search  2 Now Playing  / search  l lyrics  q quit  │
╰──────────────────────────────────────────────────────╯
```

Narrow terminal now playing screen (~60 cols):

```text
╭─ Y Music Player ──────────────────────────────────────╮
│ Search  [Now Playing]   Night Drive                  │
╰───────────────────────────────────────────────────────╯
┏━ Now Playing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ┌────────────┐  Night Drive                         ┃
┃  │   cover    │  The Midnight                        ┃
┃  │   / off    │  ━━━━━━━━━━━╸──────── 1:24 / 3:41    ┃
┃  └────────────┘  ◂◂  ▐▐  ▸▸   🔊 ━━━╸── 68%         ┃
┣━ Queue ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ▸ Night Drive                              playing   ┃
┃   Midnight City                              next    ┃
┃   Afterglow                                          ┃
┃   Blinding Lights                                    ┃
┃   Levitating                                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
╭──────────────────────────────────────────────────────╮
│ 1 Search  2 Now Playing  Space pause  l lyrics q quit│
╰──────────────────────────────────────────────────────╯
```

Mouse interaction targets:

- Click a result to select it
- Double-click or primary-click on the active action area to play
- Click the screen tabs or the now-playing strip to switch screens
- Click queue items to jump playback
- Click transport buttons for play, pause, next, previous, and mute
- Click the lyrics action to open or close the lyrics window
- Use the wheel or trackpad scroll gesture in results, queue, and the lyrics window

### State Model

Keep app state split by domain instead of one large store:

- Session state: signed-in status, session source, account label, last auth error, and restore status
- Search state: query, filters, loading, results, selection
- Player state: current track, position, duration, paused, volume, buffering
- Queue state: items, current index, history, repeat/shuffle flags
- Lyrics state: track key, loading status, content, source
- UI state: focused pane, active screen, notifications, terminal capability flags, and lyrics-window visibility

Interaction state should also track hoverable and clickable targets so keyboard focus and mouse focus do not fight each other.

The stores should be plain TypeScript modules with explicit actions so they remain easy to test.

## External Dependencies to Add

Expected packages:

- `@opentui/react`
- `react`
- `youtubei.js`
- A lyrics package or lightweight provider client
- `zod` for runtime validation of external data

Optional packages:

- `execa` if process management becomes cleaner than raw Bun spawn
- A small LRU cache utility if manual caching becomes noisy

System/runtime dependencies:

- `mpv`
- A terminal with graphics support for the best cover art experience, such as Kitty, WezTerm, or iTerm2 if compatible with the graphics path we implement

## Implementation Phases

## Phase 1: Foundation and Project Restructure

Deliverable: the app boots into a real OpenTUI React shell.

Tasks:

- Replace the starter sample with a React entrypoint at `src/index.tsx`
- Add `@opentui/react` and `react`
- Align `package.json` scripts with the real entrypoint
- Adjust TypeScript config to fit the OpenTUI app structure
- Add a theme module and base layout shell
- Add a top-level app state container and shared keyboard plus mouse event wiring

Acceptance criteria:

- The app launches into separate search and now-playing screens
- Global shortcuts work for quit, pane focus cycling, and command help
- Mouse interactions work for pane selection and basic list interaction
- The lyrics window can open and close independently of the main layout
- The layout survives terminal resize events cleanly

## Phase 2: Authentication and Session Foundation

Deliverable: the app can restore and use an authenticated YouTube session without making login mandatory.

Tasks:

- Define an auth service contract around `youtubei.js` session creation and restore
- Support cookie-based session import from a local config source
- Persist and reload session material securely enough for local single-user use
- Surface signed-in, signed-out, restoring, and auth-error states in the UI
- Add sign-out and session reset actions
- Ensure provider and playback services receive the active session through one shared boundary

Acceptance criteria:

- The app can start in anonymous mode with no auth configured
- The app can restore a previously configured authenticated session
- Invalid or expired auth fails visibly and falls back cleanly
- Search and playback code do not need separate auth handling paths

## Phase 3: Search Flow

Deliverable: users can type queries and browse real search results.

Tasks:

- Implement a music provider interface
- Add `youtubei.js` integration for search
- Add debounced search input
- Normalize returned entities into internal models
- Render results in a selectable list with type badges and secondary metadata
- Add loading, empty, and error states
- Add click and scroll interactions for the results pane

Acceptance criteria:

- Search feels responsive
- Keyboard and mouse navigation are predictable
- Search results remain stable under repeated queries and quick focus changes

## Phase 4: Playback Engine and Queue

Deliverable: users can play a selected track and manage a queue.

Tasks:

- Implement the player adapter contract
- Add an `mpv`-backed player service using IPC
- Resolve playable media for selected tracks
- Build queue actions: add, play now, remove, clear, next, previous
- Surface playback position and status to the UI
- Add playback shortcuts for play/pause, seek, volume, and track navigation

Acceptance criteria:

- Playback continues while the UI updates independently
- Queue changes are reflected immediately in the player state
- The app degrades cleanly when `mpv` is missing

## Phase 5: Cover Art Pipeline

Deliverable: the now playing area shows cover art when possible.

Tasks:

- Detect graphics capability at startup
- Download and cache thumbnails locally
- Build a cover renderer interface
- Implement a Kitty-graphics renderer path
- Implement a disabled-graphics renderer that shows a deliberate non-graphics state
- Handle refresh and cleanup when tracks change

Acceptance criteria:

- Supported terminals show cover art inside the now-playing panel without breaking layout
- Unsupported terminals show a clean graphics-disabled state
- Graphics failures never crash the app

## Phase 6: Lyrics Integration

Deliverable: lyrics appear for tracks when they are available.

Tasks:

- Implement lyrics provider contract
- Add metadata normalization for safer matching
- Fetch lyrics asynchronously after track selection or playback start
- Render lyrics in a separate toggleable scrollable window
- Add explicit unavailable and error states
- Cache successful lookups to avoid repeated requests

Acceptance criteria:

- Lyrics loading does not block search or playback
- False-positive matches are minimized
- The lyrics window does not disturb the underlying layout when opened or closed
- Missing lyrics are presented as a normal state, not as a failure

## Phase 7: Persistence and Quality-of-Life

Deliverable: the app starts to feel like a real daily-use tool.

Tasks:

- Persist config, cache, and recent history under XDG-style app directories
- Add configurable keybindings and theme values
- Add search history and recently played tracks
- Add toast or status notifications for background work and errors
- Add retry actions for network-dependent panes

Acceptance criteria:

- Restarting the app preserves useful local state
- Common failure paths are visible and recoverable

## Phase 8: Testing and Hardening

Deliverable: enough confidence to keep iterating without constant regressions.

Tasks:

- Add unit tests for provider normalization, queue logic, and state reducers/actions
- Add integration-style tests for keyboard flows where practical
- Add snapshot or render tests for major pane states
- Add smoke tests for app bootstrap with and without graphics enabled
- Validate behavior when network calls fail or `mpv` is missing

Acceptance criteria:

- Search, playback state, queue logic, and lyrics state transitions have coverage
- The app exits cleanly and restores the terminal reliably

## Key UX Decisions

### Focus Model

Use a pane-based focus system with mouse interaction layered on top.

Suggested defaults:

- `Tab` / `Shift+Tab`: move focus between regions on the active screen
- `1`: open search screen
- `2`: open now-playing screen
- `/`: focus search input
- `Enter`: play selected result or activate item
- `Space`: play/pause
- `j` / `k` or arrows: move selection
- `n` / `p`: next / previous track
- `[` / `]`: seek backward / forward
- `l`: open or close lyrics window
- `q`: quit

Mouse rules:

- Single click moves active pane and selection
- Single click on a screen tab or mini-player strip switches screens
- Double click activates the selected playable item
- Scroll affects only the hovered scrollable pane
- Hover should never trigger expensive network work by itself

### Feedback Rules

- Long-running actions must show visible status
- Errors should be recoverable where possible
- Missing graphics or lyrics should be explained once, not repeated noisily
- Mouse affordances should stay visually obvious in clickable areas
- Opening lyrics should feel modal or windowed, not like a permanent layout shift

## Risks and Mitigations

### 1. YouTube Private API Instability

Risk:

- Search or stream resolution may break when upstream changes land

Mitigation:

- Isolate provider logic behind interfaces
- Keep normalization logic local and tested
- Avoid leaking raw provider objects into UI state

### 2. Authentication Fragility and Credential Handling

Risk:

- Cookie-backed sessions can expire, break, or become invalid without warning
- Careless credential storage would create an avoidable local security problem

Mitigation:

- Keep auth behind a dedicated service boundary
- Store session material locally with explicit user control and clear removal paths
- Treat auth as optional at runtime and fall back to anonymous behavior when restore fails
- Surface auth failures once with a visible status instead of causing opaque provider errors

### 3. Terminal Graphics Variability

Risk:

- Cover art rendering may fail across terminals or remote sessions

Mitigation:

- Detect capabilities early
- Disable graphics cleanly when unsupported
- Keep the renderer interface open for a future fallback implementation
- Make graphics an optional enhancement path

### 4. Lyrics Quality and Availability

Risk:

- Matching can be wrong or incomplete

Mitigation:

- Use conservative matching and source labeling
- Allow easy refresh or manual retry later if needed
- Treat lyrics as best-effort only

### 5. Playback Process Management

Risk:

- External player lifecycle issues can leave orphan processes or stale state

Mitigation:

- Centralize process control in one adapter
- Add explicit cleanup on shutdown
- Keep player health checks simple and observable

## Recommended First Implementation Slice

The safest first vertical slice is:

1. Migrate to OpenTUI React
2. Build the screen layout and focus system
3. Add authenticated session restore with anonymous fallback
4. Implement search against `youtubei.js`
5. Let `Enter` add a result to a local queue
6. Add `mpv` playback for the selected queue item
7. Add the toggleable lyrics window after the base shell is stable

This gives a usable app early and reduces risk before adding graphics and lyrics.

## Definition of Done for v1

The app can be considered a strong v1 when all of the following are true:

- Optional sign-in works reliably and uses account entitlements when available
- Search is fast, keyboard-accessible, and mouse-friendly
- Selecting a track starts playback reliably
- Queue navigation and playback controls are stable
- Cover art appears inside now playing on supported terminals and disables cleanly elsewhere
- Lyrics load when available and fail quietly when not
- Lyrics open in a separate window only when requested
- The terminal is restored cleanly on exit
- Core flows are covered by targeted tests

## Implementation Note for Next Step

When implementation starts, Phase 1 should still begin by replacing the current core starter with a React entrypoint and updating the project scripts so the repository has a clean foundation. Immediately after that, Phase 2 should establish the authenticated session boundary so search and playback are built on the correct provider model from the start.