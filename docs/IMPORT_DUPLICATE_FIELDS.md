# Raw import duplicate-field guard

## Reproduced loss boundary

Before2.4.40, native `JSON.parse` kept only the last member when one JSON object
repeated a field. This happened before note/role/timing validation. A submitted
`events` list, nested `notes` list, note `name`, accompaniment or even `songs`
batch could therefore hide earlier valid melody or an illegal pitch. The real
library import handler then saved the surviving value, displayed success and
cleared the input. It did not retain the earlier raw members in storage.
Preexisting songs were not deleted by this defect.

A source-text audit exercised31 cases through actual parse/save/read code and
the complete production library handler under a simulated DOM/storage. Sixteen
confirmed silent-loss cases, nine compatible controls and six proper rejection
controls established the defect. These are old-code reproduction results, not
fixed-code acceptance or browser results. No copyrighted song is needed to
reproduce it.

## New-input contract

After standard JSON syntax validation, scan the original text before unwrapping,
normalizing or saving any song. The scanner uses an explicit container stack
and decodes only quoted object keys, comparing them within each object. It is
not a replacement JSON grammar parser and never rewrites the supplied text.

Reject every duplicate decoded key in the same object, including:

- Repeated `events`, `notes`, `name`, timing, accompaniment and batch members.
- Equivalent JSON escape spellings, such as `events` and `e\u0076ents`.
- Identical duplicate values and duplicate fields inside source/unknown metadata.

The last two categories deliberately narrow new-import acceptance. Treating
identical or currently ignored content specially would make ambiguous input
silently depend on future schema or parsing changes. Do not migrate or
revalidate historical stored records under this guard.

Repeated names in separate objects remain legal, as do text strings containing
JSON-looking fragments. There is no case-folding, trimming or Unicode NFC/NFD
normalization of names. Distinct names remain distinct. A single escaped key
continues to work. Built-in and stored-song reading use their existing paths.

Syntax errors retain the established illegal-JSON message. For syntactically
valid raw input, duplicate detection runs before schema errors, so an entire
document's first duplicate may be reported before an earlier song's separate
musical/schema error. After all duplicates are resolved, normal per-song
validation and first-failing-song diagnostics still apply.

## Failure and repair

The error identifies the decoded field, JSON path and both source locations.
Line/column are one-based Unicode code-point positions in the full pasted
text; CRLF counts as one newline. Root arrays and root `songs` wrappers include
the original source-song index where unambiguous. Names/paths are bounded and
control/bidi characters escaped for display only. Deep path middles may be
omitted with an ellipsis; the reported source locations remain exact.

The existing import failure path retains the full textarea (including leading
and trailing whitespace), stored library, current song, search, difficulty and
unrelated preferences. No prefix of a batch is saved. Resolve the two contents
against the complete original and intended source edition; do not simply choose
the last value, concatenate arrays or delete the reported member. The importer
cannot determine which musical interpretation is correct.

The actual copied `AI_SONG_PROMPT`, public compiler skill and JSON reference
state the same rule. Structural acceptance still does not prove melody/source
fidelity, subjective sound quality or physical playability.

## Verification

Run the focused `scripts/test-import-duplicate-fields.mjs`, existing import
contract, batch-context and concurrent-write regressions, then `npm run check`.
Release-specific results, actual own-cloud browser acceptance and clean
artifact verification are recorded separately in `VERIFY_2.4.40.md`.
