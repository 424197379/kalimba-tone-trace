# 《茉莉花》（短版）: selected-source adoption, v2.4.4

## Edition and scope

The built-in `jasmine` is now explicitly titled **《茉莉花》（短版）**.
It adopts the complete 14-bar short arrangement visible on the selected public
preview page, with 67 melody attacks and 56 quarter-note beats. It does not
combine that page with the earlier 30-bar Walter arrangement, and the difference
between these editions is not proof that the earlier arrangement is wrong.

The existing `jasmine` id, 88 BPM practice choice and 0.95 default speed are
retained. Existing links, song history and per-song speed remain associated
with that id; the displayed title and hint disclose the changed edition.
The preserved V2 `jasmine-chord` source is a separate older arrangement and
must not supply accompaniment to this differently timed short melody.

## Selected notation evidence

- [黄秀泉制谱《好一朵美丽的茉莉花》拇指琴简谱，公开预览第1页](https://doc.quark.cn/preview/tongyongshenghuo-geciqupu-qupu%E3%80%81jianpu/6EF265ECBE7A8C6DEE28100CF4DA7113)
- Source image SHA-256:
  `15a14cd2dc354c6212d914ee860700317bd5fa14bd4c2a1bf64083c53f8c667c`
- Two independent full-page pixel readings agreed on all 67 pitch/onset/duration
  tuples before the built-in song was changed, on 2026-10-12.
- The visible page is in C, 4/4, with no pickup. It has 14 complete bars and
  ends with a written quarter rest and a double bar. The selection is this
  complete visible short arrangement; no hidden page or continuation is assumed.
- The score has no visible tempo mark. 88 BPM is the retained practice choice,
  not a source tempo. The source retains its historical 0.95 speed field; the current app starts new songs at 0.55x and respects saved per-song speed. Neither multiplier is printed on the source.
- All source pitches fit the actual natural-note 21-key C instrument (F3–E6).
  This melody spans G3–C5, with no transposition or individual octave folding.
- Printed chord symbols C, F, Am, G and Dm are recorded as source information.
  No chord, bass, ornament or accompaniment is added to the melody.

The old local Walter image was unavailable for a new review. Its earlier source
claims and unresolved m25–30 notes remain historical information in the archive
and `historicalReviewNotes`, not current claims about the short edition.

## Rhythm decisions

Every bar was checked internally as well as by its four-beat total.

- Opening m1/m3: quarter-note E4, then six eighth notes. Repeated E4 and C5
  remain separate attacks.
- m2/m4: G4 for one beat, G4 and A4 for half a beat each, then G4 for two beats.
- m5: three separate quarter-note G4 attacks, then E4/G4 eighth notes.
- m9: four eighth notes, D4 at beat 34 for 1.5 beats, then E4 at 35.5 for 0.5.
- m13: dotted-quarter D4 at beat 48 for 1.5 beats, E4 at 49.5 for 0.5, then
  four eighth notes. The augmentation dot is not an octave dot.
- Arcs connect different pitches. They are phrasing slurs, not same-pitch ties;
  both ends remain attacks. No repeated pitch is merged just for being adjacent.
- The lower dots in the cadence are preserved: A3 at 43.5, G3 at 44, A3 at 46,
  A3 at 51.5 and final G3 at 52.
- The final G3 lasts three beats, ending at 55. Beat 55–56 remains silent.
  `sourceFeatures.sourceTotalBeats` is 56; no rest note, extended G3 or fill is
  used to represent the written final rest.

## Restore the earlier 145-note edition

The complete original V1 JSON is retained byte-for-byte at
[`data/archives/jasmine-walter-v2.4.3.json`](../data/archives/jasmine-walter-v2.4.3.json).
It includes all 145 melody steps, the 120-beat extent, tempo/default speed,
original titles, and all original source metadata. It is outside `data/songs`,
so it is not added to the built-in library as a duplicate.

To practice that earlier edition again:

1. In the app, the archive link opens the original JSON in a new tab, including offline after installation. Copy its complete contents or use the browser’s Save As. You can also open the archived JSON above. If viewing it in a repository
   browser, open the raw file and copy the entire JSON object.
2. In the app, open the song library, choose “添加歌曲”, and paste the complete
   JSON into “粘贴歌曲 JSON”.
3. Choose “保存到本地曲库”, then select the newly imported local **《茉莉花》**.
   The importer accepts this archived V1 format and creates a separate local
   melody record. The built-in **《茉莉花》（短版）** remains available.

This restores the old melody as a local practice song; it is not a rollback of
the whole app or a claim that the old source has been newly verified. The local
copy has its own id and practice preferences. Repeated imports create distinct
local entries rather than replacing the short built-in or another import.
The JSON's original title and provenance are intentionally unchanged for exact
archival fidelity; identify the imported record by its local label.

Archive SHA-256:
`55ec47b07ff9ea6a5030d135043f85a8d381a42ba13e4268ca119c84e7353088`

Unchanged V2 sibling SHA-256:
`ebbf3d54f58c4d4dd374114ab66d06d651841e85e020d84a408ac6787a17f721`

## Regressions and acceptance boundary

Run:

```sh
node --test scripts/test-jasmine-reviewed-short.mjs
npm run validate:songs
```

The focused fixture checks all 67 source tuples, every four-beat bar, dotted
rhythms, separate repeated/slurred attacks, low-register cadence, source bounds,
the final rest, pure-melody output, explicit selected-source metadata, the full
original archive hash, exclusion of the archive from built-ins, and unchanged
V2 bytes. The integration checks must separately cover archive import, same-id
links/history/speed, the 56-beat practice ending, and rejection of incompatible
old sibling accompaniment. After regenerating the library, run the complete
project checks; the new ending adds one entry to the source-ending regression.

The source review establishes notation correspondence for this selected short
edition. It does not substitute for reference-performance listening, browser
audio checks, or a physical 21-key C kalimba play-through. Those listening and
instrument checks remain unperformed at this transcription stage, so suitability
is **conditional**. Public-distribution permission is a separate matter; no
push, deployment or publication is implied by these checks.
