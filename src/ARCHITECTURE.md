# Source architecture

`index.ts` always starts `ManagerRuntime`. With no arguments or `--manager`, Manager stays resident. With `--daily` or the deprecated `--helper` alias, Manager runs one DailyQuest job and then closes every job and the unified server.

- `client/` owns external AWA, Twitch, Steam, and ASF communication.
- `core/Manager/` owns application lifecycle, scheduling, job state, cancellation, and shutdown.
- `core/DailyQuest/`, `core/Achievement/`, and `core/Artifact/` contain business workflows and never start servers or exit the process.
- `server/` exposes one HTTP/HTTPS port and one WebSocket endpoint through Manager.
- `webUI/` contains all Manager and task pages.
- `tools/` contains configuration, logging, HTTP, process, notification, and other infrastructure.
- `data/` contains bundled read-only data; runtime data belongs outside `src`.

Dependencies flow from CLI and Server into Manager, then into Core jobs, Clients, and Tools. Clients and Tools must not import Core or Server modules.
