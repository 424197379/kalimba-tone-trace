# Kalimba Suitability And Quality Gates

Use before committing to a full transcription, and again before delivery. The target is this app's fixed natural-note F3-E6 instrument, not every kind of kalimba. Difficulty and suitability are separate: an easy score can be wrong, and a harder arrangement can be recognizable.

## Gate 1: Does The Song Fit This Instrument?

1. **Identity and scope.** Confirm the tune, performer/composer, version and recognizable section. A shared title is not evidence of the same melody. Decide full song, one strophe, refrain, or excerpt; disclose omissions in `hint`.
2. **Pitch vocabulary.** Read the source key and accidentals before transposing. Check whether one consistent transposition preserves all essential intervals on the fixed natural-note set. Some melodies with source accidentals may fit another transposition; do not decide from the printed key alone. Never replace an essential sharp/flat with its neighboring natural note just to pass validation. If none fits, offer a faithful excerpt, different tuning/instrument, or decline that scope.
3. **Register.** Compare original and compiled lowest/highest notes and octave dots. Prefer one global octave shift over isolated octave folding. Record every local adjustment and check the phrase contour. Long high notes deserve special attention to weak sustain, not an automatic rejection.
4. **Melodic identity.** Play the hook without chords at source tempo, then at the actual practice tempo. Check whether pitch contour, rhythm and phrase endings carry the identity without vocals, lyrics, drums or timbral effects. Rap-heavy or orchestration-led sections need a specific melodic excerpt, not a blanket genre ban.
5. **Decay and texture.** A plucked note naturally decays; holding `duration` longer does not turn it into a sustained voice/string sound. Slow lyrical songs can work. Respect written holds and breathing spaces. Do not insert repeated attacks or accompaniment into every gap to simulate sustain unless the chosen arrangement supports them.
6. **Hands and tempo.** Inspect the actual left/right tine layout, same-thumb fast repeats, jumps, simultaneous targets and crossing movements at the target BPM. A sweep is only plausible for the physically adjacent tines it crosses. Start with melody-only; add source-backed sparse support if it helps, without masking the melody.

Return one scope-specific decision, with evidence:

- `recommended`: source-backed melody, register and playing demands fit the target; recognition has been compared against a reference, with the method recorded.
- `conditional`: fits only the disclosed excerpt, octave shift, slower tempo or reduced texture; record remaining listening/physical checks.
- `needs-review`: insufficient or conflicting evidence. This is not a claim that the composition is unsuitable. Do not publish guessed core notes/rhythm as approved.
- `not-recommended`: a verified constraint prevents the requested scope from retaining its identity on this fixed instrument. Explain the constraint and possible alternative.

There is no universal maximum note length or genre whitelist. Do not generate a numerical "suitability percentage" without an evidence-based calibration.

## Gate 2: Is This Transcription Faithful?

- Align the first recognizable phrase, a phrase ending, and a contrasting/high-risk section with a rhythmic primary source and an independent reference where available. Keep per-measure beat totals and source-to-event offsets in private notes.
- Read upper/lower octave dots separately from augmentation dots. A stacked `4/4` printed immediately after `1=C` is not a sharp sign.
- One underline halves the value; two quarter it. Do not spread notes evenly across the measure or replace a varied rhythm with repeated 0.75/0.5 values to make it add up.
- A tie between identical pitches merges duration and does not retrigger the note. A slur between different pitches preserves separate attacks. Preserve rests and pickup placement.
- A source tempo is not changed merely for library consistency; use the speed control for practice. Document whether the source beat unit differs from a quarter note.
- Compare source note intervals and octave contour before adding chords. An all-natural, in-range output does not prove that the source lacked accidentals or octave mistakes.
- Check the melody shared by melody/chord variants. Check accompaniment separately, including its default on/off state; a shared wrong melody cannot be repaired by switching variants.
- `rhythm.sourceStatus: verified` describes supported rhythm decisions only, not pitch, song identity, harmony or an entire arrangement's approval. Do not infer approval from an old metadata label.

## Record And Verify

For new built-ins, place a small summary inside the existing extensible `sourceFeatures` object:

```json
"suitability": {
  "status": "conditional",
  "scope": "verse-excerpt",
  "reason": "The selected verse fits; the chorus needs unavailable pitches.",
  "reviewRequired": ["Physical kalimba play-through pending."]
}
```

Keep source URLs, score images, checked bars, transformations and comparison results in the normal source/review locations. Mark physical listening, original-recording comparison and browser audio verification separately as completed or not performed. Do not claim to have listened when only inspecting data.

In this repository run `npm run report:suitability` (or append `-- --json`). The read-only report lists encoded range, long notes, gaps, suspicious duration concentration, large leaps and existing unresolved measures. It does not infer musical approval, alter songs, or replace reading the source. Old songs without the new summary remain `needs-review` in the report, not automatically deleted.

For actual playback, verify that samples decode and sound, notes start at expected times, and source rests/ties survive. First use source tempo (`1.0x`) with accompaniment off, then the configured practice speed and optional support. Matching playback to JSON tests the player; matching JSON to a score tests transcription. Neither alone proves recognizable performance.

If a gate cannot be completed, ask one precise question for the missing source, intended version, target section or performance link. Prefer a supported smaller scope over a fabricated full arrangement.

## Instrument References

- [Kalimba Magic: high-note sustain](https://www.kalimbamagic.com/blog/item/how-do-you-get-the-high-notes-to-sound-good): low/middle and highest tines can have substantially different decay behavior; check the actual instrument.
- [Kalimba Magic: chromatic kalimba](https://www.kalimbamagic.com/info/how-to-play/how-to-play-the-chromatic-kalimba): fixed diatonic tuning omits some pitches; a chromatic instrument addresses a different capability boundary.
