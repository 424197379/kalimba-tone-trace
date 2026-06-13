---
name: kalimba-tone-trace-compiler
description: Convert photographed or sourced jianpu numbered notation into validated Kalimba ToneTrace song JSON. Use when Codex needs to transcribe sheet-music photos, batch import songs into data/songs, create user-upload V2 JSON, preserve or build V2 built-in chord arrangements, add auto-accompaniment, rhythm rest windows, or prepare 21-note C kalimba practice songs for the Kalimba ToneTrace app.
---

# Kalimba Tone Trace Compiler

## Purpose

Compile jianpu or cross-checked online sheet sources into Kalimba ToneTrace data for the `kalimba-tone-trace` open-source project.

The app has two different output lanes:

- **User upload / local import**: output unified `schemaVersion: 2` event data. Melody-only uploads are represented as single-note `events`; richer uploads may include chord target notes, `autoAccompaniment`, and `rhythm.restWindows`. The app derives a local melody version automatically, creates a chord version when uploaded events contain chord targets, and creates an accompaniment version when the upload has useful `autoAccompaniment` without chord targets.
- **Built-in library**: keep the V1 melody version and, when requested, create or update a separate V2 `*-chord.json` system arrangement with chord targets, optional auto-accompaniment, and rhythm rest windows.

## Required References

Before writing song JSON, read:

- `references/song-json-schema.md` for V1, V2, accompaniment, and rhythm fields.
- `references/jianpu-transcription-rules.md` for note, rhythm, rest, chord, and accompaniment transcription rules.

## Song-Title Source Workflow

Use this workflow when the user gives only a song title and asks Codex to add it to the app, or when the supplied image is not enough to make a reliable arrangement.

1. Search for sources before asking the user for more material. Try variants such as `<title> 简谱`, `<title> 卡林巴简谱`, `<title> 简和谱`, `<title> 五线谱`, `<title> MIDI`, `<title> MusicXML`, and `<title> 吉他谱`.
2. Prefer complete rhythmic sources: full score, MusicXML, MIDI, complete jianpu with rhythm, or clear kalimba notation. Use chord-only pages only as harmony support.
3. Save useful source images, screenshots, PDFs, or page captures under `private/sheets/raw/<song-id>/`. Do not commit these files. If a source is web-only, save the URL and review notes under `private/sheets/review/<song-id>.json`.
4. Cross-check at least two independent sources when possible. Melody contour, rhythm, pickup beats, and rests matter more than adding accompaniment.
5. If the best available sources conflict or are too weak, ask the user for specific material: a clearer sheet photo, source URL, MIDI/MusicXML, target performance link, target section, or confirmation that a melody-only import is acceptable.
6. Compile the song only to the confidence level the sources support. Use melody-only V2 when harmony is uncertain; add chord targets, auto-accompaniment, and `rhythm.restWindows` only when they improve the result.
7. For built-in library additions, create or update `data/songs/<song-id>.json` and, when appropriate, `data/songs/<song-id>-chord.json`, then rebuild `src/songs.js`.

## Workflow

1. Locate source images under the project `private/sheets/raw/` when available. If the user supplied only a song title, run the Song-Title Source Workflow first. Do not move raw images into public folders.
2. Inspect the image and transcribe the main melody first. Keep rests as beat gaps.
3. If the image is blurry, incomplete, or lacks chord/accompaniment/rhythm detail, use online sheet sources for cross-checking. Prefer full score, jianpu, MusicXML, or MIDI over chord-only pages.
4. For user-upload output, use V2 `events`. If only the melody is reliable, emit one judged melody note per event; if chord targets or accompaniment are reliable, include them in the same V2 object.
5. For built-in library work, write the V1 melody song and optionally add a V2 `*-chord.json` arrangement. Use a separate id such as `xuan-cao-hua-chord`.
6. Preserve uncertain or omitted source features in `sourceFeatures` and, for private review, in `private/sheets/review/<song-id>.json`.
7. For V2 built-ins with auto-accompaniment, add `rhythm.restWindows` for main-melody gaps of 1 beat or longer and make accompaniment rest-aware.
8. Run validation before finishing:

```powershell
npm run validate:songs
npm run report:rhythm
npm run build:songs
npm run check
```

## Guardrails

- Do not commit raw sheet photos, OCR text, or private review notes from `private/sheets/`.
- Do not force chords, bass, or accompaniment into V1 `steps`.
- Do not output V1 JSON for user uploads unless specifically testing backward compatibility; current upload prompts should use V2.
- Do not silently guess unreadable notes, rhythms, or chords. Mark uncertain measures or set V2 `rhythm.sourceStatus` / harmony review confidence accordingly.
- If V2 accompaniment fills a melody rest, either remove that accompaniment event or mark the rest as an intentional `hold`; default long rests are `silent`.
- Do not make a dense auto-accompaniment pattern just because the schema supports it. A sparse, rest-aware pattern is usually closer to a real kalimba arrangement.
- If online material is not good enough for a high-confidence song, stop and ask for the missing source type instead of presenting a speculative full arrangement as finished.
- Confirm publication rights before committing modern copyrighted songs to the public built-in library.
