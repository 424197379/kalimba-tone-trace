# Batch-import error location

The importer now identifies the failing source song in an actual multi-song
array or `{ "songs": [...] }` upload. For example:

> 第 2 首歌曲「第二首」：events 第 1 项 第 1 个音 的音符 C#4 不在固定 21 音 C 调卡林巴范围；不能删除或替换升降音，请核对谱源及整体转调方案

The ordinal counts input songs, not the melody/arrangement versions produced
from earlier entries. The first invalid song stops the batch. Its complete
existing validation reason is retained, with the original error as `cause`.
No pitch, timing, role, source-extent or accompaniment constraint is relaxed.

The optional title is diagnostic text only. Non-string or missing titles are
omitted; whitespace and control/directional characters are collapsed. At most
40 Unicode code points plus an ellipsis are displayed, without splitting a
valid surrogate pair. This does not sanitize, shorten or otherwise change the
imported song itself. The existing UI renders the complete message through
`textContent`, including titles that resemble HTML.

Single-song objects and singleton containers keep their existing messages.
Invalid JSON, empty batches and reserved top-level `practiceAccompaniment`
on a wrapper still fail at the root before per-song processing. A wrapper
error is not falsely attributed to one song. The reserved-field repair
guidance, supported `autoAccompaniment`, historical stored playback layers,
V1 `steps` and old `notation` paths remain unchanged.

Parsing still completes the entire batch before the real click handler saves
anything. On failure, the pasted input, saved library bytes, current selection,
search, difficulty filter and unrelated preferences remain unchanged. The
parser's temporary reserved IDs never escape a failed parse.

## Focused verification

```sh
node --test scripts/test-import-batch-context.mjs scripts/test-import-score-contract.mjs scripts/test-song-store.mjs scripts/test-porcelain-reviewed-support.mjs scripts/test-see-you-reviewed-support.mjs scripts/test-jingle-reviewed-support.mjs
```

Implementation checks: **95/95 passed**, including 13 new batch-context cases.
The new cases cover both containers, first/second/last failures, a preceding
two-version import, multiple invalid songs, malformed/missing titles,
50,000-character titles, exact original reasons, text-only error rendering,
root-guard precedence, accepted V1/notation/V2 data and the real failed import
handler with memory-only storage. No real browser storage is modified by
these tests.

An isolated copy with only the new parser context removed produces seven
expected new-test failures and six compatibility passes. The final parser and
test files also pass Node syntax checks and the scoped whitespace diff check.
This is focused parser/handler verification; the integrated release checks
and real-browser validation are recorded separately. No song data, generated
library, playback behavior, schema or version is changed by this patch.
