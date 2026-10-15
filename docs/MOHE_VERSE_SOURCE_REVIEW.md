# Mohe verse: source review without changing notes

## Result and selected edition

Reviewed on 2026-10-12. Keep `mo-he-wu-ting-verse` unchanged: all **88 existing
pitch/onset/duration tuples** match the separately entered source reading of
**m9–24**, a 16-bar / 64-quarter-beat verse excerpt. This is verification of the
existing single-note melody, not a correction or a full-song replacement.

- [EOP catalog, Piano-13675](https://www.everyonepiano.cn/Piano-13675.html):
  《漠河舞厅-简单完整版-抖音》, printed title *Ballroom in Mohe*;
  Jeanie, revised by 宇宙霹雳无敌二宝.
- [Numbered preview](https://www.everyonepiano.cn/Number-13675.html) and
  [staff preview](https://www.everyonepiano.cn/Stave-13675.html), pages 1–2.
  These are parallel exports of **one edition**, not independent sources.
- The lyric-aligned upper melody was checked against the treble-staff voice,
  including octave dots/positions, duration marks and both tie endpoints.
  The lower piano accompaniment was not promoted into the melody.
- Printed key/meter/tempo: **1=E, 4/4, quarter=71**. One global **−4-semitone**
  shift gives C and preserves every interval: source B3–C#5 becomes G3–A4.
  There is no local octave folding or accidental replacement.
- Excerpt beat 0 is the start of source m9 (score beat 32). There is no pickup
  within this selection. The final E4 attack at beat 60 lasts four beats;
  64 beats at 71 BPM is about 54.085 seconds.

The online edition is consistent with the existing four-page numbered-source
description. The originally supplied attachment bytes were not available for
this review, so byte identity with that attachment is not established.

## Preserved decisions

There are 96 printed melody note symbols and eight same-pitch tie
continuations, yielding 88 attacked notes. All eight ties were already merged
correctly; none crosses a selected bar, system or page boundary. The retained
merged attacks are:

| Source bar | Adapted attack: pitch @ beat / duration | Printed duration parts |
| --- | --- | --- |
| 9 | C4 @ 1.75 / 0.75 | 0.25 + 0.5 |
| 10 | E4 @ 5.75 / 1.75 | 0.25 + 1.5 |
| 11 | F4 @ 9.75 / 1.75 | 0.25 + 1.5 |
| 12 | B3 @ 13.75 / 2.25 | 0.25 + 2 |
| 13 | E4 @ 17.75 / 0.75 | 0.25 + 0.5 |
| 14 | E4 @ 21.75 / 1.75 | 0.25 + 1.5 |
| 18 | F4 @ 37.75 / 2.25 | 0.25 + 2 |
| 22 | F4 @ 53.75 / 1.75 | 0.25 + 1.5 |

- Gray tied continuation digits are held sound, not rests or new attacks.
- Genuine repeated attacks remain, including F4 at 55.5 and the separate F4
  attacks at 57.25 and 57.75. Repeated phrase occurrences were read separately.
- The quarter-/half-/quarter-beat syncopation in m12 and m23 stays exact.
  The final short m12 symbol is tied into the following hold.
- Source low degree 5 remains G3 in m11, m16 and m19; low degree 6 remains
  A3 in m17 and m21, including their independent repeated attacks.
- Each selected bar has four beats. There are no written melody rests,
  melody-only omission gaps, tuplets, repeat expansion or ending silence in
  this scope. The double bar after m24 is a section/key-change boundary;
  the modulation starting m25 is outside this version.

Per-bar attack counts for m9–24 are
`8, 7, 6, 5, 8, 7, 5, 5, 5, 3, 5, 5, 5, 4, 9, 1`.

## Regressions and acceptance boundary

Run `node --test scripts/test-mohe-reviewed-verse.mjs`.

The full unchanged JSON is protected by SHA-256
`68f63b9afd5695d381e323f7d37c1e90df6fac07873025b2fedab23eefe7d3a5`.
Bounded assertions cover all eight ties, genuine repetitions, both syncopated
cells, low registers, every bar's attack count and four-beat coverage, and the
64-beat ending. Synthetic negative controls demonstrate that these assertions
reject false reattacks, merged real repeats, octave folding, straightened
syncopation and a clipped ending without relying on the byte hash. They are
test mutations, not claims about historical errors.

The separately source-authored full comparison passed for 16 spans and all
88 attacks, with zero changed tuples. Its recorded fingerprints are:

- Source reading: `0c57fe178f72f356540599143fa6892bb6146dea30ac83937d03d982a7f72574`
- Full comparison: `3bfb3c919c9b309c820f4a04bf894f9f60cfe9e3d89f60f769c1bebaea242e46`
- Executable source expectation: `2fe67e3c018a2d2ca8c0494be6c3b46befa240523603db20c173138188f29228`

These fingerprints identify retained evidence; the public test does not
re-read source pixels or duplicate the full source fixture. Source captures
and the complete per-note reading are not distributed in this repository.

Keep the existing **conditional** suitability status. This review establishes
selected-source notation fidelity and an in-range, interval-preserving
adaptation. It does not approve the introduction, chorus, interlude, full song,
another edition, piano harmony or reproduction rights. Reference-recording
listening, browser-audio acceptance and physical-kalimba sustain/hand-comfort
checks were not performed by this review and remain separate pending gates.
No melody, metadata, tempo, meter, app resource or version change is needed.
