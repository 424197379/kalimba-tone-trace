# Source-notated ending rests (2.4.1)

`getPracticeTotalBeats(events, song)` preserves an explicitly recorded source
ending after the final note. It returns the greater of the last valid event end
and `song.sourceFeatures.sourceTotalBeats`.

## Accepted metadata

`sourceTotalBeats` is an optional JSON number: finite, nonnegative, and measured
in beats from beat 0. It must describe the source's notated extent, including
ending rests. Strings, booleans, negative numbers, and nonfinite values are
ignored. A missing or invalid value falls back to the event ending; a value
below that ending cannot shorten a note. The helper does not infer missing bars
from the meter, duration, title, or arrangement version, or establish source
fidelity merely because metadata is numeric.

Valid events have a finite numeric beat at least 0 and a finite numeric duration
greater than 0, with a finite sum. Invalid events are ignored. With neither valid
events nor valid source metadata, the helper returns 0. Existing loop creation
keeps its separate nonempty-range fallback.

## Audited scope

The 13 existing V1 records with `sourceTotalBeats` cover the same notated ends.
Only these three of the 36 single-note practice songs gain meaningful time:

- `gao-bai-qi-qiu`: final event ends at 129, source ends at 132
- `qi-feng-le`: final event ends at 77, source ends at 80
- `ye-de-gang-qin-qu-wu`: final event ends at 129, source ends at 132

Each retains three silent beats. The other ten recorded source bounds equal
their event bounds, allowing for floating-point rounding. No metadata is added
to other songs. This uses existing source metadata, not a new full-score audit.

Only the practice timeline and its available loop B boundary are extended.
Notes, attacks, held-note durations, and accompaniment events are unchanged; no
rest note is fabricated. The separate 0.9-second playback ring-out allowance is
unchanged and is not part of the source's beat count.

## Regression checks

Run `node --test scripts/test-ending-rests.mjs scripts/test-practice-loop.mjs`.
Coverage includes all 13 recorded source bounds; the 36-song practice set;
exactly three meaningful extensions; final-phrase and loop B bounds; immutable
note/event data; a valid imported song without metadata; and invalid metadata,
events, or a source bound shorter than a sounding note.
