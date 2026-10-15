# Twinkle: source review without adding notes

## Outcome

No song JSON changes. All 42 current melody attacks and all 18 light-support
onsets / 33 support notes are compatible with the specifically selected source
below. Keep the sparse single notes at beats 20 (C4), 28 (G3), and 30 (G3).
Source agreement is not a reason to fill them with additional chord tones.
Physical practice continues to use the single-note melody only.

## Selected evidence

- [UkuStuff C, F and G7 staff edition, page 1](https://ukestuff.wordpress.com/wp-content/uploads/2016/08/twinkle-twinkle-little-star-c-f-g71.pdf)
- PDF SHA-256: `059515e3fa60afb41eff150c71336e2bb35d7ddd13ef6431c46e0a79e35042eb`
- Full-page pixels and the bridge were independently inspected on 2026-10-12.
- 4/4, 12 measures, 48 quarter-note beats. No pickup, written rests, ties,
  fermatas or repeat signs. Six phrase-ending notes have duration 2; the final
  note is at beat 46 for 2 beats, with no invented tail rest.
- Every source pitch C4–A4 maps to the current melody with the same +12-semitone
  octave shift, no local folding or timeline offset. Printed tempo is absent;
  current 80 BPM remains an existing practice choice, not source-verified tempo.

The 22 chord changes are recorded independently in the regression. Each existing
0.75-beat light event fits within one source chord interval. All 33 notes belong
to their interval's chord and avoid active-melody unisons. This validates chord
membership, not an exact published kalimba backing rhythm, voicing or sound.

## Older conflicts and version limits

The chosen source uses C at beat 20, C at 28, and G7 at 30. Some preserved judged
harmony notes disagree at those three positions; the light intersection retained
only compatible notes. The old automatic backing at beat 26 contains G3/D4/F4
inside the chosen F interval; its G3/D4 are outside the source chord. The light
candidate already omits beat 26. Do not restore those older layers as verified
support merely because their metadata used earlier confidence labels.

The original local photo was unavailable for re-review. The public score is a
bounded selected version, not proof about every arrangement. The existing Easy
Breezy letter-note reference uses a different 24-bar layout, unspecified octaves
and an extra printed F in its “diamond” phrase. It was not silently blended into
this staff edition or used to overwrite the current melody.

## Regressions and acceptance boundary

Run `node --test scripts/test-twinkle-source-review.mjs scripts/test-practice-support-data.mjs`.
The new fixture checks the full source melody, all chord intervals, all existing
light events, and retention of the sparse bridge. Existing baseline fingerprint
checks continue to protect all Twinkle source bytes.

No reference-performance listening or physical-kalimba play-through is claimed.
The unchanged light candidate had prior user listening feedback; that feedback
and this notation review are distinct evidence, neither approves the full
unreviewed library or the preserved old automatic layer.
