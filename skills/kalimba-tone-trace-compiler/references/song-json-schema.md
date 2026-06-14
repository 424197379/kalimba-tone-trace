# Song JSON Schema

Use this reference when producing `data/songs/*.json` or user-import JSON for Kalimba ToneTrace.

## Shared Rules

- Use only 21-key C kalimba notes:
  `F3, G3, A3, B3, C4, D4, E4, F4, G4, A4, B4, C5, D5, E5, F5, G5, A5, B5, C6, D6, E6`.
- Use ASCII lowercase hyphenated ids and filenames, for example `xuan-cao-hua.json`.
- Keep Chinese display names in `title` when needed.
- `beat` starts at 0. `duration` is measured in beats.
- Rests are represented by gaps between notes/events. Do not add rest notes.
- `difficulty` is `"easy"`, `"medium"`, or `"hard"`.
- `bpm` should normally be 72-120 for practice unless the source clearly indicates otherwise.
- `beatsPerMeasure` is the source meter when known; otherwise infer from bars and rhythm.
- When using web sources, keep source URLs and confidence decisions in `rhythm.sources`, `sourceFeatures`, or private review notes. Do not commit downloaded source images or full copied third-party scores.

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

Use V2 for all current user uploads/local imports and for system chord arrangements. For user uploads, emit a single V2 object: melody-only songs use one judged melody note per event, while richer arrangements may include harmony/bass target notes, `autoAccompaniment`, and `rhythm`. The app derives the local melody version automatically, creates a chord version when chord targets are present, and creates an accompaniment version when useful `autoAccompaniment` is present without chord targets. For built-in library songs, keep separate files when needed, usually `<base-id>.json` and `<base-id>-chord.json`.

When only a song title is supplied, build this V2 object from cross-checked sources. If melody and rhythm are reliable but harmony is not, set `arrangementKind: "melody"` / `judgementMode: "melody"` and omit chord target notes. If accompaniment is useful but should not be judged, put it under `autoAccompaniment` rather than in judged `events[].notes`.

```json
{
  "schemaVersion": 2,
  "id": "xuan-cao-hua-chord",
  "baseSongId": "xuan-cao-hua",
  "title": "Xuan Cao Hua",
  "versionLabel": "Chord version",
  "arrangementKind": "chord",
  "judgementMode": "chord",
  "uploader": "system",
  "practiceTitle": "Xuan Cao Hua chord practice track",
  "scoreTitle": "Xuan Cao Hua chord jianpu progress",
  "hint": "Follow the marked melody and chord target notes as practice targets.",
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
        { "name": "C4", "role": "harmony", "judge": true, "velocity": 0.72 },
        { "name": "G3", "role": "bass", "judge": true, "velocity": 0.6 }
      ]
    }
  ]
}
```

V2 event rules:

- `notes[].role` is one of `"melody"`, `"harmony"`, `"bass"`, `"arpeggio"`, or `"ornament"`.
- `judgementMode: "melody"` exposes only the melody note as the practice target.
- `judgementMode: "chord"` exposes every `judge: true` note in the event as practice targets.
- Use `judgeWindow` around `0.45` to `0.8` beats as a visual/following window for chord events that may be played as a sweep or broken chord.
- Do not duplicate the same note name inside one event.

## Auto Accompaniment

V2 uploads and built-ins may include `autoAccompaniment`. These notes are played by the app and are not user-played practice targets.

```json
"autoAccompaniment": {
  "enabledByDefault": true,
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
- Generate sparse, playable patterns. Avoid dense fills that compete with the melody.
- For the current app, accompaniment is for listening/following; practice target highlighting still follows the selected version.

## Rhythm Rest Windows

V2 songs with accompaniment should include `rhythm` so accompaniment respects melody rests.

```json
"rhythm": {
  "sourceStatus": "verified",
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
- Use `"hold"` only when the source or musical context clearly calls for a held accompaniment tone; allow at most one soft event near the rest start.
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

Fix validation errors before finishing. Existing intentional warnings may remain only when documented.
