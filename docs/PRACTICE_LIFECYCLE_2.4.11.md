# Practice pause / Continue lifecycle (2.4.11)

## Policy

- `document.hidden`, `pagehide`, and a non-running AudioContext pause the current session. Ordinary blur/focus does nothing. Becoming visible, `pageshow`, or an AudioContext returning to `running` never starts transport or calls `resume()` automatically.
- Lifecycle pauses preserve the last actual visible transport-render position. This includes ordinary RAF and visible layout/key-preview renders. A delayed lifecycle notification therefore does not advance through unrendered background time. Manual pause preserves its current transport position.
- A valid paused session keeps its song, speed, A–B range, mode, and already-delivered attacks. The existing pause button becomes **继续**. Untouched and completed sessions do not acquire a Continue action merely because they become hidden.
- Continue requires a new user action. It runs one separate, silent preparation phase for the normal whole-beat preparation duration. Progress stays fixed; old held notes are not presented as a fresh strike. Only after preparation does transport start from the saved target. A late preparation RAF does not backdate that start or catch up old time.
- An interrupted initial countdown targets beat 0; an interrupted A–B countdown targets A. Continue gives one fresh full preparation and then the first attack, without appending the remaining old countdown.
- Seeking or changing A/B while paused replaces the Continue target and retains the mode. Seeking targets the selected position; phrase editing targets A. Speed changes preserve the target's musical beat. These edits cancel an older pending/active Continue preparation.
- A fresh demo retains its existing restart behavior. The own-play/demo buttons are explicit mode choices and supersede an older Continue request. A normal A–B turnover is not a user edit and does not invalidate a pending mode request.
- Physical own-play keeps the existing visual-only fallback when AudioContext is unsupported.

## Transport and interaction safety

Pending fullscreen, AudioContext preparation, and sample-preload continuations check their request identity and visibility before activating. Pause, reset, song changes, edits, and newer starts invalidate the relevant request. Every pause cancels RAF and clears its stored ID.

RAF entry checks actual visibility and AudioContext state before scheduling either melody or backing. Direct render paths also guard the dispatch and delivered-event flags, so a hidden layout/rotation callback cannot consume upcoming attacks or advance the saved visible position.

A pause retains prior delivered flags and consumes only historical attacks before its target. Continue repeats this synchronization after intentional edits. True upcoming onsets remain eligible; a held note's previous attack is never replayed merely because the user continued.

Lifecycle stop releases held pointer capture and clears loop/progress drag state and automatic-resume intent. An old pointerup cannot restart or seek. During an unfinished loop drag, an unchanged phrase retains the original paused position; after an actual boundary edit the target becomes the new A. It remains available for explicit Continue after hiding.

## Audio retirement

Each note load captures an audio generation. Pause or another invalidating action increments that generation; neither successful decoding nor synth fallback can later attach an old note to a new output graph. Pending screen-key preparation is guarded the same way.

Sample and synth sources are tracked until they end. A final gain after the complete dry/reverb-wet/filter/compressor chain covers the actual output:

- Running context: fade that output to zero over 35 ms, schedule source stops at 40 ms, and clean up the retired graph after 60 ms.
- Already suspended/interrupted/closed context: immediately mute, stop, and disconnect sources and the complete old graph. Do not wait for a stopped audio clock.
- If suspension arrives during a running fade, synchronously retire its remaining graph as well.
- New playback receives a fresh graph, including a new convolver. A retired wet tail can never reopen when the context resumes. Cleanup never calls AudioContext.resume().

## Verification

`node --test scripts/test-practice-lifecycle.mjs` executes extracted production functions with controlled performance time, RAF delivery, DOM lifecycle callbacks, and Web Audio nodes. Its 82 probes cover:

- Demo/own-play during initial and positive-A preparation, active phrases, near end, and completed sessions
- Delayed hidden/statechange notifications, hidden RAF before notification, direct hidden/suspended renders, repeated hide/pagehide, and no focus/visible auto-resume
- Pending fullscreen/audio/preload and screen-key races, latest-start wins, and a mode request crossing an ordinary loop turnover
- Fixed-position Continue, one full silent preparation, interruption/restart, delayed preparation RAF, held-note/no-retrigger, upcoming attacks, exclusive B, reset/song/seek/speed/A–B cancellation
- Paused target edits, stale pointerup, release of pointer capture, and hidden during an unfinished loop/progress drag
- Sample/synth release for running/suspended/interrupted/closed contexts, suspension mid-fade, late buffer success/fallback, fresh wet graph, and no lifecycle resume call

Existing session/audio/rendering/preferences tests retain their musical scheduling assertions. The pointercancel assertion now expects an explicit Continue action instead of a disabled pause button. The library-duration harness supplies the new idle state fields without changing duration/precedence assertions.

## Boundaries and remaining verification

This change does not introduce a foreground late-onset/drop policy. A long RAF stall while the document stays visible and AudioContext stays running can still dispatch overdue attacks together. That is a separate scheduling decision; short-frame and true-onset loop boundary behavior is deliberately unchanged here.

Controlled VM/audio-node tests do not establish real acoustic fade quality, actual device app switching/locking, or phone-call interruption behavior. Those require separate real-device and listening checks. Cloud browser checks likewise must not be described as real phone-call QA.
