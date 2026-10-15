#!/usr/bin/env python3
"""Render frozen-v2.4.1 versus source-corrected Yun Yan Cheng Yu listening files.

Requires Python 3.10+, numpy, ffmpeg and ffprobe already installed. No Git,
downloads, browser effects, accompaniment, synthetic sustain or normalization.
Optional internal QA: a representative A/B excerpt and complete individual
A/B melody renders use
identical actual samples and gain. Both versions retain the same beat origin,
all prior sample tails crossing an excerpt boundary and all final sample tails.

  python3 scripts/render-reviewed-song-comparison.py \
    --before-zip /path/to/kalimba-tone-trace-v2.4.1-local-preview.zip \
    --output /path/outside/repository/kalimba-reviewed-qa --qa-only

The default B is the actual repository song, rechecked after rendering. Use
--after-zip for a historical replay after later source corrections. An exact
approved-output fingerprint is required; a different melody is rejected. The
unresolved measure 28 is frozen verbatim from v2.4.1, including rhythm and
pitch, and remains explicitly unverified in the complete candidate.
"""

import argparse
from collections import Counter
import hashlib
import importlib.util
import json
import math
import re
import shutil
import sys
import zipfile
from pathlib import Path

import numpy as np


SONG_FILE = "data/songs/yun-yan-cheng-yu.json"
BASELINE_SONG_SHA256 = "bf72c25572f9432551a110efc92b6e7c39f60b3d8e3b2a4688905427adefea05"
# Reconstructed from independently reviewed scoped fixtures, the unchanged
# opening and all eight frozen m28 tuples; compared against actual final JSON.
EXPECTED_AFTER_MELODY_SHA256 = "250f5b00a44b7b6708a0d200bb1ed5d212fe313b714dade2e0d1b25d397a7d14"
REVIEWED_ATTACK_COUNT = 181
REVIEWED_TOTAL_BEATS = 124
REVIEWED_EVIDENCE_RECORDS = [{'scope': [{'from': 16, 'to': 48.5, 'attacks': 39}],
  'evidenceSha256': '94a644e0cfd4e2de79d4af855cd55210c93067e6b095d9fff384e83738d50b19',
  'sourceImageSha256': 'e8a1574fe02f817fcfbf5db94ad4d72bf8e90a004519b643395e640c2594dbd3',
  'actualAfterTupleCheckPassed': True},
 {'scope': [{'from': 48.5, 'to': 81.5, 'attacks': 43}],
  'evidenceSha256': 'b38b951d3dca87e962939d52c0af9b7ba28426173573502265ad0eeadeb75e33',
  'sourceImageSha256': ['e8a1574fe02f817fcfbf5db94ad4d72bf8e90a004519b643395e640c2594dbd3',
                        '01023a8c008dd064ae082cba0b9d18f9f1caf37315c1c05067483140c338666f'],
  'actualAfterTupleCheckPassed': True},
 {'scope': [{'from': 81.5, 'to': 108, 'attacks': 52}, {'from': 112, 'to': 124, 'attacks': 16}],
  'evidenceSha256': '200f2dce7787bfca874d986d0ab1aeb526299d4903cbaa33281c5eb78b8004ff',
  'sourceImageSha256': '01023a8c008dd064ae082cba0b9d18f9f1caf37315c1c05067483140c338666f',
  'actualAfterTupleCheckPassed': True}]
PENDING_SCOPE = (108, 112)
MELODY_ONLY_END_REST = (120, 124)
SOURCE_URL = "https://www.sohu.com/a/274931646_759018"
GAP_SECONDS = 1.5


def load_helper():
    path = Path(__file__).with_name("render-practice-comparison.py")
    spec = importlib.util.spec_from_file_location("practice_comparison", path)
    helper = importlib.util.module_from_spec(spec)
    previous = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(helper)
    finally:
        sys.dont_write_bytecode = previous
    return helper


def sha_bytes(data):
    return hashlib.sha256(data).hexdigest()


def tuple_hash(steps):
    return sha_bytes(json.dumps(steps, separators=(",", ":")).encode())


def read_archived_song(path):
    with zipfile.ZipFile(path) as archive:
        if any(".git" in Path(name).parts for name in archive.namelist()):
            raise ValueError("Use a portable input ZIP without .git")
        names = [name for name in archive.namelist()
                 if name == SONG_FILE or name.endswith("/" + SONG_FILE)]
        if len(names) != 1:
            raise ValueError("Archive must contain exactly one " + SONG_FILE)
        raw = archive.read(names[0])
    return json.loads(raw), raw, {"archiveFile": path.name,
                                 "archiveSha256": sha_bytes(path.read_bytes()),
                                 "member": names[0], "memberSha256": sha_bytes(raw),
                                 "containsGitDirectory": False}


def validate_song(before, after):
    if None in (EXPECTED_AFTER_MELODY_SHA256, REVIEWED_ATTACK_COUNT, REVIEWED_TOTAL_BEATS):
        raise ValueError("Final source review is pending; no audio may be certified yet")
    for field in ("schemaVersion", "id", "bpm", "beatsPerMeasure", "key"):
        if before.get(field) != after.get(field):
            raise ValueError("Unexpected change in " + field)
    if after["id"] != "yun-yan-cheng-yu" or after["bpm"] != 69:
        raise ValueError("Expected Yun Yan Cheng Yu at 69 quarter-note BPM")
    if len(before["steps"]) != 196 or len(after["steps"]) != REVIEWED_ATTACK_COUNT:
        raise ValueError("Unexpected attack count")
    if tuple_hash(after["steps"]) != EXPECTED_AFTER_MELODY_SHA256:
        raise ValueError("Actual after tuples do not match reviewed corrections plus the frozen pending measure")
    if after.get("sourceFeatures", {}).get("sourceTotalBeats") != REVIEWED_TOTAL_BEATS:
        raise ValueError("Reviewed score extent, including any final rest, must match exactly")
    if [s for s in before["steps"] if s[1] < 16] != [s for s in after["steps"] if s[1] < 16]:
        raise ValueError("Previously reviewed opening changed unexpectedly")
    pending = lambda song: [s for s in song["steps"] if PENDING_SCOPE[0] <= s[1] < PENDING_SCOPE[1]]
    if len(pending(before)) != 8 or pending(before) != pending(after):
        raise ValueError("Unresolved measure 28 must preserve all eight baseline tuples verbatim")
    if max(s[1] + s[2] for s in after["steps"]) != MELODY_ONLY_END_REST[0]:
        raise ValueError("The final melody release must remain at beat 120, before the closing melody rest")
    for name, beat, duration in after["steps"]:
        if not math.isfinite(beat) or not math.isfinite(duration) or beat < 0 or duration <= 0:
            raise ValueError("Invalid beat or duration")
        if beat + duration > REVIEWED_TOTAL_BEATS + 1e-9:
            raise ValueError("A note extends beyond the source-reviewed ending")


def events(steps):
    return [{"beat": beat, "duration": duration,
             "notes": [{"name": name, "velocity": 1.0}]} for name, beat, duration in steps]


def attack_difference(before, after):
    a = Counter((name, beat) for name, beat, _ in before)
    b = Counter((name, beat) for name, beat, _ in after)
    return ([[name, beat, 0] for (name, beat), count in (a - b).items() for _ in range(count)],
            [[name, beat, 0] for (name, beat), count in (b - a).items() for _ in range(count)])


def verify_archive_samples(path, source, repo, sample_records):
    prefix = source["member"][:-len(SONG_FILE)]
    pattern = r"export const DISPLAY_KEYS = (\[.*?\]);"
    current = re.search(pattern, (repo / "src/songs.js").read_text(), re.S)
    with zipfile.ZipFile(path) as archive:
        for record in sample_records:
            if sha_bytes(archive.read(prefix + record["file"])) != record["sha256"]:
                raise ValueError("Sample changed from an input archive: " + record["file"])
        manifest = "assets/samples/manifest.json"
        if archive.read(prefix + manifest) != (repo / manifest).read_bytes():
            raise ValueError("Sample manifest differs from an input archive")
        frozen = re.search(pattern, archive.read(prefix + "src/songs.js").decode(), re.S)
        if not current or not frozen or json.loads(current[1]) != json.loads(frozen[1]):
            raise ValueError("Physical keyboard panning layout changed")


def render_pair(helper, samples, before, after, start, end, gain, beat_seconds):
    selected = {label: [s for s in song["steps"] if s[1] < end]
                for label, song in (("A", before), ("B", after))}
    sample_end = max(round((helper.LEAD_SECONDS + beat * beat_seconds) * helper.RATE)
                     + len(samples[name]) for steps in selected.values() for name, beat, _ in steps)
    nominal_end = round((helper.LEAD_SECONDS + end * beat_seconds) * helper.RATE)
    full_frames = max(sample_end, nominal_end) + round(helper.TRAIL_SECONDS * helper.RATE)
    crop_frame = round(start * beat_seconds * helper.RATE)
    frame_at = lambda beat: round((helper.LEAD_SECONDS + beat * beat_seconds) * helper.RATE) - crop_frame
    render = lambda steps: helper.render_layer(events(steps), 1, beat_seconds,
                                               full_frames, samples, gain)[crop_frame:]
    audio = {label: render(steps) for label, steps in selected.items()}
    removed, added = attack_difference(selected["A"], selected["B"])
    expected = render(removed) - render(added)
    residual = float(np.max(np.abs(audio["A"] - audio["B"] - expected)))
    if residual > 1e-12:
        raise ValueError("Audio difference contains something other than the exact reviewed attack changes")
    first_change = min((s[1] for s in removed + added), default=end)
    unchanged_end = max(0, frame_at(first_change))
    if not np.array_equal(audio["A"][:unchanged_end], audio["B"][:unchanged_end]):
        raise ValueError("Audio changed before the first corrected attack")
    carried = {}
    for label, steps in selected.items():
        carried[label] = []
        for name, beat, duration in steps:
            tail_end = frame_at(beat) + len(samples[name])
            if beat < start and tail_end > 0:
                carried[label].append({"step": [name, beat, duration],
                                       "tailEndFrameInExcerpt": tail_end,
                                       "tailEndSecondsInExcerpt": tail_end / helper.RATE})
    details = {"onsetSelectionEndBeatExclusive": end,
               "musicalStartBeat": start, "beatOriginSeconds": frame_at(start) / helper.RATE,
               "frames": len(audio["A"]), "durationSeconds": len(audio["A"]) / helper.RATE,
               "sourceTimelineCropFrame": crop_frame,
               "attacksStartingInsideExcerpt": {label: sum(start <= s[1] < end for s in steps)
                                                for label, steps in selected.items()},
               "naturalCarryInTails": carried,
               "audioMetrics": {label: helper.validate_audio(pcm, label) for label, pcm in audio.items()},
               "pcmFloat64Sha256": {label: sha_bytes(pcm.tobytes()) for label, pcm in audio.items()},
               "differenceResidualMaxAbsolute": residual,
               "differenceEqualsOnlyReviewedAttackChanges": True,
               "pcmIdenticalBeforeFirstChangedAttackBeat": first_change,
               "removedPitchOnsets": [s[:2] for s in removed],
               "addedPitchOnsets": [s[:2] for s in added]}
    return audio, details, frame_at


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before-zip", required=True, type=Path)
    parser.add_argument("--after-zip", type=Path)
    parser.add_argument("--qa-only", action="store_true",
                        help="Render and validate PCM internally; write only a QA manifest/report, no audio")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--excerpt-from", type=float, default=16)
    parser.add_argument("--excerpt-to", type=float, default=49)
    parser.add_argument("--output-gain", type=float, default=0.8)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if output.is_relative_to(repo):
        parser.error("Generate listening artifacts outside the repository")
    if not math.isfinite(args.output_gain) or not 0 < args.output_gain <= 1:
        parser.error("--output-gain must be finite, greater than zero and at most one")
    if not all(math.isfinite(x) for x in (args.excerpt_from, args.excerpt_to)):
        parser.error("Excerpt boundaries must be finite")
    if not 0 <= args.excerpt_from < args.excerpt_to:
        parser.error("Excerpt start must precede end and be nonnegative")
    if not args.before_zip.is_file() or (args.after_zip is not None and not args.after_zip.is_file()):
        parser.error("Input ZIPs must exist")
    for command in ("ffmpeg", "ffprobe"):
        if not shutil.which(command):
            parser.error(command + " must already be installed")
    helper = load_helper()
    before, _, before_source = read_archived_song(args.before_zip.resolve())
    if before_source["memberSha256"] != BASELINE_SONG_SHA256:
        raise ValueError("The before song must be the frozen v2.4.1 baseline")
    if args.after_zip is not None:
        after, after_bytes, after_source = read_archived_song(args.after_zip.resolve())
    else:
        after_bytes = (repo / SONG_FILE).read_bytes()
        after = json.loads(after_bytes)
        after_source = {"file": SONG_FILE, "sha256": sha_bytes(after_bytes)}
    validate_song(before, after)
    if args.excerpt_to > REVIEWED_TOTAL_BEATS:
        parser.error("Excerpt must stay inside the final reviewed score extent")
    samples, sample_records = helper.load_samples(repo)
    if len(samples) != 21:
        raise ValueError("Expected the repository's 21 real note samples")
    verify_archive_samples(args.before_zip, before_source, repo, sample_records)
    if args.after_zip is not None:
        verify_archive_samples(args.after_zip, after_source, repo, sample_records)
    beat_seconds = 60 / 69
    excerpt, excerpt_info, frame_at = render_pair(helper, samples, before, after,
                                                 args.excerpt_from, args.excerpt_to,
                                                 args.output_gain, beat_seconds)
    # A has its original notated content. Both full files share the final
    # reviewed timeline and common ring-out; no attack or hold is fabricated.
    full, full_info, full_frame_at = render_pair(helper, samples, before, after, 0,
                                                max(REVIEWED_TOTAL_BEATS,
                                                    max(s[1] + s[2] for s in before["steps"])),
                                                args.output_gain, beat_seconds)
    frames = len(excerpt["A"])
    gap_frames = round(GAP_SECONDS * helper.RATE)
    b_start = frames + gap_frames
    combined = np.concatenate((excerpt["A"], np.zeros((gap_frames, 2)), excerpt["B"]))
    if not np.all(combined[frames:b_start] == 0):
        raise ValueError("Comparison gap is not exact digital silence")
    output.mkdir(parents=True, exist_ok=True)
    files = []
    variants = (
        ("yun-yan-cheng-yu-reviewed-excerpt-A-B", combined, "Yun Yan Cheng Yu: v2.4.1 / reviewed excerpt"),
        ("yun-yan-cheng-yu-reviewed-excerpt-A", excerpt["A"], "Yun Yan Cheng Yu: before excerpt"),
        ("yun-yan-cheng-yu-reviewed-excerpt-B", excerpt["B"], "Yun Yan Cheng Yu: reviewed excerpt"),
        ("yun-yan-cheng-yu-full-A-v2.4.1", full["A"], "Yun Yan Cheng Yu: full v2.4.1 melody"),
        ("yun-yan-cheng-yu-full-B-corrected-candidate", full["B"], "Yun Yan Cheng Yu: corrected candidate, measure 28 pending"))
    for basename, pcm, title in (() if args.qa_only else variants):
        path = output / (basename + ".wav")
        files.append(helper.write_wav(path, pcm))
        files.append(helper.write_mp3(path, title))
    last_sample_end = max(full_frame_at(beat) + len(samples[name]) for name, beat, _ in after["steps"])
    if not np.all(full["B"][last_sample_end:] == 0):
        raise ValueError("Unexpected sound after all final natural sample tails")
    if args.after_zip is None and (repo / SONG_FILE).read_bytes() != after_bytes:
        raise ValueError("Actual after JSON changed during rendering; rerun before sharing")
    timeline = [{"label": label, "startFrame": start, "startSeconds": start / helper.RATE,
                 "endFrame": start + frames, "endSeconds": (start + frames) / helper.RATE,
                 "excerptBeatOriginSeconds": (start + frame_at(args.excerpt_from)) / helper.RATE}
                for label, start in (("A", 0), ("B", b_start))]
    beats = sorted(set([args.excerpt_from, args.excerpt_to]
                       + [s[1] for s in before["steps"] + after["steps"]
                          if args.excerpt_from <= s[1] < args.excerpt_to]))
    timestamps = [{"beat": beat, "beforeSeconds": frame_at(beat) / helper.RATE,
                   "afterSeconds": (b_start + frame_at(beat)) / helper.RATE} for beat in beats]
    manifest = {
        "formatVersion": 1, "renderType": "offline-dry-real-sample-corrected-song-candidate-comparison",
        "songId": after["id"], "title": after["title"],
        "settings": {"qaOnlyNoAudioExport": args.qa_only, "bpm": 69, "speedFactor": 1.0, "sampleRate": helper.RATE, "channels": 2,
                     "wavEncoding": "PCM signed 16-bit", "mp3BitrateKbps": 192,
                     "excerptMusicalRange": [args.excerpt_from, args.excerpt_to],
                     "reviewedTotalBeats": REVIEWED_TOTAL_BEATS,
                     "fullComparisonTimelineBeats": full_info["onsetSelectionEndBeatExclusive"],
                     "fixedOutputAttenuation": args.output_gain, "voiceGain": helper.VOICE_GAIN,
                     "melodyVelocity": 1.0, "accompaniment": False,
                     "sampleLengthPolicy": "Full natural decoded sample decay; no gating, looping, extension or synthesized sustain",
                     "normalization": "None; identical fixed gain for before and after, excerpt and full song",
                     "pan": "(physicalLane - 10) / 34; mono equal-power StereoPanner",
                     "leftBoundaryPolicy": "Render from original song origin then crop; preceding natural tails retained",
                     "prerollSeconds": helper.LEAD_SECONDS, "trailSeconds": helper.TRAIL_SECONDS,
                     "comparisonGapSeconds": GAP_SECONDS, "comparisonGapFrames": gap_frames},
        "beforeSource": before_source,
        "afterSource": {**after_source, "actualRepositoryBytesRecheckedAfterRender": args.after_zip is None},
        "reviewedSource": {"url": SOURCE_URL, "evidenceRecords": REVIEWED_EVIDENCE_RECORDS,
                           "expectedCandidateMelodyTupleSha256": EXPECTED_AFTER_MELODY_SHA256,
                           "pendingMeasure": {"measure": 28, "onsetRange": list(PENDING_SCOPE),
                                              "decision": "Keep all eight v2.4.1 tuples verbatim; pitch and rhythm remain unverified"}},
        "validation": {"actualAfterMatchesReviewedCorrectionsAndFrozenPendingMeasure": True,
                       "pendingMeasure28AllEightBaselineTuplesUnchanged": True,
                       "finalSourceExtentMatchesReviewedEvidence": True,
                       "previouslyReviewedOpeningBeforeBeat16Unchanged": True,
                       "all21SampleFilesManifestAndLayoutIdenticalToInputArchives": True,
                       "beforeTotalMelodyAttacks": len(before["steps"]),
                       "afterTotalMelodyAttacks": len(after["steps"]),
                       "beforeMelodyTupleSha256": tuple_hash(before["steps"]),
                       "afterMelodyTupleSha256": tuple_hash(after["steps"]),
                       "gapIsExactDigitalSilence": True,
                       "clippedSamplesAllRenderedPcm": sum(d["clippedSamples"] for info in (excerpt_info, full_info) for d in info["audioMetrics"].values()),
                       "nonFiniteSamplesAllRenderedPcm": sum(d["nonFiniteSamples"] for info in (excerpt_info, full_info) for d in info["audioMetrics"].values()),
                       "clippedSamplesAllWrittenFiles": sum(f["clippedSamples"] for f in files),
                       "nonFiniteSamplesAllWrittenFiles": sum(f["nonFiniteSamples"] for f in files)},
        "excerpt": excerpt_info, "fullSong": full_info, "timeline": timeline,
        "excerptBeatTimestamps": timestamps,
        "fullSongMelodyOnlyEndingRest": {"notationBeats": list(MELODY_ONLY_END_REST),
                                         "startSeconds": full_frame_at(120) / helper.RATE,
                                         "endSeconds": full_frame_at(124) / helper.RATE,
                                         "lastNaturalSampleEndSeconds": last_sample_end / helper.RATE,
                                         "digitalSilenceAfterAllSampleTailsVerified": True,
                                         "notAnAllLayerArrangementSilenceClaim": True},
        "fullSongPendingMeasure28": {"startSeconds": full_frame_at(PENDING_SCOPE[0]) / helper.RATE,
                                     "endSeconds": full_frame_at(PENDING_SCOPE[1]) / helper.RATE,
                                     "notationBeats": list(PENDING_SCOPE)},
        "fullSongFirstAttackSeconds": {label: full_frame_at(song["steps"][0][1]) / helper.RATE
                                       for label, song in (("A", before), ("B", after))},
        "sampleFiles": sample_records,
        "rendererFiles": [{"file": "scripts/" + p.name, "sha256": helper.sha256(p)}
                          for p in (Path(__file__), Path(helper.__file__))],
        "files": files,
        "toolVersions": {"numpy": np.__version__,
                         "ffmpeg": helper.run("ffmpeg", "-version").decode().splitlines()[0]},
        "limitations": [
            "Measure 28 [108,112) retains all eight v2.4.1 tuples unchanged; its pitch and rhythm remain unverified. This is not a fully source-approved song.",
            "Offline dry samples, not browser audio; excludes browser effects, compressor and scheduling.",
            "Notated rests contain no new attacks, but may contain a preceding pluck's natural decay.",
            "No speech, metronome, synthetic held sound or accompaniment is added.",
            "WAV offsets are sample-accurate; MP3 players may expose encoder-padding differences.",
            "Source evidence and signal checks do not establish subjective improvement, reference-listening acceptance, or physical playability."]}
    guide = [
        "《云烟成雨》已核段落修正试听 / Corrected melody candidate listening guide", "",
        "先听 yun-yan-cheng-yu-reviewed-excerpt-A-B.mp3；完整候选主旋律为 yun-yan-cheng-yu-full-B-corrected-candidate.mp3。",
        f"注意：第28小节（beat 108–112，完整文件 {full_frame_at(108) / helper.RATE:.3f}–{full_frame_at(112) / helper.RATE:.3f}s）的8个原版音符逐字保留，音高和节奏均尚未完成核准；完整曲不能视为全部已验证。",
        "另附无损 WAV，以及独立 A/B 片段和完整旧版 A，方便固定音量切换。",
        f"代表片段：beat {args.excerpt_from:g}–{args.excerpt_to:g}（结束拍不含新音头，完整保留自然尾音）。",
        f"A 0.000000–{frames / helper.RATE:.6f}s；中间静音 1.500000s；B {b_start / helper.RATE:.6f}–{len(combined) / helper.RATE:.6f}s。",
        f"完整 A/B 各 {full_info['durationSeconds']:.6f}s，使用相同时间轴、相同固定增益。",
        f"B 原谱时间长度 {REVIEWED_TOTAL_BEATS:g} 拍；完整文件保留开头休止、末尾原谱休止和真实采样尾音。",
        "A = 冻结的 v2.4.1；B = 已核段落修正后的实际新版，包含明确保留待核的第28小节。两版均通过精确旋律指纹检查。",
        "69 BPM、1.0 倍速、同一套真实 21 音采样；无伴奏、无独立归一化。请保持播放器音量不变。",
        "延音合并只减少有来源依据的续音重拨；独立同音重复仍保留。不会延长、循环或合成采样来伪造持续音。",
        "片段左边界先从歌曲原点渲染再截取，保留此前琴音的自然余韵；不会为制造安静休止而截断采样。",
        "manifest.json 给出来源、输入和输出 SHA-256、每一拍时间、差分残差、峰值和零削波检查。",
        "这些是干声离线渲染与数据验证，不代替参考录音听辨、浏览器播放或实体琴可弹性验证。", "",
        "English: A is frozen v2.4.1; B applies reviewed corrections but keeps all eight original measure-28 tuples unchanged. Its measure-28 pitch and rhythm remain unverified.",
        "The default beat-16–49 excerpt excludes measure 28. The complete candidate is not certified as fully source-correct. Both use real dry samples at 69 BPM and 1.0 speed.",
        "The excerpt is A, 1.5 seconds of exact digital silence, then B. Full A and B are separate files.",
        "The same fixed gain, beat origin and natural sample tails are used throughout. No normalization, accompaniment or fabricated sustain.", "",
        "Reproduce from a portable updated repository without Git:",
        f"python3 scripts/render-reviewed-song-comparison.py --before-zip /path/to/kalimba-tone-trace-v2.4.1-local-preview.zip --excerpt-from {args.excerpt_from:g} --excerpt-to {args.excerpt_to:g} --output /path/outside/repository/kalimba-reviewed-listening",
        "After future edits, add --after-zip /path/to/the-reviewed-after-version.zip for strict historical replay.",
        "Dependencies: Python 3.10+, numpy, ffmpeg and ffprobe already installed; no downloads.", ""]
    if args.qa_only:
        report = ["Internal dry-sample PCM QA; no audio files exported.",
                  f"Full timeline: {full_info['durationSeconds']:.6f}s; reviewed notation extent: {REVIEWED_TOTAL_BEATS:g} beats.",
                  f"Full PCM difference residual: {full_info['differenceResidualMaxAbsolute']:.17g}.",
                  f"Excerpt PCM difference residual: {excerpt_info['differenceResidualMaxAbsolute']:.17g}.",
                  "Identical real samples, gain and beat origin. Natural tails retained; no invented sustain or accompaniment.",
                  "Measure 28 [108,112) is frozen verbatim and remains unverified in pitch and rhythm.",
                  "Numerical QA does not establish listening acceptance, browser audio behavior or physical playability.",
                  "No user listening, file upload or audio-delivery approval is pending."]
        (output / "internal-qa-report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
    else:
        (output / "listening-guide.txt").write_text("\n".join(guide), encoding="utf-8")
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "files": len(files),
                      "excerptComparisonDurationSeconds": len(combined) / helper.RATE,
                      "excerptBStartSeconds": b_start / helper.RATE,
                      "fullSongDurationSeconds": full_info["durationSeconds"],
                      "reviewedTotalBeats": REVIEWED_TOTAL_BEATS,
                      "beforeAttacks": len(before["steps"]), "afterAttacks": len(after["steps"]),
                      "maximumEncodedPeak": max((f["peak"] for f in files), default=None),
                      "maximumRenderedPeak": max(d["peak"] for info in (excerpt_info, full_info) for d in info["audioMetrics"].values()),
                      "clippedSamples": manifest["validation"]["clippedSamplesAllRenderedPcm"],
                      "excerptDifferenceResidual": excerpt_info["differenceResidualMaxAbsolute"],
                      "fullSongDifferenceResidual": full_info["differenceResidualMaxAbsolute"],
                      "actualAfterSongSha256": sha_bytes(after_bytes)}, indent=2))


if __name__ == "__main__":
    main()
