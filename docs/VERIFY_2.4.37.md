# 2.4.37 Hongyan school fixed-beat edition

Private own-cloud preview only. No new commit, push, public deployment or
publication. The preceding2.4.36 source and patch remain frozen separately.

## Actual musical change

The canonical Hongyan entry now explicitly selects the Guangdong/Huacheng
school edition as《鸿雁》（教材定拍版）. Two complete source-only readers
independently froze every printed principal note before comparing:67 printed
heads expand to102 occurrences, with four true tie joins leaving98 attacks.
The route is m1–8 twice, then all m9–16 written ending bars,24 bars of4/4.
All adopted pitch/onset/duration tuples, ties, grace attachments and the
fermata location agree. They read one publication independently, not two
independent published sources. The first reading does not include a complete
slur endpoint inventory, so that narrower limitation is retained.

The selected practice timeline has96 fixed quarter beats, one global D-to-C
shift of-2 semitones and G3–C5 range. Eight expanded unmeasured grace groups
are explicitly omitted without taking principal time. The fermata-marked
E4@91/1 keeps its written duration with no discretionary extension; the final
A3@92/4 ends at96. This fixed-beat choice is not a claim of exact sung timing
or an ornament-complete performance.56 BPM is a retained practice setting;
the source has only a verbal tempo. Canonical id, easy classification,1.0
suggestion and actual remembered speed are retained, without asserting that
source agreement proves easier physical playing.

The complete prior82-attack/80-beat JSON is byte-preserved internally and is
not declared wrong. No old-edition card, recovery UI, archive HTTP route or
accompaniment reuse is added. All56 other source-song files and ten prior
archives remain byte-identical to36. See `HONGYAN_SCHOOL_EDITION.md` for
source identity, exact adaptation, fingerprints and recovery checks.

A separate bounded source-only review found that the complete Barynya Katyusha
page requires ten pitch classes and has an unresolved finite segno route.
It is not adopted; the existing Katyusha music is unchanged. The result is
scoped to that engraving, not a verdict on all editions or the old73-note path.

## Independent source, automated and server gates

- Independent final aggregate ran17:39:41–17:41:18 UTC:1451/1451 runtime and
  16/16 compiler tests pass, zero failures/skips. All seven optional private
  source-fixture gates actually ran. The source files themselves remain private.
- The Hongyan suite has35 actual-fixture checks; portable execution has34
  passes and one explicit missing-private-fixture skip. It includes14 actual
  structurally importable musical mutations rejected by source expectations,
  nine policy mutations, complete98-tuple comparison and24 clipped bar spans.
  Two cross-bar attacks occur in two span checks each:100 interval comparisons
  are98 attacks, not100 musical onsets.
- Seventeen added production-transport tests cover all98 attacks and full
  ending, the repeated cross-bar tie, selected loops and remembered speed at
  0.35/0.55/1.0/1.4. They test scheduling, not subjective listening.
- Validation:57 records,7459 steps,zero errors,607 review warnings. The warning
  lines are identical to36 and Hongyan adds none. Transcriptions, rhythm,
  arrangement, suitability and syntax gates pass.
- Initial aggregate runs found three stale integration expectations: two
  historical file snapshots and the exact notice-id list. The snapshot tests
  now read the complete old Hongyan archive and omit its new archive from the
  historical inventory; their expected SHA constants and counts are unchanged.
  The notice list now includes Hongyan and asserts its specific disclosure.
  Initial failures remain diagnostic records, not successful gates.
- A fresh313-file baseline-plus-cumulative-patch tree matched the repository
  byte-for-byte and reran the entire portable gate:1444 runtime passes,seven
  explicit private-fixture skips,zero failures, plus16/16 compiler passes.
  An earlier no-fixture repository run and the first clean run exposed the
  same three integration expectations; they are not counted as final passes.
- Generated songs reproduce exactly from source JSON. app.js and song-library.js
  are unchanged from36. The service worker changes only its version string.
- Actual `npm start` bootstrap on its shell loopback returned all22 app-shell
  entries and21 samples with exact final bytes and MIME. The private path and
  new Hongyan archive returned403; final byte hashes were rechecked afterward.
  The reviewer's separate ephemeral official-server check is not substituted
  for this bootstrap or the actual Python-served browser preview.

## Actual own-cloud webpage acceptance

The normal36→37 update control completed without clearing local data. The
library shows98 notes,4/4,56 BPM and the explicit school fixed-beat scope.
The pre-upgrade0.65 speed remains, with an estimated2:39 practice duration.
The canonical link opens the same entry; the source disclosure is readable
and initially collapsed.

A full1.40 demonstration reached示范结束. At0.40, pause held0:19/4:18 across
a later observation and Continue resumed rather than starting over. The
selected33–48-beat loop contains the repeated cross-bar tie. At0.40 its
visible A/B times were1:28/2:09; after1.40 they were0:25/0:37 with the same
beat range. A later observation returned to示范准备3 atA, confirming looping.
Explicit exit, restoring0.65 and reload left loop off at0:00/2:39.

At615×528, document width is615 and all21 key elements fit in x11–604.
Actual Copy Prompt returned6701 characters, exactly its textarea, including
explicit disclosure when a fixed-beat choice adds no fermata time and the
warning against calling nominal beats an exact singing duration. The compiler
skill carries the same decision. Structural import validation cannot infer
source ornament timing or adjudicate the performance choice.

No reference-recording listening, subjective audio approval, physical kalimba
play-through, OS interruption acceptance or rights approval is claimed. Source
scans, complete private fixtures and browser screenshots are not packaged.

Final core SHA-256:
- app.js: e5543e9a23931a4f06ccf441f260bb0d23cf1dd9a86cc947c8c08748d33681bb
- song-library.js: 661add494b898b21045e406cd1d67f759c143069f3783553e9cf92f9c11a53c5
- song-store.js: 5b07abb583397403f1909a6679b18dbd8b8bc41c41879f8ea8209493c6a1c52c
- songs.js: 8fbae138fd7cbf1105931bddd1ad30817693f79c9f32722959ef83e2f0cd5f0b
- Hongyan JSON: 95e5a2d0a7525cb937dc2103980bc324ebbedbc7090354321e6e5a20449df044

Only this verification document is added to the fully tested313-file tree.
The final cumulative patch is applied to another fresh baseline; all314 source
files match the repository and final ZIP byte-for-byte.
