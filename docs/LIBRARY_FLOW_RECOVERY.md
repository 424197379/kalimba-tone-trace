# Daily library and import recovery

## Observed problems

In the actual2.4.32 webpage, selecting 困难 then searching 生日快乐
produced 显示0/1首 but said no matching song existed. The matching easy song
was only hidden by the retained filter. A two-song import with a C-sharp in
song2 retained the input and made no writes, but identified only its first
local event, not which song needed correction. After a corrected successful
import, the prior URL-selected song remained highlighted and the new song's
practice action was at the end of37 cards; the nearby local manager only
provided Delete.

## Bounded behavior

- Retain intentional difficulty and search. When another difficulty contains
  matches, explain the filter and provide one action that clears only difficulty.
  Keyboard focus returns to the preserved search input after that action.
  A genuinely absent search keeps the ordinary empty state with no false action.
- A deliberate choice or successful import remembers the canonical melody ID
  in the current tab, storage and the existing library history entry. Preserve
  unrelated URL parameters/hash/history state; do not add another Back entry.
  Initial explicit links still win over storage until the user chooses a song.
  Existing pageshow rendering covers browser Back/bfcache restoration.
- Restricted history replacement cannot prevent navigation or the current-tab
  choice. Existing safe storage wrappers remain in use. Invalid IDs cannot
  mutate selection, and old chord IDs continue to resolve to single melody.
- Each practice-ready local management row has a direct “练习” action beside
  Delete. Unresolved archived material does not gain a practice button. Import
  does not start playback or navigate automatically, and actual practice alone
  updates recent-practice history; ordinary sorting is unchanged.
- Deleting a stale stored song must not overwrite a different valid explicit
  selection. Only deleting the active song resets it to the default melody.
- Multi-song errors identify the input ordinal and bounded title, preserving the
  original actionable reason and whole-batch atomicity. See IMPORT_BATCH_CONTEXT.md.
  The busy label describes local score checking; no remote AI is invoked.

## Regressions and limits

The production-function VM covers filter recovery/no matches, true initial links,
canonical navigation/Back, history denial, invalid IDs, literal titles and local
practice actions, success/failed retry, and both deletion-selection branches.
A reviewer reproduced the stale-store deletion regression introduced by the
first integration; the two branches were separated and a permanent test added.
No melody, backing, playback, speed, loop, gain, recent-history format, import
schema or audio sample is changed. Source fidelity remains outside these UI checks.
