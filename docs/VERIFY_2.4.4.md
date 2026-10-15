# 2.4.4 local verification

## Product and source scope

The selected Huang Xiuquan Jasmine short edition has 67 attacks across 14 bars,
56 beats including its final one-beat rest, with no pickup. Two independent pixel
readings agreed before compilation. See `JASMINE_SHORT_2.4.4.md` for the source,
archive hashes and exact notation decisions. The former 145-note edition remains
an exact, importable JSON archive; it has not been declared erroneous.

Sibling accompaniment now requires matching explicitly identified melody pitches,
onsets, durations, BPM and total extent including ending silence. This prevents
the short Jasmine and corrected Interstellar melody from borrowing incompatible
old V2 support. Birthday and Twinkle retain their matching, source-reviewed sparse
support. Compatibility alone does not validate harmony.

## Executable checks

`npm run check`: 250 runtime tests and 13 compiler-evidence tests pass, plus
transcription, suitability, source validation and JavaScript syntax checks.
53 built-in source records remain, with 36 canonical single-note practice songs.
The 145-note archive is outside the generated built-in list. All 21 shell assets,
including the archive, exist. The formal `npm start` server is additionally tested
over real loopback HTTP for every shell asset and all 21 samples: status 200,
correct MIME and nonempty body. Only the exact archive file is allowlisted;
unlisted archives, raw song sources and private files remain forbidden.
No service-worker cache strategy changed.

New cases cover all 67 source tuples, 14 bar boundaries, dotted notes, independent
repetitions/slurs, ending rest, exact historic bytes, local import isolation,
legacy chord routing, incompatible sibling scheduling, and retained compatibility.
The final-rest scheduler checks use offsets within the actual rest duration,
including the new one-beat ending. Source-warning disclosures remain expanded;
reviewed-edition information starts compact and is explicitly expandable.

Internal full-song dry sample rendering uses the repository's real samples and
common output gain 0.8: peak 0.584583926 (-4.6631 dBFS), no clipped or nonfinite
samples. This is a numerical audio check, not reference-performance listening or
an emulation of browser effects. No user listening attachment was produced.

## Own-cloud browser observations

- Actual private-loopback 2.4.3 to 2.4.4 update succeeds. The library shows the
  labeled short edition, 67 notes and its source explanation without claiming old
  support exists. An old `jasmine-chord` URL resolves to the short melody.
- Full normal-speed demo completes with all 21 keys preserved; the final long
  note retains its beam, then the ending clears beam/expected keys. Final-phrase
  loop preparation can pause and resume through the demo control, repeat and exit.
  Saved 1x survives reload; loop and progress reset.
- The original archive opens in a new tab and restores as a separate local
  145-note song alongside the 67-note built-in. On an isolated final-code origin,
  the same open/copy/import flow succeeds with the private server stopped.
- A direct HTML `download` link was tried during development; its offline download
  observation timed out. The final link uses ordinary cached navigation with
  `noopener`, supporting copy or browser Save As rather than that download path.
- Wide 860×404 and compact 610×526 previews retain all 21 keys and the progress
  rail. Reviewed-edition details stay collapsed by default; the final page is
  paused at 12 seconds, 0.65x, with loop off.
- With the final-code private server stopped, a complete 0.65x demo finishes,
  clears target cues and resets normally. All 21 keys remain available.
- Actual copy-button then paste yields exactly 4466 prompt characters, equal to
  the displayed prompt and including edition/support compatibility rules.

## Reproduce and limits

Node.js 24 and npm; no dependency installation is required:

```sh
npm start
npm run check
```

Use the local address printed by `npm start` (default localhost:8123).
The initial candidate lacked the archive in the formal server allowlist; this
was caught before delivery and corrected in package revision 1. The original
Python browser observations do not alone establish formal server availability.

Own-cloud UI QA uses a separate loopback-only Python static preview helper,
without a public tunnel. A cloud localhost URL is not a deliverable for another
machine; use the portable source ZIP or baseline patch.

Real phone/physical-kalimba feel, an installed-phone PWA upgrade, reference-audio
recognition, and whole-library musical fidelity remain unverified. The prior
same-version development refresh timeout remains a development caveat; final
browser checks use isolated origins to avoid stale shell bytes.
