# 2.4.19 current-score interface review

Local preview only, not pushed or published. This change follows the user's
request to remove old-score restoration choices from everyday practice.

## Intended scope

The Jingle and Jasmine library cards and practice source disclosures show only
the selected current edition. Source attribution and reviewed bar/beat bounds
remain. No replacement version picker is introduced. Historical JSON remains
unchanged for development recovery and provenance; it is not a recommended
practice choice or a new product feature.

The two active hints and notices no longer advertise old-score restoration.
Compiler guidance and the actual external-AI prompt distinguish internal
reversibility from user-facing version controls. Existing archive paths remain
narrowly allowlisted; this change neither deletes the only copy nor expands
filesystem exposure.

## Verified scope

All 55 song records retain every musical, source, ID and tempo field; the only
song-data changes are the two hints. Tests reconstruct the full previous JSON
bytes and compare their original hashes. Generated records equal their source
JSON. The 36 canonical cards, archive files, sample files, preference module
and formal server are unchanged. App changes only remove archive UI wiring.

The actual card and practice metadata functions run in focused VM regressions,
asserting current source notices and original practice buttons remain without
old-score links. Historical archive import and strict-path tests remain.
Full npm check and a clean baseline replay each pass 734 runtime plus 15
compiler tests. Independent all-script review passes 751/751 without skips.
Formal server tests cover all 43 shell/sample resources and MIME types, plus
rejection of unlisted/private files. Validation: 55 records, 7199 steps,
zero errors, 602 retained review warnings.

## Actual webpage observations

Own cloud Chromium on the existing private loopback origin completed the
normal 2.4.18→2.4.19 update. Searches show one Jingle card (51 notes) and one
Jasmine card (67 notes); both have current source notices and only their
practice action, with no restoration link. Both practice disclosures expand
normally and contain only the selected version description. Jingle retains
0.55x and light support; demo runs, advances to six seconds and pauses.
Jasmine retains 0.65x. The old Jingle chord URL resolves to the same current
single-note title with zero archive anchors. No user data is removed.

The real Copy Prompt button returns 5271 characters, including developer
archive/version-history reversibility rather than a user restore pitch.
A fresh wide 860×404 practice image shows Jasmine's current source disclosure
and all 21 keys; a compact 592×511 card capture shows Jingle's single choice.
These are webpage checks; no OS-level validation was added. Preview is left
inactive, with no automatic playback.

## Portable delivery

Baseline 73041efc803b6c4f16046c8fc0ceaefc08fcc507, branch local/practice-focus,
zero new commits. Final cumulative patch replays on the baseline, and source
hashes are compared across working tree, replay and ZIP. Node.js 24/npm,
no additional dependencies: `npm start` serves localhost:8123 and
`npm run check` runs the project gate. No push or publication.
