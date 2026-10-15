# v2.4.14 local preview verification

## User-facing result

See You Again keeps its reviewed 86 single-note targets and gains optional
24-attack low-voice support from the same 12-bar preview. The app plays it;
the physical player never receives extra chord targets. The library remains
36 canonical cards, with 54 source records. Old incompatible support stays
isolated. With no prior global backing preference, this candidate starts off.
The light selector remains session-local in this version: navigating away
returns to the existing default/global preference. Per-song speed is retained.

Pig's 76 notes already match the selected 20 bars and remain unchanged;
metadata now declares 40 beats and the limited melody review. Bluebird's 82
notes also remain unchanged: its unresolved simplified-source mapping is
visible in selection and expanded in practice, rather than presented as a
verified beginner chorus. See the three dedicated source documents.

Relative to frozen 2.4.13, only Pig/Bluebird metadata and the new support JSON
change the song sources. See You V1, every old V2 and every sample byte remain
frozen. The app.js delta is one line: light backing defaults read their own
volume configuration before falling back to the original layer. Saved user
volume still takes precedence. No sample offset is included.

## Executable acceptance

Final npm run check passes 633 runtime and 14 compiler tests. Independent
all-script review passes 649, including the two standalone scripts. All 54
generated records equal their source JSON. Formal Node-server regression
checks 42 shell/sample HTTP resources and MIME, the exact public archive,
and refusal of private/unlisted data.

An initial test cohort incorrectly counted a new companion record as a 37th
practice song, preventing later cases from registering. It now uses the actual
canonical getPracticeSongs result and still asserts 36; the complete gate
was rerun. A late hint change was regenerated before final acceptance.
Dedicated tests protect exact 86 melody/24 support tuples, legacy hashes,
default .30 volume, zero/saved volume, own/demo playback, speed and loop paths.
Healthy stepped session traces are not fixed-frame acoustic measurements.

## Browser audio measurement

In own-cloud Chromium 154, a separate private button-driven page used public
OfflineAudioContext at 44,100 Hz to render melody-only, combined and support-only
at .55x, 1x and 1.4x. All 21 original encoded sample hashes match; all nine
renders complete their expected 86/110/24 sources, retain zero buffer offsets,
unchanged pitch and natural tails. No sample reaches magnitude 1 and no
nonfinite sample occurs; the final 250 ms is zero. The graph matches the app,
except a fixed reverb random seed permits repeatable A/B comparison.

Combined sample peaks are -6.494, -4.825 and -5.327 dBFS. Support-only full-length
RMS is approximately 24.48, 24.59 and 24.17 dB below melody-only; adding support
changes full RMS by about .014–.015 dB. These are unweighted electrical levels,
not perceived loudness, masking, reference fidelity or a claim of better taste.
The original low-note samples last about 1.896 seconds, so their natural tails
can overlap the next support change (about .771 seconds at 1x). Written note
durations are not an assertion that the audio is cut at each harmony boundary.
The diagnostic does not exercise the live event-loop scheduler; normal webpage
flows are verified separately. Private measurement pages and source scans are
excluded from the portable package.

## Own-cloud webpage checks

The normal update control advances 2.4.13 to 2.4.14. The library still shows
36 cards; See You search exposes one 86-note card with optional backing.
The practice selector initially shows off, then light backing can be selected.
Demo pause holds displayed second 23, and Continue holds it during fresh
preparation. Own-playing mode runs the selected A/B range repeatedly; changing
.55x to 1.4x retains the range's musical position. Loop exit works. The full
1.4x demo reaches its ordinary end and resets progress.

Bluebird's warning is visible and expanded by default. Pig's reviewed scope
starts collapsed. Returning to See You restores the saved 1.4x speed and the
session-local backing choice returns off, as documented above. A .55x run
encountered the existing late-frame safety pause at displayed second 58;
explicit Continue retained 58 through preparation and then reached the end.
The actual copy button pasted 5,055 characters including the voice-specific
accidental rule; the temporary input was cleared without importing it.
The final preview
is returned to .55x. Compact 607×524 and wide 860×404 screenshots retain all
21 key targets, the backing selector and progress above the falling area;
compact document width equals viewport width. The user requested webpage-focused acceptance; OS-level
interruption scenarios are not a new acceptance target for this release.

## Portable artifact

The cumulative patch replays baseline 73041efc803b6c4f16046c8fc0ceaefc08fcc507.
Branch local/practice-focus has zero new commits, no push or publication.
Clean replay passes the complete gate; final source hashes and ZIP equality
are recorded in BUILD-INFO. Run with Node.js 24/npm, no extra dependencies:
`npm start`, open localhost:8123; `npm run check` for regression.
The original Git-tracked sample-source recording remains in the reproducible
source archive; no new private recording or score scan is added.
