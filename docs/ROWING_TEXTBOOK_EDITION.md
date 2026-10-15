# Rowing selected textbook edition (2.4.35)

## Deliberate source selection

The canonical `rang-wo-men-dang-qi-shuang-jiang` displays
**《让我们荡起双桨》（教材版）**. It retains the complete principal melody
printed in 山东教育出版社《义务教育教科书（五·四学制）音乐（简谱）五年级
下册》, January 2015 first edition / January 2020 sixth printing,
ISBN 978-7-5328-8591-6. The song credits 乔羽词 / 刘炽曲 and identifies the
film 《祖国的花朵》.

[Selected textbook](https://v.sjs.com.cn/ebooks/58E2823C.pdf#page=41),
printed pages 36–37 / PDF pages 41–42.
PDF SHA-256:
`07cc8f5d3815c0e481e72cf31e843d24735875b7bb2cecf1b9911375f7ff9d37`.

Five six-bar systems give **30 editorially counted bars, 60 quarter beats and
63 attacks**. There are 18 verse bars and 12 bracketed two-voice chorus bars.
The chorus lyrics align directly with its separately printed upper voice;
that identified vocal part is selected. This is not extraction of the highest
piano chord tone. The lower chorus voice is omitted and no accompaniment is
inferred or borrowed.

Both score pages were visually inspected for this implementation, as were the
colophon and immediately following page. The last two bars reach a final double
bar; composer biography and work introduction follow. PDF page 43 begins the
unrelated pieces 《迎春》 and 《纸风车》. The selected principal tune is complete.
No visible repeat instruction, D.C./D.S., alternate ending or coda is expanded.
Three verse lyric rows do not authorize three traversals. This is the complete
printed one-strophe tune with refrain, not every sung stanza or a claim about
a recording's full form.

The selected Qupu version-three source remains unavailable. The previously
inspected EOP staff/numbered exports are one different piano arrangement, and
the Xiangnan teaching fragment lacks the ending. Neither is blended into this
textbook reading. A new complete source closes the availability gap for this
edition; it does not establish that the old edition was wrong.

## Pitch, articulation and disclosed reduction

The printed key is E-flat and meter is 2/4. With the stated numbered-notation
convention **unmarked 1 = E-flat4**, lower-dot 6 is C4 and upper-dot 1 is E-flat5.
Source range C4–E-flat5 transposes uniformly by **-3 semitones** to **A3–C5**.
The entire seven-class E-flat diatonic vocabulary maps to the natural-note
instrument; modulo-12 shift 9 is the sole fitting pitch-class shift. There is
no extra global octave shift, local octave folding or accidental naturalization.

The 66 metric noteheads contain three genuine tie continuations, yielding 63
attacks. Confirmed ties are:

- m8–9: E4 at beat 14 holds three beats. E4 at beat 17 is a new attack.
- m17–18: G4 at beat 32 holds three beats, then rests at beat 35.
- m29–30: A4 at beat 56 holds four beats through the final boundary at 60.

The m6 G4 pair, m20 A4 pair and m26 dotted-eighth/sixteenth G4 pair remain
separate attacks. Different-pitch arcs are slurs. m12 keeps the high C5 and
B4/A4 sixteenths; m24 keeps low A3 at beat 46. Every separately printed later
occurrence was read rather than copied from a similar phrase. No tuplets occur.
Breath marks in m13 and m21 add no fixed beats or shortened notes.

**One small, unquantified grace degree 5 before m7 is deliberately omitted.**
Its source B-flat4 would transpose to G4. No duration is guessed, no extra
judged target is added, and no time is stolen from the main A4 at beat 12.
This is a disclosed single-melody practice adaptation, not an ornament-complete
literal realization of the engraving. The second chorus voice is also omitted.

Four source rests remain `[0,0.5)`, `[8,8.5)`, `[35,36)` and `[48,49)`.
The initial half-beat rest is within a full first bar, not an extra pickup bar.
The last rest is also printed in the lower chorus voice. These are declared
silent windows of the selected single-melody adaptation with no backing; they
are not claims about other arrangements or cutoffs of natural sample/reverb
decay. The melody has 57 sounding beats and three silent beats. There is no
ending rest. `sourceTotalBeats: 60` preserves the final four-beat A4 tie without
a retrigger at 58, truncation at 58 or an invented extra bar.

## Practice choices and separate acceptance gates

The source prints **稍快 优美地**, with no numeric metronome mark.
**96 BPM is the retained practice choice**. The historical `defaultSpeedFactor:
0.9`, `difficulty: medium`, canonical id and 2/4 meter stay unchanged. A score
suggestion does not assert the browser's actual initial or remembered speed;
this adoption does not overwrite saved settings or change the existing link.

Suitability remains **conditional**. The minimum onset spacing is 0.25 quarter
beat: 156.25 ms at 96 BPM or approximately 173.61 ms at the 0.9 suggestion.
The 60-beat notation takes 37.5 seconds at 96 BPM or approximately 41.67 seconds
at 0.9, before preparation and decay. On the fixed displayed tine layout the
shortest same-side spacing is 0.5 beat, the largest tine-index jump is 11,
and G4 at 45.5 to A3 at 46 is a ten-semitone same-side leap across three tine
positions. Side inference is not an observed hand choice. The lower register
and matched timing do not establish that this edition is easier.

The source compiler and independent reviewer read actual source pixels before
comparing their tuples. All 63 tuples, 30 bars, three ties, four rests and
transposition agree. These are independent readings of **one edition**, not
two independent published sources. The implementation worker also viewed the
actual pages. Reference-recording listening, browser/audio acceptance and
physical-kalimba play-through remain separate, unperformed data-adoption gates.
Integration verification must record its own actual browser results and visible
speed; executable tests do not imply that listening happened.

The colophon explicitly reserves copyright. Public readability is not a
reproduction or distribution license. This reversible private-preview adoption
does not authorize commit, push, public publication or deployment. The source
PDF, page images, lyrics and complete private transcription fixtures stay outside
the repository and release packages. Publication rights remain unestablished.

## Entire old file and independent developer recovery

`data/archives/rang-wo-men-dang-qi-shuang-jiang-v2.4.34.json` preserves the exact
prior byte stream, including all 63 tuples, original titles/hint, 96 BPM, 2/4,
0.9 suggestion and every source-metadata value. Whole-file SHA-256:
`62a0aa1a5621116ebb8d0b10691f8aaeccc0ff90ee4291019ca95b40aa795052`.
Do not reformat or rewrite that archive. The complete parsed old `sourceFeatures`
also survives unchanged under `sourceReview.historicalSourceFeatures`.
Historical assertions, including its older register/listening claims, are
retained as history rather than promoted to present approval.

All 63 old onset/duration pairs match the selected edition. The first 54 old
pitches, through beat 50, are exactly one octave higher. The last nine, from
beat 51, already match. Therefore lowering the entire old file is not the
selected transformation and would damage its final phrase.

The real import parser and isolated local storage recover all old values as
an independent local song. Reversing only documented normalization of schema,
id, uploader and practice/score display strings reconstructs the old parsed
JSON exactly; the archive separately protects textual bytes. Repeated imports
create distinct local identities without replacing the selected built-in,
changing selection, altering the canonical practice link or rewriting saved
speed. Current supported V2 explicit-melody imports also retain all 63 selected
tuples, four rests and the 60-beat extent.

There is no extra library card, old-version selector, restore UI, HTTP archive
route or service-worker precache entry. The archive is outside `data/songs`.
The library remains 57 records: 36 V1 and 21 V2, with 36 physical practice cards
before a deliberate local import. No current rowing source sibling exists.
Synthetic old-backed test records fail both accompaniment-provider paths despite
identical timing, id family and BPM; a matching-content positive control proves
the guard is exercised. These synthetic records are not musical arrangements.

## Regressions and integration

Run:

```sh
node --test scripts/test-rowing-textbook-edition.mjs
ROWING_SOURCE_EVIDENCE_PATH=/path/to/independent-source-evidence.json \
  node --test scripts/test-rowing-textbook-edition.mjs
```

The public test freezes all 63 tuples with SHA-256
`f24dc597902e95be98b3888ffa98a561a901762fab014b8fa83041851cb326e0` and 30
individual bar fingerprints from the independently authored, pre-comparison
source reading. Cross-bar holds belong to both overlapping bar spans, so the
checker performs 66 attack comparisons for 63 distinct attacks. Expectations
are not generated from production at test time.

The 36 negative controls cover all three split ties, genuine reattacks, slur
mis-merging, breath gaps, octave dots, the later low-six occurrence, wrong chorus
voice, altered sixteenths, quantized/undisclosed grace, all four filled rests,
ending truncation/expansion, wrong timebase/form, both old-register mistakes,
false printed BPM, changed practice settings and unapproved backing. Real
parser tests also show that an in-range wrong octave can pass structural import
while failing source evidence; a parser pass is not musical approval.

The optional fixture is the unchanged independent blind-review record, SHA-256
`8d162fcf5d44d92e5e04fd694775ed0f21dc12ba0604c7eefb8386cb1fb10ec3`.
It predates a song id: only the canonical identity is supplied in memory to the
checker, while its source tuples and bytes stay untouched. Missing explicit
`ROWING_SOURCE_EVIDENCE_PATH` produces one clearly labeled portable skip; it
never implies that fixture verification or source inspection ran.

At data adoption, the public run passed 46 tests with the one stated skip;
the explicit actual-private-fixture run passed all 47, with no failures/skips.
Built-in validation passed for 57 songs / 7,363 steps, zero errors and 607
existing review warnings. The focused import-contract, accompaniment-compatibility,
report-analysis, practice-loop/session/rendering and song-store suites passed
all 374 tests with zero failures or skips. These existing runtime regressions
ran before the separate integration rebuild and do not claim that the generated
rowing runtime was already updated. Read-only rhythm/suitability reports retain all four
rowing gaps, 60-beat extent and no support or conflicts; legacy long-gap counts
show only the two one-beat rests, not the shorter rests. Arrangement reporting
has no rowing V2 support record to approve.

The integration owner must add this test to the existing check command,
regenerate `src/songs.js`, update version/cache/release records consistently,
renew the older source-gap summary, preserve old frozen expectations through
the byte-exact archive, and run whole-project checks plus actual browser/audio
verification. This data-adoption worker does not edit generated or runtime files,
package/version/UI, shared docs or the compiler skill. Acceptance results from
later integration belong in its separate verification record.
