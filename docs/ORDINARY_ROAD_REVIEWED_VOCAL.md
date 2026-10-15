# 《平凡之路》 selected short vocal edition

Date: 2026-10-12. Data adoption for local preview 2.4.24.

## Decision and scope

The current built-in deliberately selects the **破晓 / 弹琴吧 short
guitar-and-vocal edition**, publicly displayed by
[吉他屋](https://www.jita5.cc/jitapu/7766.html). Its title is
**《平凡之路》（主歌＋副歌短版）**. The app retains the complete lyric-aligned
numbered vocal line in source m5–21: **93 single-note attacks, 68 quarter
beats, 17 complete 4/4 bars**. It omits the four guitar-only opening bars
and all guitar arpeggios, strums and chord diagrams.

This is an explicit alternate-edition choice. It is neither a local repair
of the former 235-attack 趣弹 arrangement nor proof that that arrangement
was wrong. The original 趣弹 photo is still unavailable. The selected short
edition's complete vocal line is not the full form of the original recording.
No missing verses, repeat route, guitar targets or ending are inferred.

The source's separate, lyric-aligned single numbered line establishes the
vocal role. No highest-tone or first-tone chord extraction is used. There is
no automatic or practice backing and no physical chord-practice target.

## Source evidence and its limits

Both public source pages and the actual m5–21 detail crops were viewed. The
source lead read each occurrence separately. Two independent pixel readers
had already agreed on the 62-attack chorus; a separate full-scope reviewer
then inspected all added verse crops, independently entered 31 additional
attacks, and compared all 93 tuples against that unchanged chorus shifted
by +30.5 beats. The adoption implementation also viewed both full pages,
all selected paired-bar crops and the ending guitar/vocal detail.

These are independent readings of **one edition**, not two independent
source editions. The full-scope review was an in-memory comparison; there
is no claim of a third persisted 93-tuple source transcription. Another
course-team engraving was comparison material only and supplied no values.

The publicly linked pages are:

- [Page 1](https://img.jita5.cc//20181020/C-pingfanzhilu1.png), SHA-256
  `2037090108df36cd23e3840c722262dab806ac27d2c857564f0a29ab1c13e17f`
- [Page 2](https://img.jita5.cc//20181020/C-pingfanzhilu2.png), SHA-256
  `cc118e74c7bebadddc8646c8738719b42e8e300e0c82336c7459f32a1dbb2a63`

The selected candidate was source-reviewed before production changed. Its
private source evidence fingerprint is
`9862e69ecd2fda07f9221e2bc5691893575d27834c706143fc7e8743fade6795`.
The exact production tuple-array fingerprint, from canonical
`JSON.stringify(steps)`, is
`8c269ecd68549a1218d75f80b6657b4fe96833924583a03f7f3d01bb1abe2ac9`.
The public regression keeps only production-encoding fingerprints, bounded
examples and invariants. No source scans, full raw glyph maps, lyrics,
omitted guitar transcription or private reports are copied into the project.

Public availability does not establish reproduction or public distribution
rights. This work is a local preview, with no push or deployment. Earlier
failed or restricted sources were not retried through another access route.
No source was newly retrieved during adoption.

## Timing, ties and rests

Source absolute beat 16, the start of printed m5, is selected beat 0.
Source m5–21 is [16,84), mapped by -16 to [0,68). There is **no opening
pickup**: the first complete source bar starts at 0 and contains a written
eighth rest before E4 at 0.5. The chorus pickup remains in m12 at selected
beat 30.5, without moving or padding the verse.

The 131 printed noteheads produce 93 attacks after joining 38 confirmed
tie continuations. Prolongation dashes do not create attacks. Three confirmed
cross-bar holds remain single events:

- E4 at 3.75, duration 2.25, from m5 into m6
- E4 at 19.75, duration 2.25, from m9 into m10
- C4 at 27.75, duration 2.25, from m11 into m12

No note is retriggered at beats 4, 20 or 28. Their complete original attacks
overlap both relevant per-bar evidence spans, so the private checker reports
96 overlap comparisons for 93 unique attacks.

Occurrence-specific differences are intentional. In m5, A4 at 1.5/.25 and
1.75/.75 are separate. In m9, A4 at 17.5/1 is a single tied attack. In m7,
G4 at 10.5/.25 remains separate from G4 at 10.75/1.25. Every one of the
previous 62 chorus tuples remains unchanged after the +30.5 translation,
including the later upper octave dots, genuine repetitions and final hold.

The six contiguous written **vocal-only** rests are:

| Selected beat interval | Source bars | Duration |
| --- | --- | ---: |
| [0,0.5) | m5 opening | 0.5 |
| [6,8.5) | m6 ending + m7 opening | 2.5 |
| [14,16.5) | m8 ending + m9 opening | 2.5 |
| [22,24.5) | m10 ending + m11 opening | 2.5 |
| [30,30.5) | m12 before chorus pickup | 0.5 |
| [64,68) | m21 | 4 |

Their total is 12.5 beats. These combine adjacent rest glyphs across
barlines; they do not invent extra silence. The final C5 at 62 lasts exactly
two beats and ends at 64. It is not stretched to 68, and the timeline does
not stop at 64. The source guitar still strums C in m21. Therefore metadata
uses voice-scoped `melodyOnlyRestWindows`, not `silentWindows` or a claim that
the source's whole arrangement is silent. The selected app edition omits
guitar throughout, so it has no additional scheduled sound layer there.
Written durations and acoustic sample/effects decay remain separate facts.

## Register, tempo and difficulty

Printed `1=C`, 4/4 and quarter=80 are retained. Undotted 1 means C4 under
the repository's documented absolute-octave convention; the scientific
octave number itself is not printed on the numbered score. Actual upper
dots produce the chorus high register. All selected pitches lie in C4–A5,
with all seven natural pitch classes, zero global transposition, zero octave
shift and no individual octave folding or altered accidentals. Undotted
verse C4 notes remain literal even after a nine-semitone drop from A4.

The old edition's 84 BPM was a practice reference for that different source;
the new edition's printed 80 does not prove 84 was historically wrong.
`defaultSpeedFactor: 1` is retained from the former built-in. The private
candidate's 0.75 suggestion is not adopted and was never a printed source
marking. Slow-practice advice changes neither the app's initial speed nor
a saved user preference. Actual selected playback speed belongs in the
separate browser check, not an inference from this metadata.

The selected edition is editorially rated **medium**, replacing the old
edition's hard label. This is a scope-specific judgment, not an established
claim of beginner ease: the minimum onset gap is 0.25 beat, or 187.5 ms at
80 BPM; the maximum jump is nine semitones; genuine fast repetitions and
the A5 peak remain. The suitability status stays **conditional**. A shorter
piece and successful validation do not guarantee recognizability, preferred
sound, real sustain or comfortable physical execution.

## Historical preservation and recovery

`data/archives/ping-fan-zhi-lu-v2.4.23.json` is the complete previous JSON,
byte-for-byte, including its original title, all 235 attacks, 84 BPM,
112-beat extent and historical source claims. Its SHA-256 is
`6098bdc9bffbc2c3e3097c6a7d4343556a679f52a2151564c0b99cd2bebcbd4b`.
The parsed-object reconstruction fingerprint is
`87471a8807c074046e8aacf1c38f551f0d8d4c4716f4e91b63b4158aff7e701b`.
The current metadata also preserves its full historical `sourceFeatures`,
explicitly as unverified history. No source-photo identity was recovered.

The real `parseImportedSongs` path and isolated save/read exercise restore
the archive as an independent local V2 single-melody song. All 235 tuples,
source history, tempo, difficulty and extent survive; regenerated V2 display
titles and the new local id are expected import normalization. Reconstructing
the historical V1 shape from the retained values yields the frozen parsed
hash. The current built-in remains 93 attacks, its one canonical card is
unchanged, and a second archive import receives another independent id.

The archive is developer recovery evidence only. There is no old-version
card, restoration CTA, archive HTTP route or service-worker precache. No
`ping-fan-zhi-lu-chord` sibling exists and no old backing is reused; even
forcing the archived BPM to 80 cannot make its melody content-compatible.

## Executable checks and separate acceptance

`node --test scripts/test-ordinary-reviewed-vocal.mjs` passes **27 tests**:
all 93 tuple hashes, every bar's overlap fingerprint, unchanged chorus
translation, three cross-bar holds, true repetitions, six voice-scoped rests,
literal pitch range, real current import, byte-exact archive recovery and
15 deliberately bad mutations. The mutations cover lost ties, copied verse
articulation, erased/fill-in rests, wrong octave dots, final retrigger/hold,
truncated extent, historical tempo, false all-layer silence and backing.

These tests protect source-reviewed encoding; hashes do not independently
read notation or certify musical quality. The separate private source
checker passes production against the pre-adoption source-authored
17-span evidence: 96 overlapping attack comparisons and no asserted
all-layer silent windows. The full source validator passes 56 records,
7054 steps, zero errors and 604 pre-existing warnings; this song contributes
no warnings. Rhythm, arrangement and suitability reports also run without
errors. The rhythm report retains all six gaps, four of which meet its
one-beat long-gap summary threshold, with no backing events or conflicts.
All six are recognized as declared melody-only rests, with no all-layer
silence assertion or unannotated long gap. Rebuilt generated data, UI notice
connection, player ending/loop checks and release verification belong to
the integration record.

At this data-adoption stage, reference-recording listening, browser audio
acceptance and physical-kalimba performance were not performed. Metadata
labels those stages explicitly, rather than claiming a future check passed.
Later runtime verification can be recorded separately without rewriting
what the source-reading stage established. Publication rights remain
unestablished.
