---
name: kalimba-tone-trace-compiler
description: Find and cross-check scores from song titles or photos, assess suitability for fixed 21-key C kalimba, and compile validated Kalimba ToneTrace song JSON. Use for song selection, inaccurate melody or tie/tuplet/rest audits, built-in additions, user-upload V2 JSON, and source-backed optional support.
---

# Kalimba Tone Trace Compiler

## Purpose

Compile jianpu or cross-checked online sheet sources into Kalimba ToneTrace data for the `kalimba-tone-trace` open-source project.

Physical practice follows one main melody note at a time. Preserve source harmony as data when useful; it is not an instruction to make the player perform chords or add a chord-practice switch.

- **User upload / local import**: output unified `schemaVersion: 2` with one explicit `role: "melody"`, `judge: true` note per event. Use `arrangementKind: "melody"` / `judgementMode: "melody"`; optional reliable harmony is unjudged source information or quiet `autoAccompaniment`. The webpage label “导入伴奏” denotes provenance, not an app-certified reduction, harmony check or quietness guarantee. Never output top-level `practiceAccompaniment`: new imports reject that built-in playback field, including null/empty values. Do not select the highest/first note to resolve an ambiguous melody.
- **Built-in library**: keep the V1 `steps` melody path and existing V2 source siblings. Add or revise source arrangements only within the request. The main practice UI uses the single melody; `practiceAccompaniment` is a separate optional sparse support candidate, not a new melody or a physical chord target.

## Required References

Before writing song JSON, read:

- `references/kalimba-suitability.md` for the song-fit and transcription-quality gates, including title-only requests and audits of existing songs.
- `references/song-json-schema.md` for V1, V2, accompaniment, and rhythm fields.
- `references/jianpu-transcription-rules.md` for note, rhythm, rest, chord, and accompaniment transcription rules.
- [references/evidence-and-regressions.md](references/evidence-and-regressions.md) when adopting another source edition or importing/correcting ties (including cross-system endpoints), tuplets, source endings, accidentals, melody roles or support conflicts: retain scoped evidence, run applicable executable checks, and complete the separate A/B listening gates.

## Song-Title Source Workflow

Use this workflow when the user gives only a song title and asks Codex to add it to the app, or when the supplied image is not enough to make a reliable arrangement.

1. Search for sources before asking the user for more material. For this project's preferred 拇指琴圈 WeChat index, first read [references/wechat-opencli.md](references/wechat-opencli.md) and use OpenCLI with the existing Chrome extension. If the index has no suitable version, search variants such as `<title> 简谱`, `<title> 卡林巴简谱`, `<title> 简和谱`, `<title> 五线谱`, `<title> MIDI`, `<title> MusicXML`, and `<title> 吉他谱`.
2. Identify the composer/performer, recognizable section and version. Prefer complete rhythmic sources: full score, MusicXML, MIDI, complete jianpu with rhythm, or clear kalimba notation. Use chord-only pages only as harmony support. Assess song fit before transcribing the full arrangement.
3. Save useful source images, screenshots, PDFs, or page captures under `private/sheets/raw/<song-id>/`. Do not commit these files. If a source is web-only, save the URL and review notes under `private/sheets/review/<song-id>.json`.
4. Cross-check at least two independent sources when possible. Melody contour, rhythm, pickup beats, and rests matter more than adding accompaniment. If editions agree only on a local correction, adopt only that mapped range and freeze unresolved conflicts; local agreement does not verify the whole phrase or song.
5. If the best available sources conflict or are too weak, ask the user for specific material: a clearer sheet photo, source URL, MIDI/MusicXML, target performance link, target section, or confirmation that a melody-only import is acceptable.
6. Compile the song only to the confidence level the sources support. Use melody-only V2 when harmony is uncertain; add source harmony information, auto-accompaniment, and `rhythm.restWindows` only after checking the unaccompanied melody. Never use accompaniment to hide unresolved melody errors.
7. For built-in library additions, create or update `data/songs/<song-id>.json` and, when appropriate, `data/songs/<song-id>-chord.json`, then rebuild `src/songs.js`.

Use the user's latest scope: when they accept the published arrangement as-is, compile only that arrangement's supplied extent and label a short arrangement accurately. When replacing an existing built-in, follow the [selected-edition checks](references/evidence-and-regressions.md#selected-shorter-editions). Do not keep requiring the complete original song, invent missing sections, or repeat an already granted GitHub push approval. Source access, musical suitability, and permission to reproduce source material remain separate checks.

## Workflow

1. Locate source images under the project `private/sheets/raw/` when available. If the user supplied only a song title, run the Song-Title Source Workflow first. Do not move raw images into public folders.
2. Inspect the source pixels and transcribe the main melody first. When the visible score edition conflicts with its host catalog, resolve the fixed image identity and record the disagreement; do not combine conflicting singer or arrangement labels. Distinguish an unmeasured grace ornament from a measured figure; never invent its beat value. Read small grace digits separately from tuplet-group numerals using their size, position and covered notes. A grace hook is not an octave dot, and a nearby principal note's dot must not be assigned to the grace. A wavy ornament sign does not by itself supply measured auxiliary notes; explicitly omitted ornaments leave principal timing unchanged. Any selected ornament omission must be explicit and preserve principal timing; otherwise resolve the source or edition decision first. Distinguish proven same-pitch ties, separate repeated attacks and different-pitch slurs; preserve exact tuplet ratios and rests. For a multi-link same-pitch tie chain, inspect every endpoint and merge the entire chain into one attack; an untied same-pitch note outside it still attacks. Do not merge adjacent repeated notes by pattern alone. Read each occurrence of a similar phrase, including later bars on the same page; do not copy its register, rhythm or ties from an earlier occurrence.
3. If the image is blurry, incomplete, or lacks chord/accompaniment/rhythm detail, use online sheet sources for cross-checking. Prefer full score, jianpu, MusicXML, or MIDI over chord-only pages.
4. For new user-upload output, use V2 `events` with one explicit judged melody role per event. If reliable source harmony is retained, keep other notes unjudged; optional backing must not mask unresolved melody or harmonic conflicts.
5. For built-in library work, write the V1 melody song and optionally add a V2 `*-chord.json` arrangement. Use a separate id such as `xuan-cao-hua-chord`.
6. Preserve uncertain or omitted source features in `sourceFeatures` and, for private review, in `private/sheets/review/<song-id>.json`. Record the source/version, inspected location, exact reviewed beat spans, evidence and limits; keep older source notes and unresolved questions. A focused correction does not approve the whole song.
7. Preserve an evidenced ending in `sourceFeatures.sourceTotalBeats`, including final silence, without stretching the last note. A fixed-beat treatment of an unquantified fermata must be explicit even when the choice is no extra hold; do not call nominal beats an exact sung duration. For V2 support, annotate main-melody gaps of 1 beat or longer in `rhythm.restWindows`; keep even shorter source rests free of invented fills.
8. Record the suitability decision, scope, evidence and remaining checks in `sourceFeatures.suitability` and the private review. Long notes alone are not a reason to reject a song. Do not present JSON validation or matching playback to JSON as proof of source fidelity.
9. Compare the unaccompanied phrase to the source/reference, then A/B melody alone versus optional support at source and practice tempo. Record browser audio, reference listening and physical-kalimba checks separately; leave unperformed checks pending. For optional support or gap changes, use the [read-only backing reports](references/evidence-and-regressions.md#read-only-backingreport-review) to inspect both support layers and distinguish inferred gaps from declared silence. Run applicable focused regressions from the evidence reference, then project validation:

```powershell
npm run validate:songs
npm run report:rhythm
npm run report:arrangements
npm run report:suitability
npm run build:songs
npm run check
```

Read report timing fields with their status and basis: legacy `totalBeats` is
the melody endpoint and legacy `gaps` omits endings. The explicit selected
source extent may be unresolved; an inferred ending melody gap is not a claim
of source-wide silence or an audio cutoff. See
`references/kalimba-suitability.md` for the endpoint review contract.


## Guardrails

- Each field name must be unique within its JSON object, including decoded Unicode-escape equivalents, equal repeated values and metadata. Different objects may reuse the same field names. New imports reject the whole batch with the duplicate path and source positions; preserve the complete draft and resolve both contents against the intended score. Never pick the last value, automatically merge or delete a duplicate merely to pass: it can lose melody, backing or an entire song. This guard does not migrate historical stored records. See the [raw JSON boundary](references/song-json-schema.md#raw-json-member-uniqueness).

- Do not commit raw sheet photos, OCR text, or private review notes from `private/sheets/`.
- Do not force chords, bass, or accompaniment into V1 `steps`.
- Do not output V1 JSON for user uploads unless specifically testing backward compatibility; current upload prompts should use V2.
- If source data contains built-in `practiceAccompaniment`, prepare a deliberately reviewed `autoAccompaniment` import representation that preserves all intended backing notes, onsets, durations, volume/default choice, melody timeline, rest policies and source extent. Deleting the unsupported field alone loses music. When both playback layers exist, do not automatically merge, rename or choose one: resolve the intended arrangement with source evidence and user direction. `sourceFeatures.practiceAccompaniment` remains legitimate descriptive metadata, not audio. See the [import boundary](references/song-json-schema.md#external-import-backing-field-boundary); this is not a new runtime layer or a stored-data migration.
- Do not silently guess unreadable notes, rhythms, or chords. Mark uncertain measures or set V2 `rhythm.sourceStatus` / harmony review confidence accordingly.
- Do not publish unresolved core melody/rhythm as an approved arrangement. Find a better source, offer an explicitly scoped excerpt, or ask for a target recording/clear score. Existing inaccurate versions may be withdrawn without banning the song itself.
- If support fills a source rest, remove or trim the support. Do not relabel silence as `hold` to pass validation; a held accompaniment requires positive source evidence and an explicit arrangement decision.
- Essential accidentals must survive a disclosed, interval-preserving global transposition that actually fits the instrument. Never silently replace them with natural notes.
- A disagreement between judged harmony and automatic backing needs a source check. Their intersection can be a conservative candidate, not independent proof of correct harmony.
- Do not make a dense auto-accompaniment pattern just because the schema supports it. A sparse, rest-aware pattern is usually closer to a real kalimba arrangement.
- If online material is not good enough for a high-confidence song, stop and ask for the missing source type instead of presenting a speculative full arrangement as finished.
- Confirm publication rights before committing modern copyrighted songs to the public built-in library.
