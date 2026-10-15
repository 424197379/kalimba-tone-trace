# v2.4.18 local preview verification

## Usable result

Jingle Bells' selected short refrain gains optional quiet root support: one app
note per bar, 16 attacks. The 51 physical melody attacks, 64-beat extent and
80 BPM practice setting are unchanged. New songs still start off; choosing
light uses the existing content-bound per-song memory. The historical 49-note
V2 and importable archive remain byte-identical and cannot supply incompatible
backing. There are 55 source records but still 36 canonical practice cards.

The same inspected Coughlin page supplies 18 chord symbols. The reduction takes
16 bar-downbeat roots and explicitly omits the intermediate F changes at app
beats 10 and 42. Register, .75-beat written duration and .30 × .32 gain are
arranger choices, not a written bass line. D7's F-sharp and other chord members
are omitted rather than naturalized; full harmonic color is not reproduced.
The independent source reader confirmed all symbols and written spans. See
JINGLE_ROOT_SUPPORT.md for the complete mapping and preserved historical hashes.

All 54 earlier song files, app.js, preferences, original samples and archives
are byte-identical to 2.4.17. Only a new compatible support record is added;
no new physical chord targets or audio-engine changes are introduced. The
compiler reference and actual AI prompt explain root reduction and why filtering
to legal pitches cannot by itself establish a coherent bass/phrase ending.

## Actual original-graph numerical measurements

A separate private page uses public OfflineAudioContext through ordinary browser
buttons, the original 21 MP3 bytes, unchanged sample gain/pan/output graph and
one reproducible seeded instance of the app's random reverb. It reads no hidden
app state. Actual Chrome 154/Linux 44,100 Hz renders were inspected and saved.
These pages and raw diagnostics are not in the release package.

Nine equal-window renders cover .55×, 1× and 1.4×, each with melody alone,
melody plus roots, and roots alone. All 51/67/16 sources end correctly. No
nonfinite samples or sample values of magnitude ≥1 occur; final 250 ms is zero.
Combined full-output sample peaks are −8.437, −7.204 and −8.170 dBFS. Support-only
RMS is 17.84, 17.72 and 17.79 dB below the melody; combined RMS changes by about
+0.073 to +0.074 dB. An independent saved-result audit checks all 402 note records,
source/function/sample hashes, impulse construction and reported arithmetic.
It does not independently recalculate PCM from the saved summary JSON.

A separate two-render probe inspects F3 and C4 at effective velocity .096 after
the fastest four-beat boundary, 2.142857143 seconds. Both decoded buffers end at
1.895986395 seconds, but the complete effects graph is still nonzero afterward.
Post-boundary peaks are −129.332 dBFS (F3) and −127.394 dBFS (C4); all samples
there are below −120 dBFS. Post-boundary first-100-ms RMS is −142.594 / −140.296
dBFS. Last nonzero samples occur at about 2.45857 / 2.45848 seconds. This is one
isolated-note, seed and rate measurement, not an assertion that real output is
strictly silent at chord changes or identical inside a nonlinear full mix.
No PCM was clipped or shortened to achieve these observations.

Sample peaks/RMS do not establish perceived masking, subjective pleasantness,
source-recording equality or reproduction rights. They support a conservative
opt-in mix choice alongside the source review, not a listening guarantee.

## Own-cloud webpage acceptance

Normal 2.4.17 → 2.4.18 update works. Searching Jingle shows one 51-note card with
optional backing, the same practice duration and the old49 restore link. It
initially opens off at saved .55×. Choosing light and playing a complete 1.4×
demo reaches its natural end. Reload preserves light and 1.4×. Returning to
.55× and choosing self-play runs app-only support in the first A–B phrase.
Pause at displayed second 8 preserves 8 during Continue's preparation. Switching
light off while running retains practice mode/progress; switching back, exiting
repeat, pausing and Home seeking work. The old chord URL resolves to the same
short-refrain page with light/.55× restored, without exposing chord targets.

The actual Copy Prompt button returns 5244 characters including explicit root
reduction, lost harmonic color and strong-beat/ending review. Source details
remain optional/folded. Fresh wide 860×404 and compact 607×524 screenshots show
the light selector and all 21 keys; the long title uses the existing ellipsis.
No system-level or external-site test requirement is added.

## Regression and portable source

Full npm run check passes 731 runtime plus 15 compiler tests. New data tests
cover source mapping, exact melody/root tuples, negative variants, historical
bytes, canonical routing, content guard and opt-in preferences. Twelve new
production-function session cases cover full own/demo playback and exclusive
loop boundaries at four speeds. Existing melody-only exact-attack assertions
remain in force with the available new layer disabled. Generic reports now
explicitly expect 55 records, 403 original events and 67 practice events.
Independent all-script and compiler review passes 748/748 tests with no skips.
The two additional legacy standalone scripts explain the difference from npm check.
Independent byte comparisons confirm all 54 prior song JSON files, app runtime,
preferences, archives and samples are unchanged; the new companion is the sole
song-data addition. The clean full gate also passes 731 runtime plus 15 compiler tests.

Formal Node server coverage still requests all 43 shell/sample resources with
correct MIME and rejects unlisted/private paths. Baseline is
73041efc803b6c4f16046c8fc0ceaefc08fcc507, branch local/practice-focus, zero new
commits, no push/publication. Node.js 24/npm, no additional dependencies:
`npm start` serves localhost:8123; `npm run check` runs the gate. The cumulative
patch is replayed and checked in a clean baseline. BUILD-INFO compares source
hashes across working tree, replay and ZIP; no private scores or diagnostics
are packaged. The original tracked sample-source recording remains unchanged.
