# 2.4.26 Summer selected first theme

Local preview only. The selected EOP C-major piano upper staff m8–23 contains
61 attacks, 16 bars of 2/4, and 32 quarter-note beats at printed 96 BPM.
Seven ties and five melody-only rests are preserved. The older 68-attack edition
is internally archived byte-for-byte; this adoption does not prove it wrong.
The 0.4 score suggestion is separate from actual first-visit or saved speed.

## Automated and frozen-data acceptance

- Working tree and clean baseline-plus-patch `npm run check`: 931 runtime cases,
  930 passed and one explicitly skipped optional private source-fixture case;
  15 compiler checks passed, plus standalone score/suitability and syntax checks.
- Independent full gate with `SUMMER_SOURCE_EVIDENCE_PATH` pointing to the actual
  privately inspected source fixture: 948/948 passed, zero failures or skips.
  Dedicated source cases with that fixture: 19/19. The public archive deliberately
  excludes source scans and private transcription evidence; its optional case
  therefore reports a skip rather than claiming source inspection occurred.
- Validator: 56 records, 7047 steps, zero errors, 604 existing review notices.
- All 61 tuples equal the independently read selected source. Old 68-attack edition archived byte-for-byte,
  seven ties, independent repeated notes, five rests, 32-beat extent, genuine A5
  ledger-line correction and actual parser/history restoration have regressions.
- Actual production session/render harness covers full melody at .35/.4/.55/1/1.4,
  opening and ending loops, long ties and rest highlight clearing. These are
  healthy frame trajectories, not a claim of strict browser cadence measurement.
- Other 55 source JSON records, app runtime, preferences, official server, previous
  archives and all sample assets remain unchanged from 2.4.25. Generated library
  matches all 56 source records; 36 canonical practice cards remain.
- Formal Node server tests verify 43 shell/sample HTTP resources and MIME types;
  the new internal Summer archive is explicitly refused, without widening routes.

## Own-cloud webpage acceptance

Normal 25→26 update completed in the private 127.0.0.1 preview. The card shows
61 notes, 96 BPM, 2/4, medium editorial difficulty and the selected first-theme
scope. Initial .55 remained separate from the .4 suggestion.

- Chose .40 through the visible speed slider; preparation appeared, demo advanced,
  Pause froze it and Continue showed preparation. A–B repeatedly returned from
  approximately 0:11 to 0:02; exit disabled looping. Reload retained .40 and loop off.
- A full 1.4x demo reached “示范结束”; later own-play and pause showed the falling
  melody. No new backing option appeared. This is UI/playback acceptance, not a
  reference-recording comparison or physical-instrument listening verdict.
- A manually chosen .65 survived reload, overriding the .4 score suggestion;
  restored .40 for the private preview afterward. The score-speed button is hidden
  by existing responsive CSS in these layouts, so its real click was not claimed;
  its actual application function is separately tested.
- Expanded source notice and controls checked at actual screenshot sizes 877×405
  and 609×525. Compact title truncates visually while its accessible title and
  source notice retain the selected-theme name. All 21 keys remain visible.
- Actual copy button returned 6027 characters, including the new time-unit and
  complete-theme comparison rule and existing tie/triplet/voice-rest safeguards.
- Browser used the private Python preview. It is not substituted for formal
  `npm start` resource acceptance: the separate Node HTTP/MIME gate covers that.

## Delivery boundaries

No source score images, private full transcriptions, QA browser storage or external
credentials are packaged. No push, deployment or public publication occurred.
The theme's fastest sixteenth notes still require slow practice; a smaller attack
count or changed beat unit does not establish easier physical playing. Source
selection, musical reading evidence and UI acceptance are distinguished.
