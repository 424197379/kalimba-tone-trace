# 2.4.46 — Isolate saved speeds by song

Own-cloud local preview; no new commit, push or public deployment. Previous45
source and patch remain separately frozen.

## User-visible change and boundaries

Different songs now save speed preferences to separate keys, avoiding rollback
of another song's newer setting when independent document agents overlap their
read/modify/write operations. Existing saved values load through read-only
legacy fallback; the old document remains byte-identical. Present damaged or
future new records are retained and reported rather than replaced or bypassed.
Library durations refresh on the new per-song storage events.

Refresh all old practice/library pages after upgrade. Old pages cannot see the
new format, and their later old-map writes do not supersede a new record. The
same song still has last-write behavior; shared recent-practice ordering retains
its prior concurrent-update limitation. See `SONG_SPEED_ISOLATION.md` for the
precise contract. This is not a whole-application transactional-storage claim.

## Scope

Functional changes only: `src/practice-preferences.js` and the library's speed
storage-event listener. Player app, CSS, all57 song files, generated music,
13 internal archives,21 samples, importer/AI prompt and compiler skill remain
unchanged from45. Version holders, two existing test files and explanatory
documents update; Service Worker changes version/comment only, not strategy.

Reviewed preference SHA-256:
`524476fdac2ea961cb4704da6c591d6d52c13470ef4333d83dd75d79d5151f0f`

Reviewed library SHA-256:
`883dc61a900d862f10aeaca0e8b153911d3ac2baf4a60ae95b01d497b6073192`

## Concurrency evidence

Independent JS agents execute frozen45/current actual functions against atomic
individual storage operations. A's first write waits until B has fully saved and
read back. Eight expected differential outcomes pass: old shared-map saves lose
the other song's update; new first/existing per-song saves retain both; legacy
bytes and unknown metadata remain; same-song last-write behavior remains.

This is an algorithmic inter-agent model, supported by the storage standard's
absence of an inter-agent locking guarantee. No actual Chromium race occurrence
or frequency is claimed. Ordinary sequential browser saves are a separate check.

## Actual own-cloud browser

- Normal45 UI first saved Birthday0.80 and Twinkle1.10. The normal update control
  reported46; the other open page remained45 until explicitly refreshed.
- Refreshed46 restored both old values. Separate slider changes to0.85/1.05
  survived reload, while the already-open library changed durations to18/35sec
  without reload. Light/off backing selections stayed independent.
- Birthday light-backing loop could pause, change speed0.85→0.80 without starting,
  and continue with the loop retained. A later full nonloop Demo ended normally
  with the explicit end status. Subsecond session timing is covered by tests,
  not inferred solely from the browser's rounded progress label.
- Controlled synthetic future-record and quota-failure pages used exact player
  and speed algorithms with isolated in-memory storage adapters. Read failures
  showed the warning/default0.55 rather than stale1.10; save failures showed the
  warning while the selected current0.65/1.05 still completed Demo normally.
  These are fault-injected application checks, not real-browser quota failures.
- A real-UI four-note synthetic import opened directly, saved0.75, retained it on
  reload and displayed the matching card duration. Named confirmation removed
  the test song. Final36 cards,zero local songs and empty raw draft confirmed.
- Temporary fixtures were removed from the release tree. All338 gated files
  remained identical. Final normal page: Shengshengman0.65, stopped,loop off.

No subjective sound, physical-kalimba or real-device battery/performance approval
is inferred from these checks.

## Offline local gates and packaging

- Independent complete `npm check`:1,854 runtime+16 compiler tests passed,
  zero failures/skips. All9 actual private source-fixture gates ran; all42 files
  behind those inputs and338 source files remained unchanged across the gate.
- Clean baseline-patch portable `npm check`:1,845 runtime passed,9 explicitly
  unavailable private-fixture checks skipped,+16 compiler passed; zero failures,
  exit0 and all338 files unchanged. Private fixture skips are not source-image
  approval or a CI-added test exclusion. Validator:57 records,7,633 source-record
  steps,zero errors,607 existing warnings.
- Runs used process-local offline/no-update-notifier/no-audit/no-fund settings
  with CI=true; the nested inheritance probe passed. No install was needed.
  An earlier malformed offline npm-exec command stopped with ENOTCACHED before
  tests ran and is not counted; the corrected local test commands completed.
- Actual official `npm start` was separately exercised: all22 APP_SHELL URL
  entries and21 sample responses returned exact200 status,expected MIME and
  source bytes; protected private/new-internal-archive requests returned403.
  The existing server listens on0.0.0.0:8123; requests used127.0.0.1. No tunnel
  or public deployment was created. Browser preview8131 is a separate check.
- Final archive and cumulative patch include this verification document as the
  sole addition after the338-file gates. Final339 source files must match the
  repository, ZIP and clean replay from baseline
  `73041efc803b6c4f16046c8fc0ceaefc08fcc507` byte for byte. Source fixtures,
  private review artifacts and temporary QA copies are excluded.
