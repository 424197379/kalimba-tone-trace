# 2.4.25 imported accompaniment label and per-song choice

Local preview only. External auto backing already played through the legacy
button. This stage unifies its explicit imported label, selector and
content-bound per-song choice; it does not claim the old audio route was absent.
No song notes, support arrangements or sample assets are changed.

## Automated and frozen-data acceptance

- Working tree and clean baseline-plus-patch `npm run check`:895 runtime and15
  compiler tests passed, together with existing standalone score/suitability
  scripts, source validator and syntax checks.
- Independent all-test gate:912/912, zero failures or skips. The final extra
  assertions for the actual imported-label prompt also pass19/19 separately.
- All56 music JSON files, generated library, archives, samples and official
  server remain byte-identical to2.4.24. There are still36 built-in practice cards.
- Frozen2.4.24 code generated five exact light-v1 signatures; the committed
  fixture verifies every byte survives this change. Existing light opt-ins do
  not become stale merely from the new selector implementation.
- Real parse/save/library/session regressions cover default-off despite source
  enabledByDefault:true, exact own2/demo6 attacks and gains, no density reduction,
  aliases, provider precedence, content changes, removed source, invalid/mixed
  source, tempo/extent/role mismatch, refresh/off, Continue/loops, storage failure,
  damaged/future-record retention and cross-tab non-hot-switch behavior.
- Formal Node-server tests retain43 shell/sample HTTP/MIME checks and reject
  internal/unlisted archives. No additional file serving capability is added.

## Own-cloud webpage acceptance

Normal24→25 update completed on the private127.0.0.1 loopback preview. Used a
synthetic four-melody/two-support external JSON fixture through the real form;
its source enabledByDefault was deliberately true.

1. Import succeeds as one local practice card. Library and local manager both
   label it 导入伴奏. Entering practice shows 无伴奏, despite the source flag;
   the legacy button is hidden and the selector offers off/imported-auto.
2. Select 导入伴奏; own mode starts with preparation. Pause during preparation
   and Continue work; the short practice reaches its end. Reload restores the
   selected imported choice while returning to ready state.
3. Demo with A–B enabled wraps the short phrase; disabling repeat exits it.
   A separate1.4× demo reaches 示范结束. Off followed by reload remains off.
   Exact note-call counts are the separate production-function assertions above,
   not a browser recording or acoustic measurement.
4. A second actual preview tab inherits on, then changes to off. The first tab
   retains its imported choice; re-entering the song reads off. At observation
   the first tab had already entered the existing long-frame safety pause, so
   this is evidence of choice isolation, not simultaneous uninterrupted two-tab
   audio playback. The running-session case is covered by the runtime tests.
5. Source volume starts at30% when no user gain is saved. The visible volume
   slider is set manually to20%; reload preserves20% and imported-on. No file
   volume, velocity or source density is rewritten.
6. Existing76px selector fully displays 导入伴奏 at875×404 and608×524. No CSS
   change is necessary. Screenshots show the normal single-target keyboard with
   the imported option, not additional physical chord targets.
7. Actual copy button returns5958 characters, including that imported provenance
   does not mean app-reduced density, approved harmony or lowered volume.
8. Delete only the synthetic QA group through the normal confirmation. Local
   count returns tozero; fixture bytes remain outside the package. The extra
   preview tab is closed. Built-in music and other selections are untouched.

The private Python browser preview is not the formal Node server test. Source
fidelity and subjective accompaniment quality are independent of these webpage
checks. No operating-system-specific acceptance is claimed or needed here.
See IMPORTED_BACKING_PREFERENCES.md for the provider/storage contract.

## Final package replay

The final cumulative patch was applied to a new baseline archive and every
one of265 source files compared byte-for-byte. That exact replay, including
the last prompt assertions, passes `npm run check` again:895 runtime +15
compiler tests, both standalone checks, validator and syntax. BUILD-INFO in
the source ZIP records all source hashes. No private score images or QA
fixture uploads are included.
