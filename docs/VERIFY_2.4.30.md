# 2.4.30 compiler suitability extent report

## Scope and reproducible checks

- This is a read-only compiler-report clarification, not a playback-duration
 repair. All56 music source records, generated library, archives, samples,
 app/audio runtime, preferences, layout and official server remain frozen29 bytes.
- Legacy `totalBeats`, `gaps`, `signals` and every other existing JSON field
 retain their exact semantics and values. New explicit main/melody/backing
 endpoints, selected-source status/basis and inferred ending gaps are additive.
- Missing source scope uses a labeled main-event fallback. Invalid/shorter
 declarations remain unresolved. Beyond-fallback backing, rest and pickup spans
 are diagnosed without growing the selected extent or inventing source rests.
- The original private proposal passed34/35 on the newer29 library: its old
 seven-tail expectation was stale because Farewell94→96 is now the eighth.
 That expectation was refreshed. Independently discovered pickup omission was
 fixed with V1/V2/fractional/tolerance coverage before production acceptance.
- Frozen actual29 pure inspector serves as the compatibility oracle. Its
 function body and original whole-file SHA provenance were independently checked;
 the new inspector is not compared against itself. All56 current records and
 synthetic cases preserve the old-field projection. No private score is included.
-45/45 new extent tests and legacy suitability pass. Combined extent, existing
 ending and backing-report regressions:98/98. The private design review also
 checked2400 deterministic interval-union cases. Those are report arithmetic
 tests, not claims of source fidelity or acoustic behavior.
- Actual CLI JSON contains56 records and exactly eight inferred endings:
 Jasmine55→56, Confession129→132, Ordinary64→68, Wind77→80, Farewell94→96,
 Daylily191→192, Night129→132, YunYan120→124. Other48 have no ending gap.
- Working and clean baseline-plus-patch aggregates both pass:1069 runtime
 cases,1066 passed and3 explicit optional private source-fixture skips;15
 compiler cases passed, plus standalone and syntax checks. Independent complete
 scripts-plus-compiler gate with all three actual source fixtures:1086/1086,
 zero failures or skips. Public packages omit private source images/fixtures.

## Actual webpage follow-through

- Normal private preview update29→30 succeeded. The actual Copy Prompt returned
 6314 characters exactly equal to the current textarea value. It includes the
 distinction between legacy melody endpoint, omitted ending gaps, source extent
 status and inferred gaps versus source silence/audio tails.
- Returning to Farewell restored.55. Incompatible backing stayed unavailable;
 own-play preparation and pause worked. No new music, control or layout is
 introduced by this phase, so the full29 melody/layout acceptance is retained
 rather than claimed as a new30 whole-song test.
- Browser preview uses existing private Python loopback hosting; official Node
 routes and MIME are tested independently in the clean aggregate. No public
 preview, deployment, push, credential or external upload was used.

See SUITABILITY_TIMELINE_EXTENTS.md for field/status contracts. The compiler
skill and copied import prompt carry the same limits: inferred gaps never prove
all-layer source silence, cut natural PCM/effect tails or approve harmony.
