# Daylily: optional four-bar root support

This bounded 2.4.32 local-preview addition keeps the selected
《萱草花》（声乐版） physical practice line unchanged. It adds one compatible
source companion, `xuan-cao-hua-reviewed-support`, with 16 optional app-played
roots. The new companion is not a second practice card or a chord-practice mode.
The library has 57 source records and the same 36 canonical melody cards.

The support starts **off**. Its presence does not certify subjective balance,
harmonic acceptance, physical playability or public-distribution rights.

## Frozen music and source boundary

The selected [山山吉他 C edition](https://www.21qupu.com/guitar/45750.html)
and vocal route are the same as in [DAYLILY_REVIEWED_VOCAL.md](DAYLILY_REVIEWED_VOCAL.md):

- Editorially counted m17–48, then m17–32, then the separately printed m49–64.
- 64 bars of 3/4, 192 quarter beats and exactly 183 single-melody attacks.
- Final melody C4 at beat 189 for two beats, then the vocal rest [191,192).
- 84 BPM is the retained **editorial practice tempo**. The source prints no
  numeric tempo. The 0.9 speed suggestion is separate from the selected or
  remembered runtime speed; measurements below do not multiply it in.

The support evidence has 51 printed chord symbols in 48 separately printed
vocal bars, expanded to 68 occurrences by the adopted repeat route. Two readers
agree on the symbols and change positions in this one edition. The second
reader freshly checked eight crops and four repeat/ending glyph locations;
the editorial full-route measure count is inherited from the preceding
full-page vocal review, not a second blind recount. These are two readings,
not two independent editions. Source availability does not prove identity
with the missing historical photograph or establish reproduction rights.

Literal qualities remain C, G, Am, Em, Fmaj7, Dm7 and A7. In particular, A7 at
beats 33,129,177 contains theoretical C-sharp and is not Am. The within-bar
Dm7→G changes are at 42→44, 90→92, 138→140 and 186→188; they are two successive
symbols, not slash chords. Every A7 attack, including its C-sharp, is omitted
from playback rather than naturalized. The complete literal map and all
68 selection/omission decisions remain private review material outside the
repository and local-preview ZIP.

## What the root reduction does

Every retained event lasts 0.75 written beat and contains one unjudged bass-role
note at velocity 0.30; support volume is 0.28. Their product is 0.084 before
the unchanged playback voice multiplier. These are editorial trial settings,
not source dynamics or a measured-perception guarantee.

| App beat | Counted source bar | Source symbol | App root |
| ---: | ---: | --- | --- |
| 0 | 17 | C | C4 |
| 12 | 21 | Fmaj7 | F3 |
| 24 | 25 | C | C4 |
| 36 | 29 | Fmaj7 | F3 |
| 48 | 33 | Am | A3 |
| 60 | 37 | Am | A3 |
| 72 | 41 | Am | A3 |
| 84 | 45 | Fmaj7 | F3 |
| 96 | 17, second pass | C | C4 |
| 108 | 21, second pass | Fmaj7 | F3 |
| 120 | 25, second pass | C | C4 |
| 132 | 29, second pass | Fmaj7 | F3 |
| 144 | 49 | C | C4 |
| 156 | 53 | Fmaj7 | F3 |
| 168 | 57 | C | C4 |
| 180 | 61 | Fmaj7 | F3 |

The six C4, seven F3 and three A3 attacks occupy 12 written beats, or 6.25% of
the selected extent. One onset every 12 beats is the chosen four-bar spacing,
not a transcription of guitar rhythm. Root register, spacing, duration and
gain are all disclosed arrangement choices. The source symbols do not specify
literal bass octaves or note lengths. No literal bass line was transcribed,
so the chosen register is not an octave-folded source bass. There is no melody
transposition or accidental substitution.

All 16 complete written spans lie within their three-beat source chord
intervals and below every overlapping melody note. C omits E/G; Fmaj7 omits
A/C/E; Am omits C/E. The other 52 source-symbol onsets, full guitar voicings,
strumming, picking, most changes and cadential support are omitted. In
particular there is no closing C4 root at 189, where it would duplicate the
melody attack. The last root is F3 at 180 for 0.75 beat. Missing support is a
reduction, not evidence that the source guitar is silent.

## Written rests and natural audio tails

The twenty one-beat vocal rests begin at
14,17,35,38,47,53,59,71,77,83,110,113,131,134,143,158,161,179,182,191.
All receive `silent` app-support policies, with no `hold` exceptions. No
support onset or written span enters any of them. They are vocal-only source
rests plus editorial support omissions; guitar activity in the original
source prevents an all-layer source-silence claim.

Written duration is not a PCM cutoff. The unchanged player uses full decoded
sample buffers and its existing 0.55-second convolution, filter and compressor.
It does not gate a sample at the written 0.75-beat endpoint. Nothing in this
addition crops samples, changes their pitch/rate or trims effects to manufacture
silence.

A private browser completed nine full original-graph OfflineAudioContext
renders at 44,100 Hz: melody-only (183 sources), melody-plus-support (199),
and support-only (16), at each configured multiplier 1×, 0.55× and 1.4×.
All 1,194 sources ended; there were zero nonfinite samples and zero samples
with absolute value at least 1. Original MP3 and graph hashes were checked.
The impulse uses one reproducible random seed; it does not represent every
live impulse realization. A separate scalar/source audit passed, not a second
independent PCM regeneration or listening session.

| Configured multiplier at 84 BPM | Nonzero backing-only vocal rests | Nonzero post-chord-boundary windows | Backing-only / mixed full RMS |
| ---: | ---: | ---: | ---: |
| 1× | 6/20 | 16/16 | 0.02504424 |
| 0.55× | 0/20 | 0/16 | 0.02506370 |
| 1.4× | 6/20 | 16/16 | 0.02532611 |

The six residual rest windows start at 14,38,110,134,158,182. Their backing-only
peaks are approximately −67.782 dBFS at 1× and −57.453 dBFS at 1.4×. At 1×,
even the weak post-chord-boundary tails remain nonzero; they must not be rounded
into a strict-silence claim. At 1.4×, the original C4/F3/A3 buffers themselves
extend about 0.365374 seconds past their next source-chord boundary.

Backing-only post-book output is zero in these finite renders, while melody
and mix can retain tails after beat 192. The final [191,192) vocal rest has
melody/mixed output at 1× and 1.4× despite no new attack. Every render's final
250 ms guard is zero. Capturing the full acoustic tail does not enlarge the
192-beat score or lengthen its final note.

The RMS ratios are **not perceived-loudness percentages** or an isolated backing
contribution inside the mix: the shared compressor is nonlinear. No sample-wise
subtraction was used. This numerical evidence does not establish subjective
quietness, masking, an audible clash, reference fidelity or physical acceptance.
It also does not exercise the live RAF scheduler, async loading, OS lifecycle
or real audio hardware. Those runtime checks have separate regression and
release-verification ownership. Subjective A/B, reference listening and physical
kalimba checks remain pending; source and numerical checks do not replace them.

## Preservation, selection and remembered settings

All 56 previous `data/songs` JSON files retain their exact 2.4.31 delivered
bytes. The V1's earlier no-support wording remains historical source payload;
the actual display helper uses the new short hint only when the identified
Daylily edition and compatible selected companion match. Missing, wrong,
empty or incompatible providers fall back to the preserved V1 hint.

The historical 78-event `xuan-cao-hua-chord.json` remains byte-for-byte intact,
including its 39-event original `autoAccompaniment`; it has no
`practiceAccompaniment` field. Its melody is incompatible with the selected
183-note route. Neither its title nor its 84 BPM authorizes borrowing it.
The prior 78-note archive is unchanged and remains recovery evidence rather
than a new card or exposed restore route.

The actual provider selects the new companion only after matching the complete
melody pitches/onsets/durations, BPM and effective ending extent. All three
Daylily IDs resolve to the canonical single-melody card. Support stays opt-in.
Only an explicitly saved choice for the exact current melody/support signature
restores; changing support pitch, onset, duration, role, velocity, gain or melody
compatibility invalidates it. Removing the companion cannot fall back to old
backing. Review prose does not invalidate an unchanged sound. Saved speed is
not overwritten.

Raw built-in JSON with top-level `practiceAccompaniment` is rejected by the
external importer. It is not silently stripped. The test deliberately prepares
a supported V2 `autoAccompaniment` representation and verifies that all targets,
roots, settings, rests and source metadata survive. That in-memory test is not
an extra shipped import file or permission to delete a backing layer.

## Evidence fingerprints and executable checks

- Melody tuples: `cae668aa9911d5ce06d4d3d69dae051ccb270631402a23d9eb72c7472fac22cd`
- Exact support object: `7afe06e85a5cfde0cf52bd4c1a7fa2e28b5ac25690128ab8076b0af121b1c8a7`
- Frozen private candidate: `13888538b2b784d6bdd2846fee22d3ebb98c33799d89536ae483c10c815cd5b6`
- Literal chord timeline: `a333286d4ef22e7fdb19653c64d05bfc214f40c0d854692912165d5cbaba75a4`
- Saved browser numerical JSON: `ae8ca6342ab34e3f8b92bb3e2c2e58b2cac6c8cecc1a57d9d6a1608672cbb359`
- Sorted prior56 `[filename, SHA-256(bytes)]` manifest:
  `b367d1fc31c1be4a5e63911ae39fb1e4bc68701a31ddad8ae26a2db23bf918bc`

Run `node --test scripts/test-daylily-reviewed-support.mjs`. The dedicated
regression protects preserved bytes, exact melody/roots, whole written spans,
all vocal rests, source summaries, negative mutations, actual validation,
normalization, provider/hint selection, content-sensitive memory and imports.
It distinguishes numeric-tail evidence from musical acceptance.

`DAYLILY_SUPPORT_EVIDENCE_DIR` optionally points to the private source-review
directory containing the frozen candidate, literal timeline, selection map
and melody-source fixture. The optional test verifies their fixed hashes,
compares the unchanged music payloads and checks 183 attacks with the reusable
evidence checker. Without those private files it reports a skip, never a source
inspection pass. Private fixtures are not bundled.

Also run the existing Daylily vocal, accompaniment, import, practice-session,
audio and report regressions, followed by song validation, reports, generated
library rebuild and `npm run check`. The integration owner owns generated
`src/songs.js`, the display-helper extension, package/aggregate/version changes
and final webpage/ZIP verification. This document does not imply a subjective
listening pass or public-release authorization.
