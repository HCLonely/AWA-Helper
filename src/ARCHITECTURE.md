# Source architecture

`index.ts` always starts `ManagerRuntime`. With no arguments or `--manager`, Manager stays resident. With `--daily` or the deprecated `--helper` alias, Manager runs one DailyQuest job and then closes every job and the unified server.

- `client/AWA/` owns every `alienwarearena.com` request, including AWA's Steam quest and Twitch tracking endpoints.
- `client/Twitch/` owns only Twitch page and GraphQL requests.
- `client/Steam/` owns only ASF IPC operations; AWA Steam pages never enter this directory.
- Platform `Context` objects own session and transport state. HTTP is injected through `client/shared/HttpTransport`, while pure HTML parsing lives under each client's `parsers/` directory.
- `core/Manager/` owns application lifecycle, scheduling, job state, cancellation, and shutdown.
- `core/DailyQuest/`, `core/Achievement/`, and `core/Artifact/` contain business workflows and never start servers or exit the process.
- `server/` exposes one HTTP/HTTPS port and one WebSocket endpoint through Manager.
- `webUI/` contains all Manager and task pages.
- `tools/` contains configuration, logging, HTTP, process, notification, and other infrastructure.
- `data/` contains bundled read-only data; runtime data belongs outside `src`.

Dependencies flow from CLI and Server into Manager, then into Core jobs, Clients, and Tools. Clients and Tools must not import Core or Server modules.

Cross-platform workflows are always composed in Core. For example, `TwitchQuestTask` combines AWA tracking with Twitch channel discovery, and `SteamQuestTask` combines AWA quest preparation with ASF game control. Client APIs perform remote operations but do not schedule, retry, poll, or manage process lifetime.
