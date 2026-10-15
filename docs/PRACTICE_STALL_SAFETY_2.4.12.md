# Visible practice stalls and audio readiness (2.4.12)

This bounded runtime change builds on the pause/Continue lifecycle policy in
[`PRACTICE_LIFECYCLE_2.4.11.md`](PRACTICE_LIFECYCLE_2.4.11.md). It does not change song
JSON, source-review claims, the audio graph, or the immediate-playback architecture.

## Foreground stall admission

`admitPracticeFrame()` examines the actual current transport time before either
melody or enabled backing dispatches. It is called from RAF, direct board renders,
and the backing scheduler. A render cannot move the last-visible checkpoint past
a materially overdue onset before admission runs.

- An eligible upcoming onset that is at least **150 ms late** pauses playback at
  the last visible position. The threshold is inclusive, with `1e-7` seconds of
  floating-point tolerance. A 149.999 ms age is admitted; 150 ms is not.
- Demo considers unconsumed melody attacks. Own-play considers melody onsets
  newly crossed since the last visible checkpoint, including when backing is off
  or AudioContext is unavailable. Enabled backing is considered when its audio
  context is running. Visual-only own-play does not wait on impossible backing.
- The decision covers both streams before their regular dispatch. A direct
  active layout/key/control render dispatches eligible backing before committing
  its visible checkpoint, as well as the existing melody render dispatch. The
  normal RAF backing call remains idempotent through its delivered flags.
  Paused/preparation-only/seek renders do not start backing.
- The freshness decision uses real transport time **before** the exclusive-loop-B
  visual clamp. A stale near-B attack cannot appear fresh merely because its
  render time was clamped to B minus epsilon.
- Elapsed wall time alone does not trigger a pause. A long gap during a rest or
  an already-started held tail is allowed if it misses no materially late new
  attack. An onset only 60 ms late at the end of a long rest is still eligible.

This is a product tolerance checked against the current library, not a published
browser timing guarantee. The current shortest melody spacing at 1.4x is about
59.5 ms. All 36 current melodies' densest onset-bounded eight-beat segments retain
every attack at 1.4x under 30 fps and deterministic intervals of
`[16.67, 33.33, 80, 16.67, 100, 40]` ms. Dense 250/500/1000 ms gaps pause before
new attacks in the regression cohort. Imported denser scores need separate QA.

## Controls arriving before the next RAF

A control callback can arrive before the delayed RAF, so its old clock must be
admitted before it rebases a checkpoint or consumes historical flags. Speed,
backing style/on-off/volume, loop-off, range-key edits, and loop-drag start now run
that admission first. The requested speed/backing edit is still applied to the
preserved paused point. Manual Pause uses the same stall admission, while the
internal `freezeAtLastFrame` pause bypasses it to avoid recursion.

Own-play/demo buttons admit before starting readiness and again before activation
when switching an active session. A rejected stalled mode change saves the
**requested** mode in the paused session, then requires explicit Continue and its
preparation. A later Continue cannot unexpectedly restore the mode the user was
trying to leave. A pending readiness callback cannot rebase over a stall either.

Intentional seek, reset, song replacement and new A/B target edits can still
replace the target. A range drag which first detects a stall does not carry an old
running-state flag into its pointerup and cannot restart automatically.

## Explicit recovery

A material stall displays `播放卡顿，已暂停`. The existing pause button becomes
**继续**; becoming responsive or visible never resumes automatically. Continue
retains the song, mode, speed, range and position, gives one full silent
preparation, then resumes from the saved target. Already-started held notes keep
their consumed attack flags; true following repeated notes remain separate
attacks. Normal initial/A preparation retains the 2.4.11 single-preparation rule.

No phrase is silently skipped to catch up after a visible scheduler stall. In
particular, the guarded near-B onset remains upcoming and is delivered once after
Continue, with B itself still excluded.

## Audio readiness and independent note deadlines

`preparePracticeAudio()` is shared by own-play, demo and Continue. It awaits
AudioContext preparation and the existing all-key sample preload before a new
transport starts. The pending state says `准备声音`. Own-play no longer starts
while its first backing samples are still loading.

The readiness wait is bounded at **8 seconds**. An error or timeout with an audio
context pauses explicitly (`声音未就绪，已暂停`), clears pending activation and
leaves Continue available. A ready sample failure still uses the existing synth
fallback. Unsupported AudioContext retains visual-only own-play; demo cannot
claim silent audio readiness.

Timeout does not mark successfully decodable samples permanently failed or
replace the shared preload promise. A late fetch/decode may finish populating the
existing cache for a later explicit Continue. It cannot activate the timed-out
transport: request identity is rechecked across readiness awaits, and pausing
invalidates the request. An older completion or timeout cannot pause or start a
newer mode. Existing sample-fetch failures retain their prior fallback policy.

Each melody/backing note additionally carries a monotonic absolute deadline:

`practiceStartAt + (nominal onset seconds + 0.150) * 1000`

The deadline is tied to the original onset, rather than a fresh 150 ms budget
starting at a late dispatch. After buffer await and immediately before synth
fallback, production checks the audio generation, playback request, active mode,
visibility, audio state and deadline. This protects the interval before a delayed
RAF gets a chance to run its own stall guard.

A **current** expired audio request suppresses both the stale sample and fallback
and explicitly pauses at the last visible position (`声音延迟，已暂停`). A canceled
or older-generation request is simply discarded and cannot pause a newer session.
Manual hand-key audition remains the separate immediate cached-sample/synth path
and has no old transport deadline.

### Deliberate rare-expiry limit

The already-dispatched expired attack retains its consumed flag. This stage does
not rewind the score, replay a partial chord, or undo other voices already heard.
If its onset is already behind the last visible position, Continue preserves the
future music; recovering that past attack requires an intentional seek or repeat.
Readiness prevents the normal first-load case that previously produced an 800 ms
late backing start while RAF remained healthy. This defensive expiry policy is
an explicit pause, not a promise to recover every unheard asynchronous attack.

## Timing limits

The runtime still starts sound at `AudioContext.currentTime` when admitted RAF or
render dispatch reaches it. A tolerated 100 ms jitter frame can cross two distinct
59.5 ms-spaced onsets and start both together. Regression tests explicitly record
this compression. There is **no lookahead/sample-accurate timing claim**. This
change prevents material-stall catch-up and late sample/fallback starts; it does
not reconstruct the original acoustic spacing through ordinary short jitter.

Controlled VM/Web Audio-node checks do not establish acoustic quality, real phone
interruptions, physical-kalimba suitability, or source fidelity. Browser and
real-device listening remain separate evidence.

## Regression design

`node --test scripts/test-practice-stall.mjs` executes extracted production
functions, not a test replacement scheduler. It covers:

- Inclusive threshold edges, dense gap cohorts and rest/held exceptions
- RAF, direct layout and direct backing entry; checkpoint synchronization
- Own-play with backing off; explicit Continue, held notes and real next attacks
- Short boundary-straddling frames and long near-B stalls, with exclusive B
- All 36 melodies at 1.4x, two cadence traces, exact attack order/count
- Actual mocked `source.start` times, including admitted short-jitter compression
- Nominal deadline expiry after decode success/failure and before synth fallback
- Healthy RAF with a delayed 800 ms buffer; current expiry pause and consumed flags
- Pre-RAF speed/backing/mode/Pause/range controls, requested mode retention,
  guarded activation after readiness, and intentional target-edit boundaries
- Old request cancellation, newer mode protection and immediate manual audition
- Readiness gating, timeout, late real decoded-cache recovery, explicit retry,
  hidden/reset/newer-mode races, fallback and visual-only behavior

The existing lifecycle/session harnesses load the new production admission and
readiness helpers. Their prior setup helper teleported from a count-in to a
positive score time, accidentally simulating the very stalls now being rejected.
It is now named `stepTo` and supplies healthy callbacks at intervening onsets before
the target callback. Exact expected attack lists, counts, mode, range, position,
hidden/pagehide/context handling and Continue assertions remain in place. Raw
`advance()` still injects actual interrupted callback gaps. One old 1.2-second
loop-end catch-up trace is replaced by a healthy approach to 2.86 s followed by a
150 ms boundary-straddling frame; its last onset at 2.875 s is 135 ms late and
remains eligible. The new long-gap tests separately require a pause and prepared
recovery. A support-boundary assertion's description now says healthy frames
instead of claiming a single overdue frame delivers multiple old attacks.

The rendering-only and library-duration harnesses load admission with inactive playback state; it still
checks the same visual positions, held/rest beams and note visibility. No musical
assertion was replaced by a snapshot or skipped to accommodate the new policy.

## Recorded cloud gate

- New stall/readiness file: **133 passing probes**.
- Initial focused stall + lifecycle + session + rendering gate: **310 passed, 0 failed**.
- Subsequent control-safety gate with lifecycle/session/library-duration: **325 passed, 0 failed**;
  the final 133-probe stall run additionally includes both requested-mode retention directions.
- Full `npm run check`: **570 runtime tests + 14 compiler-skill tests passed** after the control-entry
  audit;
  song transcription/suitability checks and all JavaScript syntax checks passed.
- `npm run validate:songs`: 53 songs, 7,073 steps, 0 errors, 550 existing review
  warnings. No warning was silenced or turned into a source-accuracy claim.
- `npm run build:songs` completed; all 53 song JSON files and generated
  `src/songs.js` remain byte-identical to the frozen 2.4.11 local-preview archive.
- `git diff --check` passed. This gate is controlled cloud execution, not a claim
  of real-device or audible listening verification.
