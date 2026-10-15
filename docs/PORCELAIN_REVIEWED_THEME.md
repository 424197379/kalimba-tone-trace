# 《青花瓷》（主题短版）: selected piano excerpt, local v2.4.20 preview

## What is selected

The canonical `qing-hua-ci` record now selects the explicit, monophonic upper
staff of **EveryonePiano #1676's simple piano arrangement, printed m25–40**.
The display title is **《青花瓷》（主题短版）**. It has **83 melody attacks,
16 full 4/4 bars and 64 quarter beats**. Source m25 downbeat becomes excerpt
beat 0: subtract 96 from the source's quarter-beat timeline.

Sources: [numbered export](https://www.everyonepiano.cn/Number-1676.html) and
[staff export](https://www.everyonepiano.cn/Stave-1676.html). These are parallel
representations of **one arrangement**, not two independent sources. A second
reader transcribed every adopted bar from the actual pixels before viewing the
first reader's tuples; all 83 pitch/onset/duration tuples agree. The implementer
also inspected all four numbered and five staff crops before the data edit.
No source scans, OCR, private full reports or copied full score are added here.
Source asset fingerprints remain in the selected record's review metadata.

“Theme” is an editorial scope label. The source labels **Piano** and contains
no printed chorus heading or vocal lyrics. This selection is not certified as
a vocal-score transcription, the complete original recording or a complete
40-bar rendering of the piano arrangement. Its rest-separated entry and final
printed cadence/double bar bound a coherent selected practice unit. No missing
passage is invented and no other edition's rhythm is spliced into it.

This is a deliberate edition/form choice, **not proof that the former edition
was wrong**. The former 131-attack/96-beat record's original 羊阿宝工作室 photo
is unavailable. Its highest-note extraction, printed-tempo and suitability
claims cannot be reverified. The unchanged full archive preserves every old
field as historical evidence; those claims are not relabelled as new evidence.

## Exact source decisions

- C major; G4–A5; melody pitch classes C, D, E, G, A.
- No transposition, local octave folding, substituted accidentals or extra attacks.
  There are no accidentals in the selected upper-staff scope. This makes no
  claim about all voices, the entire composition or another arrangement.
- The separately notated upper staff is monophonic throughout the selected
  onset sequence. It is selected by voice identity, not by taking the highest
  note from a chord. The lower staff, including the final bass arpeggio, is
  omitted completely. No physical chord targets or automatic backing are added.
- All 16 selected bars are printed individually; no repeat instruction is expanded.
- **96 quarter BPM is printed in this EOP edition**. The former app encoding
  used 94 BPM. Its historical “printed” claim remains unverified without the
  original photo; the new source does not establish that 94 was a mistake.
- `defaultSpeedFactor: 1` and `difficulty: hard` remain unchanged. A song's
  stored speed suggestion is distinct from the app's actual initial or remembered
  multiplier. The printed 64 beats take 40 seconds at 1.0x, excluding preparation
  and acoustic ring-out. A suggested 0.8x practice run would take 50 seconds;
  this is a suggestion, not the user's measured or changed preference.

### Articulation and boundaries

Notation below uses excerpt-global beats: `note @ onset / duration`.

1. m25 is a full bar beginning with **2.5 beats of written upper-voice rest**,
   then G5 @ 2.5 / 0.5, G5 @ 3 / 0.5, E5 @ 3.5 / 0.5. There is no incoming
   tie, removed pickup or new note before the first G5.
2. In m32, D5 @ 29.5 / 1 joins two source eighth notes at 29.5 and 30.
   It is one attack. The subsequent G5 @ 31.5 / 0.5 and G5 @ 32 / 0.5 are
   separate attacks across the barline, with no tie between them.
3. m33 has its own G5 @ 32 / 0.5 and E5 @ 32.5 / 1.5 entry. It must not
   be replaced by m25's opening rest or by the old edition's E5 @ 32 / 2.
4. m39's D5 @ 59 / 0.5 remains a separate attack. D5 @ 59.5 / 1 is tied
   across the barline to the first printed eighth of m40. No new attack at 60.
5. Final C5 @ 60.5 / 3.5 joins a dotted quarter and half note. There is no
   retrigger at 62. It ends exactly at the printed final double bar, beat 64,
   with no final rest, extra bar or artificial extension.

The eight written **melody** rests are [0,2.5), [10,10.5), [18,18.5),
[26,26.5), [34,34.5), [42,42.5), [50,50.5) and [57,57.5), totaling six beats.
The original lower piano staff can sound during them. Consequently the metadata
records `melodyRestWindows`, not all-layer source-silence windows. This selected
unaccompanied practice line has no attacks or held melody overlapping those gaps.

Each bar's four-beat accounting includes the portion of any incoming/outgoing
tie, especially m39–40. No tuplet or different-pitch slur is adopted as a tie.
Repeated E5 eighths at 22.5/23 and 54.5/55 also remain separate re-plucks.

## Fit and difficulty are separate from excerpt length

All notes fit the actual fixed 21-key natural-note F3–E6 layout. Used left-side
tines are A4/C5/E5/G5; right-side tines are G4/D5/A5. The longest contiguous
same-side run is five attacks. This layout analysis does not establish a
particular thumb technique or physical comfort.

The selected version has 48 fewer attacks and eight fewer bars. It **does not
reduce** the G4–A5 range, shortest half-beat onset interval or maximum nine-
semitone leap. At 96 BPM, consecutive eighths are 312.5 ms apart, marginally
faster than at the former 94 BPM. Retaining `hard` and a clear slow-practice
warning avoids claiming that a shorter selection is necessarily easier or
better sounding. Legitimate long notes decay naturally on a kalimba; they are
not shortened or retriggered to simulate sustained energy.

Suitability remains **conditional**. Source-pixel fidelity, event regression,
reference listening, browser scheduling/audio and physical-instrument acceptance
are separate gates.

## Historical provenance and compatibility

The complete pre-edit JSON is byte-preserved at
`data/archives/qing-hua-ci-v2.4.19.json`.

SHA-256: `ae805daffe79f68916a8c88afe0b931b45fd14ec6bc65eb06761c7993e918b21`

It retains its original title/id, all 131 tuples, 94 BPM, 96-beat extent,
`defaultSpeedFactor: 1`, difficulty and every source field. It is developer
history only: no extra built-in card, current-scope `archiveImportPath`, restore
link, route allowlist or service-worker precache entry is added. The ordinary
practice path remains the single canonical current edition.

Old beats [0,32) contain exactly the same first 42 tuples as EOP m25–32.
After beat 32, 89 historical attacks are replaced by the selected edition's 41
attacks through beat 64. These are edition/form differences, not 89 proved
transcription errors, and the first-eight-bar agreement does not recover the
missing old photo or validate its melody-selection heuristic.

No `qing-hua-ci-chord` or other original V2/backing sibling exists. The actual
`hasMatchingPracticeMelody` guard nevertheless rejects the historical melody
against the selected one, including after changing its BPM to 96. Separate
mutations demonstrate strict BPM and ending-extent rejection. No title or
canonical-id match can authorize hypothetical old backing for this new scope.

The real importer plus an isolated in-memory storage/save test preserves all
archived tuples and metadata as an independent local record without changing
the selected built-in. This proves recovery independence; it does not change
any user's browser storage or expose recovery UI.

## Executable checks and remaining acceptance

Run:

```sh
node --test scripts/test-porcelain-reviewed-theme.mjs
npm run validate:songs
node --test scripts/test-import-score-contract.mjs scripts/test-song-store.mjs scripts/test-accompaniment-compatibility.mjs scripts/test-song-report-analysis.mjs
npm run report:rhythm
npm run report:arrangements
npm run report:suitability
```

The dedicated 16 tests protect all 83 independently authored tuples, every
bar's internal rhythm and clipped duration total, three ties, independent
repetitions, eight melody rests, exact 64-beat ending, pitch fit, unchanged
hard difficulty, archive raw-byte hash, first-42 equality, independent import
and simulated save, 36 canonical cards, no archive UI/precache and strict
historical-support mismatch.

Seven negative fixtures reject: splitting the m32 tie, splitting the m39–40
tie, retriggering the final tie, merging independent D5 repetitions, copying
m25 into m33, erasing the opening rest and locally folding the high A5.
Their expectations were manually entered from the independent source reading
before editing production, then checked against both pre-existing independent
83-tuple readings. Tests never derive expected notes from production JSON.

The data tests can run before generated-library rebuilding by substituting
only the selected normalized record into a test-local library. Release
integration must rebuild `src/songs.js` and run full project checks, real
server/archive denial and actual webpage/session verification separately.
No app runtime, preferences, generated module, version files, server or
service-worker code is changed by this data-only contribution.

At this data adoption stage, reference-recording recognition, browser audio
listening and physical kalimba play-through are **not performed**. Any later
browser result must identify the actual version, scope and visible multiplier;
scheduling tests alone do not establish subjective recognizability or timbre.
There is no optional accompaniment, so no supported A/B sound claim is made.

**Publication is not approved.** The EOP preview says 禁止转载. Public access,
independent transcription, note accuracy and passing tests do not establish
rights to reproduce or publicly distribute this arrangement. This change is
for the authorized local preview only. Establish a separate publication basis
before any public commit, push or deployment; keep source scans private.
