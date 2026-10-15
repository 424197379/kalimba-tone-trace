# 2.4.3 local-preview verification

## User-visible changes

- Interstellar selected EOP m44–49: 96→144 exact triplet attacks, all 146
  outside tuples unchanged. Full melody 242→290, final end 159 unchanged.
  Hard passage: approximately 111 ms per attack at 90 BPM. First-use practice
  speed remains 0.55x, with remembered speeds preserved. Current source notice
  retains earlier voice/register and 3/4-versus-4/4 display limitations.
- Birthday: only three light-support pitch names corrected to selected primary
  C/F/C-G chord regions. All 25 melody tuples and the fermata realization remain
  unchanged. Old candidate, original V2 targets and original auto backing remain
  recoverable. Nine quiet optional attacks, no new physical chord targets.
- Twinkle: selected full 42-note melody and all 18/33 sparse support events
  independently source-reviewed; no song-data edits or unnecessary added tones.
- Compiler references, machine fixtures and the actual external AI prompt
  distinguish triplet base duration, fermatas, edition conflicts and chord-symbol
  placement on the interpreted timebase.

Source adoption and remaining limits:
[Interstellar](INTERSTELLAR_TAIL_2.4.3.md),
[Birthday](BIRTHDAY_SUPPORT_2.4.3.md),
[Twinkle](TWINKLE_SOURCE_2.4.3.md).

## Source and machine checks

`npm run check`: 231 runtime tests plus 13 compiler-skill tests pass (244 total).
Built-in validation: 53 source records, 7157 encoded steps, zero errors. The 549
warnings include genuine 1/6-beat grid/density notices; they do not authorize
quantizing the source. All 53 generated records are produced by `npm run
build:songs`, never hand-edited.

Independent review confirmed actual source pixels, scoped changes and historic
reconstruction. The real runtime scheduler is exercised at 30 fps across the
144-note loop at 0.35x, 0.55x, 1x and 1.4x, with every melody attack heard once
and no duplicate A before the next preparation.

Internal Birthday dry-sample PCM comparison against frozen 2.4.2 uses identical
melody gain, tempo and samples. Melody-only and old-auto mixes are sample-identical.
Only the three intended backing-note substitutions contribute to the new mix;
residual after subtracting those differences is 5.56e-17. Before/after peaks are
0.633911395 (-3.9594 dBFS), zero clipped or nonfinite samples. This is numerical
sample-render verification, not browser effects emulation or subjective approval.
No new user listening files were requested or produced.

## Own-cloud browser observations

- Actual private-loopback 2.4.2→2.4.3 update succeeds; song card shows 290 notes
  and the current slow-practice/source-limit notice.
- First entry to Interstellar is 0.55x with loop off. A selected slow phrase
  crossing into the reviewed triplets plays, pauses during preparation and
  resumes, repeats, and exits the loop without losing the 21-key map.
- Fresh private origin loads final 2.4.3. Copy button followed by actual paste
  produces all 4340 prompt characters exactly, including fermata and chord-time
  rules. Clipboard observation is initialized before the checked copy; an
  initial tooling clipboard read retained the previous session's text.
- Birthday defaults to 0.55x with support off. Light-support demo at 1x completes
  the full song. After a reload, saved 0.65x returns; support-selector choices
  remain session-local by existing design, so cold reload is off.
- Wide 860×404 and compact 610×526 layouts retain all 21 keys, the upper progress rail and the optional light selector. Final preview is paused at six seconds with loop off.
- With the private server stopped, ordinary reload succeeds and the entire
  self-play timeline runs offline. No physical-microphone detection is involved.

## Reproduce

Node.js 24 and npm, no external runtime packages or install step:

```sh
npm start
npm run check
```

Open the local address printed by `npm start` (default localhost:8123). Local
source, patch and screenshots are the deliverables; another machine cannot use
this cloud preview's localhost URL. The separate own-cloud UI QA uses Python's
loopback-only allowlisted preview helper, with no tunnel or public host.

Not independently verified: physical kalimba/phone feel, real installed-phone PWA
upgrade, reference-recording melody recognition, whole-library fidelity, or
subjective approval of these new support-note substitutions. Prior same-version
development refresh timeout remains a development-only caveat; no speculative
service-worker strategy changes were made.
