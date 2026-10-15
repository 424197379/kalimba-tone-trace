# 《喀秋莎》: disclose unresolved source mapping, v2.4.8

## Decision and unchanged playback

The existing built-in is now labeled **《喀秋莎》（待核版）**. Its hint and
review notice disclose that the current melody-to-source correspondence is
unresolved and the arrangement is **not source-calibrated**. This is a
metadata-only quality correction, not a replacement transcription.

All **73 pitch/onset/duration tuples** remain unchanged, as do the id, V1
schema, C practice key, difficulty, 112 BPM, historical 0.9 speed suggestion,
4/4 grouping, practice title and score title. The existing timeline ends at
beat **44**, with **41 sounding beats**, E4–E5 range and gaps at [16,17),
[25,26) and [34,35). Its last attack remains A4 at beat 42 for two beats.
The encoded end is not a newly verified source ending. No
`sourceFeatures.sourceTotalBeats` is added.

No notes, backing, repeat expansion, source excerpt or new playable version
are introduced. The historical `katyusha-chord.json` remains byte-identical.
Its 73 explicit melody-role tuples match V1 exactly; this shared data is not
independent musical evidence. No harmony or accompaniment is approved by the
metadata review, and no support is copied into the V1 record.

## Inspected sources and precise scope

The source review of 2026-10-12 inspected both pages of the edition already
linked by the historical V2 sibling:

- [Jitabang: 深蓝雨吉他 2019-25, 廖昌永版《喀秋莎》](https://www.jitabang.com/jiaoxue/8653.html)
- [Printed page 1, 1200 × 1604](https://www.jitabang.com/img/2022/03/2022031503441716.png)
- [Printed page 2, 1200 × 1704](https://www.jitabang.com/img/2022/03/2022031503445225.png)
- [Barynya's separate edition, used only for scoped comparison](https://www.barynya.com/balalaika/images/katyusha.pdf)

Jitabang's printed header is 1=C, 2/4, 112 BPM, with male capo 5 and female
capo 0. The review reads printed notes without mixing in the male capo's
sounding transposition. The instrumental introduction, first vocal pass and
fifth ending were considered separately. A second pixel review corroborated
the disputed low-E readings and fifth-ending melody accidentals. Readable
pixels do not by themselves settle engraving intent or the desired edition.

The first vocal pass is source measures 17–40: 24 two-beat bars and 61
attacks, distinct from the current 73 attacks. Its literal E3–A4 range fits
the fixed F3–E6 natural-note instrument after one uniform +12-semitone shift
to E4–A5. This is an **inspected, unadopted alternative excerpt**, not a
production melody or the complete printed arrangement. The low-E register
readings, intended edition/scope, demonstration comparison and listening
acceptance remain unresolved. The source introduction's notation/TAB
conflict cannot authorize silently changing the vocal line.

Barynya corroborates opening anchors but differs later in rhythm and
register. Its notes are not spliced into Jitabang or used to overwrite the
legacy melody. The original private kalimba photos were not available for
reverification. Neither access to the public sources nor these comparisons
establishes permission to redistribute a score or a new transcription.

## Why changing only the meter is insufficient

The current opening does not match either the printed vocal opening at
m17–18 or the instrumental beginning at m9. Pitch sequence and internal
rhythm differ. Changing 4/4 to 2/4, applying a global transposition, or
uniformly scaling note durations cannot establish those mappings.

No complete source-to-current-note mapping has been established, and no
isolated note change is safely proved. This does not show that all Katyusha
editions, or every retained note, are wrong. The honest result is to preserve
the existing encoding while removing the impression that source fidelity
has been established. Any later replacement must first identify its edition
and scope and be independently reviewed rather than inherit a familiar title.

## Separate full-edition instrument constraint

The Jitabang fifth-ending vocal melody at m41 includes explicit **F♯ and
G♯**. These are melody notes, not merely pitches inside an E/E7 chord. The
complete printed edition contains at least nine melody pitch classes:
C, D, E, F, F♯, G, G♯, A and B. None of the twelve global pitch-class shifts
can map those nine distinct classes into the seven natural pitch classes;
an octave shift cannot remove this constraint.

That conclusion applies to the **complete cited Jitabang edition including
its fifth ending**. It is not a chromatic rejection of the existing natural
73-note encoding, evidence that those old notes were created by naturalizing
sharps, or a verdict on every Katyusha arrangement. The inspected first
vocal pass has a different scope and fit result. Neither its 48-beat boundary
nor the full source's expanded form is adopted as the current song's ending.

## Metadata and restoration

The runtime hook is:

`sourceFeatures.sourceReview.currentScopeReview.status`
= `unresolved-melody-source-mapping`.

The current metadata records no reviewed production beat range and keeps
[0,44) unresolved. Suitability remains `needs-review` for that retained
encoding. Source links, page hashes, partial findings, the unadopted excerpt,
the full-edition chromatic constraint and outstanding checks are separate
from historical provenance. The warning is intended to remain expanded on
the practice page; this status is not an informational approval label.

`sourceReview.historicalReviewNotes` preserves the entire original
`sourceFeatures` object. `sourceReview.originalV1` preserves the exact old
title and hint, the original file hash and the all-tuples hash. All other
original fields retain their values and order. To reconstruct the full
original file without Git or private source material:

1. Clone the current JSON and restore the saved original title and hint.
2. Replace `sourceFeatures` with `historicalReviewNotes`.
3. Serialize with two-space JSON indentation and one final newline.

The resulting full-file SHA-256 must be:

`7de14e131a9055ff88a21310e8e6095496152b21034469eee851caec9458fbf3`

The unchanged `JSON.stringify(steps)` SHA-256 is:

`2da07ced7b54f17cf8fdabe793b354adf3bff7b4da635f3c8762904d727a55ac`

The historical V2 file SHA-256 remains:

`de452ca36de8add09257934ec3cb1e59f09c0f8b181ba14fb02fefe19367640c`

The earliest inspected repository revision, `fc8712e`, already contains
these 73 tuples. The later `c0df063` source/grouping notes did not alter
the melody. Historical claims are preserved for restoration, not endorsed
as present-day source verification.

## Evidence fingerprints

The public metadata retains these pointers for reproducibility. The scans,
crops, archived input files and full independent transcription fixture stay
outside the public repository; the hashes do not require publishing them.

- Jitabang page 1: `1e735786aa5fa396c236be5c281e2ed1282bfbed8c89985590bd5f6c5b3058f0`
- Jitabang page 2: `4e428b9d15282fc1d09b98a0a5ae9b9d474534a13676515aaf3e40cb4cc93c65`
- Barynya PDF: `1879259b25a95c095b3f8febb08ecb62fbbf7e6e21f2c52cae01d2b49175d108`
- Private source audit: `e83f20f87cf98f9c1d59f5aa0253ba5c8d9f6f6b9ae2ef1b0a0a66d1d18405c6`
- Private independent fixture: `ca63dba40cf0b6f828e735b34fc450afca67850c66e87fa4236b027e719959ea`
- Private comparison results: `3319b9fe753ca88a30b3b29ed6a1da11e5e64a6ed5c8bbcb120e87fc4da02b8f`

## Regressions and acceptance limits

Run from the repository root:

```sh
node --test scripts/test-katyusha-source-gap.mjs
npm run validate:songs
```

The regression freezes all 73 legacy tuples, timing and gaps; reconstructs
the complete original V1 byte stream; checks the exact V2 hash and explicit
melody identity; protects source URLs/fingerprints and the unresolved runtime
status; distinguishes the selected excerpt from the complete printed edition;
and confirms that the 61-note candidate has no playable production data.
Its pitch-class enumeration verifies the stated full-edition constraint.
Legacy fingerprints are preservation tests, not a source-derived correct
melody or proof of musical quality.

Reference listening, browser audio, unaccompanied recognizability, optional
support A/B listening and physical kalimba play-through were **not performed
as part of this source-gap review**. A source metronome mark and historical
0.9 speed suggestion do not establish the runtime's actual selected or
remembered practice multiplier. Any later listening check must record that
multiplier and its exact reviewed scope. No audible, physical-instrument,
harmony or public-distribution approval is implied by structural tests.

Generated-library rebuilding, full-project checks, the expanded UI warning
and coherent release-version updates are integration steps for v2.4.8.
