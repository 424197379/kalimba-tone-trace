# Mixed-meter library label

## Bounded display correction

The canonical Interstellar melody card now shows `拍号 3/4 → 4/4`.
The saved [EveryonePiano 0005180 source](https://www.everyonepiano.cn/Music-5180.html)
prints opening `3/4`, quarter note = 90, and a `4/4` change at m42.
The opening key/tempo and m41–43 image crops were visually inspected again for
these symbols. This confirms the label, not the unreviewed pitches or voices.

`getSongMeterLabel` in `src/song-store.js` reads optional
`sourceFeatures.meterDisplay`. It accepts only a string containing one to eight
`2/4` through `8/4` terms, joined by exactly ` → `, after trimming outer whitespace.
Missing, empty, non-string, malformed, other-denominator, overlong or markup
values fall back to the existing `${beatsPerMeasure}/4` label. The card uses the
existing `createMeta` and `textContent` path, never HTML from metadata.
No label is inferred from a title, free-text source note, or a meter map.

This optional field is descriptive metadata. Even a valid declaration in a
local import is only a label, not evidence that the source or music has been
verified. It is not a timing schema, bar map, playback feature, or import
permission to change a source's real beat units. Unsupported meters still need
source-specific review; a display override does not make them playable.

Only `data/songs/interstellar-main-theme.json` declares this label. Existing
source/review records remain verbatim, with a separate `meterDisplayReview`
record explaining the correction. Historical wording about “displayed bar
divisions” does not describe a current runtime feature: practice uses absolute
beats and onset-aligned loops. The current notice now correctly says that m42
starts `4/4`, retaining the restored triplets, dense-tail, slow-section practice,
and earlier voice/register cautions. The legacy quantized-tail warning remains.

## Preserved boundaries

- `beatsPerMeasure: 3`, all 290 pitch/onset/duration tuples, BPM 90 and the legacy
  `.82` suggestion are unchanged. First-play `.55` and remembered speeds are unchanged.
- The current absolute-beat timeline still ends at 159. No new source ending,
  m50 certification, repeat expansion or full-song approval is asserted.
- Reviewed melody remains `[131,155)` only; deferred ranges remain `[0,131)`
  and `[155,159)`. Recognizing m42's meter does not approve m42–43's register,
  m10–41's voice extraction, or any additional notes.
- The old V2 source/support JSON remains byte-identical, and the existing
  canonical melody, accompaniment compatibility and selection paths are unchanged.
- No audio, scheduling, looping, preparation, performance-history or preference
  logic changes. There is no new physical chord target or meter-based snapping.

## Executable checks and limits

`scripts/test-mixed-meter-label.mjs` exercises the actual card functions in a VM,
plain-text rendering, safe invalid-value fallback, ordinary songs, canonical
selection, local imports, first and saved speed badges, exact loop boundaries,
all-tuples SHA-256, and reconstruction of the entire pre-label 2.4.26 JSON.
`scripts/test-interstellar-reviewed-tail.mjs` retains its original source,
old-JSON reconstruction and frozen-V2 hashes; reconstruction removes only the
new display fields in addition to its existing historical reconstruction steps.
Existing store/disclosure tests retain the real warnings without the obsolete
current `3/4`-only display statement.

Run the new test alongside the existing tail, song-store, notice-disclosure,
library-duration and practice-loop tests, then song validation, generated
library rebuild and the aggregate check. These are source/DOM-function and
timing-data checks. Browser/audio, independent reference listening and physical
kalimba checks are not performed or newly claimed by this display correction.
