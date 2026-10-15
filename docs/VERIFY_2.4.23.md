# 2.4.23 explicit external backing-field guard

Local preview only; no publication. New imports containing own top-level
`practiceAccompaniment` now receive a field-specific error before projection
or writes. This covers individual songs and a batch wrapper. Input is retained.
The error asks for a complete, source-checked `autoAccompaniment` representation,
not deletion, blind renaming, merging or automatic layer selection. Metadata
with that name and historical stored-song reads remain compatible.

## Checks

- Working tree `npm run check`: 835 runtime tests and 15 compiler-evidence tests
  passed, plus both existing standalone transcription/suitability scripts,
  validator and syntax checks. Independent and clean replay results are recorded
  below when complete.
- Actual session regressions parse and save a supported external fixture, then
  exercise production selection/control/scheduler functions: own mode emits
  exactly G3/C4; demo emits those two plus four melody attacks. Default off,
  visible legacy button, hidden light-style select and re-entry off are checked.
- All 56 source song JSON files, generated library, archives, samples, app audio
  and scheduling, preferences and formal server remain byte-identical to 2.4.22.
- Formal local-server regressions cover all 43 shell/sample resources with HTTP
  and MIME checks, and reject unlisted/internal archives. No new serving route.

## Own-cloud webpage checks

Used the private loopback preview in Chromium, updating the existing localhost
origin normally to visible v2.4.23. This is the assistant's cloud browser.

- Pasted unsupported individual and batch-wrapper JSON through the real import
  form. Both produce the actionable field error, preserve text, and leave zero
  local songs. Compact 592×511 and wide 845×632 screenshots show the error and
  retained JSON. These are synthetic QA fixtures, not user song data.
- Supported four-note melody with two auto support attacks imports successfully
  as one practice card. The existing legacy accompaniment button is visible and
  usable; own playback reaches its end. Reload returns to off and ready state.
  Exact two/six audio-call assertions are separately the production VM evidence
  above, not a claim of browser acoustic measurement.
- Initial inspection considered only the hidden light selector. Checking the
  actual legacy button corrected that inference: supported external auto was
  already playable. No provider/routing refactor was introduced for that case.
  Its existing session-local choice remains session-local in this release.
- Clicked the actual copy-prompt button: clipboard has the new 5818-character
  prompt, including both backing field names and their import boundary.
- Removed only the synthetic QA import through the app's delete confirmation;
  the original fixture remains outside the package for repeatable testing.
  Local count is zero and the built-in library again has 36 practice cards.

The Python browser preview is not evidence of the official Node server routes;
those have their separate real HTTP tests. Structural import validation cannot
verify source pitches, ties or musical quality. OS-level scenarios are outside
this stage's scope. See IMPORT_BACKING_FIELD_GUARD.md for schema and evidence.

## Clean replay

A fresh baseline archive plus the cumulative patch also passes `npm run check`:
835 runtime + 15 compiler tests, the two standalone checks, validator and syntax.
Final package replay compares every source file byte-for-byte. The source ZIP
includes BUILD-INFO hashes; raw score images and QA fixtures are excluded.

Independent final gate: all `scripts/test-*.mjs` plus compiler evidence tests
passed **852/852**, zero failures or skips. This includes the two newly persisted
supported-auto own/demo session regressions. The larger count includes the two
standalone legacy scripts. No remaining code or documentation blocker was found.
