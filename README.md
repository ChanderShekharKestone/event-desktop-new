# Vosmos Event (event-desktop)

Offline-first desktop app for on-site event registration, QR check-in and badge printing.
Built with **Electron + React (CRA) + an embedded Express/SQLite server** that syncs with the Vosmos cloud.

## Architecture

```
Electron (electron/main.js)
 ├── starts embedded Express server (server/index.js)
 │     ├── HTTP  :4001  → REST API (/api/*) + serves React build for LAN devices
 │     ├── HTTPS :4002  → same app, self-signed cert (camera access for kiosk/scan on LAN)
 │     ├── SQLite (better-sqlite3) — migrations run on startup
 │     └── background sync: pull from cloud every 5 min, push local changes every 2 min
 └── BrowserWindow
       ├── dev:  http://localhost:3000 (react-scripts dev server)
       └── prod: build/index.html
```

| Folder          | What it is                                                                 |
|-----------------|----------------------------------------------------------------------------|
| `electron/`     | Electron main process (single-instance lock, DB backup on quit)           |
| `server/`       | Local Express API: `routes/`, `database/` (SQLite queries), `services/` (cloud pull/push), `migrations.js`, `seed.js` |
| `src/`          | React UI (MUI, Redux, hash router). API base URL in `src/apiPath.js`       |
| `public/`       | Static assets, app icons (`icon.icns`, `icon.ico`), `widget.js`            |
| `server-cloud/` | Separate mock/cloud API (Express + MongoDB). Git-ignored, own `package.json` |
| `note.txt`      | Handy curl commands for every local API endpoint                          |

### UI routes (hash router, e.g. `#/app/delegates`)

- `/` — activation screen
- `/register?type=attendee` — public registration form (also used by LAN devices)
- `/scan` — scan kiosk
- `/app` — dashboard, `/app/delegates`, `/app/scan-print`, `/app/settings`, `/app/registrations`

## Prerequisites

- Node.js (developed on v23) and npm
- macOS or Windows
- Xcode Command Line Tools on macOS / Build Tools on Windows (for compiling `better-sqlite3`)

## Setup

```bash
npm install
```

`postinstall` rebuilds `better-sqlite3` for Electron's Node version automatically.
If you ever see a `NODE_MODULE_VERSION` mismatch error, run it manually:

```bash
npx @electron/rebuild -f -w better-sqlite3
```

## Run in development

```bash
npm run dev
```

Starts the React dev server on `:3000`, waits for it, then launches Electron (which starts the local API on `:4001` / `:4002`).

Other scripts:

| Command               | What it does                                                     |
|-----------------------|------------------------------------------------------------------|
| `npm start`           | React dev server only (`:3000`)                                  |
| `npm run electron`    | Launch Electron only (expects `:3000` already running in dev)    |
| `npm run server`      | Run the local API standalone with plain Node (no Electron)       |
| `npm run dev:browser` | React + standalone API, use the app in a normal browser          |

> Note: `npm run server` / `dev:browser` use system Node, but `better-sqlite3` is compiled for Electron.
> If it fails to load, run `npm rebuild better-sqlite3` (and rebuild for Electron again before `npm run dev`).

Health check: `curl http://localhost:4001/api/health`

## Build installers

```bash
npm run dist
```

Builds React into `build/` and packages with electron-builder into `dist/`:
- macOS → `.dmg` (e.g. `dist/Vosmos Event-0.1.0-arm64.dmg`)
- Windows → NSIS `.exe` (run on Windows, or configure cross-build)

`better-sqlite3` and `node-machine-id` are unpacked from the asar so native code works in the packaged app.

## Build the Windows .exe on another PC

`better-sqlite3` is native code, so the Windows installer has to be built on a Windows machine.
Copy only the source files below. `npm install` recreates everything else.

### Files and folders to copy

| Copy                  | Why                                              |
|-----------------------|--------------------------------------------------|
| `package.json`        | Dependencies, scripts, electron-builder config   |
| `package-lock.json`   | Same dependency versions as on this machine      |
| `.env.production`     | Turns off source maps in the build (hidden file, easy to miss) |
| `electron/main.js`    | Electron main process (**only this file** from `electron/`) |
| `server/` (whole folder) | Embedded local API, DB migrations, sync       |
| `src/` (whole folder) | React UI source                                  |
| `public/` (whole folder) | `index.html`, `icon.ico`, `widget.js`, other assets |
| `README.md`, `note.txt` | Optional, docs only                            |

### Do NOT copy

| Skip                                   | Reason                                           |
|----------------------------------------|--------------------------------------------------|
| `node_modules/`                        | Built for macOS; must be reinstalled on Windows  |
| `build/`, `dist/`                      | Generated by `npm run dist`                      |
| `electron/app_data.db*`, `electron/backup/`, `electron/settings.json` | Local data and activation from this machine |
| `server-cloud/`                        | Separate mock cloud project, not part of the app |
| `sdk-files/`, `user.json`, `.git/`, `.DS_Store` | Not needed for the build                |

Zip it on the Mac (run in the project root):

```bash
zip -r event-desktop-win.zip package.json package-lock.json .env.production electron/main.js server src public README.md note.txt -x "*.DS_Store"
```

### On the Windows PC

1. Install **Node.js LTS** (20 or 22).
2. Install **Visual Studio Build Tools** with the *Desktop development with C++* workload, plus **Python 3**.
   You only need these if `better-sqlite3` has to compile from source, but having them avoids install failures.
3. Unzip the files, open PowerShell in the folder, and run:

   ```powershell
   npm install
   npm run dist
   ```

4. The installer is saved as `dist\Vosmos Event Setup 0.1.0.exe`.

Troubleshooting:
- **`Cannot create symbolic link` during `npm run dist`**: run PowerShell as Administrator, or turn on Windows *Developer Mode*, then run it again.
- **`better-sqlite3` build error during install**: check step 2, delete `node_modules`, then run `npm install` again.
- Before a production build, check `CLOUD_BASE` in `server/config.js`.

## Configuration

`server/config.js`:
- `CLOUD_BASE` — cloud API URL (currently UAT: `https://uat.event.vosmos.events/offline/api`)
- `PORT` (4001), `HTTPS_PORT` (4002)

If you change the port, also update `src/apiPath.js`.

## Data & settings location

| Mode               | SQLite DB / backups / `settings.json`                         |
|--------------------|---------------------------------------------------------------|
| Electron (dev + packaged) | Electron `userData` folder — macOS: `~/Library/Application Support/<app name>/` |
| Standalone `npm run server` | `electron/app_data.db`, `electron/backup/`, `electron/settings.json` |

- `DB_PATH` and `SETTINGS_PATH` env vars override these.
- A timestamped DB backup is written to `backup/` each time the app quits.
- `settings.json` holds activation state (`activated`, `eventId`, `expiresAt`). Delete it (or `DELETE /api/activation`) to reset activation.
- These files are git-ignored and excluded from the build.

## Activation

On first launch the app asks for an activation key. The key is validated against the cloud together with a machine ID
(SHA-256 of the hardware ID from `node-machine-id`, shown as `XXXX-XXXX-XXXX`). Activation expires at `expiresAt`, after which the app returns to the activation screen.

## LAN / kiosk use

Other devices on the same network can open the app served by this machine:
- Registration: `http://<LAN-IP>:4001/#/register?type=attendee`
- Kiosk/scan (needs camera → HTTPS): `https://<LAN-IP>:4002/#/scan` — accept the self-signed certificate warning

The LAN IP is printed in the console on startup and available at `GET /api/local-ip`.

## Test data

With the app running:

```bash
curl -X POST http://localhost:4001/api/seed                     # 1000 fake registrations
curl -X POST http://localhost:4001/api/seed -H "Content-Type: application/json" -d '{"count":500}'
curl -X DELETE http://localhost:4001/api/seed                   # remove seeded rows
curl -X DELETE http://localhost:4001/api/seed/event             # wipe all data for current event
```

See `note.txt` for the full list of endpoints (sync, scan, attendee types, badge templates, etc.).

## server-cloud (optional mock cloud)

```bash
cd server-cloud
npm install
MONGO_URI=mongodb://localhost:27017/eventdesktop npm run dev    # http://localhost:4000
```

Requires a local MongoDB. Seed scripts: `seed.js`, `seed2.js`, `seedActivationKey.js`, `seedRegistrationFields.js`.
To point the desktop app at it, change `CLOUD_BASE` in `server/config.js`.

## Backup, restore & Clean All Data

These are at the bottom of **Settings**. They only work on the host PC: LAN devices get `403`. The routes are in `server/routes/appReset.js`.

- **Export Backup:** you choose a folder, and the app saves two files there:
  - `vosmos-backup-<eventId>-<date>.db`, a full, restorable copy made with SQLite's online backup;
  - `registrations-<eventId>-<date>.csv`, all registrations for Excel or other software.

  It warns if the folder is on the laptop's own drive, because Clean All Data won't delete it.
- **Restore from Backup:** you pick a `.db` file. The app checks it (integrity check and expected tables), replaces the database and restarts.
- **Clean All Data:** for the end of an event, or before returning a laptop.
  - **Blocked while there are unpushed changes.**
  - Step 1: save a backup, or tick "don't need one".
  - Step 2: type a confirmation code the server generates, e.g. `WIPE-7K3Q`. The code is new each time, valid for 2 minutes and single-use.
  - What it deletes:
    - every table, for all events, followed by `VACUUM`, so deleted rows can't be recovered from the file;
    - `backup/` and `sdk-files/`;
    - `settings.json`, i.e. the activation;
    - Chromium storage.
  - The app then returns to the activation screen.
- **Uninstall:** `nsis.deleteAppDataOnUninstall: true` removes `%APPDATA%\Vosmos Event` when the app is uninstalled. It only works with the default one-click installer.

## Security (installed app)

These apply only to the installed app. `npm run dev` keeps DevTools, the menu and the seed endpoints.

- **Electron:** DevTools are disabled and the Reload/DevTools menu is removed. F12, Ctrl+Shift+I and similar shortcuts are blocked. New windows and navigation to outside sites are blocked, and the window runs sandboxed. The app won't start with `--remote-debugging-port`.
- **Electron fuses** (`build.electronFuses` in `package.json`): `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect` are disabled, and the app only loads from `app.asar`.
- **Source maps:** turned off in `.env.production`, so the full React source isn't shipped.
- **Local API (`server/index.js`):**
  - Requests from other network (LAN) devices can only reach the endpoints needed to register and scan. Everything else returns `403`.

    | Allowed from LAN devices |
    |---|
    | `GET /api/health`, `GET /api/sdk-configs`, `GET /api/registration-fields/by-type/:type` |
    | `POST /api/registrations` |
    | `GET /api/attendee-types`, `GET /api/badge-templates` |
    | `POST /api/scan/checkin`, `POST /api/scan/search` |

  - Admin endpoints (sync, activation, registration list, settings, SDK configs) only work from the PC running the app.
  - CORS only accepts requests from the Electron app, `localhost:3000` and pages served by this server.
  - `/api/seed` (test data and wipe) is not available in the installed app.

To give LAN devices access to another endpoint, add it to `LAN_ALLOWED` in `server/index.js`.

## Troubleshooting

- **App won't open a second window** — single-instance lock; the existing window is focused instead.
- **`better-sqlite3` load error** — rebuild for the runtime you're using (see Setup / scripts note).
- **Ports 4001/4002 in use** — another instance or old `npm run server` is running; kill it.
- **Camera not working on a LAN device** — use the HTTPS `:4002` URL, not HTTP.
