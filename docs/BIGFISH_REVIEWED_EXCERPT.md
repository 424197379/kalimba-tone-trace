# 《大鱼》（前奏至副歌选段）: selected numbered melody, local v2.4.22 preview

## Deliberate edition choice and exact scope

The canonical `da-yu` record now uses the **single numbered melody** in the
accessible [简谱家 repost](https://www.jianpujia.com/jianpu/340541.html), selecting
**前奏1 → 前奏2 → 主歌 → 桥段 → first 副歌**. The display title is
**《大鱼》（前奏至副歌选段）**. The selected data contains **162 attacks,
32 complete 4/4 bars, 128 quarter beats**, with no additional accompaniment.

This is a deliberate selection of an alternative edition/excerpt, **not proof
that the former edition was wrong**. The old V1's original source image has
not been recovered. Only its m1, m3 and m5 agree exactly with the selected
pitch/onset/duration tuples; the other 29 bars differ. Neither shared total
length nor a recognizable phrase establishes source identity. This change is
not a 38-note deletion, repair or completion of the missing old score.

Printed bars have no individual bar numbers. The following explicit linear
count is before repeat expansion; quarter beat 16 of the source becomes
selected beat 0, an offset of −16.

| Selected bars | Linear source bars | Printed section | Selected beats |
|---|---|---|---|
| 1–4 | 5–8 | 前奏1 | [0,16) |
| 5–8 | 9–12 | 前奏2 | [16,32) |
| 9–16 | 13–20 | 主歌 | [32,64) |
| 17–24 | 21–28 | 桥段 | [64,96) |
| 25–32 | 29–36 | 副歌 | [96,128) |

The four preceding 引子 bars are excluded. The gray band after the selection
specifies a later route, 前奏2 主歌 桥段 副歌; that route is not expanded.
Following 间奏, 副歌2 and 尾奏, including the later 2/4 bar, are also excluded.
All selected bars are explicitly written out and read at their actual
occurrence. No later phrase is copied from an earlier one by resemblance.

The selection starts on the first 前奏1 downbeat, without a pickup, opening
rest or incoming tie. Its final A3 @ 124 / 4 reaches beat 128. **Beat 128 is a
selected cut point after the first chorus, not the complete song's ending.**
No later score material, invented ending rest or acoustic ring-out is added
to `sourceFeatures.sourceTotalBeats: 128`.

## Source provenance and access limits

The actual publicly exposed image is
[the single-page numbered score](https://image.jianpujia.com/jianpudq/jianpu50/e0fb277fe86b96b5186636ca0df76344.png),
1024 × 1448 pixels. Its visible title is 大鱼, performer credit 周深, engraver
credit appears 写轮指 (the first small glyph has medium confidence), and
watermark is www.KTVC8.com. Indexed historical attribution supports 写轮指 but
does not establish byte identity, an original publisher, or an identical
edition to the old reference. No definitive arranger field is invented.

Fingerprints of the retrieved assets:

- Page HTML SHA-256: `17018a426789f5bcdc2586cbf12449dd0586bbf70955966c44848ce46990125b`
- Score image SHA-256: `d3665ec8d9c3155122e440ed36f860213971b86c34265fda78b47ebced441e25`

Two independent pre-edit source-pixel readings agreed on every one of the
162 tuples and every four-beat bar. Their complete private evidence fingerprints
are `54c50a52fefe6831f6759948c3efb1ce143037d9b3bb6c647a907579c8ea3b3e`
and `78051c59d4afc993bdf25b926bf067e34c598cb7e14136ef8b136014bc261b68`.
The independent reviewer, lead and data implementer also inspected the selected
crops. These are independent readings of **one source edition**, not proof from
two independent editions. Public regressions retain only the selected melody
expectations and bounded evidence, not raw scans, lyrics, the complete lower
chord transcription or excluded continuation.

The historical V2 rhythm URL is
[Qupu123's mobile reference](https://www.qupu123.com/Mobile-view-id-339695.html).
Its known certificate/TLS restriction was not retried or bypassed, and no
original image/hash was recovered. Search-index metadata alone could not
verify notation. The historical harmony reference,
[山山吉他's guitar/vocal page](https://m.2qupu.com/jita/20210814/23329.html),
had accessible HTML but both actual images returned HTTP 403. No image retry,
proxy, protocol workaround or paid continuation was attempted. The known
WeChat safety restriction was likewise not bypassed. This implementation
needed no additional network access or user-computer access.

Other inspected piano previews were parallel exports of a different arrangement;
the separate 17-tone tab did not identify a unique melody among simultaneous
tine dots. They were not used to fill source gaps or override the selected
literal registers, tempo or melody. Public preview access is a provenance fact,
not publication permission.

## Notation, adaptation and exact articulation

- Printed key **1=♯C**, meter **4/4**, with **no numeric BPM**.
- The source identifies one numbered melody line. Lower circled numbers are
  chord symbols; no highest-note or first-note heuristic extracts the melody.
- The documented register convention is **unmarked 1=C4 after C normalization**.
  Its corresponding source reference is unmarked 1=C♯4. These scientific pitch
  labels are a disclosed adaptation convention, not labels printed by the
  source. Literal octave dots are retained.
- One uniform **−1 semitone** transposition yields **G3–C5**. The corresponding
  source range under that convention is G♯3–C♯5. No local octave folding,
  global octave shift, substituted accidental or added attack is used.
- Source pitch classes {0,1,3,5,8,10} become {0,2,4,7,9,11}; every selected
  pitch fits the actual fixed-natural-note F3–E6 instrument.
- No additional accidental occurs on the selected melody. The sharp near
  selected m22 belongs to the lower chord symbol, not melody degree 3.
  This does not certify a faithful all-natural rendering of the full harmony.
- No written melody zero/rest occurs anywhere in the selected 128 beats.
  Coverage is continuous in notation; sounding decay is a separate matter.
  Lower chord symbols do not specify bass register, attack pattern, duration
  or gain, so no support is inferred from them.

Notation below uses selected-global quarter beats: `note @ onset / duration`.

1. **m7 and m15:** both actual occurrences read D4 / E4 / low A3 / D4 / E4 /
   low A3 / G3 with durations ½, ½, 1, ½, ½, ½, ½. m15 was inspected
   independently instead of inheriting m7's reading.
2. **m16:** A3 @ 60 / 3 is followed by a new A3 @ 63 / ½ and C4 @ 63½ / ½.
   The adjacent same-pitch A3s have separate attacks.
3. **m20, linear source m24:** D4 @ 76 / ½, **E4 @ 76½ / 2½**, A3 @ 79 / ½,
   C4 @ 79½ / ½. The underlined 3 at 76½ has an explicit arc to the next
   3 at 77 and its continuation dash. One attack joins segments ½ + 2 beats;
   there is no retrigger at 77. Both endpoints lie in one bar and system;
   no unresolved cross-system or cross-page tie is adopted.
4. **m25 and m29:** the opening 1 has an upper dot, giving C5 at 96 and 112.
   **m26, m27 and m30:** the opening 1 has no upper dot, giving C4 at 100,
   104 and 116. In m27's paired 61, only the 1 has an upper dot, giving
   A4 @ 105 / ½ then C5 @ 105½ / ½.
5. **m28:** E4 @ 108 / 3 and E4 @ 111 / ½ are separate attacks. **m30** is
   C4 @ 116 / 1, C4 @ 117 / ½, D4 @ 117½ / ½, E4 @ 118 / 2. It does not
   copy m26's six-attack pattern. The final m32 low A3 lasts the complete
   written four beats, with no extra attack or silence.

The octave pixels are clear and the readings agree. A same-edition performance
or alternate notation has not established whether any printed dot was intended
otherwise. That pending check concerns **authorial intent and audible identity,
not uncertain OCR**. No dot is added from familiarity, a large jump, or a vote
among different arrangements. The selected edition deliberately retains the
literal notation without claiming it is the uniquely correct recording version.

The old melody's inferred [78.5,79) gap is not source-confirmed silence in this
selection: the new E4 at 76.5 continues through it to 79. Old auto event 38
spans [78,78.75), overlapping the old inferred gap by ¼ beat, outside both old
declared silent windows. That fact does not justify trimming it, changing the
old rest policy, or declaring the absent old edition wrong. It remains untouched.

## Tempo and suitability, without listening claims

**80 BPM is an explicit practice setting, not a discovered source tempo.**
`difficulty: medium` and `defaultSpeedFactor: 0.9` are retained. That stored
suggestion is distinct from the current app's fresh-entry 0.55× behavior or a
saved user-selected speed. It does not assert that the user's actual initial
or current playback is 0.9×. Any browser acceptance should record the visible
multiplier rather than infer it from the song JSON.

At 1.0×, the notated 128 beats occupy **96 score-only seconds**. This excludes
preparation and the separate 0.9-second UI/audio tail. The fastest subdivision
and onset spacing are eighth notes (½ beat; 375 ms at 80 BPM), and the largest
encoded melodic jump is nine semitones. No new faster subdivision is invented.
The edition changes register and attack structure; 38 fewer attacks do not
prove easier thumb movement, better timbre or greater pleasantness. Long holds
are retained while real kalimba notes decay naturally.

Suitability is **conditional**, with distinct gates:

- Selected source pixels and exact encoded tuples: reviewed.
- Reference-performance recognition and octave/engraving intent: unverified.
- Browser audio at the actual selected speed: not performed by this data task.
- Physical kalimba play-through, thumb choices and natural decay: not performed.
- Public distribution rights: unestablished.

These are contributor acceptance limits. The short everyday hint states the
source, excerpt, range and practice-tempo choice; it does not burden the user
with a history essay or an instruction to supply physical-instrument testing.
A later runtime report may document actual browser behavior separately, without
turning event scheduling checks into subjective listening or physical evidence.

## Full historical recovery and strict support isolation

The entire former JSON is preserved byte-for-byte at
`data/archives/da-yu-v2.4.21.json`, directly checked against the frozen v2.4.21
preview package. All original fields remain: id/title, 200 tuples, 80 BPM,
0.9 speed suggestion, medium difficulty, and the source flags and unresolved
m7, m15–m16 and m30. Original float formatting is also retained.

- Raw archive SHA-256: `5f3aff34c32bf77aef78df70f8ec54d4181ee88d14f640feda2217395a797397`
- Parsed full-content SHA-256 (`JSON.stringify` without key sorting):
  `db04d59fa5f0d55fb669bba96338092603fafe40bb4ff995d51ef9b2841688d4`
- Unchanged `da-yu-chord.json` SHA-256:
  `1c02d483538dd43baeda3ef577d3698c827ac5f6e9c8beea84319ebb092a8f3c`

The source review retains the old `sourceFeatures` as historical context;
current clear-pixel scope has no unresolved OCR measure. The original source
has not been reverified or retroactively certified.

The actual importer accepts the untouched archive as an independent local V2
melody with a new local id/base id. It preserves the 200 attacks, source
metadata, title, hint, tempo, meter, difficulty and speed suggestion; it normally
generates local melody practice/score labels and local provenance. A simulated
storage save retains the music and source history, and recombining those fields
with the original archived header reproduces the full parsed-content hash.
The original raw archive hash independently protects every original byte.
This recovery test changes no user's browser storage.

The old V2 remains exactly **200 melody events and 62 automatic backing events**.
It has **no `practiceAccompaniment` layer**. Its same melody as old V1 is shared
historical data, not a second source. The actual `hasMatchingPracticeMelody`
guard rejects it against the selected 162-attack edition despite identical
80 BPM and 128-beat extent. A test-only reduced-support copy of its backing also
fails the actual app provider function; the old melody is a positive control.
Nothing is added to the old file, and neither backing layer is borrowed.

The archive is developer recovery evidence only. There is no new canonical
card, restore URL/UI, current-scope `archiveImportPath`, HTTP allowlist or
service-worker precache entry. The library retains 36 canonical practice cards
and 56 source records; `da-yu-chord` links still resolve to `da-yu` for practice.
All 55 other song JSON files retain their frozen v2.4.21 raw hashes.

## Executable checks and release boundary

Run the dedicated regression:

```sh
node --test scripts/test-bigfish-reviewed-excerpt.mjs
```

Its **22 passing cases** protect:

- All 162 independently authored source tuples and all 32 bar interiors.
- One literal tie, genuine same-pitch re-plucks and occurrence-specific octaves.
- The 128-beat excerpt boundary without invented source silence or support.
- Explicit melody voice, uniform transposition, bounded source/tempo claims.
- Full raw archive and reconstructed parsed-content hashes.
- Byte-frozen old V2, strict compatibility rejection and actual provider behavior.
- Actual importer/save independence, 36 canonical cards and legacy link routing.
- All 55 untouched song hashes and no archive UI/precache exposure.

Ten deliberate bad edits fail the independent source fixture: splitting the
m20 tie, recreating the old inferred gap, merging the m16 or m28 re-pluck,
adding an unprinted m26 octave dot, erasing m27's printed paired dot, copying
m26 into m30, treating m22's lower chord sharp as a melody change, shortening
the final written hold, and inventing a beat of final silence.

The implementation also ran:

```sh
npm run validate:songs
node --test scripts/test-import-score-contract.mjs scripts/test-song-store.mjs scripts/test-accompaniment-compatibility.mjs scripts/test-song-report-analysis.mjs
npm run report:rhythm
npm run report:arrangements
npm run report:suitability
```

Validation: **56 source records, 7,196 total steps, zero errors, 609 existing
review warnings**. The related test group passed **74/74**. Read-only reports
passed; the selected melody has zero notated gaps and the old backing remains
unmodified. Reports describe encoded written spans, not acoustic cutoffs,
source fidelity, harmony approval or subjective quality.

This data-only contribution changes four files: the selected V1, byte-exact
archive, focused test and this document. Release integration separately rebuilds
`src/songs.js`, runs the full app suite, tests actual HTTP archive denial and
verifies current web sessions/audio behavior. No runtime or generated library,
version file, cache strategy, UI style or other song is edited here.

**Publication is not authorized.** Public viewing/download, repeated pixel
review, exact transcription and passing tests do not establish rights to
reproduce or distribute this modern song/arrangement. This is an authorized
local preview only. No raw scans, complete lower-source transcriptions,
private audit bundle, public commit, push, publish or deployment are included.
