# Optional internal sampled-audio QA, 2.4.2

The user declined listening deliverables. No user audio review or approval is pending. The following is an optional, local, non-publishing QA workflow; it does not request a listening pass or certify subjective quality.

## Candidate and source boundaries

- Frozen before input: portable v2.4.1 ZIP, 196 melody attacks.
- Current candidate: 181 attacks, 69 quarter-note BPM, 1.0 speed, 124 notated beats including the final melody-only rest `[120,124)`.
- Entire measure 28 `[108,112)` keeps its eight v2.4.1 tuples verbatim. Its pitch and rhythm remain unverified; the complete candidate is not fully source-approved.
- Independently authored source expectations for the adopted later spans, the unchanged opening, and the frozen pending bar reconstruct the candidate exactly. Expected compact-JSON tuple SHA-256: `250f5b00a44b7b6708a0d200bb1ed5d212fe313b714dade2e0d1b25d397a7d14`.
- Actual song file at this QA: `c3dbfbfd9398e5956d0c4c42f5c29d625b928ff8c45c1646192f9db03de16480`.

The final source bar is **melody-only** silence. The selected source has a separate accompaniment outro; this app's V1 render does not include it.

## Reproduce without Git or audio export

From an extracted repository archive, with Python 3.10+, numpy, ffmpeg and ffprobe already installed:

```sh
python3 scripts/render-reviewed-song-comparison.py \
  --before-zip /path/to/kalimba-tone-trace-v2.4.1-local-preview.zip \
  --output /path/outside/repository/kalimba-reviewed-qa \
  --qa-only
```

The default after input is the actual repository JSON, rechecked after rendering. After future changes, add `--after-zip /path/to/kalimba-tone-trace-v2.4.2-local-preview.zip` for strict historical replay. No network, Git, user-machine access or publication is involved. With `--qa-only`, only a manifest and QA text report are written; no audio files are exported.

The renderer also retains an optional export mode for explicit future use. It is not required for this release. The historical opening/tie and middle-phrase renderers keep their own exact scopes and reject later changes unless supplied the appropriate historical after ZIP.

## Verified signal behavior

- Exactly the same 21 real sample files, sample manifest and physical keyboard panning layout as the frozen input.
- Fixed output attenuation 0.8, voice gain 0.92 and melody velocity 1.0. No per-version normalization, accompaniment, reverb, compressor, synthetic sustained tone or forced sample gate.
- Both versions use the same source beat origin. Excerpts retain preceding natural tails by rendering from the song origin before cropping.
- The default representative excerpt selects attacks in `[16,49)`, including the independent D5 at 48.5, and retains all final natural tails. Its A/B pause is exactly 1.5 seconds of digital silence.
- The complete A/B PCM arrays share 5,211,652 frames at 48 kHz, or **108.576083 seconds**.
- Full candidate B peak: **0.530392838**, approximately **−5.508 dBFS**. No clipped or non-finite samples in any rendered variant.
- Full and excerpt A-minus-B residuals after subtracting only the expected removed/added sample attacks: **1.1102230246251565e−16**. Duration-only tie changes do not fabricate sustained energy.
- Final melody-rest timestamps: **104.597833–108.076083 seconds**. The actual final sample tail ends at **106.059042 seconds**; subsequent PCM is exact digital silence. The final C5 is not extended into the rest.
- The frozen pending measure is at **94.163042–97.641313 seconds** in the complete PCM timeline.

These tests establish input consistency, scoped sample scheduling, natural decay and signal validity. They do not establish reference-recording listening acceptance, browser audio behavior, physical-kalimba playability, whole-song/source-version fidelity or publication rights.
