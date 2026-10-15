# 2.4.5 local verification

## Source scope and exact differences

Two source records change relative to frozen 2.4.4 revision 1; all other 51
records, including both older V2 siblings, remain byte-identical.

- Farewell / 送别: exactly five pitch substitutions in the adopted public-preview
  m7–8 cadence. All 58 attacks, every onset/duration and the other 53 pitches
  remain. m3–4 and the unseen second half remain unreviewed; no later similar
  phrase is mirrored. See `FAREWELL_CADENCE_2.4.5.md`.
- Mixue: the same-edition numbered and staff source supports C5@8 for one beat,
  followed by a separately attacked rolled chord. Only that duration changes
  from two to one. All 66 attacks, the other 65 tuples, the full 50-note Chinese
  section, m15 tie and end at beat 42 remain. The omitted chord creates an
  adaptation gap [9,10), not a written all-layer rest. See `MIXUE_MELODY_2.4.5.md`.

The old V2 files remain historical and content-incompatible backing is disabled.
This adds no physical chord targets or guessed chord-member melody. Printed
Mixue BPM 115 is distinct from a stored suggested speed and actual playback
selection. Farewell's retained 70 BPM is not printed on its public preview.

## Executable verification

`npm run check` passes: 269 runtime tests, 13 compiler-evidence tests, source
validation, transcription/suitability checks and JavaScript syntax checks.
The source library has 53 records, 36 canonical melodies, 7079 source steps,
0 validation errors and 550 existing grid/density warnings. Warnings are not
permission to round legitimate source timing or add notes.

Actual production scheduler functions run both complete corrected melodies at
30 fps and 0.55x/1x; every source onset is scheduled exactly once and no rejected
sibling backing is scheduled. Actual rendering clears Mixue's C5 beam/expected
key throughout the omitted-chord gap and resumes at the next written onset.
The 16 known source extents are covered; Mixue has no added final silence.

The formal Node server is tested through real loopback HTTP: every one of the
21 app-shell assets and 21 samples returns 200, the expected MIME and nonempty
bytes. Only the specified historical Jasmine archive is allowlisted; other
raw-song, unknown-archive and private paths remain forbidden. This formal
server gate is separate from the own-cloud browser's Python preview.

Internal dry-sample numerical checks (common gain 0.8):

- Farewell's difference consists only of the five intended pitch changes;
  residual after subtracting those changes is 1.11e-16. New peak 0.530479925,
  no clipping/nonfinite samples.
- Mixue melody-only PCM is exactly identical before/after, as expected: its
  onset/pitch sequence is unchanged and kalimba samples decay naturally rather
  than gate at notated duration. Peak 0.481914342, no clipping/nonfinite samples.
  The correction affects notation/target duration, not a promised audible change.

No new listening attachments were produced. Numerical render, source reading,
browser operation and reference/physical listening are distinct evidence.

## Own-cloud browser observations

Actual 2.4.4→2.4.5 update succeeds. Mixue's card shows 66 notes and the explicit
intro omission; no incompatible support control appears. At 0.35x and elapsed
14 seconds (inside [9,10)), no active beam or expected key is present. Its full
0.55x demo finishes normally, including a complete run with the private server
stopped using cached page/data/samples. Target lights clear at completion. Legacy Farewell chord navigation resolves to the
single melody and presents its partial-source warning; its complete 1x demo also
finishes normally. The actual copy/paste flow produces all 4632 prompt characters
identically, including omission-gap and actual-speed rules. Compact Mixue title
uses 159 available pixels without truncation after removing the old fixed
104px cap; the physical 21-key mapping is unchanged.

## Run and limits

Node.js 24/npm, no dependency installation:

```sh
npm start
npm run check
```

Open the printed local URL (default localhost:8123). The archive and patch are
portable deliverables; a cloud localhost URL cannot be opened on another host.
No push or publication occurred. Source previews remain outside the repository.
Source access and personal-study availability do not establish publication rights.

Not verified: real phone/physical instrument feel, an installed-phone PWA upgrade,
reference-performance listening, whole-library fidelity or all unreviewed bars.
Earlier same-version development refresh timeouts are not treated as successful
updates; isolated origins are used when final-code cold-cache checks are needed.
