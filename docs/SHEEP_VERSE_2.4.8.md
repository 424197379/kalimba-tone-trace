# 《别看我只是一只羊》: unchanged reviewed verse excerpt, v2.4.8

## Result and scope

All **68 existing pitch/onset/duration tuples remain unchanged**. The complete
encoded verse excerpt matches the selected C-major staff-plus-numbered
engraving. This release clarifies its evidence, title and exact boundary; it
does not repair or extend the melody, add accompaniment or introduce physical
chord targets.

The display title is now **《别看我只是一只羊》（主歌选段）**. The id,
V1 schema, difficulty, C key, 4/4 meter, 120 BPM and historical 0.8 speed
suggestion remain intact. The runtime-facing review status is:

`sourceFeatures.sourceReview.currentScopeReview.status`
= `reviewed-selected-verse-excerpt`.

This is a notation-review result for the selected excerpt, not full-song,
reference-listening, browser-audio or physical-kalimba acceptance. Suitability
remains **conditional**.

## Selected source and provenance limit

- [Accessible C-major mixed-notation source page](https://www.quputu.com/qiyuequpu/kouqin/10234.html)
- [First openly linked score image](https://www.quputu.com/uploads/allimg/221228/2-22122Q94334J1.jpg),
  1015 × 1275, SHA-256
  `1045752a16a6eb6ea20f48cdae0e714093130a7313de54985135f993562b9dd3`
- [Second openly linked score image](https://www.quputu.com/uploads/allimg/221228/2-22122Q94336262.jpg),
  972 × 1302, SHA-256
  `9931f94a9d41945a14e5a439259da256a3d1b2a6a0522e00ddbac698c4a500fd`

Both complete public images were read on 2026-10-12, covering every selected
attack, octave mark, rhythmic dot, rest, separate repeated note and the
page-break boundary. A separate review independently transcribed the same
68 tuples and eight phrase-opening rests. The fixture was authored from the
source before this metadata edit, rather than generated from production.

The source prints **1=C, 4/4** and credits 古倩敏 for the composition. Its
distinctive engraving includes a bracketed four-bar introduction, character
lines before the verse, numbered notation above a treble melody, chord
symbols and repeated dotted-eighth/sixteenth figures. It supports the
existing musical text.

This is an accessible **repost**, not an independent musical arrangement.
Staff and numbered notation on the same engraving are likewise two
representations of one arrangement. Exact image identity with the original
[Qupu123 reference](https://www.qupu123.com/qiyue/kouqin/p89823.html), its
original page and the historical claimed book
《最易上手！口琴独奏超精选》 were **not reverified**. The source does not
establish that book or arranger attribution. The original URL and label are
preserved as historical provenance, without a new assertion about that
page's current network or certificate status.

The two images were available by ordinary public HTTPS links. Public access
does not establish reproduction or distribution rights. Raw images, crops,
complete working evidence and the pre-edit snapshot remain outside the
public repository. No publication or deployment approval is implied.

## Beat origin, rests and the exact cut

Editorial measure numbers start at the first bracketed introduction bar;
the source does not print measure numbers. The selected verse begins at
editorial source measure **10**, after nine complete 4/4 bars. Therefore
local beat **0** corresponds to full-page beat **36**.

The eight reviewed phrase spans have attack counts **8, 9, 9, 9, 8, 9, 9, 7**.
Their local ranges are [0,8), [8,16), [16,24), [24,32), [32,40), [40,48),
[48,56) and [56,63). Each begins with a **0.75-beat dotted-eighth rest**.
The eight rests at beats 0, 8, 16, 24, 32, 40, 48 and 56 remain beat gaps.
They are not fake rest notes, holds or accompaniment opportunities.

The last selected note is **C5 at beat 60 for three beats**. The source then
prints two separate events in the remainder of that bar:

- A real eighth rest at **[63,63.5)**.
- A new C5 chorus pickup at **[63.5,64)**.

The existing excerpt ends at **63**, immediately after the held verse note,
and excludes **both** events. It comprises **15 complete bars and the first
three beats of local bar 16**, not sixteen complete bars or the whole song.
`sourceFeatures.sourceTotalBeats: 63` now explicitly records this selected
extent. It does not assert a source ending, round the excerpt to 64, add a
final-rest window or stretch the last note. Metadata retains the excluded
events to make the cut auditable without making them playable.

No same-pitch ties occur in this selected verse. Every repeated attack stays
separate, including **E4 at 27.75** followed by **E4 at 28**. Long notes stay
at their printed duration; no retriggers are inserted to simulate sustain.
Recurring verse material is written out, with no selected repeat signs.
`hasRepeats: false` describes this scope; omitted outro repeat signs do not
authorize expanding the verse.

## Instrument fit and source features

The excerpt spans **E4–E5** and uses all **seven natural pitch classes**. It
requires no transposition or octave folding for the fixed natural-note
F3–E6 inventory. The omitted chorus visibly introduces essential **#4 = F♯**.
Together with the selected verse, that makes eight distinct pitch classes,
which cannot fit seven natural classes under any interval-preserving global
transposition. This supports a scoped verse choice; it is not a complete
chorus transcription or a claim that every part of the original song was
reviewed for performance.

`hasChords` changes from false to **true** because printed chord symbols are
a source feature. Their voicings and timing were not transcribed or approved.
The physical practice line remains one melody note at a time. There is no
existing same-id V2 sibling, and no automatic accompaniment, optional
support, chord event or rhythm layer is introduced. Future support still
needs independent harmonic review and an exact melody/BPM/extent match.

## Tempo and alternate editions

The selected C engraving prints **no numeric metronome tempo**. Retained
**120 BPM** is the existing practice setting, not a newly verified tempo
from this source. The historical default **0.8×** suggests 96 BPM; it does
not establish the runtime's actual selected or remembered speed.

Other historical links were assessed without combining their arrangements:

- [Jianpujia's F-major vocal score](https://www.jianpujia.com/jianpu/7208.html)
  prints quarter = 120 and mainly straight eighth notes. After a uniform
  F-to-C shift, its second phrase begins B4 while this engraving begins C5;
  another phrase also differs. These are edition differences, not permission
  to replace selected pitches while retaining the C edition's dotted rhythm.
- [EveryonePiano's F-major piano edition](https://www.everyonepiano.cn/Number-531.html)
  also prints 120, uses straight eighths and alternate endings, and differs
  in its final-verse lead-in. Only its publicly embedded numbered-score
  previews were used. Paid or login-only continuations were not accessed.
- [Guitarworld's page](https://www.guitarworld.com.cn/pu/q129513) identifies
  a paid complete score and a public preview. The explicitly public preview
  returned 502 and was not recovered. No musical conclusion relies on it.

Neither F-major edition verifies a numeric tempo for the selected C
engraving. No pitch, rhythm, tempo attribution or extra attack is silently
borrowed from another arrangement.

## Complete history and byte-exact restoration

`sourceReview.historicalReviewNotes` preserves the **entire original
sourceFeatures object**, including all four URLs, old unsupported statements,
suitability language and the historical browser-check claim.
`sourceReview.originalV1` preserves the original title, practice title,
score title and hint, plus file and melody fingerprints.

To reconstruct the entire original V1 file without Git or private evidence:

1. Clone the current song and restore those four display strings.
2. Replace `sourceFeatures` with `historicalReviewNotes`.
3. Keep all 68 `steps` tuples unchanged.
4. Serialize with two-space JSON indentation and one final newline.

The reconstructed full byte stream has SHA-256:

`0b0a2b4cc768f2c3e2f0e36e536550ee23633fab9dc0a3253aa170ef90ef5a3b`

`JSON.stringify(steps)` has SHA-256:

`c057503da62fed876734291dc44531687a2a0277fe9a708cf9cc1759be500055`

Both are protected by the public regression. Historical preservation is not
renewed approval of old scope wording, attribution or a past browser check.

## Tests and remaining acceptance

Run the focused regression and project validator:

```sh
node --test scripts/test-sheep-reviewed-verse.mjs
npm run validate:songs
```

The public regression uses compact independently recorded phrase decisions
with the repository's actual transcription-evidence checker. It covers all
68 frozen tuples, eight rests, separate repeated attacks, exact 63-beat cut,
excluded rest/pickup, pitch vocabulary, unverified tempo provenance,
source-image fingerprints, full original-byte reconstruction and absence of
support. Deliberately merged attacks, filled rests, stretched final notes and
rounded 64-beat extents fail. No private input is needed for this regression.

The separate complete source fixture also passes against the production
JSON. These executable checks protect recorded decisions; they do not read
source pixels themselves. Generated-library rebuilding, version updates,
runtime integration and full project validation are release integration
checks rather than additional musical-source evidence.

Reference-recording comparison, current browser audio at the actual selected
practice speed, and physical-kalimba playing remain **not performed** in this
source review. Short repeated notes, hand alternation and real tine decay
still need instrument testing. The older claim that browser sound and timing
were checked is retained only as history, never reported as a fresh check.
Full-song transcription, harmonic approval, original-book attribution and
public-distribution rights remain unapproved.
