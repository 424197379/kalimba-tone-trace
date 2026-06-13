# Song Library

Built-in songs live in `data/songs/`. Each JSON file represents one song version.

## File And Id Rules

- Use one file per song version: `data/songs/<id>.json`.
- Use ASCII lowercase letters, digits, and hyphens for file names and `id`.
- Keep Chinese display names in `title`.
- Use `uploader: "system"` for built-in songs.
- Do not edit `src/songs.js`; run `npm run build:songs` after changing `data/songs`.

Example file name:

```text
data/songs/xiao-xing-xing.json
```

## 21-Key C Kalimba Range

The current app targets a 21-note C kalimba:

```text
F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6 D6 E6
```

Every judged note in built-in song data must be in this range.

## Formal V1 Melody Schema

The current formal built-in melody schema is `schemaVersion: 1`. It supports single-note main melody practice.

```json
{
  "schemaVersion": 1,
  "id": "xiao-xing-xing",
  "title": "《小星星》",
  "uploader": "system",
  "practiceTitle": "《小星星》练习轨道",
  "scoreTitle": "《小星星》简谱进度",
  "hint": "主旋律练习版。",
  "difficulty": "easy",
  "bpm": 80,
  "defaultSpeedFactor": 0.9,
  "beatsPerMeasure": 4,
  "key": "C",
  "steps": [
    ["C4", 0, 1],
    ["C4", 1, 1],
    ["G4", 2, 1]
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

Required fields:

- `schemaVersion`: use `1` for normal melody contributions.
- `id`: same base name as the file.
- `title`: display title.
- `uploader`: usually `"system"` for built-in songs.
- `practiceTitle` and `scoreTitle`: UI labels.
- `hint`: short source or practice note.
- `difficulty`: `"easy"`, `"medium"`, or `"hard"`.
- `bpm`: practice tempo.
- `defaultSpeedFactor`: initial playback/practice speed factor.
- `beatsPerMeasure`: source meter.
- `key`: current built-ins should use `"C"`.
- `steps`: the single-note melody.

## Steps Format

Each `steps` entry is:

```json
["G4", 0, 1]
```

Meaning:

- index `0`: note name.
- index `1`: start beat, starting from `0`.
- index `2`: duration in beats.

Rests are represented by gaps between beats. Do not write rest notes.

## Chords, Double Notes, Strums, And Accompaniment

Do not force non-melody material into V1 `steps`. Keep `steps` as the recognizable, judgeable main melody.

When the source has extra information:

- Set `sourceFeatures.hasChords` when chord symbols or chord tones exist.
- Set `sourceFeatures.hasArpeggio` when the source includes arpeggio, strum, or broken-chord material.
- Set `sourceFeatures.hasRepeats` when the source has repeat signs that were expanded or simplified.
- Use `sourceFeatures.unsupported` to describe omitted chords, double notes, strums, accompaniment, ornaments, or source constraints.
- Use `sourceFeatures.unsureMeasures` for unclear measures, rhythm, or chord decisions.

The app also contains V2 arrangement support for chord versions and automatic accompaniment. That is data-layer work. Do not break the V1 single-melody workflow when adding richer information.

## Pull Request Requirements

Before submitting a new or changed built-in song:

```powershell
npm run validate:songs
npm run build:songs
npm run check
```

If the change includes V2 accompaniment or rhythm windows:

```powershell
npm run report:rhythm
npm run report:arrangements
```

Do not submit raw sheet photos, OCR text, or private review notes. Put that material under `private/` locally only.
