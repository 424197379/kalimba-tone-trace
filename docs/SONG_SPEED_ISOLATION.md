# Per-song saved-speed isolation

## User behavior

Explicit speed changes now save only the current canonical practice song. A
different practice page saving a different song cannot replace that choice by
writing an older shared map. The library listens for these per-song changes and
updates its duration estimates. An already-running practice page keeps its own
current speed until an explicit change or reload, as before.

Previously saved speeds still load without asking the user to re-enter them.
Loading a song or browsing the library performs no migration writes. The first
explicit speed change for that song creates its new record, retaining the entire
legacy document unchanged. Supported speeds remain0.35–1.40 in0.05 steps, with
only normal floating-point error tolerated. Starting with the overnight candidate after 2.4.49, first use defaults to 1.00 and the slider’s 1.0 marker explicitly restores normal speed. Existing valid per-song choices still win; song editorial recommendations are retained in music data but no longer drive a conflicting default-speed button.

After upgrading to2.4.46, refresh every old practice and library page. Updating
one tab does not replace the code in the others. Old code can only read/write the
old map and will not see new per-song choices. Once a new record exists, a later
old-page change to that song does not supersede it. This is an explicit mixed-code
compatibility boundary, not a timestamp-based reconciliation.

## Why separate keys

The former speed map was read, merged, written and read back synchronously.
Sequential saves, including from stale tabs, were safe. However, independent
document agents could read the same map, each successfully write it, and the
later map could undo another song's already-confirmed update. Readback alone
does not make that sequence transactional.

The [WHATWG Web Storage introduction](https://html.spec.whatwg.org/multipage/webstorage.html#introduction-16)
warns that cross-agent-cluster interaction has no specified locking guarantee and
illustrates a two-window read/modify/write conflict. A deterministic independent-
agent model reproduced this lost update using unchanged2.4.45 functions and
atomic individual storage calls. This is algorithmic evidence, not an observed
Chromium race or a measured failure frequency. Two ordinary sequential UI changes
do not by themselves reproduce the race.

The same independent-agent operation order with the current functions preserves
both songs, for first saves with or without a legacy map and for existing new
records. The model also confirms the unchanged same-song boundary below.

## Storage contract

- The legacy `kalimba-song-speed-v1` document is read-only to the new code.
- A new key is `kalimba-song-speed-v2:` followed by `encodeURIComponent` of the
  exact canonical practice ID. There is no shared writable index.
- Its envelope is `{ "schemaVersion": 2, "record": { "speed": 0.8 } }`.
  The nested record preserves legacy metadata even if that metadata itself has
  fields named `schemaVersion` or `record`. Unknown envelope and nested fields
  survive later valid saves.
- A present valid new envelope is authoritative, without reading legacy storage.
  Only an absent new key permits legacy fallback. A malformed, future-version,
  metadata-only or invalid-speed new record produces an error; it is neither
  overwritten nor bypassed by an older value.
- If there is no new record, existing legacy document/selected-record validation
  still applies. Damaged or unknown legacy data blocks the first new save and is
  retained. A valid legacy metadata-only target can receive its first speed.
- Saves write and read back only the selected key. Denied storage, quota failures
  and readback mismatch cannot claim success. The current session adjustment
  remains usable with the existing error message.
- Valid encoded IDs remain distinct, including prototype-like names, separators
  and Unicode. Unencodable lone-surrogate IDs fail safely without writes; this
  does not assert support for every arbitrary legacy string ID.
- Repeated saves replace one slot. Growth is bounded by distinct explicitly saved
  song IDs, not by save count or a fixed global maximum. Deleted imported IDs may
  leave preference slots, as they could leave entries in the legacy map. No
  cleanup, deletion, enumeration or bulk conversion is introduced here.

## Boundaries

Two pages intentionally saving the **same** song still have last-write behavior;
there is no cross-page merge of competing speed choices or metadata. The new
format does not make all preferences transactional. Recently-practiced ordering
still uses its existing shared history map and retains the same independent-agent
overlap limitation. That lower-impact sorting issue is separate from saved speed
and cannot overwrite saved music.

Music data, imported-song storage, accompaniment settings, player timing, loops,
audio and service-worker caching strategy are unchanged. No physical-kalimba or
subjective musical approval follows from these storage checks.

## Regression checks

`scripts/test-practice-preferences.mjs` exercises strict speeds, read-only legacy
fallback, byte preservation, new-record precedence, malformed/future guards,
unknown metadata, encoded IDs, storage failures and a synthetic storage-call
ordering check. That unit ordering is not presented as same-event-loop browser
reentrancy. A separate independent-agent differential supplies the concurrency
evidence described above.

`scripts/test-library-practice-duration.mjs` exercises actual card/runtime readers
and event handlers with both formats, including invalid authoritative records and
unrelated storage events. Release-specific aggregate, browser and package results
are recorded separately in `VERIFY_2.4.46.md`.
