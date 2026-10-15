# v2.4.15 local preview verification

## Result and storage behavior

Each canonical song remembers light backing or off. A new song starts off,
even if an old global enable preference exists. That old global value is not
migrated or rewritten. Legacy chord/support URLs resolve to the existing
single-note canonical song and use its one preference identity.

Light approval is bound to exact melody/support content: melody pitches,
onsets and durations, BPM/extent, compatible provider identity, support
events/notes/velocity and its default volume. Changed or unavailable content
loads off; light never silently falls back to original backing. Titles,
review prose, app version and suggested speed do not invalidate it. This is
not a fingerprint of the audio engine, samples or user's speed/volume.

Separate localStorage keys avoid different songs overwriting each other
across tabs. Same-song later loads use the latest successful write; an active
page does not hot-switch audio on a storage event. Corrupt/future records are
preserved and load off. If a manual save fails, the current tab retains the
explicit selection while that content remains the same; practice can proceed.
The existing status message discloses the failed save. Original-only backing
remains an explicit session-only toggle. Global user volume remains unchanged.

Only app/preferences and their tests change functionality. All 54 source
JSONs, the generated library and all sample bytes are unchanged from 2.4.14.
Initialization still constructs the same support timeline when disabled, so
library duration and actual end calculations retain their existing agreement.

## Automated and independent checks

Full npm run check passes 651 runtime + 14 compiler tests. Independent
all-script execution passes 667 including two standalone scripts. Eighteen
new cases cover storage denial/quota/readback, invalid/future records,
canonical aliases, reload/switch, content changes, explicit defaults and
multiple tabs. Two old tests that assumed automatic backing now explicitly
turn it on before retaining their original preparation/first-onset assertions.
No timing guard or attack equality assertion was relaxed. Formal Node server
coverage still verifies all 42 shell/sample routes and MIME plus exact
archive/private-route boundaries.

## Own-cloud webpage acceptance

The normal update control moves 2.4.14 to 2.4.15. See You initially loads off;
selecting light and reloading restores light at the independently saved .55x.
Switching to Birthday leaves that different song off; returning to See You
restores its light choice. Opening the legacy See You chord link in a fresh
tab resolves to the same 86-note canonical practice page with light restored.
Turning it off in that second tab leaves the first page's selector unchanged;
reloading the first page then reads off. The extra test tab is closed.
The first tab entered its existing late-frame safety pause during this
multi-tab exercise; this observation is not claimed as live multi-tab audio
continuity. Running-session no-hot-switch behavior is separately covered by
the production-function regression.
A subsequent looped demo runs multiple cycles; pause at displayed second 10
and Continue preserve 10 during preparation. Changing light to off and back
leaves demo mode and progress intact; loop exit and final pause work. The
existing compact layout remains usable with the same single-note controls.

## Portable source

Baseline 73041efc803b6c4f16046c8fc0ceaefc08fcc507; local/practice-focus,
zero new commits, no push/publication. Node.js 24/npm, no extra dependencies:
`npm start`, localhost:8123; `npm run check`. The cumulative patch is replayed
into a clean baseline and the complete gate rerun. BUILD-INFO compares every
source byte in working tree, final replay and ZIP. Private score scans and
diagnostic pages remain excluded; the original tracked sample-source recording
remains unchanged in the reproducible archive. No sample-offset feature is
part of this release.
