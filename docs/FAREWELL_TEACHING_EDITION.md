# Farewell selected complete teaching edition (2.4.29)

## Deliberate edition selection

The canonical `song-bie` now displays **《送别》（教学版）**. It retains the whole
single melody printed in 《中国诗乐二十品》, edited by 张竹筠 and 沈亚玲,
Foreign Languages Press, printed page 222 / PDF page 238. The source credits
李叔同 for lyrics and （美）奥德维 for music. The public copy is hosted by
揭阳职业技术学院, a participating institution named in the teaching book.

[Selected source page](https://cxqx.jyc.edu.cn/__local/3/D5/71/B7A1BD225359A39D710C8C3021A_A9C90F62_167DC01.pdf#page=238)

PDF SHA-256: `ca4f41c909d255dfa1817d3988ccb404fc2ed39a96c3682b8814810a29c64e6c`.
The full page ends at a final double bar; the following page begins commentary.
Staff and numbered notation show the same lyric-aligned single voice. They are
two representations of one published edition, not two independent sources.

Retain **all 24 separately printed bars once, 86 attacks and 96 quarter beats**.
Printed system-start labels 5, 9, 13, 17 and 21 anchor the count; intermediate
bar numbers are counted. There is no pickup, omitted intro, inferred repeat,
D.C./D.S., alternate ending, coda or fermata. The later eight-bar return is
explicitly written and was read separately. Multiple lyric rows do not authorize
another traversal. This is the complete selected teaching melody, not a claim
about every stanza or recording's full form.

The older 58-attack / 64-beat version is another retained edition. The teaching
source does not recover the unavailable original kalimba photo, resolve the
other GuitarWorld engraving's intent, or establish that the old version is
wrong. Its earlier m7–8 source-specific review and unresolved questions remain
complete historical metadata. No source-version blending is used.

Source inspection and publication rights are separate. Public access to this
textbook PDF does not establish a reproduction license. This reversible,
private-preview data adoption does not authorize push, public publication or
deployment. Book pages, lyrics, glyph maps and the full private source fixture
are not included in the public project files.

## Key, articulation and rests

The selected score is E-flat major, 4/4, with source range **D4–E-flat5**. Its
treble staff establishes undotted degree 1 as E-flat4. One uniform **-3-semitone**
transposition yields C major, **B3–C5**, entirely inside the fixed F3–E6 natural
instrument. All seven source pitch classes are present; modulo-12 shift 9 is
the only fitting class. No local octave folding or accidental naturalization
is used. Key-signature flats belong to the original scale and are preserved
by the global transformation.

Specific occurrence checks include:

- m3 and m19: B-flat4 drops to E-flat4 in the source. Staff and undotted numbered
  notes agree; compiled C4/D4/E4/D4/C4 retain the lower phrase, followed by D4.
- m7, m15 and m23: the final short degree 7 has a lower octave dot and staff D4,
  compiling to B3. Each separately printed occurrence was checked.
- m5, m13 and m21: high tonic dotted quarter, followed by an eighth-note degree 7.
  m7, m15 and m23 have dotted-quarter degree 4 followed by lower-7 eighth.
- Every visible arc joins different pitches and remains a slur. No same-pitch
  tie is present. C5@33/1 and C5@34/2 remain separate, as do A4@41.5/0.5 and
  A4@42/0.5. m11 retains all eight eighth-note attacks. No tuplets occur.

There are 40 eighths, 25 quarters, six dotted quarters and 15 halves, totaling
84 sounding beats. Six two-beat rests begin at **14, 30, 46, 62, 78 and 94**.
Each four-bar phrase ends with a half-note and two explicit quarter rests.
Because this engraving is a single voice with no backing, these windows are
recorded as `currentScopeReview.silentWindows`. They do not assert silence in
other arrangements or a physical cutoff of natural sample/reverb decay.

Final C4@92 lasts two beats, followed by **[94,96)**. Numeric
`sourceFeatures.sourceTotalBeats: 96` preserves that ending. Do not stretch C4
through the rest or truncate the track at beat 94. The legacy validator's
last-sounding-note-end heuristic can still flag 94 as not divisible by 4; the
complete source extent is 96 and all 24 bars balance exactly. This release
does not change that generic validator or alter correct music to remove its
informational warning.

## Practice choices and acceptance limits

The page prints no numeric tempo or tempo word. **70 BPM is an editorial
practice choice**, retained from the prior built-in, not a source or recording
marking. The historical `defaultSpeedFactor: 0.9` remains unchanged. This is a
score suggestion, not evidence of actual initial or remembered browser speed;
no runtime defaults or saved preferences are changed by the edition selection.

`difficulty: easy` and suitability `conditional` are editorial practice
assessments. Minimum onset spacing is 0.5 quarter beat, approximately 429 ms at
70 BPM or 476 ms at the 0.9 suggestion. The notation spans about 82.29 seconds
at 70 BPM, or 91.43 seconds at 0.9, before preparation and natural decay. On the
actual key layout there are nine half-beat same-side pairs, a largest
nine-semitone melodic leap and an 11-position key-index jump. These facts do
not certify physical ease or recognizability.

The source author read all 24 bars in both notation forms. A second reader
independently entered every bar before comparing and matched all 86 transposed
tuples and all six rests; their private check rerun passed 17/17. Implementation
also viewed the full page. These are independent readings of one edition.
Reference-recording listening, browser/audio acceptance and physical-kalimba
play-through are separate gates and were not performed by this data-adoption
worker. The integration owner's browser and release verification record must
report those results separately rather than infer them from executable tests.

## Complete history and independent developer recovery

`data/archives/song-bie-v2.4.28.json` preserves the **entire prior V1 byte stream**,
including all 58 steps, original titles, hint, 70 BPM, 4/4, 0.9 suggestion and
all source metadata. Its complete-file SHA-256 is
`31042a1c640d60dbf2cabfd880aa451d6d2f142916c169fa5bc5eabca19c0a26`.
Do not rewrite the archive to improve its title or update old claims.

The complete parsed `sourceFeatures` is also retained unchanged under
`sourceReview.historicalSourceFeatures`, including the older nested source
review. Historical claims are not present-day approval. This developer archive
is outside `data/songs`: there is no extra library card, old-version selector,
restore control, HTTP archive route or service-worker precache entry.

The actual importer and local storage recover all 58 old tuples and the old
64-beat extent as an independent local song, preserving the reviewed built-in
and saved song speed. Normalization changes schema, id, uploader and practice
display strings; reversing only those documented fields reconstructs every old
JSON value. The archive itself preserves exact textual bytes. Importing it a
second time also creates a distinct local identity.

The original `data/songs/song-bie-chord.json` remains byte-for-byte unchanged,
SHA-256 `dd575f1e2db95a54b010d3e9eca6e1f273f58190743fec68e7db55490e61c35c`.
Matching titles, base id and BPM do not make its melody or support compatible.
The actual content guard rejects both old backing-provider paths for the new
86-attack route. No new chord card, physical chord target or accompaniment is
introduced. Library counts remain **56 records: 36 V1 and 20 V2, 36 practice
cards** before any deliberate local import.

## Executable checks

Run `node --test scripts/test-farewell-teaching-edition.mjs`.

The public test freezes the 86-tuple SHA-256
`ad944edad48e74b6a3bfa6c80d47bc5deaf3f72dc079331c4183ee8a26727180`
and 24 separate source-authored bar fingerprints and counts. Expectations were
frozen from the private pre-adoption staff reading, not generated from production
at test time. Tests cover every tuple, four-beat bar balance, all rests, separate
repeated attacks, register, extent, tempo provenance, historical metadata, whole
archive/V2 byte hashes, real independent import/storage, saved speed and old
backing rejection.

Seventeen negative mutations reject old high-register first/later phrases,
lost lower dots, invented same-pitch ties, lost dotted-quarter timing, a cut
back to the old 16-bar form, lyric-driven duplicate traversal, stretched/filled
or truncated ending silence, erased rest metadata, invented printed tempo,
changed practice BPM, overwritten speed suggestion and unapproved backing.

`FAREWELL_SOURCE_EVIDENCE_PATH` can explicitly name the private pre-adoption
source-authored `teaching-evidence.json`. Its SHA-256 is
`577988d8890ac8c55ae147a01b231a3f746e3ea3bf7025235979408a8805f316`.
That test checks all 86 attacks against all 24 source spans, six rests and the
source pitch-fit assertion using the reusable compiler checker. The fixture's
candidate id stays intact; only the checked song id is aliased in memory to
`song-bie-teaching-candidate` for comparison. All musical data remain the actual
production values. No fixture or expected tuple is silently regenerated.

Without that explicit private path, **25 tests pass and one is explicitly
skipped**. With the reviewed fixture, **26/26 pass**. A skipped source fixture
is not source inspection, and a passing fixture cannot certify listening,
physical playing or publication rights.

The integration owner regenerates `src/songs.js`, updates the concise source
notice and version, and owns full validation/report/runtime/packaging checks,
actual browser acceptance and the release verification record.
