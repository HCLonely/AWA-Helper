# Windows bootstrap and updater

`AWA-Manager.exe` statically includes JSON parsing and gzip inflation. WinHTTP
handles HTTPS (including redirects and the system proxy), and BCrypt computes
SHA-256. The target machine needs no Node.js, PowerShell or tar installation for
the native updater. Build with `node scripts/build-tray.js` using MSVC x64 tools.

`scripts/package-windows.js` creates a program-only ustar/gzip archive, embeds
`installation.json` with per-file sizes/hashes and writes the archive checksum.
Publish the Manager EXE, archive and checksum together in a new Release. Older
packages without the installation manifest cannot be bootstrapped or repaired
by this updater; existing installations can still start and check for a newer
compatible release. Version numbers come from `package.json`.

GitHub requests use the original URL, then the three configured prefix proxies
in order. Missing releases/assets are terminal; transport, response parsing and
integrity failures advance to the next source. Downloads are restarted, not
appended across sources. SHA-256 is an integrity check, not publisher signing.

The main thread owns UI/child-process state. Background preparation posts progress
and results to it. An inherited, delete-on-close `.update/install.lock` serializes
native installation and coordinates with the standalone Helper's ProcessLock.
The temporary installer opens process handles before acknowledging the hand-off,
waits for graceful exit, and applies files with atomic per-file replacement.

`.update/current.json` records `prepared → installing → health → completed`.
Backups and the full rollback list are persisted before changing any target.
`installing`/`health` records are recovered on startup by an external copy of
Manager. The new Helper's tray READY message acknowledges successful startup.
Failure restores old files and removes newly added program files. If a process
cannot stop, files are not overwritten and recovery remains pending. User data
is outside the program allowlist. `.update/last-result.json` and
`logs/Updater.log` contain results; completed stages participate in the existing
retention policy, which keeps the newest successful backup.

Tray Helper update requests delegate to Manager without prematurely stopping
the scheduler. Standalone Helper keeps its updater but uses the same install
lock and refuses to overwrite a live tray installation. `update.bat` prefers the
Manager menu path and never kills all processes by executable name.

Run `node scripts/test-tray.js` on Windows for real installer subprocess tests,
rollback/recovery tests, archive boundary tests and offline release fixtures.
`npm run verify` covers TypeScript, lint, application tests and bundling. The
test executable substitutes network I/O and dialogs; production builds contain
neither the fixture hooks nor the test command-line modes.
