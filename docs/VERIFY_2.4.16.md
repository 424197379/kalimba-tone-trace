# v2.4.16 local preview verification

## Selected easy refrain

Jingle Bells now explicitly selects Coughlin's complete 16-bar short refrain:
51 single-note attacks, 64 quarter beats, globally G to C (+5 semitones),
C5–G5. The 80 BPM is a practice choice. This edition choice does not establish
that the previous 49-note edition was wrong. All source notes, separate repeated
attacks and differing first/final cadences are covered by a pixel-reviewed
fixture. Breath commas do not invent measured rests. See JINGLE_REVIEWED_SHORT.md.

One canonical card remains. The former 49-note JSON is byte-preserved in an
explicit archive, exposed through an exact id/status/path whitelist. It imports
as a separate local song. The historical V2 is unchanged and cannot lend its
incompatible accompaniment to the new melody. Saved speed remains usable;
content-bound backing approval safely falls back to off. No stored playhead or
A–B range is migrated. No new backing or sample-offset feature is included.

## Automated checks

Full npm run check passes 667 runtime and 15 compiler tests. Independent
all-script review passes 684 including two additional standalone scripts. Its initial run
found an old archive-helper fixture without song identity; the fixture now
supplies its real Jasmine id and separately asserts that missing identity is
rejected. Exact-path security checks were not relaxed. The new source tests
cover all 51 tuples, 16 complete bars, repeated eighths, +5 transposition,
negative mutations, old JSON reconstruction/import and support isolation.
Healthy-frame full-song and four-speed loop regressions retain exact attacks;
these are not claims of strict fixed-cadence browser timing.

The formal Node server test requests all 43 shell/sample resources with correct
MIME, including both exact archive paths, and rejects unlisted/private data.
The service worker precaches both recoverable originals. All other song JSONs,
old V2s, audio samples, app.js and preference runtime are unchanged from 2.4.15.

## Own-cloud webpage acceptance

Normal update from 2.4.15 to 2.4.16 succeeds. Searching Jingle yields one short
refrain card with 51 notes, source/tempo explanation and old49 archive link.
Opening that JSON shows 49 steps. Copying it into the actual import UI creates a
separate local49 song while builtin51 remains. Deleting only that QA copy leaves
36/36 canonical songs. The actual Copy Prompt button returns 5089 characters
including the new breath-comma rule. No imported code is executed.

The new song plays at 1.4x through its natural end, visibly reports demo ended,
and resets progress. Slow .55x A–B repeat, pause at displayed second 10, Continue
with preparation holding second 10, repeat exit and Home seek work. The old
chord URL opens the same short-refrain single-note practice page. Source details
start folded and expand to the precise edition and restore link. All 21 keys
are visible at 607×524 and 860×404; the narrow long title is ellipsized and the
wide title is complete. Screenshots capture both layouts.

After stopping the private loopback preview server, reloading the opened archive
still returns its 49-note JSON; the same server is then restarted. This is actual
browser cached-route evidence. Formal release-server HTTP/MIME correctness is
separately established by the Node test, not inferred from the Python visual
preview. No OS-level or external-site compatibility work is claimed.

## Portable source

Baseline 73041efc803b6c4f16046c8fc0ceaefc08fcc507; local/practice-focus,
zero new commits, no push/publication. Node.js 24/npm, no extra dependencies:
`npm start` serves localhost:8123; `npm run check` runs the gate. The cumulative
patch is replayed into a clean baseline and checked. BUILD-INFO records hashes
for all source files and verifies working tree/replay/ZIP equality. Private
score scans and diagnostics are excluded. The originally tracked sample-source
recording remains unchanged. No claim of reproduction rights or subjective
musical/physical-playing approval follows from source or structural checks.
