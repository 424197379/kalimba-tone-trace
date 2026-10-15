# Remaining source-review gaps

Last reviewed: 2026-10-12. These are bounded results of actual source inspection,
not a declaration that the retained songs are wrong. No note changes are made
by this document. A missing original image or a different edition cannot
justify guessing its pitches, changing its meter, normalizing octave jumps or
merging repeated notes. The next review should first recover the selected
edition, or explicitly choose and label another arrangement.

## 《铃儿响叮当》 — selected short refrain adopted in 2.4.16

The original photo is unavailable in this checkout. The recorded
[Doctor Uke sheet](https://www.doctoruke.com/jinglebellsc.pdf) supplies chords
and lyrics, not melody durations. The
[Easy Breezy letter-note edition](https://easybreezypianotutorials.com/wp-content/uploads/2021/07/jingle-bells-piano-notes.pdf)
has a different 45-attack sequence and does not establish the current rhythm.
The fully inspected
[Coughlin easy lead sheet](https://www.christmasmusicsongs.com/PDFleadsheets/jingle-bells-easy-lead-sheet.pdf)
has 51 attacks over 64 quarter beats and differs from the former 49-attack
edition in articulation/form. Its complete independent transcription confirms that
edition, not an error in the retained 49-note path.

Resolution: v2.4.16 deliberately adopts the complete Coughlin short refrain,
51 attacks / 64 beats, under an explicit short-refrain title. See
`JINGLE_REVIEWED_SHORT.md`. The previous 49-note JSON remains byte-preserved and
can be imported separately; it is not declared wrong. Its missing original
photo and historical verification claims remain unresolved. The shared old
V1/V2 melody is not independent evidence. No old backing is borrowed, and this
melody adoption does not approve harmony, reference listening or physical play.

## 《青城山下白素贞》 — selected complete vocal edition in 2.4.36

The formerly selected 江南听雨/Qupu123 image is missing. Two inspected public editions,
[Guitarworld's public preview](https://www.guitarworld.com.cn/pu/q88824) and
[陈尊学 / 好妹妹乐队 jianpu](https://www.ccguitar.cn/cchtml/18921275.htm),
agree on 13 opening attacks. Against those editions, eight then-retained onset or
duration tuples differ within beats 0–8; pitches are unchanged. A separately
prepared comparison preserves all 103 later tuples, but is not adopted.
Other editions vary in register, rhythm and form. Agreement on another
arrangement does not identify the missing source's intended transcription.

Needed: the actual selected engraving and a map from its introduction,
D.S./endings and original measure numbers to the historical 72-beat timeline.
The historical low-A3 claims at source m10/m16/m23 cannot be normalized from
large jumps or majority voting among other editions.

Resolution in 2.4.36: deliberately select the complete lyric-aligned vocal
section in the 罗林斯 / ROLLINS image, visibly labelled 鞠婧祎版, from the
[readable source page](https://www.cnjpw.net/tongsu/88391.html).
The page catalog names another singer; the fixed image's explicit edition
label is used rather than combining those identities. Two independent blind
readers agreed on all 196 attacks in editorially counted m6–35: 30 bars of
4/4, 120 quarter beats, printed quarter=82 and literal G3–D5 in C. Five small
unmeasured G4 grace notes are explicitly omitted without changing principal
timing. All 16 adjacent same-pitch attack pairs and the written-out later
ending remain distinct; there are no selected vocal rests, ties or repeat jumps.
The five-bar instrumental introduction and five-bar outro are omitted.

This is an explicit alternate edition, not recovery of the unavailable original
or proof that its 116 attacks were wrong. Its full prior file remains internally
byte-preserved without a restoration control or borrowed accompaniment. The
selected scope is longer than the prior 72-beat path, so completeness does not
establish easier physical playing. See `QINGCHENG_REVIEWED_VOCAL.md` for source
identity, ornament reduction and separate listening/physical/rights limits.

## 《萱草花》 — selected complete vocal edition in 2.4.28

The original photo, historically described as 1=C# with the misprinted title
“萱雨花”, is unavailable. The inspected
[第七城市 edition](https://www.jitabang.com/jitapu/2805.html) and
[山山吉他 public mirror](https://www.21qupu.com/guitar/45750.html) both show
3/4 and contain real lyric-aligned vocal notation. Their first 24 pitch
classes match the current order, but seven notes differ by an octave and
onsets are not explained by uniform 4/3 scaling. Their fifth vocal bar also
disagrees on a held A3 versus A3 followed by rest. The first three E4 attacks
are separate in both sources; no opening tie merge is justified.

Needed: the original selected photo or an explicit edition choice. Verify
key, meter, octave, repeat expansion and ending together. The public mirror
is linked to the same arranger named by the recorded 2qupu page, but the
failed original image request prevents asserting byte identity. Do not mix
one edition's hold with another's rest or repair this by changing only 4/4.

Resolution in2.4.28: deliberately select the complete 山山 vocal edition rather
than patching the missing photo. Its inspected repeat/alternate-ending route
contains183 attacks,64 bars of3/4 and192 quarter beats, including20 melody-only
rests. All48 separately printed vocal bars were independently read before
expansion.84 BPM is a practice choice; the former78-attack source remains
internally archived, not declared wrong. See `DAYLILY_REVIEWED_VOCAL.md`.

## 《让我们荡起双桨》 — selected complete textbook edition adopted in 2.4.35

The original selected Qupu vocal version was not recovered. The inspected
[EOP numbered score](https://www.everyonepiano.cn/Number-1144.html) and
[matching staff score](https://www.everyonepiano.cn/Stave-1144.html) are two
exports of the same piano arrangement. At one disputed point the staff tie
supports the then-retained E5@14/3; a numbered-notation zero must not mechanically
shorten it. Other hold/ending/register differences remain edition comparisons.
Neither export approves the original selected vocal ending or full timeline.

A further full-page inspection found 27 common-stem upper-staff chord positions
without a separately identified main melody; selecting their highest notes
would not independently establish the vocal line. A public
[Xiangnan Preschool Teachers College teaching examination PDF, page 182](https://www.xnyesz.com/uploads/1/file/public/202311/20231115213157_md3qv5o7db.pdf#page=182)
has lyric-aligned notation but stops at “迎面”, before the final phrase and
cadence; the next page supplies examination instructions, not the missing score.
Its overlaid key label is also insufficient to establish the original printed
key. At that review, neither source closed the complete-theme gate, so neither was adopted.

Resolution in 2.4.35: deliberately adopt the complete 山东教育出版社 textbook
principal melody from printed pages 36–37 / PDF pages 41–42 of
[the selected textbook](https://v.sjs.com.cn/ebooks/58E2823C.pdf#page=41).
Two independent readers entered all 63 attacks across 30 bars / 60 beats before
comparing. One uniform Eb-to-C shift preserves A3–C5; three ties, four rests and
true repeated attacks remain. The unmeasured m7 grace note is explicitly omitted
without taking time from the principal note; the lyric-aligned upper chorus
voice is selected by its role, not by a highest-note heuristic.96 BPM remains a
practice choice. See `ROWING_TEXTBOOK_EDITION.md` for the selected scope and
separate listening/physical/rights limits. The complete prior JSON is retained
internally without an old-version UI or borrowed accompaniment.

This does not recover or adjudicate the unavailable original Qupu engraving.
Its retained timeline matches the new 63 onsets/durations; its first54 pitches
are one octave higher and final9 equal. Those edition differences are not
proof that the old source was wrong. Do not treat parallel notation as two
independent sources or assume one format is universally authoritative.

## 《鸿雁》 — selected school fixed-beat edition in 2.4.37

The selected historical G-key/Qupu source is unavailable. Its retained82 attacks
and80 beats are not disproved by another edition. The readable
[Guangdong/Huacheng Grade5 textbook, PDF41 / printed40](https://lywgyxx.szftedu.cn/xkjc/yinyue/202209/P020220910587728087297.pdf#page=41)
provides a complete independent lyric-aligned melody: its8-bar theme repeats,
then all8 separately printed ending bars follow, for24 bars of4/4. Two complete
independent blind readings agree on all98 principal attacks, four expanded
tie joins, eight expanded grace groups and the sole fermata position.
The first reader did not record every slur endpoint, so this is not a claim
that every slur received two complete endpoint inventories.

Resolution: explicitly choose the school fixed-beat practice edition, globally
transpose D to C by-2 semitones, and preserve G3–C5 without octave folding.
Omit eight unmeasured grace groups without taking principal time. At beat91,
retain the fermata-marked E4's written one beat with no discretionary extension.
The selected96-beat practice timeline is not an exact expressive-performance
duration.56 BPM remains a practice choice; the source prints only a verbal
slow/singing direction. The earlier complete JSON is internally byte-preserved,
without a restoration UI or borrowed accompaniment.

The already-held Shandong textbook is a distinct G-key listening excerpt ending
with an ellipsis. Its theme contour does not close the Guangdong ending or
recover the old selected source. See `HONGYAN_SCHOOL_EDITION.md` for the actual
source decisions, adaptation, and separate listening/physical/rights limits.

## 《童年》 — selected teaching vocal strophe in 2.4.38

The original Qupu image remains unavailable. The earlier2.4.9 decision adopted
only two opening ties shared by the GuitarWorld public preview and a separate
HGNU-hosted teaching score; it did not approve the other81-note edition's
remaining rhythm, register or ending. Those complete bytes and their earlier
83-note reconstruction evidence remain internally archived without alteration.

Resolution: deliberately select the complete16-bar lyric-aligned vocal line
in the People's Music Publishing House teaching score, PDF46–47 / printed42–43
of [the HGNU-hosted book](https://music.hgnu.edu.cn/_upload/article/files/09/d4/faf43ffb4e08b61cf64ee0adaf16/ec5df379-7cae-4b24-9ece-880a54ee478b.pdf#page=46).
Two complete independent source-only readings agree on86 principal heads,
seven tie joins yielding79 attacks, all nine different-pitch slurs and three
vocal rests. All16 written bars are played once,64 quarter beats, ending at
C5@60/4 after one global G-to-C shift of-7 semitones. Five lyric rows do not
supply a repeat instruction.105 BPM is a practice choice, not a printed tempo.

This is a named alternate edition, not proof that every conflicting opening
or earlier later phrase was wrong. Its separate numbered vocal line is below
TAB; no highest-note choice or inherited guitar backing is used. Exact symbol
coordinates were recorded by only one reader, while both verified page/system/
bar/head sequence and pixels; do not claim two independent coordinate surveys.
See `CHILDHOOD_TEACHING_EDITION.md` for the complete selected scope and separate
reference-listening, real-instrument and publication-rights limits.

## Other explicitly bounded gaps

- 《诀别书》: current334 attacks remain unchanged. Historical cross-source review
  covers the opening theme only; the recovered complete15-key script has no
  separately labelled melody voice. Full-script availability is not full-span
  melody approval. See `JUEBIE_SOURCE_GAP.md` for the2.4.43 disclosure and the
  separate limits of the recovered32-bar EOP piano arrangement.
- 《菊次郎的夏天》: the original Qupu score pixels remain unavailable.
  In2.4.26 an explicitly selected EOP5457 monophonic piano first theme
  (m8–23,61 attacks/32 quarter beats) is adopted from a separately readable
  engraving. Its2/4 timebase and ties do not prove the old68-attack edition
  wrong. See `SUMMER_REVIEWED_THEME.md`; later piano sections are not adopted.
- 《云烟成雨》: keep the entire disputed measure 28, beats [108,112), coherent
  and pending; see `YUN_YAN_TAIL_2.4.2.md` and the song's current scope review.
- 《喀秋莎》: current 73-note mapping remains unresolved; see
  `KATYUSHA_SOURCE_GAP_2.4.8.md`.
- 《天空之城》: existing naturalized accidentals are disclosed as an altered
  version, not a faithful fixed-C rendering; see `SKY_CASTLE_FIT_2.4.1.md`.
- 《星际穿越主题曲》: only the adopted tail is rechecked; earlier voice/register
  limitations remain in its scope review. The source-backed 3/4 → 4/4 card
  label is corrected in2.4.27 without changing note timing or extending approval.
- 《送别》: in2.4.29 a separately selected complete24-bar teaching edition
  replaces the old partial selection. Its86 attacks/96 beats are independently
  read from《中国诗乐二十品》; the original kalimba photo remains unavailable,
  and differences do not prove that earlier edition wrong. See
  `FAREWELL_TEACHING_EDITION.md`.
- 《童年》: the earlier two-tie-only decision remains historical. The complete
  selected teaching strophe is separately source-reviewed in2.4.38 above;
  other recorded forms and the unavailable original source remain unresolved.

## Historical Sheng Sheng Man source search, before 2.4.41 selection

The then-current76-note edition lacked the original supplied-image pixels.
A bounded search identified a named 崔开潮/孙世彦 vocal-jianpu page at
https://www.jianpu2.com/money/jianpu/189109.html, but the page was inaccessible
and its ordinary verified-TLS retrieval returned502. No score was inspected,
no alternate candidate was adopted, and the existing76 tuples remain unchanged.
A readable original or complete selected alternate was required before changing
its tie, register or timing claims. The later explicit2.4.41 selection is recorded
below; this paragraph retains the earlier bounded search result.

## Access and acceptance boundaries

The known Qupu certificate restriction was not bypassed. Paywalled previews,
blocked responses or absent source photos do not authorize alternate access
routes. Preserve source identity, private evidence fingerprints and failed
comparisons, but do not include copyrighted scans in a public repository.
Reference-recording listening, subjective sound and physical-instrument
acceptance remain separate checks. Structural validation and exact regression
fixtures protect recorded decisions; they cannot independently prove music.

## 《声声慢》 — explicit selected xiqiang edition in 2.4.41

The exact historical 羊阿宝工作室 image remains unavailable. Its 76 attacks /64
beats and old tie claims are retained byte-for-byte internally, not recertified
or declared wrong. The 2.4.41 edition deliberately selects the complete visible
[逸兔《声声慢·戏腔》 vocal jianpu](https://www.cangqiang.com.cn/bofang/56707.html).
The image credits 刘洋曲、崔开潮词、逸兔制谱, without a named performer.

Two source-only readers initially agree on all130 principal heads,126 written
attacks,4 ties,9 different-pitch slurs and the actual whole-score repeat. The
24 written bars are traversed twice:252 attacks/192 quarter beats. One small
m2 grace's octave initially differed; A corrected it after pixel reinspection
in a separate preserved addendum. This is not initial blind agreement on all
ornament details. The principal melody was unchanged by that reconciliation.

Printed quarter=72 is retained. A uniform +8-semitone E-to-C realization gives
E4–G5 without local pitch edits. Each pass explicitly omits14 unmeasured grace
notes and4 short wavy ornaments without stealing principal time; no rest or
fermata extension is invented. There is no borrowed or newly created backing.
Original id and users' saved speed remain; no old-version restoration control
is added. This selected complete principal-only edition is not the unavailable
old source, a whole named recording, or listening/physical/rights approval.
See `SHENGSHENGMAN_XIQIANG_EDITION.md`.

## 《大鱼》 — explicit selected-edition resolution in2.4.22

The former200-note source photo remains unavailable. A public numbered
简和谱 at https://www.jianpujia.com/jianpu/340541.html provides an explicit
single melody through the selected32-bar route. After independent pixel
readings,2.4.22 deliberately selects its162 attacks/128 beats; it does not
identify this image as the recovered original or call the prior edition wrong.
80 BPM is a practice choice, and the full later repeat/interlude/ending is
outside scope. Literal octave dots are retained; intent/reference performance
beyond the pixels has not been established. See BIGFISH_REVIEWED_EXCERPT.md.

The old V2's backing event crossing an inferred [78.5,79) gap remains historical
material, not evidence of a source-silence violation: the selected new edition
holds E4 to79. Do not use either edition to silently rewrite the other's rests
or backing. The new melody does not inherit the old support.

## 《平凡之路》 — selected complete short-edition vocal adopted in 2.4.24

The historical 趣弹/石头 image remains unavailable; its 235-note path is not
newly verified or declared wrong. The explicitly selected 破晓/弹琴吧 short
edition supplies a separate lyric-aligned vocal line, m5–21, independently
read as 93 attacks over 68 beats. Its complete vocal verse and chorus are
retained; the four guitar-only intro bars and all guitar support are omitted.
Source quarter=80 is retained, including opening, internal and final vocal
rests. Guitar remains active under some rests; these are not source-all-layer
silence claims. The old edition stays in a byte-exact internal archive without
a product restore control. See ORDINARY_ROAD_REVIEWED_VOCAL.md for edition,
source scope, tie/repetition differences and reference-listening limits.

## Barynya Katyusha complete-page gate remains closed

A later source-only inspection of the already-held
[Barynya score](https://www.barynya.com/balalaika/images/katyusha.pdf)
read the complete page independently, without the old production or partial
fixture. Intro m2 contains G-sharp4, m3 B-flat4 (including the later same-bar B),
and m4 F-sharp4. Together with the A/B sections' seven natural pitch classes,
the full page requires ten distinct pitch classes: no global pitch-class
transposition can put all ten on the fixed seven-class natural-note instrument.

The A/B principal line alone is natural and spans E4–A5, but no new excerpt was
chosen or transcribed for production. A segno appears at A's start and again
at B's end; B also has left/right repeats without a clear finite terminal
instruction. This review did not guess a full expansion. It neither resolves
the current73-note mapping nor establishes that every Katyusha edition fails.
The PDF hash remains1879259b25a95c095b3f8febb08ecb62fbbf7e6e21f2c52cae01d2b49175d108.
