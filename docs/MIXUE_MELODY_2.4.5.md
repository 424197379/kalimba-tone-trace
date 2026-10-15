# 《蜜雪冰城主题曲》: reviewed single-note reduction, v2.4.5

## Scope and exact change

The built-in V1 keeps **all 66 existing single-line attacks** of Jeanie's visible
21-bar arrangement, including **all 50 attacks in the complete Chinese
lyric-bearing section, m6–21**. Only one tuple changes:

- m5 first beat, global beat 8: **C5 duration 2 → 1**.
- m5 second beat, global **[9,10)**: omit the separately printed instrumental
  rolled chord in its entirety. This is a **single-melody adaptation gap**, not
  a source-written rest or all-layer silence.

The source identifies no separate single-melody member within that rolled
chord. The reduction does not select its highest note, add a tonic retrigger,
create a physical chord target or invent accompaniment to fill the gap.
The other 65 pitch/onset/duration tuples, original song id and titles, printed
115 BPM, 0.9 historical speed suggestion and final 42-beat extent are preserved.
The hint discloses the limited intro omission and complete Chinese melody.

This is the complete selected 21-bar melody reduction with its stated omission,
not a literal transcription of the whole two-hand piano score or every
commercial performance of the tune.

## Selected source and pixel evidence

- [Jeanie, numbered score, page 1 of 1](https://www.everyonepiano.cn/Number-13218-1.html)
- [Same edition, staff notation](https://www.everyonepiano.cn/Stave-13218-1.html)
- [Source listing](https://www.everyonepiano.cn/Music-13218.html)
- [Numbered preview image](https://www.everyonepiano.cn/pianomusic/014/0013218/0013218-j-b-1.png),
  2381 × 3368; SHA-256:
  `c4243d0d65455d71f7b2774fcfc287680ecfff50255132431eff3240cb83db35`
- [Staff preview image](https://www.everyonepiano.cn/pianomusic/014/0013218/0013218-w-b-1.png),
  2500 × 3400; SHA-256:
  `5528d825785582b686222ecfe795940345506c857c0e4bf58fd54215dcad0ee3`

The numbered score's complete five systems, m1–21, were read on 2026-10-12
before changing the song. An independent reviewer agreed with all 65 retained
tuples outside m5 and the m5 quarter-note correction. The same edition's staff
preview corroborates the opening, m5, m15 tie and ending; it is not an independent
second musical edition. The credit printed on the score is Jeanie; EOP小编 is
the web listing uploader, with listing update 2021-08-01. These are arrangement
and listing credits, not a new authorship claim about the underlying tune.

The source prints **1=D, 2/4, quarter note = 115**. One global transposition of
−2 semitones gives the selected melody:
D5/E5/F♯5/G5/A5/B5 → C5/D5/E5/F5/G5/A5.
It fits the fixed natural-note 21-key C instrument without individual octave
folding or accidental replacement. This does not certify the old lower piano
accompaniment as a literal global transposition.

The source pages/images carry personal-study and no-republication notices.
Source scans and crops stay out of the repository and release files. The review
does not establish reproduction or public-distribution permission, and implies
no push, deployment or publication approval.

## Timebase, phrase and duration decisions

Beat 0 is the start of the first **complete** 2/4 bar. Bar n spans
[2(n−1),2n). The first bar has **1.5 beats of written silence**, followed by
two sixteenth-note attacks over **0.5 beat**. The unchanged historical V2 field
`pickupBeats: 1.5` records lead-in silence; it is not the audible pickup length.
No note or bar has been shifted to change that metadata convention.

- Intro m1–5: 16 selected single-line attacks over ten beats, with the separate
  rolled chord at beat 9 omitted from the single-note practice line.
- Chinese m6–9: 14 attacks, ending on degree 2.
- Chinese m10–13: 14 attacks, ending on degree 1.
- Contrasting Chinese phrase m14–17: eight attacks, including the tie.
- Chinese closing phrase m18–21: 14 attacks, ending on degree 1.

The dotted-eighth/sixteenth pairs remain 0.75 + 0.25 beats. Repeated pitches
without a tie remain separate attacks. In **m15**, the upper degree 6 eighth is
tied to the same-pitch quarter: one **A5@28.5 for 1.5 beats**, with no attack at
beat 29. In **m21**, **C5@40 for 2 beats** reaches the final double bar at 42.
There is no printed ending rest, repeat sign, D.C./D.S. or alternate ending to
add. Similar phrases are written out. The English text at the top is a title;
this source does not print a performed English section.

The old unsupported claim about an omitted English section/loop and
`hasRepeats: true` are retained only inside historical metadata. Current
`hasRepeats` is false. `sourceTotalBeats: 42` makes the already correct extent
explicit and does not stretch the final note.

## Why m5 ends its C5 at beat 9

Both previews show a quarter-note upper tonic on m5 beat 1. The following beat
is a new rolled chord with source pitches F♯5/A5/D6, globally transposed to
**E5/G5/C6**. The arpeggio sign does not specify numerical within-roll offsets.
Neither preview shows a tie, extension dash, half note or a continuing C5 in
that chord that could support the old two-beat C5.

The lower source voice is also sounding during that second beat. Accordingly,
`melodyOnlyAdaptationGaps` explicitly marks `sourceWrittenRest: false` and
`sourceAllLayerSilence: false` at [9,10); it is not entered in source
`silentWindows`. The only recorded all-layer opening silence is [0,1.5).
No source-rest label should be borrowed to certify this reduction's gap.

## Historical restoration and accompaniment boundary

The old V2 `data/songs/mi-xue-bing-cheng-theme-chord.json` stays byte-identical:

`df1100d1587c3b297ab0f6cc60a6a78696f00bf0b8c37e98e26bebcacf7b247e`

Its explicit melody still includes C5@8 for two beats, so it is incompatible
with the corrected V1 melody. The content-compatibility guard must reject
borrowing its `practiceAccompaniment` or `autoAccompaniment`. Its old
`rhythm.sourceStatus: verified` is historical metadata; it cannot approve the
new reduction or establish harmony correctness. No replacement support is
introduced by this correction.

The complete pre-correction V1 byte stream is reconstructible without Git or a
private source image. `sourceReview.historicalReviewNotes` retains the exact
old `sourceFeatures` object, including the old image-path claim and English/loop
statement; `sourceReview.originalV1.hint` retains the old hint. To reconstruct:

1. Clone the current V1 object.
2. Restore `hint` from `sourceReview.originalV1.hint` and `sourceFeatures` from
   `sourceReview.historicalReviewNotes`.
3. Change only C5 at beat 8 back to duration 2.
4. Serialize with `JSON.stringify(object, null, 2)` plus one final newline.

The resulting full V1 bytes must have SHA-256:

`354e2a8a878c519c0e581450872041f9a0b69bdfc680c5666501a2d7c9dfec14`

This historical reconstruction preserves the original metadata exactly;
it is not a new claim that those old source assertions are correct.

## Tempo, tests and remaining acceptance

115 BPM is the printed quarter-note tempo. `defaultSpeedFactor: 0.9` is only
the unchanged legacy suggestion. The app starts an unremembered song at 0.55x
and otherwise respects saved per-song speed. Actual playback checks must record
the visible selected multiplier rather than claiming a fixed 103.5 BPM from
the stored suggestion.

Run:

```sh
node --test scripts/test-mixue-reviewed-intro.mjs
npm run validate:songs
```

The focused regression records source-derived expectations for all 21 bars,
all 66 attacks, the one changed tuple and 65 untouched tuples, the 50 unchanged
Chinese-section attacks, bar accounting, dotted rhythms, separate repeats,
m15 tie, final extent, global transposition and pitch fit, adaptation-gap
semantics, exact historical metadata, source-image fingerprints, original V1
reconstruction hash and unchanged V2 bytes. It uses no downloaded source scan
or private evidence path. These expectations protect the recorded review;
the executable checks do not read pixels or prove musical quality themselves.

Integration checks must separately confirm the regenerated built-in library,
42-beat ending, rejected old sibling support and one-note practice behavior.
Build and complete project checks belong to the release integration, not this
focused data-only test.

Reference-performance listening, browser-audio comparison and physical-kalimba
play-through were not performed as part of this transcription change.
Suitability stays **conditional**. Those checks, and any future optional
support's own source/harmony review, remain separate from notation and
regression success.
