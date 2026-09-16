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

`tools/index.ts` is an export-only compatibility facade. Implementations are owned by `tools/common`, `config`, `http`, `i18n`, `logging`, `notification`, `process`, `proxy`, and `update`. Manager jobs run inside an asynchronous log scope, producing independent `Manager-`, `DailyQuest-`, `Achievement-`, and `Artifact-YYYY-MM-DD.txt` files. WebSocket entries carry the same scope so each WebUI page renders only its corresponding job.

## Durable operations

`RunHistory` stores bounded, atomically replaced run snapshots under `data/manager`; `trackRunStep` attaches Core workflow results through an asynchronous scope. Platform clients do not import Manager.

`Scheduler` owns timezone-aware execution, serialized artifact requests and preview. Preview candidates are verified with node-cron's matcher because cron-parser uses different date/weekday semantics. Reload invalidates pending requests; it never resumes work from an older configuration generation.

`Diagnostics` creates isolated, bounded read-only probes and exposes only classified results. Authenticated server routes expose history, schedule preview, probes and a redacted JSON export. Health checks do not trigger external probes. The browser renders operation results with textContent and never puts credentials into URLs.

The backend uses TypeScript Node16 module resolution with CommonJS output (package.json has no type: module); browser scripts use Bundler resolution. Rollup/SEA remain the distribution pipeline. CI verifies Windows and Linux on Node 22.20.0, 24 and 26, including browser tests; tray compilation is Windows-only.
