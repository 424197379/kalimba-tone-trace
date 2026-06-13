# Score Compiler Workflow

This project includes a public Codex skill template at `skills/kalimba-tone-trace-compiler/`. Use it when converting numbered notation, photographed jianpu, or sourced sheet material into Kalimba ToneTrace JSON.

## Local Source Folders

Use these local-only folders while compiling songs:

```text
private/sheets/raw/       Original sheet photos or downloaded source images.
private/sheets/ocr/       OCR text and AI intermediate transcriptions.
private/sheets/review/    Human or AI review notes, source conflicts, listening notes.
data/songs/               Public built-in song JSON output.
```

Do not commit original sheet photos, OCR text, or review records from `private/`.

## Recommended Flow

1. Put source images in `private/sheets/raw/<song-id>/`. If the user only gives a song title, search for sources first and save useful downloaded images, screenshots, PDFs, or source notes in the same private source folders.
2. If OCR is useful, put intermediate OCR output in `private/sheets/ocr/<song-id>/`.
3. Read the main melody first. Keep it playable on 21-key C kalimba.
4. Convert rests to beat gaps, not rest notes.
5. If the image is blurry or lacks rhythm/chord details, cross-check with online sources.
6. Prefer complete score, MusicXML, MIDI, or full jianpu with rhythm over chord-only pages.
7. Record uncertainty in `sourceFeatures` or in `private/sheets/review/<song-id>.json`.
8. Write public built-in output to `data/songs/*.json`.
9. Build and validate before committing.

```powershell
npm run validate:songs
npm run build:songs
npm run check
```

For V2 accompaniment work:

```powershell
npm run report:rhythm
npm run report:arrangements
```

## Song Title Only

When the request is only "add this song", the compiler should behave like the `tai-yang-zhao-chang-sheng-qi` workflow: search for the score, preserve the useful source material privately, cross-check melody and rhythm, then compile the best supported app data.

Recommended search variants include `<title> 简谱`, `<title> 卡林巴简谱`, `<title> 简和谱`, `<title> 五线谱`, `<title> MIDI`, `<title> MusicXML`, and `<title> 吉他谱`.

Ask the user for more material only after a reasonable search, and be specific about the missing piece: clearer sheet image, source URL, MIDI/MusicXML, target performance, target section, or confirmation that a melody-only version is acceptable.

## Melody First

For built-in melody versions, keep `schemaVersion: 1` and write only the main melody in `steps`. The melody should be recognizable and judgeable as single notes.

Do not put simultaneous chord tones, strums, or accompaniment directly into V1 `steps`.

## Chords And Accompaniment

When a source contains chords, double notes, arpeggios, or accompaniment:

- Record omitted source features in `sourceFeatures`.
- Use V2 chord arrangement files only when the arrangement is deliberate and validated.
- Keep chord targets playable on 21-key C kalimba.
- Thin dense chords to useful 2-4 note targets.
- Keep automatic accompaniment sparse and quieter than the melody.
- Do not fill melody rests by default. A main-melody gap of 1 beat or longer is usually a breathing space.
- If accompaniment must continue through a rest, mark that decision clearly with source evidence.

## Common Pitfalls

- Do not trust one blurry photo for rhythm. Cross-check bar lines, underlines, dots, ties, and pickup beats.
- Do not treat `0` as a note. It is a rest and should become a beat gap.
- Do not transpose by note names first when the source key is not C. Read the source key, then map the melody into C for this app.
- Do not invent accompaniment just to make the playback busy. Sparse, source-aware accompaniment usually sounds closer to a real kalimba arrangement.
- Do not ignore source conflicts. Mark `needs-review` or keep the main melody only.
- Watch for terminal encoding issues. If Chinese text appears as `????`, verify the actual file with UTF-8-aware tooling before committing.

## Copyright And Publication

Modern songs and sheet images may be copyrighted. Public PRs should include source and authorization notes where possible. Do not publish copied sheet photos, OCR dumps, or full third-party scores in this repository.
