# Reviewed evidence, regressions and listening acceptance

Use for a new import or focused correction involving attacks, tuplets, ending silence, melody identity, accidentals or optional support. Tests compare data with recorded decisions; they do not read the score or certify musical quality.

## Inspect first; preserve the scope

Retain source URLs, chosen version, page/image and bar locations, inspected crop coordinates when useful, beat origin, meter/tempo, source-to-event mapping, transformations, confidence and outstanding questions in the existing private review. Keep source images/crops private. Public metadata can retain source links and concise factual decisions, not full copied scores. Preserve existing `unsupported`, `unsureMeasures`, source history and unrelated discoveries when adding a focused correction.

- **Source/version conflicts:** when a clear source differs from a legacy transcription, identify which source and exact span is being adopted. Preserve the older source and disclose any unreviewed original. A discrepancy against one chosen score is not proof that every performance/version is wrong; do not silently combine competing arrangements.
- **Fermatas and fixed-time practice:** a fermata does not prescribe a fixed number of added beats. Compare the chosen arrangement before calling an extra hold a transcription error. Document any fixed-time realization separately from literal notation, move all subsequent melody and optional support anchors consistently, and retain the actual chosen ending. Choosing no extra hold also requires an explicit practice-edition disclosure; nominal beats do not prescribe an exact sung duration. Do not remove an intentional hold or append another edition’s final rest merely to make a bar total match. A source version without a fermata is a distinct choice, not proof the original is wrong.
- **Octave and rhythmic dots:** review every dot against its note/rest, including across line/page breaks. Check whether proposed pitch offsets are consistent before calling a change a global transposition. Mixed +12/0 offsets can identify a review target but do not automatically prove an error or authorize folding pitches. A readable symbol can still conflict with another version or raise an engraving-intent question: distinguish “literal pixels known” from “intended pitch unresolved.” A large leap alone does not prove a typo. Seek the same arranger’s alternate notation or performance without bypassing access controls; when unresolved, keep a coherent pre-existing phrase with an explicit caution rather than silently mixing inferred pitches into a source-approved claim. A dotted rest keeps its full silence; a dotted eighth plus sixteenth is not a tuplet without a source indication.
- **Tie / repeat / slur:** only merge a confirmed same-pitch tie, after checking endpoints, octave dots, arc, beams and any source legend. One attack gets the summed duration. An adjacent repeated pitch without a tie remains a separate attack; a source-visible slur between different pitches is not a same-pitch tie and does not remove either attack. Follow ties across line/system and bar boundaries; a confirmed five-beat sustain remains one attack even in 4/4. A chain across several same-pitch heads is one attack only when every successive connection is verified; do not stop at the first tie or absorb an untied neighbour. The next same-pitch independent note still attacks. Color conventions are source-specific. Unreadable arcs need review, not automatic merging.
- **Tuplets:** record the count and total group duration. A three-in-one-beat group uses `1/3`, with onsets derived from a common origin. JSON stores numeric approximations; compute from the fractions and compare with tolerance rather than rounding onto a quarter-beat grid. Fractional pickups are legal too. Validator grid/density notices are review aids, not instructions to round or shorten a source-confirmed value. Distinguish beams/underlines, augmentation dots and octave dots. A correct bar total alone does not prove internal onsets are right.
- **Unmapped legacy melody:** identical melody and richer-arrangement records are shared data, not independent source confirmation. If neither the source vocal line nor instrumental opening maps to the encoded attacks, a meter-label change cannot repair unknown pitches or durations. Preserve the old data, disclose the unresolved mapping and keep the source’s accidentals/form limitations scoped to that edition. A chromatic full ending does not automatically disqualify a separately reviewed diatonic excerpt or every arrangement of the title.
- **Parallel notation exports:** numbered and staff previews from one arrangement are two representations, not two independent sources. A displayed zero in one export can conflict with an explicit same-pitch tie in the other. Inspect the actual voice and both endpoints, preserve the conflict and adopted reading, and do not mechanically prefer either format. A matching staff fragment still does not verify another vocal edition’s ending or octave choices. This requires human/source-pixel review; JSON validation cannot settle it.
- **Measure-local rhythm evidence:** inspect every adopted bar’s actual duration lines, rather than copying a familiar lyric cell or nearby phrase. Per-bar onset/span fixtures can catch an eight-eighth-note bar stretched into two bars, but meter totals are review clues, not universal rejection rules: pickups, fermatas and meter changes require source-specific interpretation. Different-pitch slurs retain attacks. When omitting a labeled instrumental interlude, distinguish the entire printed extent from the selected vocal extent; its sounding notes are not a written rest. Multiple lyric rows alone do not authorize another repeat.
- **Endings:** keep the reviewed notated extent as numeric `sourceFeatures.sourceTotalBeats`. The practice end is at least the last valid event end. A known final rest remains silence; do not invent a rest note, extend the last note, fill it, or round the timeline up to an assumed bar. Ring-out seconds are not score beats.
- **Pitch fit:** identify essential source accidentals and their scope before transposing. Test all 12 global pitch-class shifts against the fixed natural-note set, then check the actual register and intervals. A global octave shift preserves pitch-class limitations. If no faithful shift fits, disclose and downgrade an existing altered version; for a new import, explain a verified smaller scope or different tuning/instrument and obtain the user’s direction before changing the requested arrangement. Do not independently naturalize pitches. An all-natural JSON file proves only its encoded vocabulary.
- **Melody role:** use source voice/notation and an identifiable phrase, not array order or the highest note. New multi-note events need exactly one explicit melody role. If identity is ambiguous, stop that span and get a better source; do not promote an explicitly bass/harmony-only event.
- **Harmony conflict:** align source chord-symbol boundaries to the actual melody timebase, including pickups and any documented fermata realization. A chord symbol can support a sparse derived voicing, but does not prove the precise rhythm, register or articulation of an automatic backing track. Preserve that distinction and the original candidate. Compare judged non-melody anchors and backing at matching beats. A disagreement is a review trigger. Intersecting their notes may reduce density, but cannot establish which harmony was intended. Keep the original layers and conflict locations available; mark an unverified candidate accordingly.

## Selected shorter editions

For a raw built-in file containing `practiceAccompaniment`, do not describe a
new import as a lossless recovery. The external importer now rejects that
reserved top-level playback field on songs and batch wrappers, even if empty,
null, malformed or alongside `autoAccompaniment`. Retained
`sourceFeatures.practiceAccompaniment` is only descriptive metadata. Prepare
and verify a deliberately selected supported `autoAccompaniment` representation
with the complete intended notes/attacks, timing, gain/default choice, rest
policies and ending intact; deleting the rejected field alone loses music.
If both layers already exist, require a clear arrangement decision rather than
automatic merging, renaming or selection. Built-in and historical stored reads
are unchanged; this is a new-import guard, not a schema migration. Older
verification logs remain historical evidence, not current import instructions.
See [IMPORT_BACKING_FIELD_GUARD.md](../../../docs/IMPORT_BACKING_FIELD_GUARD.md).

When the user selects a shorter source arrangement to replace an existing built-in:

1. Review the selected page/section as its own edition. Align display titles and hints with its actual scope; record source identity, bar/beat bounds, weak-start/pickup placement (or confirmed absence), and final rest. A complete visible short arrangement need not be the complete original song. If no tempo is printed, label the chosen BPM as a practice choice, not a source marking.
2. Before replacement, retain the complete prior JSON byte-for-byte outside `data/songs`, including its original titles, timing and source metadata. Record its hash and verify that the actual importer restores an independent local song without replacing the new built-in. Do not rewrite the archive to give it a clearer title. This is developer recovery evidence: do not add a user-facing restore link, extra library card or old-version choice by default. Keep everyday practice focused on the selected current edition; source/version traceability belongs in its concise source notice and detailed development record. Keep older source claims and unreviewed questions historical; adopting another edition does not establish that the prior edition was wrong.
An explicitly monophonic piano upper staff may be selected as that arrangement’s theme line. Name its actual instrument/voice and source bars; do not silently relabel it as a source-certified vocal melody. An editorial “theme” or “chorus” name is not a printed source label. A shorter selection reduces length only: review fastest subdivision, register, jumps, rests and physical same-side runs separately before calling it easier. A common opening does not prove that the rest of two editions should match.

3. Recheck [sibling support compatibility](song-json-schema.md#optional-conservative-practice-support) after the melody changes. Keep the preserved source sibling available without treating it as accompaniment for the new edition by default.

When the single-note adaptation deliberately omits a separately attacked chord, preserve the preceding note’s printed duration. Record the resulting melody-only omission gap and its source event; do not lengthen the earlier note to fill it, select a highest chord tone without melody evidence, or describe the gap as a written all-layer rest. The remaining voices may have written activity even when the physical practice target is silent.

## Existing focused examples

Read only the relevant case; these are repository evidence records, not universal arrangement templates:

- [JASMINE_SHORT_2.4.4.md](../../../docs/JASMINE_SHORT_2.4.4.md): explicitly selected short edition, exact importable prior archive, separately attacked multi-pitch slurs, final silence, and rejection of differently timed sibling support. Pixel review establishes the selected notation; archive hashes, tuple fixtures and compatibility guards protect recorded decisions rather than supplying source or listening evidence.
- [INTERSTELLAR_TAIL_2.4.3.md](../../../docs/INTERSTELLAR_TAIL_2.4.3.md): sixteenth-note triplets use 1/6 quarter beats; an exact difficult source still needs a slow-practice warning, not fabricated quantization.
- [BIRTHDAY_SUPPORT_2.4.3.md](../../../docs/BIRTHDAY_SUPPORT_2.4.3.md): inspect a primary-source fermata before calling another edition’s timing a correction; source chord symbols can expose shared errors in two older backing layers.

- [YUN_YAN_TIES_2.4.1.md](../../../docs/YUN_YAN_TIES_2.4.1.md): three confirmed ties, a separate repeated D5 attack, and a separately reviewed final three-note rhythm. Precise tuple checks and frozen untouched tuples prevent accidental full-song rewriting.
- [SKY_CASTLE_FIT_2.4.1.md](../../../docs/SKY_CASTLE_FIT_2.4.1.md): source pixels establish essential melody accidentals; the reviewed nine-pitch-class theme cannot fit seven natural pitch classes by global transposition. The unavailable original arrangement remains unverified.
- [ENDING_RESTS_2.4.1.md](../../../docs/ENDING_RESTS_2.4.1.md): preserve known ending metadata and loop B without changing attacks or sustained durations.
- [PRACTICE_SUPPORT_REVIEW.md](../../../docs/PRACTICE_SUPPORT_REVIEW.md): sparse candidate provenance and unresolved harmony conflicts; membership in two legacy layers is not independent verification.

From the repository root, run the regressions relevant to the edit:

```sh
node --test scripts/test-jasmine-reviewed-short.mjs scripts/test-accompaniment-compatibility.mjs
node --test scripts/test-yun-yan-opening.mjs scripts/test-yun-yan-ties.mjs
node --test scripts/test-ending-rests.mjs scripts/test-practice-loop.mjs
node --test scripts/test-practice-support-data.mjs scripts/test-sky-castle-fit.mjs
node --test scripts/test-import-score-contract.mjs scripts/test-song-store.mjs
node --test scripts/test-porcelain-reviewed-support.mjs scripts/test-see-you-reviewed-support.mjs scripts/test-jingle-reviewed-support.mjs
```

The import contract regression covers single objects, arrays and batch wrappers;
rejection of every present reserved backing value and coexisting layers;
acceptance of descriptive metadata; the real import click handler's no-write
failure path; supported V2 backing/storage round-trips; and unchanged legacy
reads. The three source-support regressions retain their exact source/attack
hashes while rejecting raw built-in imports and proving explicitly prepared
external `autoAccompaniment` representations. Those checks protect musical
data from accidental loss; they do not establish source fidelity or listening
approval by themselves.

A later phrase that looks or sounds similar is a separate source occurrence. Do not mirror an octave or rhythm correction into an unseen repeat: retain its prior tuples and mark that occurrence unreviewed until its own notation or an explicit repeat instruction is visible. A partial public preview does not authorize reconstructing a paid or missing continuation.

Do not copy a fixed attack count or density limit from one song into a universal admission rule. Written repeated notes, tuplets and long sustains are legitimate. Retain immutable fingerprints or exact outside-scope tuples when correcting a small range, but keep separately approved later edits out of the frozen region.

## Reusable fixture checker

The dependency-free helper compares a V1/V2 song with a small separately reviewed evidence JSON. The evidence file is a private review artifact, **not an additional song schema**. Author its expected attacks from the source, not by copying the output being checked. Use synthetic fixtures for public regressions.

```sh
node skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs data/songs/<id>.json private/sheets/review/<id>-evidence.json
node --test skills/kalimba-tone-trace-compiler/scripts/test-transcription-evidence.mjs
```

Minimal synthetic evidence shape (replace with actual reviewed scope, never invent a review):

```json
{
  "songId": "synthetic-example",
  "source": { "reference": "synthetic teaching phrase", "scope": "one triplet and an ending rest" },
  "melodySpans": [{ "from": 0, "to": 1, "attacks": [
    ["C4", 0, "1/3"], ["D4", "1/3", "1/3"], ["E4", "2/3", "1/3"]
  ] }],
  "silentWindows": [{ "beat": 1, "duration": 1 }],
  "sourceTotalBeats": 2,
  "pitchFit": { "sourcePitchClasses": [0, 2, 4], "semitoneShift": 0 }
}
```

`melodySpans` uses half-open beat ranges and includes every melody event overlapping the range, including an earlier attack held across its start. Include the complete original attack in that case. Expected beats/durations accept JSON numbers or integer-fraction strings such as `"10/3"`; song JSON uses numbers only. `silentWindows`, `sourceTotalBeats`, and `pitchFit` are optional claims. Declare all-layer silence explicitly in `silentWindows`; total extent alone does not establish silence, because a source-backed accompaniment hold may outlast the melody. The checker still rejects any layer extending beyond the reviewed total. Pitch classes are integers C=0 through B=11; omit `semitoneShift` to report possible shifts without asserting one. This pitch-class calculation does not check register or prove that the compiled notes actually apply the declared shift; reviewed attack tuples and source comparison do that.

The checker fails on mismatched pitches, attacks, onsets/durations, ambiguous melody roles, lost source extent, sounding events in reviewed silence, a contradictory `hold` label, or an impossible declared shift. It checks durations overlapping a rest, not just onsets. Exit 0 means supplied expectations matched, exit 1 a failed check, exit 2 missing file arguments. It never edits data, infers ties, validates copyright permission, or approves a score. Run the project validator as well; it is not a full schema validator.

## Same-source measure timing regression

`node --test scripts/test-rain-reviewed-timing.mjs` protects the selected
《大雨小雨》 vocal scope: eight-eighth-note source bars remain four beats,
all repeated attacks and different-pitch slurs remain separate, the first
47 tuples are frozen, and the following phrase moves consistently. The full
page's instrumental interlude is not mislabelled as ending silence. The
fixture was independently transcribed from the selected pixels before the
production correction. See [RAIN_TIMING_2.4.6.md](../../../docs/RAIN_TIMING_2.4.6.md).
This is a source-specific regression, not a rule that every phrase must fill
four beats or that every parenthesis denotes an interlude.

## A/B listening and physical acceptance

Distinguish the printed source tempo, the encoded BPM, a score’s suggested `defaultSpeedFactor`, and the runtime’s actual selected/remembered speed. A stored suggestion is not proof of the current playback speed; record the visible multiplier used during listening or browser checks.

The physical single-melody line is the primary experience. In the browser compare the same reviewed phrase at source tempo and the actual practice tempo:

1. **A: melody only.** Align the reference phrase/pickup. Listen for recognizability, discrete attacks versus holds, exact triplet spacing, register and phrase/end silence. Check that the player schedules the encoded events, then separately compare those events to the source.
2. **B: optional support.** Keep the same melody/timing; enable the quiet, sparse candidate. It should remain clearly subordinate, add no melody-rest fills, create no double melody attacks, and introduce no unsupported harmony. For new practice candidates, start opt-in. Never overwrite an existing user setting merely to match this recommendation.
3. **Physical kalimba.** Check playable hand alternation, jumps, fast repeats and real decay. Long notation duration does not imply sustained energy from a plucked tine. Do not shorten legitimate holds or add retriggers just to sound fuller.

Record what was actually checked, the exact bars/version/tempo, A/B observations and outstanding items. Pixel review establishes notation evidence; event tests establish encoded invariants; browser playback establishes scheduling/audio behavior; reference listening establishes an audible comparison; a physical play-through establishes instrument behavior. One cannot stand in for another. If audio playback or a physical instrument was unavailable, record it as pending and retain a conditional/needs-review decision rather than claiming a completed listening test.

### Shared local evidence amid edition conflicts

When two identified editions agree on a specific tie but differ elsewhere,
review and adopt only the precisely mapped shared range. Preserve unrelated
attacks, genuine repetitions and every conflicting span until an edition
choice is supported. Do not infer full-phrase or full-song validation from
two local agreements. Record each edition's key/register/time offset and
actual endpoint evidence. Include an old-data failing example, a corrected
local fixture, and full outside-range/history hashes. A sibling generated
from the same melody is not an independent source. After an attack-sequence
change, re-check old backing compatibility rather than silently inheriting it.

### Check existing unresolved source work before another transcription

Read [SOURCE_REVIEW_GAPS.md](../../../docs/SOURCE_REVIEW_GAPS.md) when a title
already has unresolved source work. It distinguishes missing selected images,
parallel notation, alternate arrangements and an actually adopted local fix.
Do not redo blocked access or turn a previously rejected comparison into an
approved replacement merely because another agent recorded its tuples.
Re-open the musical decision only with new source evidence or an explicit
edition choice; keep unchanged songs unchanged when no safe correction is
established.

### Similar phrases still need occurrence-specific evidence

An apparently repeated hook can change octave, subdivisions or tie endpoints
within the same visible page. Read the later occurrence before reusing the
earlier phrase; a matching title, lyric or contour is insufficient. Record
which exact occurrence each adopted tuple came from. A printed repeat sign
is a separate source instruction and can legitimately justify expansion.

For a bounded preview, preserve its actual cut point without calling that
the full-song ending. Freeze historical data and review backing compatibility
when the selected melody changes. A useful regression includes a later-phrase
copy mutation that fails the independently read expectations, alongside true
repeated attacks and unchanged bars. Structural import checks cannot discover
this musical mismatch without source-authored expectations.

## Read-only backing/report review

Run `npm run report:rhythm`, `npm run report:arrangements` and
`node --test scripts/test-song-report-analysis.mjs` when a change affects
optional backing, melody gaps, or selected ending extent. Inspect both
`autoAccompaniment` and `practiceAccompaniment`; the generic song validator
already checks both against explicit rhythm windows. Reports compare full
written spans, retain initial/internal/declared-ending gaps, and distinguish
inferred melody gaps from declared all-layer silence, source-supported hold
policies and omitted source gestures. A hold label is not positive source
evidence. Do not upgrade a candidate from another layer's verified label,
penalize a deliberate single melody for having few chords, or infer harmony,
subjective quality, source fidelity or rights from a successful report. See
`docs/SUPPORT_REPORTS.md`. No report or validation pass authorizes editing song
JSON or trimming acoustic/PCM tails.

## Source-informed root reductions

Printed chord symbols can justify a sparse root-only accompaniment, but they
do not specify a bass octave, attack pattern, duration or gain. Preserve the
complete source chord map and label those choices as an arrangement. An omitted
chromatic third is not a naturalized third: do not replace it with a neighboring
natural or claim the remaining root reproduces the full chord's color. Keep the
physical melody unchanged and backing opt-in.

Filtering a piano part to legal pitches does not establish a coherent supporting
line. List lost downbeats, phrase endings and cadences as well as removed pitches;
a numerically valid handful of weak-beat fragments may be a poor accompaniment.
Disclose uniform octave shifts separately from the melody's transposition.
Written note durations, decoded sample ends and reverb/filter decay are separate
limits. Review full written spans and measure relevant effects-tail crossings;
do not shorten PCM to make a metadata duration act as a hard gate.

## Source-backed lower holds in sparse support

Review each melody rest against the actual lower staff before assigning a
rest policy. A written lower half-note may begin before a melody eighth-rest
and continue through it; an exact, evidenced hold retains that one onset and
its original duration. Do not add a fresh attack inside the rest or call the
window all-layer silence. Conversely, if a sparse reduction deliberately
omits a separately attacked source chord at another melody rest, record that
as an omission, not proof that the source lower staff was silent.

A final ascending accompaniment may be reduced to its first root, but the
root keeps its printed short duration. The omitted ascent is not an extra
source rest and does not authorize extending the root through the final
melody. Test exact hold versus silent policy, no retrigger within the hold,
terminal duration/extent and omitted attacks. Separately measure natural
sample and effects tails; the written duration is not a PCM cutoff.

## Different-edition evidence and inferred gaps

A recovered public score with the same title and arranger credit does not prove
identity with an unavailable original photo. If its complete selected route is
adopted, label that edition and its cut points explicitly, retain old data
internally, and invalidate incompatible old backing. Do not use a different
edition's sustained note to silently replace an old melody gap, or use the old
inferred gap alone to truncate backing. Bigfish's selected E4@76.5/2.5 versus
the historical [78.5,79) inferred gap is a concrete regression example.

State the absolute-octave convention used to compile numbered notation as well
as the global key transposition. Read each actual octave dot and each printed
repeat route. Unfamiliar leaps do not justify adding dots; an excerpt that ends
before a later printed repeat is not the full-song ending. Existing AI prompt
rules 1–4 and 6 require these same source, octave, repeat and compatibility
checks; a new edition is not an exemption from them.

## Coherent vocal selection and occurrence-specific articulation

When choosing a shorter edition, first identify its complete recognizable vocal
scope. Do not remove a familiar verse merely to minimize attack count. Record
omitted guitar-only intro separately from retained opening/internal/final vocal
rests; guitar may remain active under a source vocal rest. A whole selected
vocal edition is still not necessarily the complete recorded song form.

Ordinary Road's selected m5–21 retains 93 attacks over 68 beats, including all
62 previously reviewed chorus attacks shifted by exactly 30.5 beats. Source
m5 and m9 have different A4 tie/repetition patterns despite similar phrases.
Read every occurrence rather than copying a prior bar. Preserve cross-bar
holds as one onset and count unique attacks separately from an evidence checker
that compares the same held attack in both overlapping bar spans (96 span
comparisons here represent 93 attacks). Machine fixtures check the adopted
mapping and protect genuine repeats; only actual source inspection establishes
which arc is a tie. Run `scripts/test-ordinary-reviewed-vocal.mjs`, the actual
session loops and rendering-rest regressions when changing this selection.

## Different notation timebases and a familiar theme

Compare actual form, quarter-beat units, printed tempo, meter and tied noteheads
before interpreting a shorter beat count. Summer's selected piano first theme
has16 bars of2/4 and32 quarter beats, with61 attacks from68 printed heads after
seven source ties. The retained edition had64 encoded beats for the same pitch
outline. This is not evidence that half the familiar theme was deleted or that
the unavailable old score was wrong. Use the selected edition's actual timing;
never silently double durations to resemble the old beat count or combine one
version's meter with another's tempo. Separate genuine rhythmic differences
from tied-note merging. Verify all printed occurrences and phrase boundaries.

A faster printed tempo and fewer attacks do not prove easier playing. Record
minimum onset spacing at the actual visible practice speed; distinguish a
score default-speed-button suggestion from initial or remembered user speed.
Summer's0.4 suggestion must not overwrite a user's existing preference. Confirm
meter label, preparation, loop boundaries and ending in the webpage without
inventing bar-based behavior in a player that snaps loops to attacks.

## Source meter labels and actual timing consumers

Inspect actual runtime consumers before describing a meter limitation.
Interstellar's current player loops on attacks and schedules absolute quarter
beats; its old single 3/4 card label did not prove a playback or bar-grid bug.
The inspected source changes to 4/4 at m42, but the fully reviewed note range
still starts at m44. A source-backed 3/4 → 4/4 label can be corrected while
freezing all pitches, absolute timing, repeats, support, speed and deferred
voice/register boundaries. Do not broaden note approval from a meter symbol.
Run `scripts/test-mixed-meter-label.mjs` and preserve historical byte hashes
by precisely removing only the new display metadata during reconstruction.

## Printed repeats, alternate endings and separately written codas

Read the actual repeat signs and first/second-ending boundaries before expanding
a vocal route. Multiple lyric lines alone do not grant repeat expansion. When
a sign really returns to the same printed section, reusing that exact notation
is appropriate; separately printed later stanzas or codas must be read again.
Record whether measure numbers were printed or editorially counted.

The selected Daylily vocal edition has 48 separately printed three-quarter bars.
Its observed route m17–48, m17–32, m49–64 yields 64 bars, 192 quarter beats and
183 distinct attacks. The counted numbers include the omitted 16-bar guitar
intro. No visible vocal tie permits merging its initial three E4 attacks.
Twenty one-beat vocal rests include the final [191,192); guitar activity means
these are not all-layer silence claims. Keep one edition's rest/register/form
consistent instead of mixing the other public edition's held or octave-shifted
notes. A complete and longer route is not automatically easier or shorter.
Run the dedicated source, negative-mutation, full-route, loop and rest-highlight
regressions; an optional private fixture skip must never be counted as source
inspection.

## Complete teaching editions versus inferred repetition

The selected Farewell teaching page prints 24 bars, 86 attacks and96 quarter
beats. Its familiar first16 bars are not the whole printed form: the final8
are explicitly engraved and must be read, not dropped or synthesized from memory.
Multiple lyric rows do not by themselves add repeats, and no visible repeat
instruction should be invented. Staff and numbered notation on that page are
one edition, not independent corroboration. The uniform E-flat-to-C fit keeps
all intervals; six two-beat rests include[94,96). Keep true same-pitch attacks
at the high-tonic return and repeated A4 phrase.70 BPM and easy are practice
choices because the engraving gives no numeric tempo.

A new complete edition can replace a partial earlier selection without proving
the earlier edition wrong. Preserve the full old JSON bytes, identity, source
review and import recovery internally; show one clearly named teaching edition
in practice. Reject old accompaniment whose timeline no longer matches. Run
`test-farewell-teaching-edition.mjs` with optional actual private source evidence,
plus the public timing/rest/render/session cases. These protect the decision;
only viewing the source establishes its literal notation.

## Report compatibility and endpoint regressions

When adding review metadata, preserve the old report fields as a compatibility
contract unless an intentional migration is authorized. Test against a frozen
prior inspector, not the new inspector imported twice. Include fractional tails,
unordered/overlapping intervals, no melody, missing/invalid/short source extents,
independent backing endpoints and pickup beyond an undeclared main-event fallback.
The fallback must not silently grow to fit unverified content. The regression
`test-suitability-extent.mjs` covers these machine-computable facts; it cannot
prove source fidelity or authorize cutting natural audio tails.

## Validating declared ending rests without rewriting music

Reproduce the old built-in boundary failure before repairing validation. The
Daylily183-note candidate ends its melody at191 but its selected source at192;
the final one-beat rest is real. A structurally equivalent accepted external
import can expose a built-in-validator inconsistency, but does not itself prove
the score. Keep the actual source fixture and old-validator hash separate.
Run `test-validator-source-extent.mjs` for V1/V2, positive/fractional extents,
invalid/short/overflow bounds, backing alternatives, pickup and retained
silent/hold enforcement. Do not fix a checker by trimming source rests.


## Sparse support over expanded vocal routes

Map printed chord positions through the same evidenced repeat and ending route
as the selected melody. A first ending is not copied into the second ending;
source symbols counted on the page and their expanded timeline occurrences
are different counts. Keep both auditable before selecting sparse anchors.
A one-root-per-four-bars pattern is one arrangement choice, not a general rule.
Test the exact roots after expansion, all melody/rest tuples unchanged, opt-in
playback and final-rest/loop scheduling. See `docs/DAYLILY_REVIEWED_SUPPORT.md`
and `scripts/test-daylily-reviewed-support.mjs` for a concrete bounded example.

When a score does not print tempo, label audio comparisons by the configured
practice BPM and selected speed, not “source speed”. Measure residual output
without rounding tiny nonzero effects tails into silence. Numerical peak/RMS
checks are distinct from listening approval and should not trigger PCM cuts.

## Explicitly omitted unmeasured ornaments

The Rowing textbook edition shows one small, unmeasured grace note before the
principal note in editorially counted m7. Its separate edition decision omits
that ornament, retaining the principal melody's exact timing; the omission is
visible in the song hint and source metadata. A small note alone does not
justify a guessed 0.25-beat target, shortening the principal or shifting later
onsets. This is different from a measured short-note group or tuplet.

For a new transcription, inspect the actual symbol and source legend. If the
ornament's realization or omission is essential and not selected, obtain that
evidence or decision before generating JSON. Do not silently omit ornaments.
The reusable checker has a synthetic omitted-grace test rejecting added targets,
stolen principal time and shifted onsets. That executable fixture protects an
already reviewed adaptation; it does not recognize ornaments in images or make
an in-range, structurally valid invented duration musically correct.


## Source-image identity and complete written vocal returns

A web catalog's singer or arrangement field can disagree with the actual
engraving. Resolve which fixed image and edition are being selected and record
the conflict; do not silently combine a catalog name with another image's music.
The Qingcheng selected image explicitly labels 鞠婧祎版, while its host catalog
names another singer. Its image hash and visible edition label identify the
adopted source; this is not proof of a particular recording's performance.

All thirty lyric-bearing bars (editorially counted m6–35) are separately
written. Read the later vocal returns, octave dots and independent same-pitch
attacks occurrence by occurrence; the second written ending is part of that
selected line, not an optional repeat guessed from familiarity. The five-bar
intro and five-bar outro are instrumental omissions, not vocal rests. Five
unmeasured grace notes are explicitly omitted without altering principal time.
See `docs/QINGCHENG_REVIEWED_VOCAL.md` and
`scripts/test-qingcheng-reviewed-vocal.mjs`; independent reader fixtures and
runtime loop checks protect different claims. The longer selected edition does
not itself establish easier physical playing or listening acceptance.


## Explicit school fixed-beat edition

`docs/HONGYAN_SCHOOL_EDITION.md` and `scripts/test-hongyan-school-edition.mjs`
show a complete selected route with two cross-system/same-bar tie types,
eight expanded unmeasured grace groups and a fermata. Four tie joins turn102
expanded measured heads into98 attacks; bar occupancy must clip sustained
notes at bar boundaries instead of summing only attacks starting in that bar.
The disclosed practice choice omits unmeasured graces and adds no fermata time.
It uses96 fixed quarter beats, not a claimed exact sung duration;56 BPM is a
practice setting, while the source has no numeric tempo. Distinguish two
independent readings of the same page from two independent published sources,
and do not claim a second complete slur inventory when only one exists.

The portable source regression has an explicit skip when its private source-only
fixture is absent. Set `HONGYAN_SCHOOL_EVIDENCE_PATH` to the verified frozen JSON
to run that separate fixture gate. Neither the skip nor the normal structural
importer certifies source pixels, expressive timing, listening or physical play.


## Complete teaching vocal strophe

`docs/CHILDHOOD_TEACHING_EDITION.md` and its source suite select all16 written
vocal bars once from a guitar teaching score. The lyric-aligned numbered voice
is separate from TAB, and five lyric rows do not create a five-pass instruction.
Seven same-pitch joins reduce86 printed heads to79 attacks; a two-link chain
must be one attack, while the five independent high2s in the next bar remain
five. A slightly heavy single duration line does not become two beams by font
weight. Preserve all three vocal rests, including the half-beat one; guitar
notation underneath does not turn those into all-layer silence. The global
G-to-C shift preserves the key-dependent F-sharp as B, without naturalization.
The whole selected64-beat strophe is not a whole five-verse recording;105 BPM
is a practice choice, with no tempo printed on the adopted pages.

The actual private `CHILDHOOD_SOURCE_EVIDENCE_PATH` gate checks the second
immutable source-only reading. Omission of that fixture is an explicit skip,
not source evidence. The prior two-opening-tie regression still checks the
full archived earlier version and its original hashes, rather than refreshing
those expectations to the new edition.
