# 《送别》: narrowly reviewed cadence, 2.4.5

## Decision

Adopt the already cited [GuitarWorld C-major arrangement](https://www.guitarworld.com.cn/pu/q45790) only for its unambiguous public-preview bars 7–8, beats 24–32. Change five V1 pitch fields down one octave: D5→D4 at 25, E5→E4 at 25.5, F5→F4 at 26, B4→B3 at 27.5, and C5→C4 at 28. The initial G4 at 24 is unchanged.

This is a source-specific correction to the existing single-note practice melody, not a claim that the unavailable original kalimba photo or every other edition was wrong. It is not whole-song approval or a replacement with a complete new arrangement.

All 58 attack onsets and durations, the 64-beat encoded extent, the 53 unaffected pitches, and the existing two-beat gaps at 14–16, 30–32 and 46–48 stay unchanged. No repeated attacks, fills, chords or new accompaniment are added. No `sourceTotalBeats` is asserted: the retained encoded ending is not a verified source ending.

## Evidence and exact scope

- Selected source: GuitarWorld `q45790`, its publicly displayed [preview image](https://s2.guitarworld.com.cn/upload/pu_qupupic/791924/view/4e7aacc1901fe74235aa752033510542.png). The paid complete score was not accessed.
- Preview: 1200 × 831 pixels; SHA-256 `1316e3ffb8e3ae391f184ec6881db13d380d3e12a566687532394644a15a5601`.
- Reviewed cadence crop in original pixels: `[630, 698, 1110, 830]` (left, top, right, bottom).
- Timebase: the first visible vocal melody attack is beat 0; printed key `1=C`, meter 4/4, no pickup before that attack. No-dot tonic maps to C4 under the repository's convention. No transposition is applied.
- m7–8 is exactly G4 at 24 for 1 beat, D4 at 25 for 0.5, E4 at 25.5 for 0.5, F4 at 26 for 1.5, B3 at 27.5 for 0.5, and C4 at 28 for 2. Beats 30–32 are silent.
- The different-pitch arc is a slur, so the notes remain separate attacks. The F's side dot is an augmentation dot; the B has a lower octave dot beneath its eighth-note underline. D/E/F/C have no upper octave dots. The final two printed zeros are quarter rests.
- No printed tempo is visible. The 70 BPM playback basis and historical `defaultSpeedFactor: 0.9` field are retained, not established source markings. The historical field corresponds to 63 BPM at 0.9×; it is not the current runtime's initial practice speed. Practice acceptance must use the actual selected or remembered multiplier. Without a saved preference, the current first-use 0.55× speed corresponds to 38.5 BPM.

The source image and full private research stay outside the public repository. Public tests retain only the small reviewed cadence fixture, provenance links, immutable hashes and preservation checks.

## Deliberately unresolved

The first phrase, m3–4 (beats 8–16), is unchanged. The preview's m3 clearly has upper dots on C/D but none on the following E/D/C, producing an internal register discontinuity. Literal notation and engraving intent are different questions. Neither adopting the current coherent upper phrase nor assembling a lower phrase from other editions resolves the selected source's intent.

The second page and later form were not inspected. In particular, the superficially similar phrase at beats 57–60 is **not** changed to match m7–8. The final C5 at beat 60 still lasts four beats because it is preserved prior data, not newly verified notation. The full repeat order, later rest at 46–48, final note/register/duration and ending extent remain pending.

The existing [CNBlogs encoded melody](https://www.cnblogs.com/anbus/p/11303701.html) provides a secondary textual lower-register cross-check, but uses different phrase-end durations. The [Wikipedia article](https://zh.wikipedia.org/zh-hans/%E9%80%81%E5%88%AB_(%E6%AD%8C%E6%9B%B2)) supplied notation alt text during research; its notation pixels were not verified. These references do not authorize replacing GuitarWorld's printed two-beat holds and two-beat rests, changing the unresolved first phrase, or extending this review to the whole song.

Both originally named private source images were unavailable. The earlier unsupported-field sentence claiming a correction of mistaken lower octaves is retained verbatim inside `historicalReviewNotes`, explicitly labeled historical rather than repeated as current verification. Original source URLs and image references remain intact.

## Preserved V2 and support boundary

`data/songs/song-bie-chord.json` remains byte-for-byte unchanged, including its original melody, harmony and backing data. Its original melody now differs from V1 at exactly these five pitches. A matching title or base id must not allow its accompaniment to be borrowed for this revised melody. Content compatibility is required before reuse; compatibility itself would still not prove source fidelity or harmony quality.

This change neither repairs nor replaces the V2 arrangement. Any later support decision needs a separate source review, rest checks and listening comparison. No new backing has been invented for the corrected cadence.

## Restoration and executable regression

The focused test reconstructs the entire pre-correction V1 JSON without private files: restore the five original pitches and historical hint/unsupported/unsure-measure fields, then remove the newly added review and suitability metadata. Two-space JSON serialization with the original final newline reproduces the frozen original hash, including every prior field and source claim.

- Original complete V1 file: `adaf958d152111ca3a11c0a7b9a6373e9074035d9a464a88504f08e57afb884d`.
- Unchanged complete V2 file: `dd575f1e2db95a54b010d3e9eca6e1f273f58190743fec68e7db55490e61c35c`.

Run:

```sh
node --test scripts/test-farewell-reviewed-cadence.mjs
npm run validate:songs
npm run report:rhythm
npm run report:suitability
```

The focused regression checks exact six-note source tuples and rest, exactly five octave-only changes, every timing tuple, all unchanged pitches, the whole outside-scope sequence, the untouched earlier/later phrases, exact original JSON reconstruction, historical claim placement, honest partial-review metadata, and unchanged V2 bytes. These checks protect recorded decisions; they do not perform source reading, audio listening or a physical play-through.

Source-data checks on 2026-10-12: all six focused tests passed; song validation reported 53 songs, 7079 steps, zero errors and 550 existing review warnings. Rhythm and suitability reports completed successfully. The private evidence checker also passed the six cadence attacks and their rest, plus the separate 15 unchanged attacks and two rest windows. Both restoration hashes were checked against the frozen 2.4.4 preview ZIP.

Release integration must rebuild `src/songs.js`, run the full project checks and verify that content-incompatible support is unavailable. Those integration steps are separate from this source-data change.

## Suitability and acceptance limits

The six-note reviewed cadence fits the fixed F3–E6 natural-note instrument without transposition. Its shortest duration is half a beat, about 429 ms at the retained 70 BPM basis, or 779 ms at the current first-use 0.55× speed of 38.5 BPM. A remembered or manually selected speed may differ and must be recorded for acceptance. The complete retained encoding now spans B3–F5, but encoded range alone does not certify accuracy, recognizability or hand movement.

Overall status remains `needs-review`. Browser sample playback, reference listening, melody-versus-support A/B listening and physical-kalimba play-through were not performed for this source-data correction. They are separate acceptance gates. Public source visibility is not a publication-rights clearance, and no publication is authorized by this review.
