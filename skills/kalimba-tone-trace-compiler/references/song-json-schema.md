# Song JSON Schema

Use this reference when producing `data/songs/*.json` or user-import JSON for Kalimba ToneTrace.

## Shared Rules

- Use only 21-key C kalimba notes:
  `F3, G3, A3, B3, C4, D4, E4, F4, G4, A4, B4, C5, D5, E5, F5, G5, A5, B5, C6, D6, E6`.
- Use ASCII lowercase hyphenated ids and filenames, for example `xuan-cao-hua.json`.
- Keep Chinese display names in `title` when needed.
- `beat` starts at 0. `duration` is measured in beats. Fractional tuplets are legal numeric values: calculate `1/3` etc. rather than rounding to a quarter grid. JSON itself cannot contain arithmetic expressions.
- Rests are represented by gaps between notes/events. Do not add rest notes or fake held durations. If the source ends after the final event, preserve its finite nonnegative numeric extent in `sourceFeatures.sourceTotalBeats`; do not infer extra bars. Legacy/runtime timeline fallback uses at least the event end; new imports reject an explicitly shorter source extent rather than repairing it.
- `difficulty` is `"easy"`, `"medium"`, or `"hard"`.
- Preserve a known source `bpm` and beat unit. Use `defaultSpeedFactor` / practice speed for slowing down rather than normalizing source tempo to a library range.
- `beatsPerMeasure` is the source meter when known; otherwise infer from bars and rhythm.
- When using web sources, keep source URLs and confidence decisions in `rhythm.sources`, `sourceFeatures`, or private review notes. Do not commit downloaded source images or full copied third-party scores.
- New built-ins should record a scope-specific `sourceFeatures.suitability` summary as described in `kalimba-suitability.md`. It is review metadata, not a new playback schema or an automatic approval.

## New-import checks versus legacy fallback

New imports are checked before normalization. Supplied `bpm` must be numeric 40–220, `defaultSpeedFactor` 0.35–1.4, and `beatsPerMeasure` an integer 2–8. Preserve actual timing and explain unsupported meter/tempo instead of rounding it to pass; source-backed fractional beats/durations remain legal.

Unsupported pitches, invalid roles/timing and ambiguous melody roles are errors. A supplied `sourceTotalBeats` must be finite, nonnegative and cover all notes, backing, rest windows and pickup. A declared ending rest extending beyond the final note requires this source extent. Rest windows cannot overlap melody, silent windows cannot overlap automatic backing, and backing cannot duplicate the melody's same-onset same-pitch attack. The importer reports these conflicts rather than silently discarding notes/backing or stretching durations.

Older stored records retain their separate tolerant read/runtime fallback; that behavior is not permission to emit invalid new JSON. Exercise the actual parser with `node --test scripts/test-import-score-contract.mjs scripts/test-song-store.mjs`; the skill's fixture checker checks only explicit reviewed evidence and is not a full schema validator.

### Raw JSON member uniqueness

Every object in a new pasted JSON document must have unique decoded field
names. This covers nested notes, events, timing, source metadata and batch
wrappers, including identical repeated values. Escaped spellings such as
`"events"` and `"e\u0076ents"` name the same field. No case-folding, trimming
or Unicode normalization is applied; different objects may reuse field names,
and key-looking text inside a string is not a member.

The original text is checked after JSON grammar validation and before song
unwrapping, normalization or storage. A duplicate rejects the entire new import
with its JSON path and first/repeated line and column (one-based Unicode code
points; CRLF counts as one newline). Long/control-filled path labels are
escaped and shortened for display only. The complete pasted draft and existing
library remain untouched. Preserve both contents and resolve the intended
music against the source; never simply choose the last value, merge arrays or
delete the reported field to make the import pass. Identical duplicate values
and duplicate metadata are intentionally rejected too, rather than creating
exceptions that can hide later mistakes. Historical stored reads are not
migrated or revalidated by this new-input boundary.

Run `node --test scripts/test-import-duplicate-fields.mjs` alongside the existing
import contract tests. These checks prevent ambiguous content loss, not musical
transcription errors or source-fidelity failures.

### External-import backing field boundary

New imports reject an own top-level `practiceAccompaniment` field on each song
or on a batch `{ "songs": [...] }` wrapper. This is a built-in playback layer,
not an external-upload alias for `autoAccompaniment`. Rejection is based on
field presence, including `null`, empty, malformed or otherwise valid values,
and still applies when `autoAccompaniment` is also present. Do not remove the
field just to make the file import and silently lose its music. Review and
prepare a supported `schemaVersion: 2` representation with the intended backing
in `autoAccompaniment`, preserving every intended note, attack, onset, duration,
volume/default setting, melody timebase, `rhythm.restWindows` policy (including
evidenced `hold`) and `sourceFeatures.sourceTotalBeats`. If both layers exist,
do not automatically merge, rename, overwrite or select one; resolve their
source/arrangement intent before producing the upload.

`sourceFeatures.practiceAccompaniment` is allowed as descriptive review metadata;
it does not play audio. Unrelated metadata is not prohibited by this guard.
Supported V2 `autoAccompaniment`, V1/notation compatibility without the reserved
field, and built-in/historical stored reads remain unchanged. A bad entry in a
batch rejects the whole new import before saving or changing the current song.
See [IMPORT_BACKING_FIELD_GUARD.md](../../../docs/IMPORT_BACKING_FIELD_GUARD.md)
for the current contract and regressions; older verification records describe
their historical importer behavior, not an exception to this boundary.

## V1 Melody Schema

Use V1 for legacy files and for built-in melody versions. Current user uploads should use the V2 upload schema below; the app may still accept legacy V1-like `notation` or `steps` and convert them into V2 melody events.

```json
{
  "schemaVersion": 1,
  "id": "xuan-cao-hua",
  "title": "Xuan Cao Hua",
  "uploader": "system",
  "practiceTitle": "Xuan Cao Hua practice track",
  "scoreTitle": "Xuan Cao Hua jianpu progress",
  "hint": "Melody-only practice version.",
  "difficulty": "easy",
  "bpm": 88,
  "defaultSpeedFactor": 0.9,
  "beatsPerMeasure": 4,
  "key": "C",
  "steps": [
    ["C4", 0, 1],
    ["D4", 1, 1]
  ],
  "sourceFeatures": {
    "hasChords": false,
    "hasArpeggio": false,
    "hasRepeats": false,
    "unsupported": [],
    "unsureMeasures": []
  }
}
```

`steps` must be non-empty and sorted by non-decreasing beat. Each step is `[noteName, beat, duration]`.

Do not use this as the current user-facing upload target unless specifically testing backward compatibility.

## V2 Upload And Chord Schema

Use V2 for current user uploads/local imports and preserved source arrangements. New imports expose a single-melody physical practice path: use `arrangementKind: "melody"` / `judgementMode: "melody"`, exactly one explicit `role: "melody"` per event, and `judge: true` on that note. If harmony is retained in the event, set it unjudged. Optional app-played support belongs in `autoAccompaniment`. Never resolve an ambiguous melody by pitch height or array order.

For built-ins, keep the V1 melody and existing separate V2 source records, usually `<base-id>-chord.json`. Historical chord targets remain source data; they do not authorize a new chord-practice UI or a melody rewrite. The importer may retain a source arrangement sibling for management while physical practice uses its derived melody. Use only fields supported by current code; do not invent a new playback schema for review evidence.

Example new import retaining an unjudged source chord:

```json
{
  "schemaVersion": 2,
  "id": "xuan-cao-hua",
  "title": "Xuan Cao Hua",
  "versionLabel": "Melody version",
  "arrangementKind": "melody",
  "judgementMode": "melody",
  "uploader": "system",
  "practiceTitle": "Xuan Cao Hua melody practice track",
  "scoreTitle": "Xuan Cao Hua melody jianpu progress",
  "hint": "Follow the single melody; retained harmony is source information.",
  "difficulty": "medium",
  "bpm": 88,
  "defaultSpeedFactor": 0.85,
  "beatsPerMeasure": 4,
  "key": "C",
  "tuning": "21-key-c",
  "events": [
    {
      "beat": 0,
      "duration": 1,
      "judgeWindow": 0.6,
      "notes": [
        { "name": "E4", "role": "melody", "judge": true, "velocity": 1 },
        { "name": "C4", "role": "harmony", "judge": false, "velocity": 0.72 },
        { "name": "G3", "role": "bass", "judge": false, "velocity": 0.6 }
      ]
    }
  ]
}
```

V2 event rules:

- `notes[].role` is one of `"melody"`, `"harmony"`, `"bass"`, `"arpeggio"`, or `"ornament"`.
- `judgementMode: "melody"` exposes only the melody note as the practice target.
- Historical `judgementMode: "chord"` records preserve chord-target intent; the main physical practice UI projects a single explicit melody. Do not use chord mode for new single-melody imports.
- Use `judgeWindow` around `0.45` to `0.8` beats as a visual/following window for chord events that may be played as a sweep or broken chord.
- Do not duplicate the same note name inside one event. A multi-note import must have exactly one explicit melody role; multiple roles remain ambiguous even if only one is judged.

## Auto Accompaniment

V2 uploads and built-ins may include `autoAccompaniment`. These notes are played by the app and are not user-played practice targets.

```json
"autoAccompaniment": {
  "enabledByDefault": false,
  "volume": 0.38,
  "events": [
    {
      "beat": 0,
      "duration": 0.75,
      "pattern": "source-chord",
      "notes": [
        { "name": "G3", "role": "bass", "velocity": 0.42 },
        { "name": "C4", "role": "harmony", "velocity": 0.36 }
      ]
    }
  ]
}
```

Auto-accompaniment rules:

- Do not put `judge` on accompaniment notes.
- Keep velocity lower than melody, usually `0.30` to `0.45`.
- Generate sparse, quiet support only from verified harmony or an explicitly requested labeled candidate. Start new practice support opt-in; preserve existing user-selected settings. Avoid fills in melody rests or patterns that compete with the melody.
- For the current app, accompaniment is for listening/following; practice target highlighting still follows the selected version.

## Rhythm Rest Windows

V2 songs with accompaniment should include `rhythm` so accompaniment respects melody rests.

```json
"rhythm": {
  "sourceStatus": "needs-review",
  "pickupBeats": 0,
  "restWindows": [
    { "beat": 13.5, "duration": 2.5, "policy": "silent", "reason": "phrase-rest" }
  ],
  "sources": [
    { "label": "Qupu123 jianpu source", "url": "https://example.com/source" }
  ]
}
```

Rhythm rules:

- `sourceStatus` is `"verified"`, `"inferred"`, or `"needs-review"`.
- Add `restWindows` for melody gaps of 1 beat or longer.
- Default rest policy is `"silent"`: no auto-accompaniment event should overlap the window.
- Use `"hold"` only when positive source evidence supports a held accompaniment in the chosen arrangement. Never change a source rest to `hold` merely to make a conflict validate; remove or trim unsupported overlap.
- Put external rhythm/chord references in `sources` when used.
- Use `sourceStatus: "verified"` only when the rhythm and rest decisions are backed by a reliable source or multiple consistent sources. Use `"inferred"` or `"needs-review"` when the arrangement depends on conservative AI inference.

## Validation

After changing built-in songs or import code, run:

```powershell
npm run validate:songs
npm run report:rhythm
npm run build:songs
npm run check
```

Fix validation errors before finishing. Existing intentional warnings may remain only when documented. Run the applicable focused fixtures and A/B acceptance from [evidence-and-regressions.md](evidence-and-regressions.md); structural validation does not verify source pixels or listening quality.


## Optional conservative practice support

Built-in V2 source records may include `practiceAccompaniment`, with the same
validated shape as `autoAccompaniment`. It is a separate, optional reduced
support candidate, never a second melody or a judged physical chord target.
Record source membership, unresolved conflicts, and review scope under
`sourceFeatures.practiceAccompaniment`. The main single-note practice UI may
borrow support only from a content-compatible source sibling. Keep the original
`autoAccompaniment` intact for comparison and restoration. Current candidates
are opt-in (`enabledByDefault: false`); do not infer musical approval from
validation. Multi-note imports must identify a unique explicit melody role.

This section describes built-in/legacy runtime data only. New user-upload JSON
must follow the [external-import boundary](#external-import-backing-field-boundary),
even when the built-in and external backing objects happen to have the same shape.

After any melody pitch, onset, duration, length or BPM change, recheck inherited
`practiceAccompaniment` and `autoAccompaniment`; a matching title/base id does
not establish compatibility. The current `hasMatchingPracticeMelody` guard
compares the explicitly identified melody's pitch/onset/duration sequence, BPM
and effective ending extent, including known final silence, with timing
tolerance for numeric fractions. Ambiguous melody roles fail the check.
Use these content checks rather than requiring a new revision field merely to
establish a match. Compatibility is necessary for reuse, not proof of harmonic
correctness: source harmony, rest conflicts and the separate listening gates
still need review.

### Imported-backing playback and review identity

The webpage label “导入伴奏” identifies external `autoAccompaniment`; it does
not mean the app has reduced its density, validated its harmony or lowered its
volume. Keep the actual source-supported events and settings intact. Review
full event spans, onset density, rests and audible balance separately. A stored
playback choice is a user preference, not evidence of musical correctness.
Changing melody or the selected supporting content must not silently carry an
old on choice into a different arrangement. Test the actual import → select →
playback → reload → off flow as well as JSON structure and stored values.

## Meter display is not a timing map

`sourceFeatures.meterDisplay` optionally supplies a source-backed card label.
The current display accepts one to eight `2/4` through `8/4` terms separated
exactly by ` → `; malformed or unsupported text falls back to beatsPerMeasure/4.
It does not accept or execute HTML, alter beat units, subdivide measures,
rescale notes, change playback/count-in, or create bar-snapped loops. Retain
actual absolute quarter-beat timings and record inspected source change points
separately. This label does not certify the notes or omitted sections. Do not
change a source denominator merely to fit the label grammar.

### Built-in source extent and rhythm-window bounds

Built-in `practiceAccompaniment`, like `autoAccompaniment` and `rhythm`, is a
V2-only playback field. A V1 top-level practice layer is rejected rather than
allowed to disappear in normalization; similarly named source metadata remains
non-playing documentation.

The built-in validator must bound rhythm rest windows by a usable declared
`sourceFeatures.sourceTotalBeats`, not merely the final sounding event. A
melody ending at191 with an evidenced final rest[191,192) is structurally valid
when total192 is declared. Never delete that rest, stretch the preceding note
or shorten the source scope to appease an older last-event-only check.

A supplied extent must be a finite nonnegative number covering main events,
both backing alternatives, rhythm rest windows and pickup; invalid/short values
are errors, not coerced strings or silently enlarged totals. With no declaration
the existing event-end fallback remains. This does not permit invented ending
bars or weaken melody overlap, silent/hold or support checks. Test valid and
invalid boundaries against both built-in validation and the actual import path;
legacy storage normalization remains a distinct compatibility concern. See
`../../../docs/VALIDATOR_SOURCE_EXTENT.md`.


### Batch failure recovery

For a multiple-song import, locate the error by its original input-song ordinal,
bounded title and original field/reason. An ordinal is not an internal generated
variant index or a note index. Keep the complete input while correcting the
identified score with source evidence; do not discard an invalid song or pitch
to make the batch appear successful. A failed batch saves no partial prefix and
must not change selection. Retain singleton and wrapper-level diagnostics where
no particular song has been selected for validation. See
`../../../docs/IMPORT_BATCH_CONTEXT.md` and its executable regression suite.
