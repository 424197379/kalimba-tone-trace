# 2.4.45 — Keep narrow practice controls reachable

Own-cloud local preview; no new commit, push or public deployment. Previous44
source and patch remain separately frozen.

## User-visible change

Narrow compact practice views now give the title, Pause and Change Song their
own row, with Own-play, Demo, speed and available backing beneath it. Very short
views also reduce key-area height and progress spacing to retain falling-note
space. All21 keys, note labels, octave dots, loop handles and source notices
remain; wider layout and player behavior are unchanged. See
`COMPACT_CONTROL_LAYOUT.md` for exact thresholds and limitations.

This is a CSS-only functional change. The player, all57 song files, generated
songs,13 internal archives,21 MP3s, importer, AI prompt and compiler skill remain
unchanged from44. Version holders and explanatory documents are updated;
Service Worker changes version/comment only, not its cache strategy.

## Actual browser evidence

Original44 at ordinary150% browser zoom (410×352 CSS pixels), Birthday with
light backing: the Change Song center hit Own-play. At175% (351×302), Pause and
Change Song centers hit Own-play and Demo. The document did not overflow
horizontally, demonstrating why width alone was an inadequate check.

Actual45 normal update44→45 retained36 cards, empty raw input and zero local test
songs. At615×528 the old single-row layout remains. At410×352 the corrected
Birthday controls have distinct rectangles and all centers hit their own control;
the falling area is90.41pixels. Demo reached its normal ending. A new loop played,
paused at4, stayed paused at4 after resizing to307×264, retained loop and position
through a paused speed change, then continued after preparation to active5.

At307×264, Birthday and a newly imported synthetic16-note score with its explicit
imported backing each have50pixels of falling area,21 keys fully in view, and
reachable controls. The synthetic import was saved through the normal UI,
practiced with imported backing to normal Demo completion, then deleted through
its named confirmation. Afterwards36 built-ins,zero local test songs and empty
raw input were confirmed.

Shengshengman's normally closed summary and Juebie's manually closed warning
leave24pixels of falling area at that very small viewport; all21 keys are visible.
Juebie Demo was observed active at41, then explicitly paused at41. These are
limited functional observations, not equivalent readability or physical playing
comfort to a larger window. No subjective sound approval is claimed.

### Preserved failed/limited cases

The toolbar-only candidate left2pixels of falling space at307×264 and was not
accepted. The additional short-height rules address that loss for the tested
closed/no-notice cases.

Juebie's long default-open warning still leaves no falling area and clips key
bottoms at307×264. A controlled comparison with identical synthetic notes and the
full production notice shows frozen44 CSS also fails (key bottom297.84 versus
candidate277.84,both beyond264). Expanded notices at351×302 and410×352 are counted
only as readable disclosure and reachable controls, not normal playing acceptance.
The full warning remains default-open; users can read and close it, or zoom out.
No warning text, font or default-open policy is weakened to manufacture a pass.

Software rotation rules have matching static placement and swapped viewport-unit
checks but no new actual portrait-rendering acceptance. Browser zoom observations
are not represented as phone or touchscreen testing. The viewports tested are
specific samples, not an every-size guarantee.

Temporary app copies used full unchanged player/store code and clearly synthetic
notes only. They were closed and removed from the repository before the gates.
One intermediate ordinary reload retained old root-worker-cached test CSS; it was
not counted as the changed-style result. The test HTML then referenced a newly
named static stylesheet, whose computed rules were observed. No production cache
strategy change, storage/runtime injection, protected-content copy or DevTools
was used. Final normal page is Shengshengman0.65x,loopoff,progress0,stopped.

## Reproducible checks

- Independent complete offline check:1847 runtime and16 compiler passes,
 zero failures or skips; all nine actual private source-fixture checks ran.
 All336 frozen source files and private fixture hashes remained unchanged.
- Clean cumulative baseline replay:1838 runtime passes,nine explicit missing
 private-source skips,zero failures;16 compiler passes. The omitted private
 images/fixtures are not distributed and their skipped checks are not source
 image verification. CI introduced no extra skip.
- Validator57 records/7633 steps,zero errors and607 existing warnings;
 transcription,suitability and syntax stages complete. Existing161 focused
 independent regressions also pass; no new test count is substituted for actual
 rendering evidence.
- Twelve read-only browser geometry records were independently reconciled,
 including toolbar rectangle overlap, hit targets and preserved failed cases.
 Static scope review confirms backing hidden guards and player/music bytes are
 unchanged. Source review status does not increase in this layout release.
- npm uses process-only CI/offline/notifier/audit/fund settings; no persistent
 configuration changes or unrelated registry request are required.

The real `npm start` entry was separately started in the own-cloud sandbox. It
retains the existing0.0.0.0:8123 listener; requests were made to127.0.0.1 and no
public tunnel or deployment was created. All22 app-shell URL entries and21 samples
returned200 with expected MIME and exact bytes. Private paths and the internal
Shengshengman archive returned403. This is separate from the browser preview.

## Delivery

336 files passed complete gates; only this note was added afterwards, yielding337
delivered files. The final tree, ZIP, fresh cumulative-patch replay from
73041efc803b6c4f16046c8fc0ceaefc08fcc507 and independent replay match byte for byte.
Source images, private fixtures, temporary QA copies and browser diagnostics are
excluded. Final hashes are retained with the delivery artifacts. No old-edition
restoration control is introduced.
