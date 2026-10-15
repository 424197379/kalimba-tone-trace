# 2.4.34 local-library write protection

## Reproduced data-loss issue

Own-cloud Chromium2.4.33 had two library pages open before either import.
Page A imported id `qa-same-source-id`, title 并页旧谱, C4@0/1. Without a
refresh, page B imported the same ID, title 并页另一版, E4@0/1. B reported
success but showed only one local song. Reloading A also showed only the new
edition: this was an actual persisted overwrite, not merely a stale view.
The test used disposable app-created scores only; they were removed afterward.

## Intended bounded fix

Commit-time fresh strict raw storage, append-only group rebasing, one shared
Web Lock for webpage imports and deletions, and passive library refresh that
preserves a draft, filters and intentional selection. Lock contention or missing
support must fail clearly without discarding input or changing stored music.
The public browser lock coordinates updated same-origin pages; it does not make
uncooperative older code or direct synchronous helper calls transactional.

## Automated acceptance

- Initial aggregate failed two old VM fixtures missing the new deletingSong and
  reloadLibraryViews dependencies; those fixtures were repaired with their
  behavior assertions retained, then the gate was rerun successfully.
- Working aggregate and final clean baseline-plus-patch replay each completed1194
  runtime tests:1190 passed,4 optional private-source skips;15 compiler passed.
  The clean replay includes the final dedicated visible refresh-status element.
- Independent full-core gate passes1211/1211,zero skips, with all four private
  source fixtures enabled. Its final disclosure-only change was separately
  rerun through101 affected tests, all passing. The new concurrency suite has27
  cases with real production store/entry functions and controlled DOM/locks.
- Review found and fixed raw trim/stringified identity collisions, temporary
  passive-read failure losing selection, and a refresh warning hidden in the
  collapsed import form. Each has a regression.
- All57 music JSONs, generated library, audio/playback runtime, preference module,
  samples, archives and official server remain byte-identical to33. Formal
  server resource/MIME, private-path rejection and archive-access checks are included.

## Actual own-cloud Chromium acceptance

The private preview used the existing Python server. Official Node serving is
separately covered by the real HTTP tests, not inferred from that preview.

- Normal33→34 update was first checked on localhost8131. A separate127.0.0.1
  origin was then updated from32→34 after the core fixes. Final visible-status
  assets were refreshed using a harmless reviewed-build comment in the worker;
  the final dedicated libraryRefreshMessage element was observed in both tabs.
  This is development cache hygiene, not a change to the cache strategy.
- Two pre-opened pages: B's unsaved JSON and Birthday search stayed intact when
  A saved. B then imported the same requested ID; both editions were present.
- Actual targets were distinct: original C and new E. Original retained imported
  backing and0.40 speed; new had no backing and default0.55 speed. Browser Back
  kept the original page's selection, and reopening it restored its settings.
- Deleting the original through its named confirmation left the new edition
  intact and selected in the other page. Both lists converged through updates.
- On the final assets, near-concurrent UI clicks genuinely produced Web Lock
  contention: A saved, B displayed the busy-lock error, kept the complete JSON
  and re-enabled its button. Retrying B succeeded and both scores appeared in
  both lists. This is an observed contention outcome, not a promise that every
  pair of clicks overlaps or that localStorage itself is transactional.
- All disposable scores were removed through their exact-title confirmations
  on both test origins. No user-provided score was deleted.

Missing/denied lock APIs, corrupted storage, quota/read failures and deterministic
ordering are controlled automated cases, not browser settings altered for QA.
No new audio/source-fidelity or operating-system acceptance is claimed.

Final reviewed source hashes:
- src/song-store.js: b89e960a800b53f496ad099190e5f7bb947f45a37137927429df4f6528923a05
- src/song-library.js: 1a20979edb2f3831e0a1fbbf2d6b65e742a31532276fc0992e6e02423085bdef
- songs.html: cd99026907a0288d33c495a7435554e1957e1b66e4fec8a4f7f862f02428478f

Update or reopen all old library pages before importing. Older code and direct
synchronous helper callers do not honor this new UI lock. Unsupported locking
fails closed for import/delete while existing songs remain readable/playable.
Final portable source and cumulative patch are byte-compared with a fresh
baseline replay; private source images and evidence fixtures are excluded.
