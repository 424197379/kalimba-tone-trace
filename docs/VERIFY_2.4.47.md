# 2.4.47 — Screen-key preview, short dark and held fill

Own-cloud local preview; no new commit, push or public deployment. The delivered
2.4.46 source/patch and its five-page guide remain separately frozen.

## Visible behavior

The next note is outlined before it starts; a second upcoming note has a fainter
short edge. Immediately before a new attack, that key's guidance goes briefly
dark. At the attack it becomes a brighter filled key until its scored duration
ends. A held note remains primary while its next note has a secondary outline.
Two short bars distinguish a real same-key re-strike from a single held event.
Long rests and the silent ending do not retain an expired fill.

See `KEY_GUIDANCE.md` for the exact preview and dark windows, overlap handling,
pause/continue rules and reduced-motion behavior. Dense events shorten the dark
window; a low frame rate can skip that brief window rather than flashing late.

## Scope and unchanged content

The pure `src/key-guidance.js` selector, a display-only `renderKeyGuidance` helper
and its call from `renderBoard`, and key CSS implement this feature. Existing
audio, transport, judgement and falling-block timing bodies are unchanged from
46. No independent cue timer is introduced. Existing screen-key audition uses
an independent green bottom mark so it cannot replace the score guidance.

All57 song JSON records,13 archives, generated `src/songs.js`,21 audio samples
and sample manifest are byte-identical to the delivered46. No music, AI import
prompt or compiler-skill content changed. Key dimensions and calibration are
unchanged. Service Worker adds the selector to its shell and changes version;
its caching strategy is unchanged. Upgrade/reload old open pages before testing.

## Production logic checks and independent review

-42 selector tests cover preparation, duration boundaries, rests, overlaps,
  identical pitches, ties, dense attacks, both loop boundaries and invalid input.
-50 tests execute the actual production rendering and transport functions,
  including pause/continue, interrupted initial/A preparation, speed changes,
  seeks, song/range changes, loop recovery, skipped RAF onsets and manual input.
-At the same supplied time, production block geometry reaches the judge line,
  the key fills, and the corresponding note is dispatched through
  `playKalimbaNote` to the decoded-sample path with its nominal onset/deadline
  and current generation. The controlled audio node starts at the supplied
  AudioContext time. Slow0.35x and fast1.40x
  are included. Controlled WebAudio nodes make this a logical scheduling test,
  not a measurement of actual speaker or Bluetooth latency.
-Independent review found and verified fixes for spurious repeat marks on two
  past overlapping holds, and early fill when an interrupted first count-in was
  resumed or its preparation was cancelled by a speed change. A still-visible
  paused preview keeps its exact beat; a far-away interrupted count-in receives
  a steady near-A outline until playback actually starts.

The original samples and their attack lead-in remain untouched. No physical
kalimba, subjective listening or mobile-device performance approval is claimed.

## Own-cloud browser observations

The normal47 player was opened on a fresh local origin with current resources.
Early count-in pause/continue restored an outlined G4 rather than an early fill.
The real Birthday demo at0.35x showed B4 held fill and G4 secondary outline;
pause, stopped speed changes, loop controls and keyboard progress seek remained
usable. A separate D6 audition kept the B4/G4 guidance and added only its own
touch feedback. Fast1.40x loop preparation was also exercised.

An explicitly labelled fixed-time, synthetic, silent QA page uses the complete
production app with only module paths and test data/control setup changed. In
the actual browser it showed outline at1.20s, dark at1.97s, fill with block at the
line at2.00s, held fill at3.50s, no cue during rest at4.50s, and repeated-key
mark/dark/re-fill at9.30/9.48/9.50s. A separate two-future-note case showed the
primary outline and secondary short edge together. These are fixed render
observations, not a recording of live audio.

Wide1180×757 and944×606 CSS viewports were inspected; the normal compact player
also fit all21 keys at590×378 through browser zoom. The filled key, secondary
outline and note labels remained distinguishable. This is cloud Chromium
viewport coverage, not a claim of testing a physical phone.

## Offline gates and delivery consistency

-Complete local `npm run check`:1,937 runtime tests passed,9 private-source
  fixture tests explicitly skipped because those optional image fixtures are
  not included in the recovered release;16 compiler tests passed; zero failures,
  exit0. The historical46 source-image runs are not counted as new47 executions.
-All343 source files were hashed before and after that gate and stayed identical.
  Runs used process-local `CI=true`, offline, no-update-notifier, no-audit and
  no-fund settings. No installation or external registry request was required.
-Independent actual `npm start` HTTP gate checked all23 APP_SHELL URL entries
  and21 sample responses:200, expected MIME and exact source bytes. The new
  selector and two version endpoints loaded;17 protected paths returned403.
  The existing server listened on0.0.0.0:8123 and checks used127.0.0.1. It was
  stopped after validation. The separate127.0.0.1:8131 browser preview is not
  treated as the official npm-server gate.
-This verification document is the sole addition after the343-file gate. Final
  delivery contains344 source files. ZIP and cumulative patch must reproduce
  those bytes from baseline `73041efc803b6c4f16046c8fc0ceaefc08fcc507`.
  Private fixtures, screenshots and temporary QA copies are excluded.
