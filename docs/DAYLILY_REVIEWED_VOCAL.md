# 《萱草花》 selected complete vocal edition

## Adoption and source boundary

Version 2.4.28 adopts one canonical melody, **《萱草花》（声乐版）**, under the
existing `xuan-cao-hua` id. It follows the complete lyric-aligned vocal line of
[山山吉他's two-page C edition](https://www.21qupu.com/guitar/45750.html).
The guitar tablature is a separate voice, not a source for highest-note
extraction or simultaneous physical practice targets.

The source author inspected both complete pages, every selected vocal row and
the ending brackets. A separate reader reviewed all 183 pitch/onset/duration
tuples, the full repeat route and all 20 vocal rests. Implementation also viewed
both full pages. These are multiple readings of one edition, not independent
source editions or a recording comparison. The page-image SHA-256 values are
recorded in `sourceFeatures.sourceReview.currentScopeReview.sourceAssetHashes`;
raw images, enlarged crops and the full private glyph map are not packaged.

All measure numbers below are editorial counts from the first guitar-intro bar;
the source does not print measure numbers. Omit the 16 guitar-only intro bars,
then retain:

- m17–48: 32 bars, 96 quarter beats, 89 attacks
- m17–32 again: 16 bars, 48 beats, 47 attacks
- m49–64, second ending and separately printed coda: 16 bars, 48 beats, 47 attacks

The first ending starts at m33, and the end repeat is after m48. On the second
pass skip m33–48 and continue to m49. The complete selected vocal route has
64 bars of 3/4, 192 beats and 183 attacks; it is not asserted to be the complete
commercial recording form. The coda was read from its own printed occurrences,
not copied from a similar verse. Only the explicit m17–32 repeat reuses notation.

The unavailable historical photo described as `1=C#` and misprinted “萱雨花”
remains unavailable. The chosen mirror is not claimed to recover that photo or
to prove the old 78-attack edition wrong. A comparison edition from 第七城市 was
not blended into the new data: its longer A3 in selected bar 5 and lower A3 in
selected bar 29 are edition differences. Selected 山山 bar 29 (counted m45)
retains A4@84/1.5, B4@85.5/0.5 and C5@86/1.

Public source availability does not establish reproduction or public-distribution
rights. This reversible private-preview adoption does not authorize public push,
publication or deployment.

## Timing, register and practice choices

The printed selected key is C, with original key Bb. Under the project's
undotted `1=C4` convention, actual lower and upper dots yield **G3–C5**. Zero
semitone or octave transposition is used, with no local octave folding or
accidental replacement. Scientific octave numbers are the compilation convention,
not absolute octave labels printed in the source.

There is no vocal pickup. Three E4 quarter notes attack independently at beats
0, 1 and 2. The corresponding E4 groups at 24, 96, 120, 144 and 168 also retain
three attacks each. No selected vocal ties are visible; prolongation dashes
lengthen one note without adding attacks. Duration counts are 90 eighths,
51 quarters, 24 dotted quarters, 14 halves and four dotted halves.

Twenty one-beat vocal rests start at 14, 17, 35, 38, 47, 53, 59, 71, 77, 83,
110, 113, 131, 134, 143, 158, 161, 179, 182 and 191. They are stored as
`melodyOnlyRestWindows`, never all-layer silence. Guitar remains active at some
of those rests, including the final bar. Final C4@189 lasts two beats, followed
by [191,192). Do not stretch the note or truncate the track at 191. Written
note duration is separate from natural sample or effects-tail decay.

No tempo mark is visible. **84 BPM is an editorial practice choice**, retained
from the historical built-in, not a source/recording tempo claim. The old
`defaultSpeedFactor: 0.9` suggestion stays unchanged. It is a score suggestion,
not proof of the actual first-visit or remembered browser speed. This adoption
changes neither runtime speed defaults nor saved preferences.

`difficulty: medium` and suitability `conditional` are editorial assessments.
The shortest onset spacing is 0.5 quarter beat, about 357 ms at 84 BPM or
397 ms at the 0.9 suggestion. On the actual display layout, there are 39
half-beat same-side pairs, a largest nine-semitone melodic leap and an
11-position key-index jump. The longest same-side run has nine attacks across
beats 57–66, including a full vocal rest; it is not nine uninterrupted fast
notes. At 84 BPM the notation spans about 137.14 seconds, or 152.38 seconds
at 0.9, before lead-in or natural decay. More complete source coverage and a
low/middle register do not prove easier physical playing than the old edition.

Reference-recording comparison, browser/audio acceptance and physical 21C
play-through remain separate gates. This data-stage record does not claim any
of them passed. Browser verification is pending while its transport is blocked;
source and independent executable checks do not substitute for actual webpage
speed, scheduling, loop, ending or audible-output verification.

## History, restoration and backing

`data/archives/xuan-cao-hua-v2.4.27.json` is the exact pre-adoption V1 byte stream,
including all 78 attacks, original titles, 84 BPM, 4/4, 0.9 suggestion and source
metadata. It preserves the original numeric lexical forms, including `0.0`.
Do not parse and reserialize this archive to replace it. SHA-256:
`e9cd5a2a7ec4912fb208983a279b4f40f05eb524422c2bf5914e77fc4f1e9798`.

The original `sourceFeatures` also remains unchanged as historical data under
`sourceReview.historicalSourceFeatures`. Historical source claims are not new
musical approval. The archive is developer recovery evidence outside
`data/songs`: no additional built-in card, old-version selector, user restore
control, HTTP route or service-worker precache entry is added.

The actual importer and storage recover the archive as an independent local
song with all 78 tuples and its 116-beat extent, without replacing the reviewed
built-in. Normalization changes schema/id/uploader/practice display strings;
reversing only those documented fields recovers every old JSON value. The
archive retains original bytes; parsing is not a promise to preserve textual
number spellings in local storage. Saved speed is checked to remain untouched.

The V2 `xuan-cao-hua-chord.json` sibling stays byte-for-byte unchanged, SHA-256
`82f43ef27df396c1af0235750a5ea070dbed7997ab821b956d0a1e829a705b57`.
Its title/base id and 84 BPM do not establish compatibility with the new melody.
The real content guard rejects borrowing both old support layers. No new
accompaniment or physical chord target is introduced.

## Executable checks

Run `node --test scripts/test-daylily-reviewed-vocal.mjs`.

The public regression freezes the exact 183-tuple SHA-256
`cae668aa9911d5ce06d4d3d69dae051ccb270631402a23d9eb72c7472fac22cd`
and 64 separate source-authored bar fingerprints/counts. It checks three-beat
bar balance, repeat routing, all rests, repeated E4 attacks, source-register
choices, final extent, scoped provenance, old archive and V2 bytes, actual
independent local import/storage and absence of automatic old backing.
Negative mutations include invented ties, missing repeat/coda, wrong ending
route, mixing edition-specific hold/register, stretching to the old meter,
truncating/filling the final rest, changing tempo or the speed suggestion.

`DAYLILY_SOURCE_EVIDENCE_PATH` optionally points to the local pre-edit
source-authored evidence fixture. Its SHA-256 is
`0d53881e02367af6758d767b07d61aa47366ddbe91497a7116cd73598dc6cb09`.
That optional check compares 183 attacks across 64 spans with the reusable
compiler evidence checker. Expected tuples are never generated from production.
Without the fixture, the optional test is explicitly skipped; public locks and
mutation checks still run. The fixture text predates independent-person review,
so its authorship disclaimer is retained rather than rewritten. Executable
matches protect adopted decisions, not independently read score pixels.

The integration owner regenerates `src/songs.js`, updates the single concise
notice and app version, and runs the complete validation/report/runtime/packaging
checks. Actual webpage verification and final release status belong in that
separate verification record. This document does not infer their completion.
