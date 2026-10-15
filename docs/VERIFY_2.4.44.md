# 2.4.44 — Pause at Change Song intent

Own-cloud local preview; no new commit, push or public deployment. Previous43
source and patch remain separately frozen.

## User-visible fix

The Change Song callback now calls the existing pause operation before assigning
the library URL. Slow, failed or cancelled navigation no longer leaves the old
transport running or a pending playback request able to activate. If the original
page remains, its paused position, mode, speed and loop remain available for an
explicit prepared Continue. Existing count-in clamping and short audio fade/stop
semantics are preserved; this is not a zero-millisecond acoustic-cutoff claim.
A browser fullscreen request can still finish, but its stale playback continuation
cannot start old audio. See `NAVIGATION_PAUSE.md`.

The only player change is this call with explanatory comments. All57 song files,
generated song data,13 internal archives and21 MP3s are unchanged from43. No melody,
backing, importer, AI prompt or compiler-skill change is made. The production
Service Worker changes its version/comment only, not its cache strategy.

## Real browser evidence

A controlled own-cloud app copy contains the complete unchanged43 player and a
clearly synthetic repeated-note sequence. Only its test request layer delays the
library navigation response20seconds. After clicking actual Change Song, the old
page still showed the browser loading indicator while Demo advanced0:19→0:29 and
notes moved. This establishes active-transport behavior; no subjective audition or
claim of a naturally occurring outage is made.

A fresh comparison scope uses the exact fixed44 player with the same synthetic
data and delay. At position8, Change Song immediately shows Continue and freezes
the page. Stopping the pending browser navigation leaves position8,loopA0/B
115.68181818181817seconds and0.55x unchanged. After more than20seconds the same
values remain; explicit Continue then advances to17 with Demo active. An earlier
count-in leave also pauses immediately and eventually reaches the library.

Background-tab frame-stall trials and an incomplete update in the intentionally
slow QA scope are excluded from passing observations. Both temporary app copies
were retained privately and removed from the repository, and their tabs closed.
No protected source material, runtime/storage injection, production cache-strategy
change or browser-security bypass was used.

Normal production43→44 update completed through the visible refresh button.
All36 cards, empty raw input and zero local test songs remained. Birthday Demo
at0.55x with its existing light backing reached position6; own-play then Change
Song reached the correct selected library. At the observed narrow library width,
clientWidth=scrollWidth=600. Final normal page is Shengshengman0.65x,loopoff,
progress0,stopped,no backing. Promise-order edge cases below are model checks,
not claimed as every one having been forced in the real browser.

## Reproducible checks

-111 new current-production function regressions pass. The identical suite against
 untouched43 gives17 existing-control passes and94 expected navigation failures.
 Coverage includes the pre-URL boundary, pending audio/fullscreen/Continue results,
 stale note/RAF work, failed navigation, preserved loop/speed/position, lifecycle
 idempotence and explicit recovery. Complete current note continuations still
 reach their audio endpoints.
- Independent final offline `npm run check`:1847 runtime and16 compiler passes,
 zero failures/skips; all nine actual private source-fixture checks ran. All334
 tested source files and fixture hashes remain unchanged across that run.
- Fresh clean baseline replay:1838 runtime passes,nine explicit missing-private
 source skips,zero failures;16 compiler passes. Private source images/fixtures
 are intentionally not distributed; skips are not source-image verification.
- Validator57 records/7633 steps,zero errors and607 existing warnings;
 transcription,suitability and syntax stages complete.
- Initial aggregate runs exposed one old isolated draft-navigation harness missing
 the new pause dependency. It now provides a named pause spy and asserts one call,
 keeping the real callback/binding and every draft/selection assertion. The full
 transport is covered separately. Those failed runs are preserved,not counted as
 success; the170-test draft/navigation integration then passes.
- npm runs use process-only CI/offline/notifier/audit/fund settings to avoid
 unrelated registry traffic; no persistent configuration or network change.

The actual `npm start` server was separately started and queried in the shell.
All22 app-shell URL entries and21 samples returned200 with correct MIME and exact
bytes. Private documents and the internal Shengshengman archive remained403.
This is distinct from the controlled browser preview.

## Delivery

334 files passed the complete final gates; only this verification note was added
subsequently, producing335 delivered files. A fresh cumulative-patch replay from
73041efc803b6c4f16046c8fc0ceaefc08fcc507, independent baseline replay, final source
tree and ZIP match byte for byte. The package excludes source images,private
fixtures,temporary QA app copies and browser diagnostics. Final hashes are stored
alongside the private delivery. No old-edition restoration control is introduced.
