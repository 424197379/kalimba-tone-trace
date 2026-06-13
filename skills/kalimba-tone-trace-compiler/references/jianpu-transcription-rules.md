# Jianpu Transcription Rules

Use this reference when reading photographed numbered notation or online jianpu sources for Kalimba ToneTrace.

## Priority

Always transcribe the main melody first. The derived melody version must be playable and judgeable as single notes on a 21-key C kalimba.

For current user-upload JSON, use V2 `events`: melody-only songs still use single-note events, and reliable chords, accompaniment, and rhythm metadata may be included in the same upload object.

## Reading Notes

- Map C-based degrees to note names:
  - `1=C`, `2=D`, `3=E`, `4=F`, `5=G`, `6=A`, `7=B`.
- No octave dot means octave 4: `1=C4`, `2=D4`, ..., `7=B4`.
- One dot above means octave 5.
- Two dots above means octave 6.
- One dot below means octave 3, but only `4=F3`, `5=G3`, `6=A3`, `7=B3` are playable.
- If the source key is not C, read in the source key first, then transpose to C degrees for app output.
- If a note falls outside the 21-key range, move it to the nearest musically sensible playable octave and record the adjustment.

## Rhythm And Rests

- Use beat units from the source meter.
- Use common durations such as `0.25`, `0.5`, `0.75`, `1`, `1.5`, `2`, `3`, and `4`.
- Underlines, beams, dots, ties, and slurs must be reflected in `beat` and `duration`.
- `0` is a rest. Represent it as a beat gap, not as a note.
- Bar lines help align beats but are not emitted as events.
- Preserve weak starts, pickups, and long phrase rests. For V2 accompaniment, gaps of 1 beat or longer should become `rhythm.restWindows`.
- If a melody rest is unclear, prefer silence over invented accompaniment until a source confirms otherwise.

## Repeats And Form

- Expand repeats into explicit `steps` or `events` for the practice app.
- Record repeated sections in `sourceFeatures.hasRepeats`.
- If a source uses first/second endings or D.S./D.C. marks and the expansion is uncertain, mark the affected measure or beat range for review.

## Chords

For legacy V1 melody output:

- Keep only the vocal or recognizable main melody note.
- Do not include simultaneous chord tones in `steps`.
- Record omitted chord information in `sourceFeatures.unsupported` or review notes.

For V2 uploads and built-in chord arrangements:

- Put simultaneous notes in `events[].notes`.
- Use `role: "melody"` for the main line, `role: "harmony"` for inner chord tones, and `role: "bass"` for low support notes.
- Set `judge: true` only for notes the user should play in that version.
- Keep chord targets playable on the 21-key C kalimba. Thin dense chords to 2-4 useful notes.
- Use `judgeWindow` for chord events that are likely swept or broken rather than perfectly simultaneous.

## Auto Accompaniment

- Add auto-accompaniment only to V2 songs.
- Prefer sparse bass/harmony support derived from verified chord tones or from the V2 chord anchors.
- Do not place accompaniment events inside `rhythm.restWindows` with `policy: "silent"`.
- Use a soft held event only when the rest window is intentionally `policy: "hold"`.
- If a source lacks accompaniment details, infer conservatively and mark the source status or review confidence as inferred/low.

## Source Cross-Checking

Use online sources when the image is blurry, incomplete, or lacks rhythm/chord/accompaniment information.

Source priority:

1. Full score, MusicXML, MIDI, or complete jianpu with rhythm.
2. Jianhepu or numbered notation with chord/bass hints.
3. Chord charts or guitar tabs.
4. Listening-based inference.

When sources conflict, keep the melody/rhythm from the most complete rhythmic source and use chord-only pages only for harmony support.

## Uncertainty

If a measure, chord, rest, or accompaniment pattern is ambiguous:

- Choose the most likely melody only when confidence is high.
- Mark uncertain measures or beat ranges in `sourceFeatures.unsureMeasures`.
- For V2 rhythm, use `sourceStatus: "inferred"` or `"needs-review"` rather than `"verified"`.
- Write review notes under `private/sheets/review/<song-id>.json` when working with built-in songs.

## Validation

After generating or updating song data, always run:

```powershell
npm run validate:songs
npm run report:rhythm
npm run build:songs
npm run check
```
