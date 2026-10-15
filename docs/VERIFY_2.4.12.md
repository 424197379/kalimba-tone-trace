# v2.4.12 local preview verification

## Result and boundary

Overdue melody or enabled backing now pauses practice at the last admitted
visible checkpoint before dispatch. Explicit Continue gives silent preparation
at that point. Admission also precedes speed, mode, backing, pause and loop
control changes, so a control cannot conceal a preceding stalled frame.
Initial and resumed playback await bounded sample readiness. Absolute per-note
deadlines and session generations suppress obsolete asynchronous starts.
See `PRACTICE_STALL_SAFETY_2.4.12.md` for the exact policy and its limits.

The inclusive 150 ms age threshold is a product tolerance, not a claim of
sample-accurate audio. Short admitted jitter may compress adjacent attacks.
Rare asynchronous expiry retains consumed event flags; seek or repeat is the
explicit way to retry those attacks. No automatic rewind is added. All 53
source song JSON files and generated songs.js remain byte-identical to 2.4.11.

## Automated acceptance

`npm run check` passes 570 runtime tests and 14 compiler evidence tests,
including 133 new stall/readiness cases. Independent execution passes 586
including two additional standalone scripts. The original independent probe
where a speed change preceded RAF after a long gap now pauses at the original
checkpoint at 1x, 0.55x and 1.4x. All 36 songs' densest sections, fast speed,
loop boundaries, held notes, both modes, delayed decode/fallback, timeout and
control-entry behavior are covered by production-function harnesses.
The formal Node server gate checks 42 shell/sample HTTP responses and MIME,
the allowed archive, and rejection of private/raw unlisted files.

## Actual own-cloud browser acceptance

Normal in-app update from 2.4.11 to 2.4.12 succeeded. Night Piano No. 5 completed
an actual 1.4x demo without spurious pause. Its enabled short phrase ran through
multiple cycles; after manual pause, Continue held the displayed point during
preparation and retained the phrase. Loop exit and speed restoration worked.
Birthday ran in own-play with light backing at 0.55x. Pausing at displayed 21
seconds, changing to 0.60x and continuing held the rebased 19-second point
through preparation, then reached the normal practice end. Speed was restored
to 0.55x. Final wide 860×404 and compact 607×524 screenshots show a paused
Birthday session with Continue and all 21 keys inside the board.

With the private visual-preview server stopped, cached reload displayed
2.4.12, 21 keys and idle state. The server was restarted. This is cached cloud
browser reload evidence, not real-phone installation or upgrade evidence.
Python visual preview does not substitute for the formal Node server gate.
Actual long-frame injection and acoustic timing were not performed in this
browser; deterministic stall coverage comes from the test harness. The managed
cloud visibility limitation documented in VERIFY_2.4.11 still applies. No
browser security/policy settings were changed.

## Reproducible package

The cumulative patch applies to baseline
73041efc803b6c4f16046c8fc0ceaefc08fcc507. A clean replay passes the full check;
working tree, replay and ZIP source bytes are compared with BUILD-INFO hashes.
Branch local/practice-focus has zero new commits. Node.js 24/npm, with no extra
dependencies required: `npm start` serves localhost:8123; `npm run check` runs
the gate. No push or publication. Source scans and the private sample-decoding
diagnostic are excluded. Real phone interruptions, tactile playing, reference
performance and acoustic timing remain unverified; score-source gaps persist.
