# Do it later — review of the `giveaway` branch (2026-11-19)

Order to fix in: 1, then 2 + 5 together, then 3, then 4.

## High

1. **Any website opened on the event PC can read attendee data and wipe the app.**
   `server/index.js` CORS allows `Origin: "null"` (needed for the `file://` window), but a
   sandboxed iframe on any website also sends `Origin: null`. Requests come from 127.0.0.1,
   so they pass the "this PC only" check. Such a page can read `/api/registrations`, call
   `/api/app-reset/challenge`, read the WIPE code from the response and post it to `/wipe`.
   The "same host" check (Origin host == Host header) can also be bypassed by DNS rebinding.
   Fix: Electron adds a secret header to the app's own requests
   (`session.webRequest.onBeforeSendHeaders`) and the server requires it on everything not in
   `LAN_ALLOWED`. Also reject any `Host` that isn't localhost / 127.0.0.1 / the LAN IP.

2. **A revert can be lost while its assign is being uploaded.**
   `server/services/giveawaySync.js` keeps an op `pending` while it is being sent. If staff
   revert at that moment, `queueOp` (`server/database/giveaways.js`) cancels the assign and
   queues nothing, but the assign still reaches the cloud. The next pull shows the delegate as
   having the giveaway again.
   Fix: set status `sending` before the POST; `queueOp` only cancels ops still `pending`.

3. **A hung cloud request can stop giveaway sync for good.**
   The giveaway cloud calls set no axios timeout. `syncGiveaways()` keeps returning the same
   stuck `running` promise, so background giveaway sync stops until the app restarts.
   Fix: `timeout: 15000` on the giveaway calls, or a shared default in `server/config.js`.

4. **A restore that fails halfway leaves the app empty.**
   `server/routes/appReset.js` (restore) deletes the live DB, then copies the backup. If the
   copy fails (e.g. USB pulled), the app restarts with no data; the error only goes to the log.
   Fix: copy to `dbPath + ".restore"`, check it, then rename into place; only then delete the old files.

4b. **Cloud pull can lose un-pushed check-ins and edits** (found 2026-11-19, existing bug).
   `server/database/sync.js` uses `INSERT OR REPLACE`, which deletes and re-inserts the row
   for every attendee the cloud sends: the row gets a new local id, so its `push_pending`
   entry (keyed by the old id) never uploads and stays counted forever (blocks Restore /
   Clean All Data); local check-ins not pushed yet are overwritten by the cloud's values;
   local-only columns (customfields, campaignSource, avatarUrl…) are reset.
   Fix: `INSERT … ON CONFLICT(cloudId) DO UPDATE`, keeping the local id, and skip (or merge)
   rows that still have a `push_pending` entry.

## Medium

5. **Two ways into giveaway sync can run at the same time.** `/api/sync/push` and
   `/api/sync/pull` (`server/routes/sync.js`) call `pushGiveaways` / `pullGiveaways` directly,
   skipping the one-at-a-time guard in `syncGiveaways`. Route both through one guarded function.

6. ~~Every 409 from the cloud is treated as success~~ — checked 2026-11-19 in
   VosmosVirtualEvents/routes/Offline.js: 409 is only "already assigned" / "already
   reverted"; out of stock is 400. No change needed.

7. **A stuck queued change can block Restore and Clean All Data.** Queued giveaway changes are
   keyed by email. If a delegate's email changes in a cloud pull, a queued change under the old
   email shows "waiting" forever, and `pendingPushCount() > 0` blocks Restore / Clean All Data
   with no way to clear it in the app. Key by local / cloud id, or add a way to discard.

8. **Rejected changes are dismissed with one click** (`src/pages/giveaway/index.js`, the
   "rejected by cloud" chip). These may be real hand-outs that never reached the cloud.
   Add a confirm step, or let staff export the list first.

## Low

- Search doesn't escape `%` and `_` in LIKE (`server/database/giveaways.js`, getAttendees).
- The out-of-stock check is local only: two offline PCs can over-assign; the cloud rejects
  the extras later. Fine if intended, but staff should know.
- `server/config.js` now points at production (`api.vosmos.events`). Confirm that's intended.
- Restore doesn't check that the backup belongs to the activated event.
- `getSyncStatus` runs one DB lookup per queued change. Fine at event scale.

## Open decisions

- **uniqueUserId for desktop walk-ins** (parked 2026-11-19). Walk-ins registered on the
  desktop get no uniqueUserId (cloud `POST /offline/api/attendees` ignores it), so their
  badges use the older QR `{"id": cloudId | localId}`. Random IDs rejected. Options:
  1. Reserve a block of the cloud's `YZ_<n>` counter while online, hand out offline
     (same format; needs a new cloud endpoint; gaps in numbering).
  2. Per-PC prefix assigned at activation, counted locally (`D1_0001`).
  3. Cloud assigns on upload; offline walk-ins keep the old QR.
  Whatever is chosen: a cloud pull must not overwrite a local uniqueUserId with empty.
- **Cloud scanners reject underscores**: diy-ui `api/utils/badgeQr.js` and client
  `parseQrId` use `/^[A-Z0-9][A-Z0-9-]{0,63}$/i`, but in-person IDs are `YZ_1234`.
  The desktop already accepts `_` (fixed 2026-11-19). Not fixed in diy-ui.
- **Scan rules not ported from the cloud (step 2, 2026-11-19)**: the cloud turns away
  delegates whose `status` is hold / pending / reject(ed) ("registration isn't confirmed",
  403) and counts `printCount` on every print. The desktop stores neither field, so it
  checks those delegates in. Needs `status` (and `printCount`) in the pull + push first.
