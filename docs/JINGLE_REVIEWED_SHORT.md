# 《铃儿响叮当》（短版副歌主题）: selected-source adoption, v2.4.16

## Edition and scope

The canonical `ling-er-xiang-ding-dang` melody adopts the complete short refrain
printed in Kyle Coughlin's **Jingle Bells — Short version, in the key of G**.
The display title is **《铃儿响叮当》（短版副歌主题）**. It contains 16 bars, 51
separate melody attacks and 64 quarter-note beats. The page is a complete short
arrangement of the familiar refrain; it does not include the original song's
“Dashing through the snow” verse. No missing verse or continuation is supplied.

This is a deliberate choice of an identified edition. The difference from the
previous 49-attack, 32-beat edition does not prove that the earlier edition is
wrong. The old source photo was not available for renewed verification, and its
historical source/rhythm claims are not applied to the selected Coughlin page.

The same canonical id preserves existing links and per-song preferences. The
old `-chord` record remains a historical source sibling, not a second default
practice card and not backing for the new melody.

## Source and transcription decisions

Selected source:
[Kyle Coughlin, Jingle Bells easy lead sheet](https://www.christmasmusicsongs.com/PDFleadsheets/jingle-bells-easy-lead-sheet.pdf),
complete one-page short arrangement, music and lyrics credited to James Pierpont.

The actual saved source pixels were independently reopened and read across all
four systems before adoption. A fresh transcription agreed with the earlier
independent reading on every pitch, onset and duration. These are independent
readings of the same score, not two independent source editions.

- PDF SHA-256:
  `6938f9d76dc4be1daf4cdc12b128bba0916bde6cdcc86a86829fda460018ae70`
- Inspected image SHA-256:
  `83ef33ff7ec86a6852ba4dce5cb83da8187475971b8a7758dfef9c4f2193944f`
- Source key: G major. Source melody range: G4–D5.
- Selected transformation: **global +5 semitones**, giving C5–G5 and preserving
  the earlier app register. Every source pitch receives the same shift.
- There is no octave folding, individual pitch replacement or naturalization.
  The alternative global −7 shift was considered but is not used.
- Meter: 4/4, with no pickup. All 16 bars are written out; no repeat sign is
  expanded. The two similar halves were read separately.
- There are no printed rests, ties, slurs or tuplets in this melody. Every
  separately printed repeated note remains an attack.
- The score has no tempo mark. The retained **80 quarter BPM** is a practice
  choice. The historical `defaultSpeedFactor: 0.9` is also a practice suggestion,
  not a score marking. Actual speed follows the app's new-song default or the
  user's saved per-song setting; verify the displayed multiplier when checking.

### Repeated attacks and different cadences

All values below refer to the globally transposed C melody and a zero-based
quarter-beat timeline.

- m1/m2 and m9/m10 each use three E5 attacks of 1, 1 and 2 beats.
- m3/m11 use E5/G5/C5/D5 quarters; m4/m12 use a four-beat E5.
- m5/m13 use four separate F5 quarters.
- m6/m14 begin F5/E5/E5 quarters and end with two separate E5 eighth notes.
  The first half therefore includes distinct E5 attacks at 23, 23.5 and 24.
  The later eighths are at 55 and 55.5; the next attack is G5 at 56.
- m7 uses E5/D5/D5/E5 quarters; m8 uses D5 at 28 for two beats and G5 at 30
  for two beats. This first-half ending is not copied into the final cadence.
- m15 uses G5/G5/F5/D5 quarters at 56/57/58/59. Final m16 is C5 at beat 60
  for four beats, ending exactly at 64.

Comma-shaped breath marks after m4, m8 and m12 express phrasing without a
specified duration. The fixed-time practice timeline retains the complete
printed note values. It does not assign guessed silence, shorten preceding
notes or add beats. There is no final rest; `sourceTotalBeats` and the final
note end are both 64. Audio decay after the score is not additional score time.

At the chosen 80 BPM the score lasts 48 seconds before count-in or post-score
ring-out. At the app's current new-song 0.55x speed it lasts about 87.27 seconds.
A saved multiplier changes that duration; neither value is printed by the source.

## Melody-only instrument fit and support boundary

The selected melody uses exactly C5, D5, E5, F5 and G5, all available on the
fixed 21-key natural-note F3–E6 instrument. C5/E5/G5 are three left-side tines;
D5/F5 are two right-side tines. There is one target per attack, no simultaneous
chord requirement, no sweep and no individual octave remapping.

The maximum same-thumb movement is two tine positions. The fastest written
onset interval is half a quarter beat: 375 ms at 80 BPM and about 682 ms at
0.55x. The repeated E5 eighths require actual re-plucking. Four-beat notes decay
naturally on a kalimba; their notation does not authorize invented retriggers.
This structural fit supports **conditional** suitability, subject to the
separate listening and physical checks below.

The source prints chord symbols G, C, A7, D and D7. Under the same +5 shift they
become C, F, D7, G and G7. In particular, **A7 becomes D7, containing F#**, which
is unavailable on the fixed natural-note instrument. This is a harmony issue;
F# does not occur in the selected melody. The symbols are retained as source
information only. No chord is naturalized, no playable lower voice is guessed,
and no automatic support or physical chord target is added.

The unchanged historical V2 melody matches the archived 49-note edition, but
fails the actual `hasMatchingPracticeMelody` check against the selected 51-note,
64-beat edition. Its shared title/id and former accompaniment preference cannot
make it compatible. Both legacy automatic backing and optional practice support
must remain unavailable for this different melody/timebase.

## Restore the previous 49-note edition

The entire original V1 JSON is preserved byte-for-byte at
[`data/archives/ling-er-xiang-ding-dang-v2.4.15.json`](../data/archives/ling-er-xiang-ding-dang-v2.4.15.json).
The archive keeps its original id, title, 49 steps, 32-beat timeline, 80 BPM,
0.9 speed suggestion and all source metadata. It is outside `data/songs`, so it
is not enumerated as another built-in default.

To restore it as a local practice song:

1. Open the app's **旧49音版 JSON · 可导入还原** link, or open the archive above
   in a repository browser and view its raw JSON. The app's installed offline
   shell includes the exact archive asset.
2. Copy the complete JSON, open the song library's “添加歌曲”, and paste it into
   “粘贴歌曲 JSON”.
3. Choose “保存到本地曲库”. The legacy V1 import path produces a separate local
   **《铃儿响叮当》** with all 49 original tuples and source metadata. The
   built-in **《铃儿响叮当》（短版副歌主题）** stays available.

The archive is not retitled or reformatted to distinguish it: exact preservation
is intentional. The imported record has its own local id and preferences;
repeated imports create additional independent records. Restoring this melody
does not roll back the app or newly verify its missing original source.

- Original V1/archive SHA-256:
  `8309ad1fea7f60b373e204c2fb952b345999b9981e139b8db8c68fbc3782f9d9`
- Original V1 `steps` JSON SHA-256:
  `bb2946608ade26de3f6b9c67dabb6f9a6e2f651488280f5a3e6129d2310c452f`
- Unchanged historical V2 full-file SHA-256:
  `c28df5631e09a1dcce5e28fc7b32c3ec86d1ff858c2032daff9c91de888bafa8`

The new record's `historicalReviewNotes` preserves the old `sourceFeatures`.
Current source identity, tempo status and notation decisions refer only to the
selected Coughlin page. The original local-photo, Doctor Uke and Easy Breezy
references remain historical context, not new certification of this edition.

## Regression and acceptance coverage

Run the dedicated test:

```sh
node --test scripts/test-jingle-reviewed-short.mjs
```

It checks all 51 independently reviewed tuples, each bar's internal rhythm,
separate repeated attacks, distinct cadences, global +5 range, unmeasured breath
signs, exact end64, no support, selected-source metadata and historical context.
It verifies complete archive/V2 hashes and actual import into an independent
local melody without replacing the selected built-in. It also rejects eight
mutations: merged eighth, omitted later eighth, copied first-half cadence,
doubled old timing, invented breath rest, shortened or extended final note,
and the unadopted lower register.

The importer test constructs the selected normalized built-in directly so it
can run before generated-library rebuilding. Release integration must also
verify the actual generated library, single canonical card, old chord-link
routing, preserved speed/history, incompatibility of both old backing paths,
archive download allowlist, exact server asset access and offline archive bytes.
`sourceTotalBeats: 64` must be included in ending/duration regressions. Archive
support must not broadly expose `data`, private files or arbitrary user paths.

After integration and regenerated `src/songs.js`, run project validation,
focused runtime tests and the complete `npm run check`. Never hand-edit the
generated song module or include raw score images/OCR in the public repository.

### Separate acceptance boundaries

The transcription review establishes correspondence with the selected notation.
Executable tests preserve recorded decisions; they cannot read the source or
prove the sound. At the data-adoption stage:

- External-reference performance listening is not performed.
- Browser audio/scheduling is not performed by this data review. Record any
  later browser check with the actual visible version, scope and multiplier.
- Physical 21-key C kalimba play-through is not performed.

These boundaries remain explicit in metadata. Browser scheduling/audio checks
may be completed separately without claiming a physical-instrument audition.

The inspected PDF bears ©2013 Kyle Coughlin / All Rights Reserved. Source
availability, notation accuracy and public distribution permission are separate.
No public commit, push or deployment is authorized or implied by this local
adoption; any publication basis must be established separately. Source scans
remain private.
