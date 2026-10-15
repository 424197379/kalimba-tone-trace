# 2.4.36 complete Qingcheng vocal and content-bound deletion

Private own-cloud preview only. No new commit, push, publication or deployment.

## Selected musical scope

The canonical Qingcheng entry deliberately selects the fixed ROLLINS image
labelled 鞠婧祎版: its complete lyric-bearing m6–35, 30 bars of 4/4, 196 attacks
and 120 quarter beats. Two independent blind readers agreed on every tuple
before adoption; integration and release reviewers also viewed actual pixels.
These are independent readings of one image, not two published sources. The
host catalog names another singer; it is not combined with the image's identity.

The printed 82 BPM and literal C-major G3–D5 register are retained, with no
transposition, octave folding or inferred melody voice. Sixteen adjacent
same-pitch attack pairs remain separate, including C4 at117.5/.5 and118/2.
Five unmeasured G4 graces are explicitly omitted before the E4 quarters at
beats35,59,83,99,115, without stealing principal time. The selected vocal line
has no written rests or same-pitch ties. Five intro and five outro instrumental
bars are omitted; no recording-wide completeness is claimed.

The full earlier116-attack/72-beat file is byte-preserved internally, not
pronounced wrong, offered through a recovery UI or used for backing. All56 other
source-song files and nine older archives remain unchanged. Canonical id,
medium difficulty and0.9 suggestion remain; the user's actual saved speed is
not forced. The longer selected line does not itself establish easier playing.
See `QINGCHENG_REVIEWED_VOCAL.md` for source fingerprints and adaptation limits.

## Reproduced data-loss problem and fix

In actual foreground own-cloud Chromium35, tab A displayed a confirmation to
delete synthetic QA旧谱. Tab B deleted that score and reimported different
content under the same requested id. Even after A's background list visibly
showed QA新谱须保留, confirming its old dialog deleted the replacement.

The fix binds confirmation to the complete raw group represented by the
already-rendered list, including metadata, backing, unknown same-group records
and all versions. It compares that snapshot with one strict latest read inside
the existing Web Lock, before any write. Object-key and top-level record order
are not content changes; array order within a record is. Unrelated groups do
not invalidate permission. Only readable confirmed records are removed;
unknown records are preserved. Passive refresh invalidates an obsolete dialog,
and an old asynchronous result does not dismiss a later dialog.

Content-identical delete/reimport (ABA) is intentionally indistinguishable
without persistent generations; no storage schema or key migration is added.
All old tabs must be refreshed. New code cannot protect a still-running35 page
or an external writer that does not follow the lock protocol.

## Automated and server verification

- Independent frozen aggregate:1399/1399 runtime and16/16 compiler checks pass,
  zero failures/skips, with all six optional private-fixture gates actually run.
- The aggregate includes39 Qingcheng source tests,27 meaningful musical negative
  controls,41 stale-confirmation cases and17 production transport cases covering
  all196 attacks, source ending, selected loops at four speeds and speed memory.
- Frozen35 against the same deletion suite:8 pass/33 fail. Four ID-reuse cases
  directly reproduce replacement loss. Several other failures concern newly
  visible warnings or snapshot accessors; they are not33 distinct deletion bugs.
- Validator:57 records,7443 steps,zero errors,607 existing review warnings.
  Transcription, rhythm, arrangement, suitability and syntax gates pass.
- After independent review, one inaccurate library comment was corrected; the
  reviewer proved it was the only source-line change and behavior was identical.
  The final deletion/concurrency/recovery recheck passed80/80. The final portable
  tree was byte-matched to all309 pre-verification repository files and reran the
  complete gate:1393 passes,6 explicit private-fixture skips,zero failures, plus
  16/16 compiler checks. Missing private fixtures are not source-review passes.
- Earlier13 new Qingcheng session failures were a known integration state before
  rebuilding the generated module; all17 now pass. An interrupted duplicate
  runtime is not counted. Historical expected hashes were preserved, with old
  Qingcheng bytes read from the archive rather than refreshing expectations.
- Actual npm start bootstrap on its own shell loopback server returned all22
  app-shell entries and21 samples with exact final repository bytes and MIME.
  Private routes and the new Qingcheng archive returned403. The initial private
  probe wrongly expected one extra word in the server banner; correcting that
  probe required no server change, and the complete final-byte gate passed.
  The independent ephemeral-server check and Python browser preview are separate.

## Actual own-cloud webpage acceptance

Both test tabs visibly loaded36 before repeating the exact stale-confirmation
scenario. The old dialog was removed, the replacement remained, and the visible
message required checking the list before reconfirming. The unpublished draft
and search text survived. The remaining E4 test score opened successfully in
practice. A fresh confirmation naming the new score then deleted it normally;
local count returned to zero. All test records were synthetic.

The no-storage-event commit-time guard is covered by real production-handler
regressions, not by browser-internal mutation. Browser checks used ordinary
visible controls without DevTools or injected application state.

The library shows one named Qingcheng edition with196 notes,4/4,82 BPM and the
scope disclosure. Its pre-upgrade0.65 speed remains, showing approximately2:16.
A full1.4 demonstration reached示范结束. At0.40, pause held the visible0:09
position across a later observation; Continue resumed from there. A selected
loop retained its beat range through0.40→1.40, changing displayed A/B times from
about0:25/0:39 to0:07/0:11 and returning to preparation on later passes. Explicit
exit and reload retained0.65 and loop-off on the canonical URL.

The settled615×528 viewport has document width615; all21 keys fit in x11–604.
The long title is compactly truncated while the source disclosure is accessible.
Actual Copy Prompt returned6642 characters, exactly its textarea, including
both the image/catalog identity rule and the existing no-silent-ornament rule.
The compiler skill carries the same source-identity decision. No parser can
establish a score image's correct singer, pitch, voice or ornament realization.

The extra test tab was closed; the own-cloud preview remains Qingcheng ready
at0.65 with loop off. No reference-recording listening, subjective sound approval,
physical kalimba play, OS interruption acceptance or publication-rights approval
is claimed. Source scans and complete private fixtures are excluded from the
portable package.

Final core hashes:
- app.js: e5543e9a23931a4f06ccf441f260bb0d23cf1dd9a86cc947c8c08748d33681bb
- song-library.js: 661add494b898b21045e406cd1d67f759c143069f3783553e9cf92f9c11a53c5
- song-store.js: a75666cf5dc716ad2334a96670d7941aa65242d0434defb4bb77a5eb232e7579
- songs.js: a44a7cf29ed529514bcd722178aef60417f0393c92572700ad8c9dc09d201b9a
- Qingcheng JSON: ff38de1b61a7b8933f825565ce3fb42ecd0c1e63c0b9ea916c0ee9383aad8e31

The final cumulative patch is check-applied to another fresh baseline; all310
source files match the working repository and ZIP byte-for-byte. Only this
verification document is additional to the fully tested309-file portable tree.
