# 2.4.21 optional Porcelain roots review

Local-only preview. The current 83-note melody remains byte-identical to 2.4.20.
This adds a source-backed, deliberately sparse root layer, default off, with
no new physical targets or version-selection controls. Full source decisions
are in PORCELAIN_ROOT_SUPPORT.md.

## Source and numerical evidence

Three readers separately inspect the lower-staff source: 35 events/91 pitch
attacks. The candidate selects 15 downbeat roots with one global +12 register
change: 14 two-beat roots and terminal C4@60/.5. It retains the lower hold
across the melody rest [57,57.5), omits six second-chord attacks at other
melody rests, and omits the terminal ascent after60.5. These omissions are
not source silence. The original upper 83 tuples and64-beat extent are fixed.

The actual own-cloud Chromium public OfflineAudioContext diagnostic renders
same-melody A/B and support alone at .55x/1x/1.4x, using the exact original
sample voice/output graph parameters at explicit offline timestamps and all21
original sample hashes. This diagnostic does not invoke the live DOM transport
or its asynchronous generation guards. It substitutes
only one deterministic seed for the app's random reverb formula, shared by
all nine renders. An independent audit checks all588 scheduled/ended records,
source function hashes, frame extents and numeric arithmetic.

Mixed peaks are −7.579/−5.960/−5.471dBFS; support-only RMS is
−22.722/−22.700/−22.543dB relative to melody. No clipped/nonfinite samples;
final250ms is exactly zero. This is electrical level/headroom evidence,
not perceptual loudness, subjective pleasantness or reference listening.

A second actual diagnostic measures isolated F3/C4 natural output at1.4x.
The next four-beat bar boundary is1.785714s, before the1.895986s decoded
buffer end. Actual F3/C4 post-boundary peaks are −76.646/−74.353dBFS;
first100ms RMS is −89.141/−85.564dBFS. F3 therefore has nonzero residual
output in the next G harmony, and final C4 can ring beyond beat64 as tonic.
No sample is cropped to force silence. Isolated values are not exact stem
contributions under the mixed song's shared nonlinear compressor.

## Integration findings and webpage checks

Initial full gate: 786 runtime +15 compiler tests passed; independent all-script
run: 803 passed. These passes did not cover one source-hint integration defect:
the preserved V1 hint still said “无伴奏” even though optional support was now
available. Independent review caught it in both practice and library displays.
A compatible-support-aware shared display helper now serves both pages; four
new positive/negative actual-rendering tests cover the fix. Final full gate is
790 runtime +15 compiler; independent all-script gate807/807, all passing.
The clean baseline-plus-patch replay separately passes790+15. All55 existing
song JSONs and all archives/samples/preferences remain byte-identical;56
generated records equal their source data, and36 canonical cards remain.

Own-cloud Chromium performed the normal 2.4.20→2.4.21 update. The filtered
library has one 83-note/96-BPM theme card with optional support, not another
version card. First entry remains off with previously saved .55 speed.
Selecting light and 1x played through to 示范结束. At1.4x the ending section
repeated in 自己弹 mode; Pause and Continue both retained0:24, with a new
five-beat preparation. Exiting the repeat and selecting off continued to
练习结束; reload returned inactive/off/1.4x/repeat off.

## Final-byte webpage and package checks

The original loopback origin already cached the early21 development build;
its same-version update correctly reported latest but retained the old hint.
Final-byte QA used the independent private127.0.0.1:8131 origin, not a claim
that same-version development refresh installs changed bytes automatically.
Both actual practice DOM and actual library-card DOM now use the reviewed
support hint without the stale “无伴奏” claim. First entry remained off/.55;
light demo playback, pause and seek to14 seconds worked. Final screenshots
show860×404 and607×524 layouts with all21 keys and no extra support targets.
The actual copy button returned5410 characters including the source-hold and
short-ending-root rules. No source scans or diagnostic pages are packaged.

Final cumulative-patch replay, ZIP file-by-file hashes and Library receipt
are checked when packaging. This is webpage functionality and numerical audio
verification, not reference-recording listening or a guarantee of taste.
