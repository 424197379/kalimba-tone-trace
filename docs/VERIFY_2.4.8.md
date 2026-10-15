# v2.4.8 local preview verification

## User-facing scope

《别看我只是一只羊》 is explicitly a reviewed verse excerpt. Every one of its
68 existing note tuples stays unchanged, including eight phrase-opening rests.
The selected ending is beat 63, before the source's following eighth rest and
chorus pickup. This is not 16 complete bars or the full song. The current
120 BPM is a retained practice setting, not a number printed on the adopted
C-major engraving. See `SHEEP_VERSE_2.4.8.md`.

《喀秋莎》 keeps all 73 old note tuples and is visibly marked 待核版. The
recorded source does not establish a reliable mapping for that timeline; just
changing 4/4 to 2/4 would not calibrate its pitches or durations. A different
source excerpt is not substituted. The complete Jitabang fifth ending's
chromatic limitation is specific to that printed version. See
`KATYUSHA_SOURCE_GAP_2.4.8.md`.

Reviewed informational scope notes start collapsed in the practice page, with
the native “谱面说明” disclosure still available. Unresolved mapping, source
or fixed-instrument-fit warnings remain expanded. Library cards retain their
full scope notes. No score, backing sound, playback timing, calibration or
physical key layout changes are part of this disclosure adjustment.

## Verification status

Source-specific regressions protect every old tuple and complete historical
JSON reconstruction. The disclosure regression executes the actual
`applySongMeta` function, checks informative versus unresolved states, legacy
warnings, song transitions, stale-text clearing and archive availability.
The source checksum and independently entered expected tuples are evidence
fixtures, not automatic source-image recognition.

`npm run check` passes: 317 runtime tests plus 13 compiler-evidence tests,
source validation, transcription/suitability checks and syntax checks. An
independent read-only run includes two additional standalone scripts: 332
checks pass. All 53 generated song records equal their JSON sources. Relative
to frozen 2.4.7, only the two documented song metadata records change; every
playable note tuple and all historical V2 files stay unchanged.

The formal Node server regression checks all 21 app-shell resources and 21
samples for HTTP 200, nonempty bodies and correct MIME, including the exact
145-note Jasmine archive; unrelated raw/private data paths remain denied.
The browser visual preview uses a separate private Python loopback server,
not a substitute for that Node-server test.

In the own-cloud Chromium preview, the normal update action moved 2.4.7 to
2.4.8. Sheep's library title, 68-note count and 58-second 0.55x practice span
match the intended excerpt. Its disclosure starts closed and opens/closes
through the native summary. Demo preparation, playback, pause and seek work.
Katyusha's new title and warning are visible in the library; both its normal
entry and old chord deep link show the single-note pending version with its
warning expanded. Sky's altered-pitch warning also stays expanded.
Screenshots cover 860×404 and 610×526 practice layouts. The actual copy button
pasted all 4,848 prompt characters exactly into the import textarea, including
the new shared-source/meter-only rule; the temporary pasted text was cleared.
Stopping the private preview server and reloading the already cached Sheep
practice page still displays 2.4.8 and the correct collapsed notice. This is
a desktop cached-page check, not a real phone install/upgrade result.

A clean replay from baseline 73041efc803b6c4f16046c8fc0ceaefc08fcc507 passes
the same full check. Packaging compares every tracked source byte across the
working tree, replay and ZIP and records SHA-256 hashes in BUILD-INFO.json.
The branch is local/practice-focus with zero new commits; the portable patch
is relative to that baseline.

## Limits and run

Node.js 24/npm, no dependency installation: `npm start`; `npm run check`.
No push or publication. Raw score images remain private outside the repository.
No reference-performance listening, physical-kalimba play-through or installed
phone PWA verification is implied by source, runtime or local-server checks.
