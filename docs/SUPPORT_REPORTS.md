# Read-only song/support reports

`npm run report:rhythm` prints a JSON array for every built-in song.
`npm run report:arrangements` prints the existing V2 arrangement table.
Both commands inspect `autoAccompaniment` and `practiceAccompaniment`
separately. They do not merge the alternatives into a denser backing track.
Use `node --test scripts/test-song-report-analysis.mjs` for regression tests.

## What the values mean

- `autoEvents` and `autoDensity` retain the original backing-layer meaning.
  `practiceEvents`, `practiceDensity` and `practiceWrittenCoverage` describe
  the separate reduced candidate. Density means event attacks per score beat;
  written coverage means the union of encoded event durations divided by score
  extent. Neither measures loudness, musical quality or acoustic sustain.
- `inferredRestWindows` / `longGaps` count melody gaps of at least one beat,
  including pickups and endings supported by numeric
  `sourceFeatures.sourceTotalBeats`. Detailed melody gaps also retain shorter
  gaps. A declared extent alone does not assert all-layer silence. No ending
  is invented beyond the written melody if extent was not declared.
- `rhythmRestWindows` / `restWindows` still count explicit rhythm annotations.
  Missing annotation checks compare actual covered beat ranges, not just counts.
- `conflicts` now means overlap with a **declared** support-silence policy or an
  explicit current-source all-layer silence declaration. Entries identify the
  metadata path and affected layer counts. Source event counts can include
  retained harmony as well as melody.
- Inferred gaps with support overlaps appear separately under
  `analysis.melodyGapSupportOverlaps`. They require source review and are not
  automatically source-rest violations. Every comparison uses full half-open
  written spans, including an attack before a gap that continues into it.
- A `hold` rhythm policy appears under `analysis.holdPolicies`. Structural
  count/onset restrictions are checked for each support layer. A hold is not
  automatically a silence conflict, but a label or global rhythm status cannot
  prove that source evidence authorized it. `sourceAuthorization` therefore
  remains `not-established-by-report`. Check the actual source and scoped
  evidence; do not relabel a silent source rest to silence a warning.
- Actual current-source metadata adapters distinguish melody-only rests,
  all-layer silence, omitted gestures and melody-only adaptation gaps. They
  retain original paths and declarations, without recursively treating
  historical candidates as current evidence. Mixue's omitted rolled chord
  remains an adaptation gap; Yun Yan's final melody rest does not become
  all-layer silence; Rain's omitted out-of-scope interlude does not extend the
  selected ending.
- Source lower-voice rest declarations at
  `sourceFeatures.practiceAccompaniment.rests.sourceLowerVoiceRestWindows`
  remain separate under `analysis.claims.sourceLowerVoice`, retaining each
  exact metadata path. `analysis.sourceLowerVoiceRestReview` compares full
  written spans only with `practiceAccompaniment` when its `sourceVoice`
  explicitly declares `literal-bass-clef-lower-voice`. These are review leads,
  not automatically asserted conflicts or proof of source approval. Other or
  absent voice mappings yield `practiceApplicability: "not-established"` and
  null overlaps. Such declarations never assert silence in the melody or
  original auto layer, and never cover missing melody-gap annotations.

## Review and compatibility

Original row identity, source status and original auto-layer columns remain.
The output is additive except for the corrected `conflicts` meaning above,
expanded gap scope, the density denominator described below, and removal of
`fewMulti`. Single-note physical melody is intentional. `manyMulti` remains a legacy chord-data review notice; multi-judged
notes in a melody-mode record get their own notice.

Density now uses effective score extent: the greater of encoded source-event
end and a valid declared `sourceFeatures.sourceTotalBeats`. Previously
`autoDensity` used only the encoded source-event end. A declared final rest can
therefore lower the displayed density and remove a dense-auto notice; this is
a denominator change, not newly established musical approval. Backing that
outlasts a declared ending is still reported and cannot extend the denominator
to hide itself.

New candidate review metadata stays independent of the original backing, harmony and rhythm labels.
Unknown or ambiguous melody data gives null gap results plus `analysis.issues`,
not a guessed first/highest melody or a successful zero-gap result.

The reports are not schema validators. `validate:songs` already validates both
support layers' shape and their declared rhythm-window overlaps. Continue to
run it. An empty risk/conflict list does not establish correct source notes,
harmony, listening acceptance, physical playability or reproduction rights.

No report edits songs, proposes chord targets, schedules audio, cuts samples,
trims PCM tails, or changes runtime behavior. Natural acoustic ring-out is
separate from written event duration.

The shared CLI loader reads only regular `.json` files. Filenames are literal
filesystem names, so legal `#`, `%`, and platform-supported `?` characters are
preserved rather than interpreted as URL fragments, escapes or query strings.
