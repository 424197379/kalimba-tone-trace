# 《大雨小雨》: same-source vocal timing correction, v2.4.6

## Scope and exact change

The built-in V1 retains the existing **single-melody, once-through vocal
scope**. All **70 pitch names and separate attacks** stay unchanged. The first
**47 complete pitch/onset/duration tuples**, source bars 1–8 at **[0,32)**,
also stay unchanged. Only the last **23 timing tuples** change:

- Source bar 9: eight eighth-note attacks over **[32,36)**, rather than the
  old eight-beat [32,40) realization.
- Source bar 10: eight eighth-note attacks over **[36,40)**, rather than the
  old eight-beat [40,48) realization.
- Source bar 11: its seven attacks and internal durations are already correct;
  shift the entire bar eight beats earlier, from [48,52) to **[40,44)**.

The selected vocal extent is therefore **44 beats**, down from 52. Its final
note remains **C4 for one beat**, now beginning at beat **43**. This change
does not add notes, remove attacks, rewrite earlier phrases, introduce physical
chord targets, or add accompaniment. The song id, titles, difficulty, 92 BPM,
historical 0.9 speed suggestion, 4/4 meter and C-major practice key are retained.

## Primary-source evidence

- [Existing recorded source page](https://www.ccguitar.cn/cchtml/12894419.htm)
- [Its one-page numbered-score image](https://s201.lzjoy.com/res/statics/fileupload/opern666/score_400000_500000/0321/3f5f572b52892028574824bfed66c0375e7586ab8a6d1.jpg)
- Image size: **1000 × 1430**; SHA-256:
  `20f666fdba68000b80f72d0254d561e81189742804d2b5f906f22ec8464cde03`

The entire image, header and four systems were read on 2026-10-12 before
editing. The correction uses the exact source already recorded for this song,
not a different arrangement or a meter-only inference. An independent review
agreed with all 70 source-derived tuples over the eleven selected bars.
Bar numbers here are assigned from visible bar lines; they are not printed
on the source.

The source explicitly prints **1=D, 4/4**. Degrees 1–6 appear without octave
dots or incidental accidentals. One uniform **−2-semitone transposition** maps
D4/E4/F♯4/G4/A4/B4 to C4/D4/E4/F4/G4/A4. The existing C4–A4 melody already
matches this transformation by attack index, with no local octave folding.

The old secondary Baidu reference remains in historical metadata. Its current
response exposed a JavaScript loading shell rather than notation; independent
secondary-source corroboration was not established. This is not described as
a verified paywall or a successful second-source review.

The original public page and image were accessible through ordinary verified
HTTPS. Public access does not establish reproduction or distribution rights.
Raw scans, enlarged crops, complete private evidence and the input snapshot
remain outside the repository. No publication or deployment approval is implied.

## Why the last phrase changes

Every attack in source bars 9 and 10 has a single underline, so each lasts
half a quarter-note beat. Each bar has eight such attacks, totaling four
beats. The old data instead used four-attack cells of **1 + 0.5 + 0.5 + 2**
beats, doubling those two source bars.

The visible arcs connect different pitches. They are slurs, not same-pitch
ties, and retain both attacks. Equal-pitch repeated notes remain separate
because no connecting same-pitch ties are present. Bar 11's final tonic has
no extension dash or rest after it within the retained vocal bar; its one-beat
duration is preserved.

All eleven selected bars balance to four beats with no written rests. No
rhythm windows, extra ending silence or held fillers are created. Tests lock
the exact internal rhythm, not merely the total duration of each bar.

## Selected 44 beats versus the full printed 48 beats

After the eleven lyric-bearing bars, the page prints a separate twelfth bar
inside parentheses, labeled **间奏**. It contains seven instrumental attacks
over **[44,48)**; the printed final double bar follows it.

The existing adaptation already omitted that interlude. This correction keeps
the same scope:

- Selected vocal melody once: **11 bars, 70 attacks, 44 beats**.
- Entire printed score read linearly, including interlude: **12 bars,
  77 attacks, 48 beats**.

`sourceFeatures.sourceTotalBeats: 44` explicitly describes the retained vocal
extent. It does **not** assert that the full printed page ends at beat 44.
The omitted interlude is source activity outside the selected scope, not a
source-written rest, all-layer silence or a four-beat practice ending gap.
Its metadata records both `sourceWrittenRest: false` and
`sourceAllLayerSilence: false`; no `silentWindows` claim is added.

Two lyric rows share the same notation, but the page has no repeat sign,
alternate ending, D.C. or D.S. instruction. The existing single run is kept;
the second lyric row alone is not treated as permission to invent another
70-note pass. `hasRepeats` remains false.

## Review metadata and restoration

The runtime-facing scoped status is:

`sourceFeatures.sourceReview.currentScopeReview.status`
= `reviewed-vocal-melody-interlude-omitted`.

This names the reviewed notation and omitted-interlude scope. It does not
approve reference listening, physical playability or publication. The hint
discloses the eleven bars, single pass, 44 beats, transposition, omitted
four-beat interlude and chosen practice BPM.

`sourceReview.historicalReviewNotes` preserves the complete original
`sourceFeatures`, including the old local image-path claim, both source URLs
and the omitted-interlude statement. `sourceReview.originalV1.hint` preserves
the old hint. The entire original V1 byte stream is reconstructible without
Git or a private source file:

1. Clone the current song, restore the historical hint and replace
   `sourceFeatures` with `historicalReviewNotes`.
2. For attack indices 47–62, restore the four old cells beginning at beats
   32, 36, 40 and 44. Each uses offsets [0,1,1.5,2] and durations
   [1,0.5,0.5,2]. Do not change their pitches.
3. Add eight to the onsets of indices 63–69; keep their durations.
4. Serialize with two-space JSON indentation, compact every `steps` tuple to
   one line as in the original, and append one final newline. The focused
   regression contains the exact formatting operation.

The reconstructed full JSON must have SHA-256:

`e7a90499d051ed5afc10ec564f9bd6dbb870786119b3e9be8e8dc02344173ea0`

This protects every original property, not only the melody. The snapshot was
hashed and checked against the pre-edit production file before the correction.
Historical preservation is not a renewed fidelity claim for the old timing.

## Accompaniment compatibility

There is **no existing `da-yu-xiao-yu` V2 sibling**. The separate `da-yu` and
`da-yu-chord` ids belong to another song and are untouched. No support layer
is introduced or borrowed.

Any future support must match this exact melody, 92 BPM and 44-beat effective
extent. The actual `hasMatchingPracticeMelody` guard rejects a synthetic V2
projection of the old 52-beat timing and a candidate that wrongly appends the
four interlude beats as ending silence. A synthetic same-content V2 control
passes compatibility, which is not a harmony or listening approval.

## Tempo, tests and acceptance limits

No metronome tempo is printed. The retained **92 BPM is a practice choice**;
`defaultSpeedFactor: 0.9` is a historical suggestion. Neither field establishes
the runtime's actual selected or remembered multiplier. Playback checks must
record the visible multiplier used.

Run the focused checks from the repository root:

```sh
node --test scripts/test-rain-reviewed-timing.mjs
npm run validate:songs
```

The regression invokes the repository's actual transcription-evidence checker
with compact independently recorded per-bar expectations. It covers all eleven
bars, 70 pitches/attacks, the frozen first 47 tuples, exactly 23 timing changes,
eighth-note density, retained slurs and repeated attacks, final extent,
interlude-versus-rest semantics, global transposition, source fingerprints,
complete historical-byte reconstruction and support compatibility. The same
fixture reproduces the old-data failure at source bar 9. No private file is
needed for the public regression.

The complete private eleven-span source fixture must also pass the checker
against the corrected production JSON. These executable comparisons protect
the recorded review; they do not themselves read source pixels or establish
audible musical quality. Generated-library rebuilding, version updates, full
project checks and runtime integration belong to the release integration.

Suitability remains **conditional**. The narrow diatonic range and maximum two
attacks per quarter beat fit a plausible beginner melody, but reference
recognition, browser-audio comparison at the actual practice speed and physical
kalimba testing remain unperformed in this source correction. Same-thumb
repeated eighth notes and natural tine decay still need physical checking.
No phone or instrument verification is claimed.
