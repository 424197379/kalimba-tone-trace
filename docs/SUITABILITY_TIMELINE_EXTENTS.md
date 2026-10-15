# Suitability report timeline extents

`npm run report:suitability` is a read-only review of compiled song data.
It now distinguishes melody, main source events, the two independent backing
layers and the selected source extent. This corrects an ambiguous report label;
the app already preserves source endings in its practice timeline. No song,
playback setting, runtime duration, audio sample or accompaniment is changed.

## Compatibility and units

All original JSON/API fields remain unchanged, including `totalBeats`, `gaps`,
`signals`, recorded decisions, scope, pitch range and duration counts.

- `totalBeats` remains the maximum melody endpoint. It is not a full source-scope
  total or the sum of note durations. `melodyEndBeat` explicitly names the same
  value. A long overlapping note can end later than the last attack.
- `gaps` remains the original initial/internal melody gaps of at least one beat
  (with the existing floating tolerance). It excludes ending gaps.
- The human table calls that count `initialInternalGaps>=1b`. This deliberate
  display-label change does not rename or reinterpret the JSON `gaps` field.
- A second human table shows melody endpoint, selected extent, selection basis,
  ending-gap duration and issue count. `--json` includes the detailed fields.

Every endpoint and gap duration below uses absolute score beats, not seconds,
sample length, acoustic decay or effects tails. Timing comparisons use `1e-8`
tolerance without rounding or quantization. A genuine fractional gap is retained;
floating roundoff such as `19.999999999999993` versus `20` creates no new tail.

## Additive JSON/API fields

| Field | Meaning |
| --- | --- |
| `melodyEndBeat` | Explicit alias of legacy `totalBeats`. |
| `sourceEventEndBeat` | Maximum valid main event endpoint. V2 retained harmony-only events may outlast melody. |
| `accompanimentEndBeats` | Separate `autoAccompaniment` and `practiceAccompaniment` written endpoints; each is null when no valid events exist. Alternatives are never merged. |
| `declaredSourceTotalBeats` | Finite nonnegative numeric `sourceFeatures.sourceTotalBeats`, including a conflicting short declaration; otherwise null. Always read with status. |
| `selectedSourceExtentBeats` | Usable declared extent, explicitly labeled main-event fallback when missing, or null when unresolved. |
| `sourceExtentStatus` | Timing status described below; never musical or source approval. |
| `sourceExtentSelection` | `declared-source-total`, `encoded-main-event-fallback` or `unresolved`. |
| `sourceExtentIssues` | Separate machine-readable diagnostics; original `signals` is untouched. |
| `endingMelodyGap` | Positive interval from maximum melody endpoint to selected extent, or null. Includes sub-beat tails. |
| `melodyGaps` | Inferred initial/internal/ending gaps above tolerance, including sub-beat gaps. Null with no melody or invalid inspected timing. |

Gaps have `beat`, `duration`, `position` (`initial`, `internal` or `ending`)
and `meaning: "inferred-melody-gap"`. An ending also names its `extentBasis`.
Held/overlapping spans are combined for gap detection using the maximum covered
endpoint; overlap never invents a rest inside a still-held note. Existing overlap
review signals remain visible. An invalid/short declared extent blocks only an
inferred ending; otherwise valid initial/internal gap information can remain.

## Extent status and diagnostics

- `covers-written-content`: a usable declaration covers all inspected main events,
  both independent backing layers, rhythm rest windows and pickup extent. It does
  not mean that those notes or metadata are faithful to a source.
- `missing`: no own `sourceFeatures.sourceTotalBeats` property. The selection falls
  back to `sourceEventEndBeat`, explicitly labeled `encoded-main-event-fallback`.
- `invalid-value`: a present declaration is not a finite nonnegative number.
  Strings, booleans, null, negative values, NaN and infinities are not coerced.
  Explicit undefined is invalid, distinct from a missing property.
- `shorter-than-written-content`: a numeric declaration ends before an inspected
  span. Keep the declaration for diagnosis; selected extent is null. Do not trim
  music or silently replace the source claim with an event maximum.
- `unresolved-timing`: malformed inspected timing prevents selecting an extent
  that would otherwise have status `missing` or `covers-written-content`.
  Invalid-value or shorter-declaration status takes precedence when both occur;
  all detected issues remain available. Selected extent is null in every case.

Diagnostics include `invalid-timing-array`, `invalid-written-span`,
`invalid-pickup-extent`, `invalid-source-total-beats`,
`written-content-beyond-source-extent` and
`content-beyond-undeclared-main-event-fallback`. Invalid span diagnostics name the
input path; beyond-extent diagnostics list each relevant path and `endBeat`.

Missing metadata does not authorize inventing a larger source selection. If a
backing span, rest window or `rhythm.pickupBeats` extends past the main events,
the last diagnostic names it while the fallback stays at the main event end.
For example, melody ending at `1/3` with pickup extent `2/3` and no declaration
retains fallback `1/3`, reports pickup beyond it, and creates no ending gap.
Zero pickup is valid. Negative, nonfinite or nonnumeric pickup leaves timing
unresolved. Fractional pickup follows the same tolerance as every other span.

This report is not a full schema validator. Its original main-event shape
assumptions and legacy metrics remain intact. A null backing endpoint can mean
absent events or no valid events; inspect issues instead of treating it as proof
of silence. A null ending gap means absent or unresolved, not approval.

## Inferred melody gaps are not silence claims

An inferred ending means only that no encoded melody covers that interval.
Source harmony or backing may continue. It does not prove a printed rest,
all-layer silence, source fidelity, musical suitability, reproduction rights,
permission to remove lower voices, or permission to cut acoustic/PCM tails.

Examples:

- Melody ends at 4, declared extent 4.5: legacy `totalBeats=4` and `gaps=[]` stay
  unchanged; the new ending gap is `[4,4.5)`.
- Melody ends at 4, declaration is 2: declared value remains 2; selected extent
  and ending gap are null, with `shorter-than-written-content` status.
- Melody ends at 4, independent backing ends at 8, no declaration: fallback stays
  4 and diagnoses the backing endpoint. It does not invent four beats of rest.
- Melody ends at 4, declaration and backing end at 8: an inferred four-beat melody
  gap coexists with backing through 8. This is not all-layer silence.
- No melody, declared extent 8: the usable extent can remain 8, but melody gaps
  and ending gap are null. The original no-melody signal remains.

Selected `sourceTotalBeats` does not automatically mean the complete printed page
or recorded song. Do not promote an omitted instrumental passage, historical
candidate, or differently named full-page extent into the chosen scope. Use the
[backing reports](SUPPORT_REPORTS.md) to inspect explicit silence/hold claims and
overlaps, and read the source before changing either music or those claims.

## Current-library regression cohort

The 56-record v2.4.29 cohort has eight inferred ending melody gaps:

| Song ID | Melody endpoint | Selected extent | Ending gap |
| --- | ---: | ---: | ---: |
| `gao-bai-qi-qiu` | 129 | 132 | 3 |
| `jasmine` | 55 | 56 | 1 |
| `ping-fan-zhi-lu` | 64 | 68 | 4 |
| `qi-feng-le` | 77 | 80 | 3 |
| `song-bie` | 94 | 96 | 2 |
| `xuan-cao-hua` | 191 | 192 | 1 |
| `ye-de-gang-qin-qu-wu` | 129 | 132 | 3 |
| `yun-yan-cheng-yu` | 120 | 124 | 4 |

The other 48 records gain no ending gap. Daylily retains 19 legacy initial/internal
gaps of at least one beat; the detailed gap list has 20 including its ending.
Farewell retains five legacy gaps and gains a separately reported sixth ending
gap. These are encoded/declaration comparisons, not fresh source-pixel evidence.
The output does not erase distinctions between a melody-only source rest and a
source-backed all-layer silence claim.

## Regressions

```sh
node --test scripts/test-suitability-extent.mjs
node scripts/test-song-suitability.mjs
node --test scripts/test-ending-rests.mjs scripts/test-song-report-analysis.mjs
npm run report:suitability
npm run report:suitability -- --json
```

`scripts/fixtures/suitability-legacy-v2.4.29.mjs` is a test-only copy of the actual
pre-extension pure inspector and constants, with its key import relocated and
CLI removed. Its header records the original whole-file and function SHA-256
hashes; the regression verifies the frozen function hash. It never imports the
migrated inspector. Every synthetic inspection and all 56 current records compare
all old fields to that independent oracle, preventing self-comparison after
migration. Tests also cover no mutation, V1/V2, fractional and overlapping spans,
sub-beat tails, missing/invalid/short extents, both backing alternatives, pickup,
nonfinite/overflowed timings, the eight-song cohort and both CLI formats.

Passing these checks establishes report behavior and compatibility. It does not
complete source comparison, browser/audio A/B listening or physical-kalimba QA.
