# Built-in validator source endings

`scripts/validate-songs.mjs` now checks an explicitly supplied
`sourceFeatures.sourceTotalBeats` and uses it to bound V2 rhythm rest windows.
A source-confirmed ending can extend beyond the last sounding event. For
example, a final note ending at beat 3 and a source ending at beat 4 can retain
the silent window `[3, 4)` without stretching that note or adding a sound.

This is a compiler-validation change. It does not change song data, playback,
stored preferences, the external importer, audio samples or report behavior.
It does not approve a composition, a transcription or an accompaniment.

## Declaration contract

- An own `sourceFeatures.sourceTotalBeats` property must be a finite,
  nonnegative number. Zero and fractional values are numeric values, not
  missing metadata. Strings, booleans, null, explicit undefined, negative
  numbers, NaN and infinities are errors; nothing is coerced.
- V1 declarations must cover every written `steps` endpoint. V2 declarations
  must cover every main `events` endpoint, both independent accompaniment
  layers, every `rhythm.restWindows` endpoint and `rhythm.pickupBeats`.
  Unjudged main harmony still counts as written content.
- The extent check inspects timing independently of note validation and runs
  before the main-array early returns. An invalid note, malformed sibling or
  missing main array cannot hide an independently invalid or too-short
  declaration. The existing schema checks still reject malformed timing.
- Finite beat and duration values whose sum overflows are errors in every
  supported timing layer, whether or not the declaration is present.
- Comparisons retain the validator's existing absolute `1e-9` beat tolerance,
  also used by the new-import boundary checks. The separate suitability
  report retains its existing `1e-8` reporting tolerance. Neither tolerance
  rounds stored timing or quantizes source-confirmed tuplets.

An explicit source value is never replaced with the maximum event, backing,
rest-window or pickup endpoint. A short value remains an error. An invalid
value is not treated as absent and does not activate a fallback.

Zero is legal metadata, but a positive written span extending beyond zero
still fails the boundary check. An empty song is independently rejected by
the song schema; zero does not establish a valid all-silent song.

## Compatibility and limits

When the source property is absent, V2 rest windows retain the legacy bound:
the maximum valid main-event endpoint. That includes retained unjudged main
events. Backing layers, pickups, rest windows and bar rounding do not enlarge
it. This preserves the existing missing-metadata behavior; it does not grant
musical approval to legacy data or invent an extra ending bar.

V1 cannot use V2 `rhythm`, `autoAccompaniment` or `practiceAccompaniment`
playback fields. The validator now explicitly rejects the last of these,
matching the existing runtime's V2-only backing support instead of letting
V1 data pass and silently lose that layer during normalization. Descriptive
`sourceFeatures.practiceAccompaniment` metadata remains allowed. Existing V2
practice backing still reuses the auto-accompaniment schema, with errors
renamed to the `practiceAccompaniment` field. The validator continues to
check rest-window ordering/overlap and the existing silent/hold support rules
independently for each backing layer. A valid longer source ending does not
relax those checks or authorize filling a rest.

The historical `steps` bar-alignment warning still reports the note endpoint.
It can remain visible when a valid source ending completes the bar. Do not
stretch a note, delete a final rest, change the meter or add a sound merely
to suppress that warning.

For a compiler failure, verify the selected score scope and exact final beat.
Correct metadata only when supported by that source. Do not copy a full-page
duration into a shorter selected excerpt, choose an accompaniment layer by
its endpoint, or relabel silence as `hold` to make validation pass. A declared
extent proves neither all-layer silence nor that a decaying sample has stopped.

## Regressions

```sh
node --test scripts/test-validator-source-extent.mjs scripts/test-validator-fractional-timing.mjs
npm run validate:songs
node --test scripts/test-ending-rests.mjs scripts/test-import-score-contract.mjs scripts/test-song-report-analysis.mjs scripts/test-suitability-extent.mjs scripts/test-daylily-reviewed-vocal.mjs
```

The source-extent tests execute the actual monolithic validator in the same
import/CLI-free VM harness as the existing fractional-timing tests. They use
generic synthetic fixtures and an in-memory V2 conversion of the existing
Daylily built-in melody; they contain no copied score, private candidate or
new production song. Inputs are frozen and checked for mutation.

The Daylily conversion preserves all 183 melody attacks, its last note ending
at 191, the declared source ending at 192, and a `[191, 192)` final rest.
It passes with that declaration, reproduces the old event-end-only failure
when the declaration is absent, and rejects a rest extending past 192.
A separate private-candidate before/after check reproduced the same original
single boundary error and confirmed zero errors after this fix, with candidate
bytes and the pre-existing note-end/bar warning unchanged. This establishes
structural acceptance only; it does not publish or musically approve that
candidate.

Other cases cover V1/V2 declarations, all invalid value kinds, explicit zero,
fractions, tolerance edges, overflow, all supported written layers, malformed
inputs, missing-metadata fallback, retained main harmony and existing
silent/hold/overlap checks. The current 56-song corpus remains at 7,180 steps,
zero validation errors and 606 warnings.
