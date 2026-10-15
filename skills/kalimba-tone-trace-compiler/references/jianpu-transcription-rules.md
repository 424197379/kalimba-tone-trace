# Jianpu Transcription Rules

Use this reference when reading photographed numbered notation or online jianpu sources for Kalimba ToneTrace.

## Priority

Always transcribe the main melody first. The derived melody version must be playable and judgeable as single notes on a 21-key C kalimba.

For current user-upload JSON, use V2 `events`: melody-only songs still use single-note events. Reliable unjudged source harmony, optional accompaniment, and rhythm metadata may be retained without changing the single-melody physical practice task.

## Reading Notes

- Map C-based degrees to note names:
  - `1=C`, `2=D`, `3=E`, `4=F`, `5=G`, `6=A`, `7=B`.
- No octave dot means octave 4: `1=C4`, `2=D4`, ..., `7=B4`.
- One dot above means octave 5.
- Two dots above means octave 6.
- One dot below means octave 3, but only `4=F3`, `5=G3`, `6=A3`, `7=B3` are playable.
- These degree/octave mappings describe `1=C`. For another key, read the actual source pitches and accidentals first, then choose one disclosed interval-preserving global transposition only if every essential pitch fits. Do not treat changing the key label to C as permission to naturalize chromatic notes.
- If notes fall outside the 21-key range, first try a global octave shift. Do not silently fold individual notes or discard accidentals. Apply the scope-specific decision in `kalimba-suitability.md` and record any accepted adjustment.

## Rhythm And Rests

- A small grace note does not by itself specify a fixed beat duration. First
  distinguish a nonmetric ornament from a measured small-note figure using the
  actual notation and source legend. Do not invent a duration, steal time from
  the principal note or move later attacks merely to fit a JSON event. For an
  explicitly selected ornament-omitted practice edition, retain all principal
  timings and disclose the exact omitted ornament and scope. If its realization
  is essential or the intended adaptation is unclear, obtain a clear source or
  an explicit edition decision before compiling it. This is a source-reading
  gate; the importer cannot identify an invented but structurally legal grace.

- Distinguish a small grace numeral from a tuplet-group count using actual size,
  position and the notes covered by its attachment. A small3 is not automatically
  a triplet sign. Check each grace's own octave dots: its curved hook is not a
  lower dot, and a nearby principal's low dot does not belong to the grace.
  Similar later figures do not resolve the current occurrence by copying.
- A short wavy/mordent-like or trill mark may not specify auxiliary pitches,
  count or metrical allocation. Do not expand it into guessed timed targets.
  When explicitly selecting an ornament-omitted principal-melody practice
  edition, disclose both small grace heads and symbolic ornaments by location
  and preserve all principal timing. This does not approve the full decorated
  performance. Keep initial independent readings and any source-pixel correction
  addendum separate rather than overwriting a frozen disagreement.

- A breath comma or phrase mark is not a quantified rest. Preserve the written
  durations and next onset unless the selected source explicitly specifies a
  timed gap. If a fixed-time interpretation is deliberately chosen, label it
  as an interpretation rather than silently shortening a held note or adding
  beats. The source reviewer identifies the symbol; the evidence checker can
  only protect the resulting reviewed tuples. See the synthetic breath-mark
  regression for shortened-note and inserted-gap negative examples.

- Use beat units from the source meter.
- Preserve source durations, including common binary values and exact tuplet ratios. For three notes in one beat use computed `1/3` durations and onsets from the group origin, not `0.25 + 0.25 + 0.5` or accumulated rounded `0.33`. There is no quarter-grid-only restriction. Read the underlying note value as well as the tuplet numeral: three eighth-note triplets span one quarter beat (each `1/3`), while three sixteenth-note triplets span half a quarter beat (each `1/6`). A 4/4 bar with eight such groups has 24 attacks. Do not assume every printed “3” means three notes per quarter beat, or replace a three-note cell with a four-note approximation. Compare alternate staff notation from the same arrangement when available.
- Underlines, beams, dots, ties, and slurs must be reflected in `beat` and `duration`.
- Merge identical pitches only when source pixels/notation confirm a tie, retaining one attack with summed duration. Keep independently attacked same-pitch repeats and different-pitch slurred notes separate. Adjacent equal pitches are not proof of a tie. Check octave dots, rhythmic dots, underline extent and the source legend; a stacked meter beside `1=C` is not a sharp sign.
- At a system or bar break, trace both endpoints of an apparent tie. A confirmed sustain may exceed one bar; do not create another attack at the next bar or line. Continuation colors are edition-specific evidence aids, not a universal rule. Keep the next independently attacked same-pitch note.
- `0` is a rest. Represent it as a beat gap, not as a note.
- Bar lines help align beats but are not emitted as events.
- Preserve weak starts, pickups, and phrase rests. For V2 support, gaps of 1 beat or longer should become `rhythm.restWindows`; shorter source rests still must not acquire invented fills. Preserve an evidenced final rest in numeric `sourceFeatures.sourceTotalBeats` without lengthening the final note.
- If a melody rest is unclear, prefer silence over invented accompaniment until a source confirms otherwise.

## Repeats And Form

- Expand repeats into explicit `steps` or `events` for the practice app.
- Record repeated sections in `sourceFeatures.hasRepeats`.
- If a source uses first/second endings or D.S./D.C. marks and the expansion is uncertain, mark the affected measure or beat range for review.

## Chords

For legacy V1 melody output:

- Keep only the source-identified vocal or recognizable main melody note. Do not guess it from the highest pitch or first array element.
- Do not include simultaneous chord tones in `steps`.
- Record omitted chord information in `sourceFeatures.unsupported` or review notes.

For V2 uploads and built-in chord arrangements:

- Put simultaneous notes in `events[].notes`.
- Use `role: "melody"` for the main line, `role: "harmony"` for inner chord tones, and `role: "bass"` for low support notes.
- New imports target one explicit `role: "melody"`, `judge: true` note per event; any retained harmony/bass notes are unjudged. Preserve historical chord-target data when auditing existing source arrangements, but do not present it as the main physical practice task.
- Keep retained source harmony within the instrument vocabulary. When arranging support, use only as many source-backed notes as help the melody; avoid treating a fixed chord size as universally suitable.
- Existing `judgeWindow` can document a source chord sweep/broken attack; it is not proof that the tine layout makes a sweep physically possible.

## Auto Accompaniment

- Add auto-accompaniment only to V2 songs.
- Prefer sparse bass/harmony support derived from verified chord tones or from the V2 chord anchors.
- Do not place accompaniment events inside `rhythm.restWindows` with `policy: "silent"`.
- Use a soft held event only when positive source evidence and the chosen arrangement justify `policy: "hold"`. Do not change a silent rest to `hold` to excuse an overlapping event.
- When source accompaniment is unavailable, prefer melody-only. An explicitly requested inferred candidate must remain sparse, quiet, opt-in and marked inferred/needs-review. Keep source harmony conflicts unresolved until checked; agreement or intersection between existing layers is not independent evidence.

## Source Cross-Checking

Use online sources when the image is blurry, incomplete, or lacks rhythm/chord/accompaniment information.

Also use online sources when the user gives only a song title. Search broadly first, then narrow around the sources that preserve rhythm. Useful query families include:

- `<title> 简谱`
- `<title> 卡林巴 简谱`
- `<title> 简和谱`
- `<title> 五线谱`
- `<title> MIDI`
- `<title> MusicXML`
- `<title> 吉他谱`

Source priority:

1. Full score, MusicXML, MIDI, or complete jianpu with rhythm.
2. Jianhepu or numbered notation with chord/bass hints.
3. Chord charts or guitar tabs.
4. Listening-based inference.

When sources conflict, identify the intended version and resolve the affected melody/rhythm span against a readable rhythmic source. Source ranking alone does not resolve an audible conflict. Use chord-only pages only for harmony support.

Save downloaded source images, screenshots, or page captures under `private/sheets/raw/<song-id>/`. Save URL lists, confidence notes, conflicts, and source decisions under `private/sheets/review/<song-id>.json`. These private source files are working material and must not be committed.

## When To Ask The User For More Sources

Ask for user help only after a reasonable source search, and ask for the exact missing material.

Ask when:

- No complete rhythmic source can be found.
- Sources disagree on the main melody, pickup, or phrase rests.
- Only chord charts or performance videos are available and the melody would be mostly guessed.
- The source is too blurry or cropped to read durations.
- Harmony or accompaniment would be mostly invented.
- The user wants a specific version, excerpt, singer, film arrangement, or kalimba cover that differs from the common published melody.

Useful requests include a clearer sheet photo, a source URL, MIDI or MusicXML, an audio/video reference, the target section, or permission/source notes for modern copyrighted material.

## Uncertainty

If a measure, chord, rest, or accompaniment pattern is ambiguous:

- Use a melody decision only when source evidence supports its identity. Ambiguous multiple candidates remain unresolved; do not choose the highest/first note as a fallback.
- Mark uncertain measures or beat ranges in `sourceFeatures.unsureMeasures`.
- For V2 rhythm, use `sourceStatus: "inferred"` or `"needs-review"` rather than `"verified"`.
- Write review notes under `private/sheets/review/<song-id>.json` when working with built-in songs.

## Validation

Use [evidence-and-regressions.md](evidence-and-regressions.md) for scoped fixtures and separate source/audio/physical acceptance. After generating or updating song data, run:

```powershell
npm run validate:songs
npm run report:rhythm
npm run build:songs
npm run check
```
