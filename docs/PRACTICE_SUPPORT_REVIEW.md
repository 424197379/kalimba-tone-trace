# Conservative Practice Support Review

> Historical v2.4.0 candidate review. From v2.4.3, Birthday’s light-support pitches at beats 14, 16 and 20 use the independently inspected lead-sheet chord symbols instead. See [the scoped correction](BIRTHDAY_SUPPORT_2.4.3.md). The old intersection candidate remains recoverable in source metadata. Twinkle’s sound data is unchanged; a later selected-source review now confirms its existing sparse candidate’s chord membership, while retaining original-photo and audible-acceptance limits. See [Twinkle source review](TWINKLE_SOURCE_2.4.3.md). Historical uncertainties below describe the earlier stage.

## Scope and status

This review covers optional `practiceAccompaniment` data for the existing
`birthday-chord` and `xiao-xing-xing-chord` arrangements. The latter is Twinkle,
Twinkle, Little Star; its existing filename and song identity remain unchanged.
No additional "easy version" or duplicated library entry is introduced.

These are **conservative reduced-support candidates, not independently verified
new harmony**. They retain the intersection of two existing arrangement layers.
Agreement between those layers is useful provenance but does not establish that
either layer is musically correct. In particular, Twinkle's original backing and
judged chord anchors disagree at beats **20, 28 and 30**. Those conflicts remain
unresolved.

The existing V1 melodies, V2 melody notes, chord targets, automatic backing,
tempos, rhythm/rest metadata, titles, IDs and earlier source-review fields are
unchanged. Only `practiceAccompaniment` and its separate provenance under
`sourceFeatures.practiceAccompaniment` are added. The earlier
`harmonyReview.confidence` labels must not be read as independent approval of
these new reduced-support candidates.

## Selection contract

The candidate uses the same playback-object shape as `autoAccompaniment`:
`enabledByDefault`, `volume`, and `events` containing `beat`, `duration`,
`pattern`, and unjudged `notes`.

1. An onset must already occur in `autoAccompaniment.events` and coincide with an
   existing V2 event containing judged non-melody notes.
2. A retained pitch and role must occur in both the original backing event and
   that judged non-melody anchor. No pitch, onset or chord is inferred to complete
   a thinner event.
3. Retain at most two notes: at most one bass and at most one harmony note. An
   unresolved intersection can remain a single note.
4. Do not double a melody pitch active during the support event. Do not attack
   during a melody gap or overlap a silent rest window.
5. Retain each original backing duration, bounded by the next melody rest or
   song end. Both current melodies are continuous; all retained source durations
   are already 0.75 beats and require no shortening.
6. Keep volume at 0.34, bass velocity at 0.40 and harmony velocity at 0.34. Notes
   have no `judge` property. The new candidate has `enabledByDefault: false` and
   is available for explicit selection in the melody-practice support control.

The product presents only off and light support for these two songs. Original
backing remains in the source data and offline A/B/C comparison, not a third
practice-menu choice. Physical chord-mode entry points have been removed across
the library; their source targets remain unchanged for recovery and provenance.

## Candidate inventory

Beats are zero-based song beats, preserving the original song timing.

| Arrangement | Melody attacks | Original backing attacks / notes | Light support attacks / notes |
| --- | ---: | ---: | ---: |
| Birthday | 25 | 9 / 21 | 9 / 18 |
| Twinkle | 42 | 24 / 53 | 18 / 33 |

Birthday retains these beat/pitch groups:

- 0: G3 + C4
- 4: G3 + D4
- 6: G3 + D4
- 10: G3 + C4
- 12: G3 + C4
- 14: F3 + C4
- 16: G3 + C4
- 20: G3 + D4
- 23: G3 + C4

F4 from the original backing at beats 4, 6 and 20 is omitted because it is absent
from the judged non-melody anchors. No new chord tones are substituted.

Twinkle retains these beat/pitch groups:

- 0: G3 + C4
- 4: F3 + C4
- 6: G3 + C4
- 8: F3 + C4
- 12: G3 + D4
- 14: G3 + C4
- 16: G3 + C4
- 20: C4
- 22: G3 + D4
- 24: G3 + C4
- 28: G3
- 30: G3
- 32: G3 + C4
- 36: F3 + C4
- 38: G3 + C4
- 40: F3 + C4
- 44: G3 + D4
- 46: G3 + C4

The original Twinkle backing onsets at 2, 10, 18, 26, 34 and 42 are omitted
because they do not coincide with judged non-melody anchors. F4 at retained G7
backing onsets is also omitted when absent from the judged anchor.

### Unresolved Twinkle conflicts

| Beat | Original judged non-melody anchor | Original automatic backing | Retained intersection |
| ---: | --- | --- | --- |
| 20 | F3, A3, C4 | G3, C4 | C4 |
| 28 | G3, B3, D4 | G3, C4 | G3 |
| 30 | G3, C4, E4 | G3, D4, F4 | G3 |

These single-note choices avoid choosing between the incompatible layers. They
do not resolve which original harmony is preferable. A source-based harmony
review is still required before claiming a corrected or verified arrangement.

## Automated verification

Run the dedicated data checks with:

```sh
node --test scripts/test-practice-support-data.mjs
```

The 10 tests cover:

- V1 melody files matching frozen baseline `73041efc803b6c4f16046c8fc0ceaefc08fcc507`.
- V2 melody pitch, onset and duration equal to the V1 melody, note for note.
- Original automatic backing, all chord targets and all earlier metadata equal
  to that frozen baseline, after removing only the two optional practice additions.
- Exact candidate inventory, reduced note density, fewer than half of melody
  attacks receiving support, source onset/pitch/role membership, quiet gain,
  unique sorted events, no judged backing notes, and maximum bass/harmony counts.
- No active-melody unisons, implicit melody-gap attacks or silent-rest overlaps;
  original durations bounded by rests/end.
- Explicit unverified provenance and the three unresolved Twinkle beats.
- Negative fixtures that reject extra onsets, one-layer-only pitches, a third
  support note, melody unison, louder notes and rest conflicts. These fixtures
  exercise the silence guards even though the two real melodies have no gaps.

Frozen SHA-256 hashes protect the original parsed JSON without requiring Git,
so the portable source ZIP runs the same checks. The explicit candidate and
V1/V2 comparisons remain independent regression checks.

Results for this data pass:

- Dedicated support tests: **10 passed, 0 failed**.
- `npm run validate:songs`: **53 songs, 0 errors, 154 existing warnings**.
- `npm run test:song-transcriptions`: passed all 15 existing melody regressions.
- `npm run report:rhythm`, `npm run report:arrangements`, and
  `npm run report:suitability`: completed successfully. These existing reports
  examine their existing arrangement fields; the dedicated tests above inspect
  the new candidate field directly.

The application integration must run `npm run build:songs` to include the data
in the generated library, followed by `npm run check`. These are separate from
the data-only checks recorded here.

## Listening and source-review limits

Structural tests establish what the data contains and what was preserved. They
do not prove recognition, musical balance, fidelity to a published source,
sample playback quality, or physical playability.

Review the three variants at equal melody gain and tempo: A, melody alone; B,
melody with this light candidate; C, melody with original backing. Pay particular
attention to Birthday's phrase endings and Twinkle's beats 20, 28 and 30. Audio
rendering, audible review and source verification are distinct checks; merely
generating A/B/C files does not complete listening review.

Independent source comparison, audible listening acceptance and a physical
21-key kalimba play-through are still pending for these candidates. No public
publication or new source-fidelity claim follows from this data review.
