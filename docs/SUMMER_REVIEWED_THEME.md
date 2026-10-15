# Summer: selected piano first theme, 2.4.26 private preview

## Decision and scope

The canonical `ju-ci-lang-de-xia-tian` card now selects the EOP 5457 C-major
piano edition's explicitly monophonic upper staff, source measures 8–23.
The display title is **《菊次郎的夏天》（首主题）**. The melody contains 61 attacks
in 16 bars, totaling 32 quarter-note beats in the actual printed **2/4** at
**quarter = 96**. The fixed 21-key C instrument uses the source G4–A5 register
unchanged: no transposition, octave folding, altered accidental, chord-top-note
extraction, backing, or physical chord target.

“First theme” is an editorial description of this phrase, not a printed section
label. The selected extent retains the same familiar thematic outline as the
prior card; it is not shortened merely to lower its attack count. It omits the
accompaniment-only introduction m1–7 and stops at m23 before a fresh m24 pickup.
Later written-out thematic returns, contrasting material and the full ending
through m89 are outside the selection. This is not the full composition.

Current metadata has stable status `reviewed-selected-piano-first-theme`, edition
`eop-5457-c-piano-upper-staff-m8-23`, and revision
`summer-eop5457-first-theme-2026-10-12`. The existing canonical id is unchanged.

## Evidence and limits

Selected source:

- [EOP 5457 arrangement page](https://www.everyonepiano.cn/Music-5457.html)
- [Public staff preview, page 1](https://www.everyonepiano.cn/pianomusic/006/0005457/0005457-w-b-1.png)
- [Page 2, later continuation](https://www.everyonepiano.cn/pianomusic/006/0005457/0005457-w-b-2.png)

Source page 1 SHA-256:
`23450167f24de4804bac3446155c8b9a119644b943ac615a85c5ccab0766f906`.
The source header prints Summer, the Chinese title, no key signature, 2/4,
quarter = 96 and piano. Selected noteheads, durations, rests and seven tie
endpoints were read from actual source pixels before the candidate was made.
An independent reader checked the selected bars before consulting that fixture.

The first independent reading of the high note in m22 was G5; the initial author
read A5. Reinspection resolved it to **A5**, whose center lies on the first ledger
line above the F5 top line. The final 61 tuples agree. This records the resolved
disagreement rather than claiming the initial readings were identical. Later
similar occurrences were not copied into this scope as substitute evidence.
The implementing review also reopened the saved header and selected bar crops;
that was a consistency check after receiving the earlier reading, not another
blind independent transcription.

The source's lower staff has notes during all five selected melody rests.
`currentScopeReview.melodyOnlyRestWindows` preserves this voice-specific meaning
and is recognized by the generic report. No all-layer silence claim is made.
The task does not transcribe or validate the lower-staff accompaniment.

Source access and notation evidence do not establish publication permission.
The source describes personal-study arrangements and restricts redistribution
and commercial use. This change remains a **private preview**; no permission to
publish the derived arrangement is asserted. No raw source scans, crops, full
private glyph maps or unrelated source previews belong in the source package.

Reference-recording recognition, browser audio acceptance and physical-kalimba
acceptance are separate gates. The data stage records all three as not performed.
Structural tests are not substitutes for listening or real-instrument play.
No reference-audio or real-phone claim is made by this document.

## Exact timing decisions

Source quarter beat 14 becomes local beat 0. All of m8 is retained, including its
initial one-beat melody rest; G4 first attacks at local beat 1. There is no
truncated pickup bar, guessed count-in or timing conversion to 4/4.

Seven same-pitch ties each make one attack:

- m9 C5 and m13 C5: sixteenth plus quarter, 1.25 quarter beats
- m11 D5 and m15 D5: sixteenth plus eighth, 0.75 quarter beat
- m17 G5, m19 G5 and m21 E5: sixteenth plus eighth, 0.75 quarter beat

The ties are within individual measures. Their continuation heads do not
retrigger. Neighboring C5, G5 and E5 repetitions remain separate attacks. No
repeat sign occurs in this selected span; all 16 bars are written out.

The five upper-staff rest intervals are [0,1), [4,5), [12,13), [21,21.5) and
[25,25.5), totaling four quarter beats. They remain empty of practice melody.
The final D5 starts at local beat 30 and lasts two beats, reaching the excerpt
boundary at 32. No final silence, extended sustain or later return is invented.

## Practice speed and difficulty

The change keeps the **source tempo 96 BPM**. `defaultSpeedFactor: 0.4` changes the
score's explicit default-speed button suggestion from the old edition's 0.9.
It is an editorial slow-practice suggestion, not a source marking. It does not
set the actual live slider or overwrite a remembered speed. The unchanged
runtime first-visit selection of 0.55 is a separate setting; acceptance must
record the visible selected speed and verify remembered settings separately.

The fastest attacks are 0.25 quarter beat apart:

- Source 1.0×: 156.25 ms
- First-visit 0.55×: about 284.09 ms
- Suggested 0.4×: about 390.625 ms
- Optional slower 0.35×: about 446.43 ms

For comparison, the old encoded minimum is 0.5 beat at 80 BPM, 375 ms at 1.0×
and about 416.67 ms at its old 0.9 suggestion. Only substantial slowdown makes
these fastest spacings approximately comparable. At 0.4× the selected 32-beat
span lasts 50 seconds, excluding any playback lead-in or sound decay.

`difficulty: medium` is an editorial, conditional slow-practice rating. The
source is not marked “medium,” and the source tempo is not represented as easy.
Seven ties remove retriggers; this alone does not make the phrase easier.
On the app's actual tine layout, the melody has 17 consecutive same-pitch pairs,
24 same-side pairs, an eight-attack same-side run, a maximum nine-semitone melodic
leap and a maximum 15-position display jump. These are warning signals, not
proof of a particular fingering or physical comfort. Physical speed, thumb
movement, recognition and real note decay still need a play-through.

## Historical edition and recovery

`data/archives/ju-ci-lang-de-xia-tian-v2.4.25.json` contains all original bytes,
including its 68 steps, original display strings, 80 BPM, 4/4, 0.9 speed
suggestion and complete source metadata. SHA-256:
`d9217930906156ca047d542d1008cdcfe0c681fcdde829d8b71709275b078d3d`.
Its original source references remain preserved:

- [Historical Qupu page](https://qupu123.com/puyou/shangchuan/p348385.html)
- [Historical Qupu image](https://qupu123.com/Public/Uploads/2019/07/16/5078795d2d7a9005a8a.jpg)

The Qupu engraving was not recovered or reverified. The selected EOP edition is
not proof that the old edition was wrong. Its prior `sourceFeatures` are retained
unchanged in `sourceReview.historicalReviewNotes` and in the exact archive.
Historical confidence text is history, not current EOP verification.

For comparison only, halve old beat values and unfold the seven EOP ties back
into printed heads: all 68 pitch heads agree in sequence, including A5. Six
notehead timing tuples differ in EOP m18/m20. Those are edition differences;
they do not justify splicing the old rhythm into the selected source.
**32 versus 64 beats is a notation/timebase difference, not evidence that half
of the familiar phrase was removed.**

The archive is developer recovery evidence outside `data/songs`. It creates no
extra built-in card, user-facing restore UI, HTTP route or service-worker cache
entry. The actual importer restores it as a separate local song without changing
the selected built-in. Normalization changes schema/id/uploader/practice display
strings; a regression reverses only those documented fields and reconstructs
all original bytes from the imported/saved content plus archived display fields.
This is recovery verification, not a new restore feature or historical-source
musical approval.

## Executable checks

Run the public regression:

```sh
node --test scripts/test-summer-reviewed-theme.mjs
```

It protects the exact 61-tuple SHA-256
`6a0b1e514dc98d85a7d208439d24670f3dd5f5ce7b5c32f0d7f2c9860633e482`,
16 independently recorded bar fingerprints/counts and complete two-beat spans,
seven ties, real repeated attacks, all five melody-only rest declarations, final
extent, pitch register, source meter/tempo, conditional practice metadata,
archive bytes, real importer/storage recovery and card independence. Mutation
checks reject wrong ledger pitch, local octave fold, split tie, merged repeat,
erased initial rest, filled short rest, borrowed old rhythm, invented ending,
old tempo and old meter.

An optional local-only test reads the separate pre-edit source-authored evidence
when `SUMMER_SOURCE_EVIDENCE_PATH` points to it. It checks that fixture's frozen
SHA-256 `480c750d7de42e0afaf61623fa67bd6b00c08377fc04e9da40ea04d04b5a2672`,
then exercises the reusable evidence checker against all 61 expected attacks in
16 spans and rejects the same mutations. Only the candidate-to-built-in id is
mapped; expected attacks are never generated from production JSON. Without the
private fixture, that optional test is visibly skipped, not reported as an
independent source pass. The full private fixture is not copied into this repo.

The source-data stage also runs the song validator, timing/report analysis,
import-contract tests and song-store tests. The integration owner separately
regenerates the built-in module, wires the concise notice, checks actual source
and practice playback, verifies first-visit/remembered speed, and runs the full
project and private-preview packaging checks. Those later results belong in
their own verification record, not inferred from this data-stage test.
