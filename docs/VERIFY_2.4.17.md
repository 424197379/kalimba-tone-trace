# v2.4.17 local preview verification

## Reusable checks, unchanged music

Both backing layers are now visible to the generic report workflow. All 54 song
JSONs, generated songs, app.js, preferences and sample assets remain byte-identical
to 2.4.16. The reports cannot alter songs, waveform tails or playback state.

The current library contains 403 original automatic events and 51 practice-layer
events (Birthday 9, Twinkle 18, See You 24). The prior reports omitted the latter.
Melody-gap inference uses explicit melody identity and merged written spans,
including short gaps and declared ending extent. Actual declarations retain
separate paths and meanings; an inferred gap is not a source rest. Missing or
ambiguous melody identity produces an unresolved result, not a false zero.
Deliberate single-note practice is no longer warned for too few chords.

A newly surfaced Da Yu legacy backing event [78,78.75) overlaps the inferred
melody gap [78.5,79). This is a source-review lead only. No note is deleted,
shortened or declared wrong. Source silence, omitted chords and written support
holds remain distinct; neither structural success nor a metadata label proves
harmonic fidelity or pleasantness. See SUPPORT_REPORTS.md for CLI compatibility.

## Integration and webpage

The compiler entrypoint/reference and actual external AI prompt now ask for
both-layer review, complete written-span comparisons and explicit evidence
boundaries. The copied external JSON schema remains unchanged; the prompt does
not introduce an unsupported practiceAccompaniment import field. Its conservative
example continues to import through the production parser.

The own-cloud normal update control advances 2.4.16 to 2.4.17. The actual Copy
Prompt button returns 5184 characters including all-layer review, full written
spans and no authority to crop natural sample decay. Song selection still opens
See You with .55x preserved; selecting light and starting demo displays preparation
then progresses to second 60, where manual Pause preserves position. No layout
changes were made; 2.4.16 wide/compact screenshots remain the prior visual sample,
not relabelled as a new screenshot capture.

## Checks and scope

The report suite passes 39 cases; full npm run check passes 706 runtime and
15 compiler tests. Independent all-script review passes 723 including two
additional standalone scripts.
Review found a missing sourceLowerVoiceRestWindows adapter and URL-sensitive
file loading. Both are covered by regressions: lower-voice claims stay scoped
to explicitly mapped practice support and unknown mapping stays unresolved;
legal filename punctuation is treated literally. Skill frontmatter validation
passes. Formal Node server
HTTP/MIME and exact archive boundaries continue in the full gate. No system-level
or external-site testing is added. This stage addresses future compiler/report
errors; it does not claim a newly corrected song or whole-library musical approval.

## Portable source

Baseline 73041efc803b6c4f16046c8fc0ceaefc08fcc507; local/practice-focus,
zero new commits, no push/publication. Node.js 24/npm, no extra dependencies:
`npm start`, localhost:8123; `npm run check`. The cumulative patch is replayed
against the baseline and the complete gate rerun. BUILD-INFO hashes compare
working tree, replay and ZIP. Private score scans and diagnostics remain outside
the package; the original tracked sample-source recording stays unchanged.
