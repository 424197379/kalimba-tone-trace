# 2.4.29 Farewell selected teaching edition

Local reversible preview; no push, public deployment or publication.

## Source and scope

- Independent source inspection and blind re-entry agree on all86 attacks,
 24 printed4/4 bars and96 quarter beats. Uniform E-flat→C(-3 semitones) retains
 B3–C5 without local folding. The final written8 bars are included once.
- Six two-beat single-voice source rests start at14,30,46,62,78,94. Last C4@92/2
 ends at94; the selected extent remains96. True adjacent repeats are retained.
- 70 BPM/easy are editorial practice choices, not printed tempo or proof of
 physical ease. Prior58/64 is a different edition, not retrospectively wrong.
 See FAREWELL_TEACHING_EDITION.md for source identities and limits.
- Only Farewell V1 changes among56 source records. Its complete old bytes are
 preserved internally with SHA31042a1c640d60dbf2cabfd880aa451d6d2f142916c169fa5bc5eabca19c0a26.
 V2, all other music, app/audio runtime, preferences, original samples, formal
 server and existing archives are unchanged. Old backing is incompatible.

## Automated acceptance

- Source-focused public tests25 passed plus one explicit private-evidence skip;
 with FAREWELL_SOURCE_EVIDENCE_PATH the complete26 passed, no skips.
- Shared integration108/108; actual production session/render regressions18/18,
 including four speeds, complete86 attacks, true repeated tones, loops and
 all six rests. These use healthy frame trajectories, not an acoustic recording.
- The first full gate found two old-edition test expectations: Farewell still
 appeared in the warning-expansion list, and a report test expected the former
 scoped melody-only rest claim. The former record is now tested from its exact
 archive; the current edition has an additional six-rest/96-beat report check.
 Both fixes plus related checks passed49/49. No production music was changed
 to satisfy those old expectations.
- Validator56 records/7180 steps/zero errors/606 review hints. One new legacy
 heuristic hint uses the94-beat sounding endpoint instead of the declared96
 source extent. All24 source bars balance; this hint is not fixed by stretching
 the last note. Generic report/validator semantics are a separate task.
- Working and clean baseline-plus-patch aggregate both passed:1024 runtime
 cases,1021 passed and3 explicit optional private-source skips;15 compiler
 cases passed, plus standalone and syntax checks. Independent all-scripts-plus-compiler gate
 with all three actual private source fixtures:1041/1041 passed,zero failures
 or skips. The public archive intentionally omits those private source files.

## Actual own-cloud webpage acceptance

- Normal update control visibly completed2.4.28→2.4.29. The single Farewell card
 shows《送别》（教学版）,86 notes,4/4,70 BPM, and the source/transpose/rest scope.
 No old-edition restoration control or extra card appears.
- First opening used.55 with no incompatible backing selector. A full1.4 demo
 ran from preparation to `示范结束`, including the added final written section.
 At0:59/1:00 its board and key highlights were clear in the ending silence.
 This is webpage progression, not a reference-recording or per-note acoustic
 measurement. Exact events are covered by the source/session tests.
- At.55, actual pause froze0:17/2:31 and Continue displayed fresh preparation.
 The optional loop was adjusted through keyboard Home; at1.4 it repeatedly
 returned inside A0:00/B0:15. Explicit exit, pause, refresh restored1.4 with
 loop off. Own-play preparation and pause worked. Preview left ready at.55.
- Resize during playback retained position and mapping. Actual screenshots are
 877×405 wide and609×525 compact. A coordinate action immediately following
 resize reported an outdated viewport bound; a fresh screenshot established
 the new viewport and normal supported input then succeeded.
- Actual Copy Prompt returned6212 characters, exactly equal to the textarea's
 current value, including complete separately printed return-section guidance.
- Interactive preview uses private Python loopback hosting. It does not stand
 in for official Node server routes: the formal HTTP/MIME/archive rejection
 test remains part of the aggregate gate. No public URL was created.

No subjective listening approval or physical-instrument guarantee is inferred
from these source, automated and webpage checks.
