# Contributing

Thanks for helping improve Kalimba ToneTrace. This project welcomes bug reports, small feature improvements, documentation updates, and playable song data contributions.

## Reporting Bugs

When reporting a bug, include:

- Device and browser.
- Whether you used the online app, installed PWA, or local server.
- Steps to reproduce.
- Expected behavior and actual behavior.
- Screenshot or screen recording when it helps.
- Console errors if available.

## Submitting New Songs

New built-in songs should be added under `data/songs/*.json`.

Rules:

- Use an ASCII lowercase hyphenated file name and `id`.
- Put the Chinese display title in `title`.
- Main-melody PRs are allowed and encouraged.
- The stable built-in melody format is `schemaVersion: 1` with single-note `steps`.
- A song may include source notes for chords, double notes, strums, or accompaniment in `sourceFeatures`.
- Rich chord or accompaniment data is allowed only as data-layer work that preserves the single-note main melody flow.
- Do not submit raw sheet photos, OCR dumps, or copied third-party score images.
- Include source and authorization notes where possible, especially for modern copyrighted songs.

Before opening the PR:

```powershell
npm run validate:songs
npm run build:songs
npm run check
```

## Submitting Feature Changes

Small, scoped feature PRs are welcome. For now, avoid broad changes to:

- Core audio playback architecture.
- Microphone pitch-detection architecture.
- PWA cache foundation.
- Overall visual design system.

If a feature requires one of those areas, open an issue first and describe the design.

## Local Development

```powershell
npm start
```

Then open:

```text
http://localhost:8123/index.html
```

## Pull Request Checklist

- Read `AGENTS.md` if using an AI assistant.
- For song changes, read `docs/SONG_LIBRARY.md`.
- For sheet-photo transcription, read `docs/SCORE_COMPILER.md`.
- Run the required commands:

```powershell
npm run validate:songs
npm run build:songs
npm run check
```

- Confirm `src/songs.js` was generated, not hand-edited.
- Confirm private sheet materials were not staged.
- Update release docs or changelog only when appropriate for the change.

## Copyright

Do not upload infringing sheet music. If you request or contribute a modern copyrighted song, describe the source and authorization status. Public song data should be a playable practice transcription, not a copied score image or OCR dump.
