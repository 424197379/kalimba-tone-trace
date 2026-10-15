# 2.4.35 Rowing textbook edition and progress seeking

Private own-cloud preview only. No new commit, push, publication or deployment.

## Music adoption and source boundary

- The selected textbook principal line has63 attacks,30 printed2/4 bars and60
  quarter beats. Independent blind readers agreed on every pitch/onset/duration
  before adoption; the integration owner and release reviewer also inspected
  actual page pixels. See ROWING_TEXTBOOK_EDITION.md for source identities.
- Uniform Eb→C(-3 semitones) preserves A3–C5. Three ties, genuine repeats and
  four written rests survive. One unmeasured grace note is explicitly omitted
  without stealing principal time; lower chorus voice and lyric-driven repeats
  are not added.96 BPM and0.9 suggestion are practice choices.
- The old unavailable Qupu edition is not declared wrong. Its complete file is
  byte-preserved in an internal archive, without a user restoration control,
  extra card, public-server route or borrowed backing. Canonical id and saved
  speed remain. All56 other source-song files are byte-identical to34.
- Actual copied AI prompt and compiler skill now distinguish measured small
  notes from nonmetric ornaments. Omission needs an explicit edition decision,
  source-location disclosure and unchanged principal timing. The importer
  cannot identify invented but structurally valid musical data.

## Reproduced seeking problem and bounded fix

In foreground own-cloud Chromium2.4.34, Birthday at0.55 with light accompaniment
falsely paused during a one-second stationary progress hold near15.285% of the
track, just before backing beat4. The same foreground own-play hold with
backing off stayed running. Controlled production-function tests reproduce the
causal problem with healthy20ms frames in own-play and demo: backing is
intentionally suppressed during the drag but was treated as a missed onset.

The fix exempts only that intentional backing suppression, retires elapsed
suppressed backing at healthy checkpoints and release/cancel/control cleanup,
and never bursts old backing after release. Exact current onsets remain
eligible for immediate release. Melody delivery, real melody/backing stalls,
audio deadlines, lifecycle freezing and exclusive loop B remain protected.

The new48-case suite passes. The frozen34 app fails30 of those cases;18 pass.
Some off-mode cases fail only the new consumed-suppressed-onset assertion, not
because old backing-off practice falsely stalls. Real source/body and simulated
clock checks do not establish acoustic or physical-instrument quality.

## Automated verification

- Rowing source-specific public gate:46 pass plus one clearly disclosed private
  fixture skip. With the actual independent pre-adoption fixture:47/47 pass.
- Thirteen production session checks cover all63 attacks, source ending, ties,
  repeated notes, rest-aware loops at four speeds and canonical speed memory.
- Four stale integration expectations were repaired after the first aggregate:
  two historical full-file manifests now read the exact old archive, the
  source-bounded song list includes Rowing60/60, and the disclosure list includes
  the new explicit scope. No historical expected hash was refreshed.
- The first new speed-memory fixture accidentally used a helper that forces1x;
  it was corrected to the ordinary initial-selection harness. Production speed
  behavior was unchanged. Apparent full-session hangs were slow~90s execution;
  two early duplicate runs were interrupted and are not counted as passes.
- Validator:57 source records,7363 steps,zero errors,607 existing review warnings.
  Rhythm, arrangement and suitability reports complete with source/rest limits.
- Real npm start bootstrap was exercised in its own shell HTTP environment:
  all22 app-shell entries and21 samples return exact repository bytes and
  expected MIME; private paths and the new Rowing archive return403. Browser
  preview remains private Python loopback hosting and does not replace this gate.

Final independent aggregate completed1302/1302 runtime and16/16 compiler
checks,zero failures/skips, with all five actual private fixtures enabled.
All standalone validation/transcription/suitability/syntax gates pass. The
portable clean baseline-plus-patch replay completed1302 runtime checks:
1297 passed,five explicit optional-private-fixture skips,zero failures;16/16
compiler checks and all standalone/syntax gates pass. Those source fixtures
are intentionally excluded from the portable package. The final documentation
record was added after that run; all tested runtime/test bytes remain identical.

## Actual own-cloud webpage acceptance

- Normal update control completed34→35, and a final same-version service-worker
  review comment refreshed the rebuilt source-metadata spacing. Cache strategy
  is unchanged. New controlled browser tabs initially opened behind an old
  library tab; background-induced stalls were excluded from foreground results.
- Foreground35 Birthday/light stationary hold continued in both own-play and
  demo. This repeats the formerly failing34 action at the same position/speed.
- Library shows one《让我们荡起双桨》（教材版）card with63 notes,2/4,96 BPM,
  approximately1:09 at.55 and the explicit grace/transposition/source scope.
  Practice has no backing selector or old-edition recovery control.
- Full1.4x demonstration reached示范结束. At.40, pause froze the displayed
  position and Continue showed fresh preparation at that same position.
- A/B loop retained its section during a.40→1.40 speed change and repeatedly
  returned to preparation within A0:04/B0:08. Explicit exit and refresh left
  loop off while preserving1.40 speed and the canonical textbook selection.
- Settled compact615×528 layout keeps all21 keys and controls within the viewport
  (key row x11–604; document width615), with no horizontal overflow.
- Actual Copy Prompt returned6596 characters, exactly matching its textarea,
  including both no-guessed-grace-timing and no-silent-omission rules. Preview
  was returned to the canonical textbook page, ready at.55 with loop off.

Reference-recording listening, subjective approval, physical kalimba playing,
OS interruption tests and publication rights remain unverified. Source images
and full private fixtures are excluded from the delivered portable files.

Final reviewed runtime/source hashes:
- src/app.js: e5543e9a23931a4f06ccf441f260bb0d23cf1dd9a86cc947c8c08748d33681bb
- src/songs.js: ee75dacb748068df4c0a9c3e9104d23b4265ae5c9aab1be6bbdf45027b5497cb
- Rowing source JSON: 9ddf1f6ac8a1c28fc412a7df61899877d0b65b002c80ee5f0a7259a6e68e9640

The final cumulative baseline patch is check-applied to another fresh baseline;
all305 source files match the repository and ZIP byte-for-byte. Only this
verification document differs from the already fully tested portable replay.
