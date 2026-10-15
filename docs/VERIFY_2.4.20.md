# 2.4.20 selected Porcelain theme review

Local preview, not pushed or published. The 16-bar source-authored theme is
selected as a named piano-upper-voice edition, not a correction proving the
unavailable prior edition wrong. See PORCELAIN_REVIEWED_THEME.md for source
bounds, source asset hashes, voice identity and preserved limitations.

## Recorded integration findings

The initial full gate correctly failed on historical tail assertions still
pointing at the new edition. Those three assertions now read the exact old
archive; new selected-tail, last-note, tempo and extent assertions are added.
The 22-song extent cohort also retained this song’s old 96/96 endpoint; it now
expects the selected source’s 64/64 endpoint without removing the cohort check.
A further integration expectation omitted the new source notice from its exact
visible-notice list; the new song is explicitly added. Neither failure is
counted as a successful gate. The corrected final full reruns pass; all earlier failed rounds remain recorded.

Focused source/session/disclosure/import matrix: 189/189. This includes six
production-function healthy-frame session cases at .55x and 1.4x, covering
all 83 attacks, opening rest, [28,36) and [56,64) loop boundaries. It does not
claim a strict fixed-cadence audio or physical-kalimba experiment.

The internal prior archive is byte-identical and deliberately absent from
user links and the HTTP allowlist. Formal-server regression checks its 403
response. No new raw score asset is packaged. App audio, samples, preferences
and accompaniment remain unchanged.

## Final verification

The final npm gate passes 756 runtime plus 15 compiler tests, as does the
clean baseline replay after copying the corrected extent-table test. Independent
all-script review passes 773/773 with zero failures/skips. Its first two runs
correctly failed on the stale bounds/notice expectations; only its final run
is reported as passing. Final portable replay is recreated from the complete
patch and compares every source byte with the working tree and ZIP.

All 83 source-authored tuples match the pre-edit independent fixture. The other
54 song source files, app runtime, sample assets, preferences and formal server
remain byte-identical to 2.4.19. The internal prior JSON is byte-identical to
that version's 131-note record. The generated 55 records equal source JSON;
36 canonical practice cards remain. Validation is 55 songs/7151 steps with
zero errors and 602 preserved warnings.

## Actual webpage observations

Own cloud Chromium on the existing private loopback origin completes the
normal 2.4.19→2.4.20 update. Search shows one theme-short card: 83 notes,
96 BPM, hard difficulty and the precise piano-upper-voice source scope.
No old-version restoration entry is introduced. The complete 1.00x demo
reaches “示范结束” after the 64-beat selection. At .55x, own-playing repeat
runs and enters preparation again at the wrap; Pause at displayed five seconds
and Continue show the same position with “继续准备 3”. Repeat exits normally.
Reload restores .55x and starts inactive with repeat off. Wide 860×404 and
compact 607×524 captures show the current title/source notice and all 21 keys.

The actual Copy Prompt returns 5333 characters including explicit voice scope,
shorter-not-automatically-easier and internal-reversibility guidance. This
checks real webpage copy and play controls, not reference-recording comparison
or subjective physical ease. No system-level validation was added.

Baseline 73041efc803b6c4f16046c8fc0ceaefc08fcc507; local/practice-focus;
zero new commits. Node.js24/npm, no additional dependencies: `npm start` and
`npm run check`. No push/publication or raw source-score redistribution.
