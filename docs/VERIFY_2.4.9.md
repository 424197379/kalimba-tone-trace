# v2.4.9 local preview verification

## Musical change and limits

《童年》 has two source-supported same-pitch ties corrected: G4 at beat 2
holds 1.5 beats without the former beat-3 retrigger; A4 at beat 5.5 holds one
beat without the former beat-6 retrigger. The genuine A4 attack at beat 6.5
remains. Both actually viewed editions agree on those endpoints. The current
83 attacks become 81, all other 79 tuples and the 64-beat event extent remain.

The sources conflict at beats 9–10 and 15–16. These and the later melody stay
unchanged and pending. This is not full opening/full-song calibration. Tempo
105 remains a historical practice setting, not the GuitarWorld printed 120.
See `CHILDHOOD_OPENING_TIES_2.4.9.md` for URLs, scoped mappings, hashes,
excluded differences and complete historical reconstruction. All historical
V2 source bytes stay unchanged. Its old attack sequence no longer matches,
so the existing content guard prevents borrowing its backing. No new harmony,
physical chord target or version choice is introduced.

## Automated and independent checks

`npm run check`: 333 runtime tests plus 13 compiler-evidence tests pass,
alongside source validation, existing transcription/suitability and syntax
checks. The independent all-script run includes two standalone source tests:
348 checks pass. All 53 generated records equal their source JSON. Comparing
the frozen 2.4.8 archive, only `tong-nian.json` changes among the 53 song files.

Ten source regressions protect exact correction ranges, the old failing
counterexample, 79 unchanged tuples, all 70 attacks from beat 8, conflict spans,
true repetitions, the complete original JSON hash and V2 byte identity. Six
actual-runtime checks play the complete corrected tune at 0.55x/1x and loop
beats [1,8) at 0.35x/0.55x/1x/1.4x with every intended attack once and no
incompatible backing or first-note duplication on wrap.

Internal dry rendering uses the app's 21 recorded note samples with the same
gain and natural tails. At 0.55x and 1x the PCM is identical before beat 3;
the entire difference equals only the two deleted retrigger samples. Both
before/after renders have zero clipped and non-finite samples. This checks
sample scheduling and headroom, not subjective musical quality, reference
performance listening or equivalence to browser audio effects.

The formal Node server test checks 42 app-shell/sample resources over actual
HTTP, correct MIME/nonempty content, the single allowlisted archive and denied
raw/private paths. A private Python loopback browser preview is separate and
is not used as evidence that the release server routes are correct.

## Browser and portable replay

Own-cloud Chromium's normal update action moved 2.4.8 to 2.4.9. The card
shows 81 notes with no borrowed-backing badge. The practice warning remains
expanded and its backing-volume control is disabled. At 0.55x, the actual
[1,8) phrase loop returned to its preparation phase and paused/exited cleanly.
The complete 1x demo reached “示范结束” with loop off and pause disabled. Speed
was restored to 0.55x afterward. Screenshots cover 860×404 and 607×524.
The latter keeps the final E6 key inside the shell at default width.

The real copy button pasted exactly 4,898 prompt characters into the import
textarea, including the new local-evidence rule; the temporary text was
cleared. Stopping the private preview server and reloading the cached practice
page retained 2.4.9, the pending-scope warning and disabled incompatible
backing. The server was restarted; the private preview is left at 待开始.
This is a cloud desktop cached-page check, not a phone PWA installation claim.

The portable patch is replayed from baseline
73041efc803b6c4f16046c8fc0ceaefc08fcc507. The clean tree must pass the same
full check; packaging compares all working/replayed/ZIP source bytes and
records SHA-256 hashes. Branch local/practice-focus has zero new commits.

## Run and remaining limits

Node.js 24/npm, no extra dependencies: `npm start`; `npm run check`.
No push/publication. Raw score images remain private outside the repository.
Reference-recording listening, physical-kalimba playing and installed-phone
PWA upgrade remain unverified. Existing other-song source limits remain.
