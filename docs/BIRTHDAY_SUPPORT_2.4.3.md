# Birthday: scoped light-support correction in 2.4.3

## Outcome and scope

The optional Birthday light support changes **three pitch names** to agree with
chord symbols in the selected primary edition. It remains an opt-in, quiet,
app-played aid to the unchanged single-note melody. It is a **source-informed
voicing candidate**, not an exact transcription of a written accompaniment.

Only `data/songs/birthday-chord.json`'s `practiceAccompaniment` and
`sourceFeatures.practiceAccompaniment` are revised. The three corrected events
also receive the descriptive `source-chord-symbol-correction` pattern label;
this label does not change their timing or audio parameters. The six other
support events are identical to the preceding candidate.

Preserved without a musical or timing change:

- All 25 Birthday melody attacks, including every pitch, onset and duration.
- The complete V1 `birthday.json` file, byte for byte.
- All original V2 events/chord targets, automatic accompaniment, rhythm fields,
  and earlier metadata outside the scoped practice-support provenance.
- All Twinkle V1/V2 file bytes, including its current support candidate and
  original-layer conflicts. The subsequent [Twinkle source review](TWINKLE_SOURCE_2.4.3.md)
  resolves selected-source chord membership without changing these data.
- Nine support onsets, two notes per onset, 0.75-beat durations, volume 0.34,
  bass velocity 0.40, harmony velocity 0.34, and `enabledByDefault: false`.

This is not a source approval of the preserved original chord targets or
`autoAccompaniment`. Their historical discrepancies remain intact for recovery.

## Chosen source and timeline

Primary source: Michael Kravchuk,
[Happy Birthday lead-sheet page](https://michaelkravchuk.com/free-lead-sheet-happy-birthday/),
[C-major PDF, page 1](https://michaelkravchuk.com/wp-content/uploads/2017/02/Happy-Birthday-To-You-C-Major.pdf).
The page's opening, fermata and ending pixels were inspected, and the chord
locations were checked in a separate independent visual review. Raw source
images and full score copies are not included in the repository.

The source is in C major and 3/4. App beat 0 is the first sounding pickup;
the first full measure starts at app beat 1. The unchanged app melody is one
octave above the source throughout. The source has no printed metronome mark;
104 BPM remains the existing app practice tempo, not a newly verified score
marking.

The source's quarter-note A3 with a fermata maps to app A4 at beat 17. The
existing two-beat app duration is retained as a fixed **one-extra-beat practice
realization**. A fermata does not prescribe exactly one extra metrical beat.
All subsequent source anchors are mapped with that same extra beat. The
primary final half note maps to C5 at beat 23 for two beats, ending at beat 25.
No final rest is printed in this primary edition.

The already-recorded
[Music-for-Music-Teachers edition](https://www.music-for-music-teachers.com/happy-birthday.html)
is different: its corresponding note has no fermata and it prints a final
quarter rest. Those details are not mixed into the selected primary edition.
The former secondary-only mismatch is not grounds to shorten the current
melody or append that other edition's rest.

Printed chord changes, on the retained app timeline:

| App beat | Primary chord |
| ---: | --- |
| 1 | C |
| 4 | G7 |
| 10 | C |
| 16 | F |
| 20 | C/G |
| 22 | G7 |
| 23 | C |

There is **no printed pickup chord at beat 0**. Keeping G3 + C4 there anticipates
the first C chord and remains an arrangement inference. The tests distinguish
this inferred C membership from the directly printed chord timeline.

## Exact correction and full light-support inventory

| Beat | Prior light support | Current light support | Basis |
| ---: | --- | --- | --- |
| 0 | G3 + C4 | G3 + C4 | Inferred pickup C; unchanged |
| 4 | G3 + D4 | G3 + D4 | G7; unchanged |
| 6 | G3 + D4 | G3 + D4 | G7; unchanged |
| 10 | G3 + C4 | G3 + C4 | C; unchanged |
| 12 | G3 + C4 | G3 + C4 | C; unchanged |
| 14 | F3 + C4 | **G3 + C4** | C continues until beat 16; F3 was outside C |
| 16 | G3 + C4 | **F3 + C4** | F starts here; G3 was outside F |
| 20 | G3 + D4 | **G3 + C4** | C/G; retain G bass and replace non-chord D4 |
| 23 | G3 + C4 | G3 + C4 | C; unchanged |

No support attack is added at the printed G7 change at beat 22. Sparse support
may omit a chord change. The source's chord symbols establish allowable chord
tones, not these exact octaves, two-note voicings, attack locations or durations.
In particular, G3 + C4 is a reused sparse C-family voicing, not a claim that the
source explicitly requires a G bass for every C chord.

## Recovery and provenance

The preceding candidate and its complete original provenance are preserved as
`sourceFeatures.practiceAccompaniment.historicalCandidates` entry
`conservative-layer-intersection-v2.4.2`. Its `practiceAccompaniment` object and
`review` object reconstruct the full preceding Birthday V2 song. This retains
the previously auditioned candidate rather than relabeling it as the new one.

The [historical support review](PRACTICE_SUPPORT_REVIEW.md) describes the older
intersection method. Its original onsets, pitches, role membership and quietness
checks still run against the saved candidate. The new three pitches are checked
separately against the primary-source chord timeline; they are not made to pass
by changing original V2 layers or weakening the historical membership rule.

## Verification

Run the portable regression without Git or private source files:

```sh
node --test scripts/test-practice-support-data.mjs
```

**18 tests passed, 0 failed.** They cover:

- Original baseline `73041ef` parsed-JSON hashes after removing only the two
  allowed practice-support subtrees; the baseline hashes were not regenerated.
- Byte hashes for Birthday V1 and both complete Twinkle files.
- Exact historical Birthday candidate, original provenance, and reconstructed
  complete V2 snapshot hashes, plus original two-layer membership negatives.
- Exact current nine-event inventory and a deep comparison permitting only the
  three pitch substitutions and three descriptive pattern-label changes.
- Chord-tone membership for all nine support events, explicitly inferred pickup
  C, and G bass for C/G. Negative fixtures reject a non-chord tone at every
  onset, all three former conflicts, and a wrong C/G bass.
- The unchanged 25-note melody, fixed-time fermata interpretation and primary
  ending without a secondary-edition rest.
- Existing quietness, density, role, sorted-onset, melody-unison and silence
  guards for both historical and current candidates.

The final primary-source melody and nine-event support fixtures were also
compared directly with the revised data. The melody matches exactly; the
support matches in every playback field, with the three descriptive pattern
labels intentionally updated.

Additional data checks passed in the shared 2.4.3 working tree:

- `npm run validate:songs`: 53 songs, 0 errors, 549 warnings.
- `npm run test:song-transcriptions`: all 15 melody regressions.
- `npm run report:rhythm`, `npm run report:arrangements`, and
  `npm run report:suitability`: completed; these inspect their existing fields
  and do not independently certify this support candidate.

Generated-library rebuild, full app checks and browser integration are separate
release checks owned by the integrating change. This data pass does not claim
those checks merely from the focused tests above.

## Remaining acceptance

`status: needs-review` and `independentlyVerified: false` remain appropriate:
the chord symbols were visually checked, while the exact sparse voicings and
inferred pickup are arrangement decisions. Fresh audible A/B comparison of
melody alone and revised light support, including a comparison with the
previously auditioned light candidate, is still pending for this data pass.
Test at the retained 104 BPM and configured practice speed. Prior acceptance of
the old support does not automatically accept the three substituted pitches.

No physical 21-key kalimba play-through was performed. Structural tests, source
pixels, browser scheduling, audible balance and physical playing are distinct
checks. No publication or deployment is part of this scoped correction.
