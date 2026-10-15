# 2.4.33 daily selection and import recovery

## Actual baseline findings

Own-cloud2.4.32 webpage reproduced all three targeted issues:

1. Difficulty 困难 then query 生日快乐 displayed0/1 and “没有找到匹配的歌曲”.
   The easy song existed but was hidden by the retained difficulty selection.
2. A valid first score and C#4 in score2 produced only an event-local location,
   without song identity. The1410-character original input and zero-song library
   were correctly preserved; this transactional behavior is not a new fix.
3. A corrected successful import added 流程验收甲 but kept the prior 小星星
   URL-selected card accented. Local manager offered only Delete; the actual
   practice button was at the end of37 cards.

## Bounded implementation

Filtered empty state explains the selected difficulty and provides one action
that preserves search text, clears difficulty and restores search-field focus.
Local practice-ready rows add direct practice. Intentional selections/imports
synchronize canonical selection, existing history URL and current-tab state,
while initial explicit links remain authoritative. No automatic playback,
practice-history write, reordering or new chord target is introduced.

Multi-song errors retain the original reason plus source-entry ordinal and a
bounded single-line title; singleton/wrapper errors and atomic parse/save remain.
Busy UI describes checking the score rather than remote AI. Skill/schema and
actual external prompt explain preserving the original batch and its input-song ordinals.

Independent review caught a first-integration regression: deleting only a stale
stored song also changed an unrelated explicit URL selection. Separate branches
now preserve the current valid choice; permanent production-function tests cover
both active deletion and stale-storage deletion. Filter-button focus restoration
was also added after review.

All57 music JSONs, generated songs, playback/audio runtime, preferences, archives,
samples and official server are frozen against32. Detailed behavior and tests:
LIBRARY_FLOW_RECOVERY.md and IMPORT_BATCH_CONTEXT.md.

## Final validation

Working tree and clean baseline-plus-patch replay both passed `npm run check`:
1167 runtime tests:1163 passed,4 optional private-source tests skipped;15 compiler
tests passed. Independent all-script review enabled all four private fixtures:
1184/1184 passed,zero skips. Formal server HTTP/MIME and archive access checks
are included; the interactive preview below uses the existing private Python
server and is not substituted for those official Node server checks.

Own-cloud Chromium, normal32→33 update on localhost8131, verified:
- Hard filter plus birthday search displays the precise reason and recovery
  action. Recovery retains the query, selects All and focuses the search field.
- Selecting Birthday and browser Back highlights Birthday instead of the prior
  URL selection. An immediate same-call navigation/back attempt hit a tool
  attachment race; rebinding and observing navigation before Back succeeded.
- The actual copied prompt is6457 characters, equals the visible prompt value,
  and includes the new batch recovery guidance.
- Failed two-song batch identifies input song2, title流程验收丁, event/note and
  C#4 reason. All1776 input characters and the existing one-song local library
  remain. Correcting that same batch adds both songs, clears input, selects the
  first newly imported song and reports three local songs.
- Local manager direct Practice opens流程验收丁. Imported backing starts off;
  choosing it, starting own-play, pausing and refreshing retains the selection
  and0.55 speed. Browser Back selects丁 correctly. Audio scheduler behavior is
  covered by the existing permanent2/6-event tests; this UI check is not a new
  waveform or subjective listening measurement.
- All three temporary QA songs were deleted through their named confirmation
  dialogs. The library returned to the36 built-in practice choices and Birthday
  selection. Compact recovery layout was captured at the actual browser size.

No operating-system interruption testing or new source-music approval is claimed.
Final portable archive and cumulative patch are byte-compared against this tree
and a fresh baseline replay; private source images/fixtures are excluded.
