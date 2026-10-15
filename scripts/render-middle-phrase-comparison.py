#!/usr/bin/env python3
"""Render the source-reviewed Yun Yan Cheng Yu m5–12 correction, A then B.

Requires Python 3.10+, numpy, ffmpeg and ffprobe already installed; no Git,
downloads, browser effects, accompaniment, synthetic sustain or normalization.
The frozen v2.4.1 ZIP supplies A. The actual repository song supplies B by
default; optional --after-zip selects a historical reviewed after version. B
must match the immutable reviewed scope fingerprint before any output is made.
The optional private evidence file adds a direct tuple-by-tuple cross-check;
it is not required to reproduce from a portable repository without .git.

  python3 scripts/render-middle-phrase-comparison.py \
    --before-zip ../kalimba-delivery-v2.4.1/kalimba-tone-trace-v2.4.1-local-preview.zip \
    --output ../kalimba-middle-listening

Only onsets in [16, 48.5) may change. Beat 48.5 is deliberately included in
the listening excerpt to retain the independent D5 after the final tie.
"""

import argparse
from collections import Counter
import hashlib
import importlib.util
import json
import math
import shutil
import sys
import zipfile
from pathlib import Path

import numpy as np


SONG_FILE = "data/songs/yun-yan-cheng-yu.json"
SCOPE_FROM, SCOPE_TO = 16, 48.5
EXCERPT_FROM, EXCERPT_TO = 16, 49
GAP_SECONDS = 1.5
BASELINE_SONG_SHA256 = "bf72c25572f9432551a110efc92b6e7c39f60b3d8e3b2a4688905427adefea05"
REVIEWED_SCOPE_SHA256 = "bf52ba0534198e243b935c3d8a2ff438e3b930c4db5ea71cf0cd6fa6ac8e1c04"
REVIEWED_EVIDENCE_SHA256 = "94a644e0cfd4e2de79d4af855cd55210c93067e6b095d9fff384e83738d50b19"
SOURCE_IMAGE_SHA256 = "e8a1574fe02f817fcfbf5db94ad4d72bf8e90a004519b643395e640c2594dbd3"
SOURCE_URL = "https://www.sohu.com/a/274931646_759018"
SOURCE_IMAGE_URL = "https://5b0988e595225.cdn.sohucs.com/images/20181113/3696afe6f91f4067999b5f0c48daad10.jpeg"
RESTS = ((20, 21.5), (37, 38))
# These are source decisions, not a rule for merging adjacent repeated pitches.
TIES = (("E5", 35.5, 36, 37), ("B4", 39.5, 40, 40.5),
        ("G4", 43.5, 44, 44.5), ("C5", 45.5, 46, 47),
        ("D5", 47.5, 48, 48.5))


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
            raise ValueError("Use the portable baseline ZIP without .git")
        names = [name for name in archive.namelist()
                 if name == SONG_FILE or name.endswith("/" + SONG_FILE)]
        if len(names) != 1:
            raise ValueError("Baseline must contain exactly one " + SONG_FILE)
        member = names[0]
        data = archive.read(member)
    return json.loads(data), {"archiveFile": path.name,
                             "archiveSha256": sha_bytes(path.read_bytes()),
                             "member": member, "memberSha256": sha_bytes(data),
                             "containsGitDirectory": False}


def validate_changes(before, after, evidence_path=None):
    for field in ("schemaVersion", "id", "bpm", "beatsPerMeasure", "key"):
        if before.get(field) != after.get(field):
            raise ValueError("Unexpected change in " + field)
    if before["bpm"] != 69 or after["id"] != "yun-yan-cheng-yu":
        raise ValueError("Expected Yun Yan Cheng Yu at 69 quarter-note BPM")
    scoped = lambda song: [step for step in song["steps"] if SCOPE_FROM <= step[1] < SCOPE_TO]
    outside = lambda song: [step for step in song["steps"] if not SCOPE_FROM <= step[1] < SCOPE_TO]
    old, new = scoped(before), scoped(after)
    if len(old) != 43 or len(new) != 39 or tuple_hash(new) != REVIEWED_SCOPE_SHA256:
        raise ValueError("After scope must match exactly the 39 source-reviewed attacks")
    if len(before["steps"]) != 196 or len(after["steps"]) != 192:
        raise ValueError("Unexpected whole-song attack count")
    if outside(before) != outside(after):
        raise ValueError("An attack outside [16, 48.5) changed")
    candidate = ([step for step in before["steps"] if step[1] < SCOPE_FROM]
                 + new + [step for step in before["steps"] if step[1] >= SCOPE_TO])
    if candidate != after["steps"]:
        raise ValueError("Actual repository melody is not the reviewed scoped replacement")
    if sum(step[0] == "D5" and step[1] == 48.5 for step in after["steps"]) != 1:
        raise ValueError("The independent D5 at 48.5 must remain")
    for start, end in RESTS:
        if any(beat < end and beat + duration > start for _, beat, duration in after["steps"]):
            raise ValueError(f"Notated source rest [{start}, {end}) is occupied")
    if evidence_path is not None:
        raw = evidence_path.read_bytes()
        evidence = json.loads(raw)
        if sha_bytes(raw) != REVIEWED_EVIDENCE_SHA256:
            raise ValueError("Evidence is not the independently reviewed source fixture")
        span = evidence["melodySpans"][0]
        if (span["from"], span["to"], span["attacks"]) != (SCOPE_FROM, SCOPE_TO, new):
            raise ValueError("Actual repository tuples differ from source evidence")
    return old, new


def events(steps):
    return [{"beat": beat, "duration": duration,
             "notes": [{"name": name, "velocity": 1.0}]} for name, beat, duration in steps]


def audible_difference_steps(before, after):
    # Duration is notation only. Same-pitch/onset attacks cancel even if the
    # corrected tie length changes. Octave changes, shifts and repeats remain.
    old = Counter((name, beat) for name, beat, _ in before)
    new = Counter((name, beat) for name, beat, _ in after)
    return ([[name, beat, 0] for (name, beat), count in (old - new).items() for _ in range(count)],
            [[name, beat, 0] for (name, beat), count in (new - old).items() for _ in range(count)])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before-zip", required=True, type=Path)
    parser.add_argument("--after-zip", type=Path,
                        help="Optional historical reviewed after ZIP; current repository is the default")
    parser.add_argument("--output", required=True, type=Path,
                        help="Output directory outside the repository")
    parser.add_argument("--source-evidence", type=Path,
                        help="Optional original reviewed fixture for a direct tuple check")
    parser.add_argument("--output-gain", default=0.8, type=float,
                        help="Shared fixed attenuation, never per-variant normalization")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if output.is_relative_to(repo):
        parser.error("Write generated audio outside the repository")
    if not math.isfinite(args.output_gain) or not 0 < args.output_gain <= 1:
        parser.error("--output-gain must be finite, greater than zero and at most one")
    if not args.before_zip.is_file():
        parser.error("--before-zip must point to an existing archive")
    if args.after_zip is not None and not args.after_zip.is_file():
        parser.error("--after-zip must point to an existing archive")
    if args.source_evidence is not None and not args.source_evidence.is_file():
        parser.error("--source-evidence must point to an existing reviewed fixture")
    for command in ("ffmpeg", "ffprobe"):
        if not shutil.which(command):
            parser.error(command + " must already be installed")

    helper = load_helper()
    before, before_source = read_archived_song(args.before_zip.resolve())
    if before_source["memberSha256"] != BASELINE_SONG_SHA256:
        raise ValueError("Baseline is not the frozen v2.4.1 song")
    if args.after_zip is not None:
        after, after_source = read_archived_song(args.after_zip.resolve())
        with zipfile.ZipFile(args.after_zip) as archive:
            after_bytes = archive.read(after_source["member"])
    else:
        after_bytes = (repo / SONG_FILE).read_bytes()
        after = json.loads(after_bytes)
        after_source = {"file": SONG_FILE, "sha256": sha_bytes(after_bytes)}
    old_scope, new_scope = validate_changes(before, after, args.source_evidence)
    beat_seconds = 60 / before["bpm"]
    samples, sample_records = helper.load_samples(repo)
    if len(samples) != 21:
        raise ValueError("Expected the same 21 real kalimba samples")
    archive_prefix = before_source["member"][:-len(SONG_FILE)]
    with zipfile.ZipFile(args.before_zip) as archive:
        for record in sample_records:
            if sha_bytes(archive.read(archive_prefix + record["file"])) != record["sha256"]:
                raise ValueError("Sample changed from the frozen baseline: " + record["file"])
        sample_manifest = "assets/samples/manifest.json"
        if archive.read(archive_prefix + sample_manifest) != (repo / sample_manifest).read_bytes():
            raise ValueError("Sample manifest changed from the baseline")
        # Physical panning comes from the current display mapping. Verify that
        # mapping against the frozen archive as well as the source sample bytes.
        import re
        pattern = r"export const DISPLAY_KEYS = (\[.*?\]);"
        current = re.search(pattern, (repo / "src/songs.js").read_text(), re.S)
        frozen = re.search(pattern, archive.read(archive_prefix + "src/songs.js").decode(), re.S)
        if not current or not frozen or json.loads(current[1]) != json.loads(frozen[1]):
            raise ValueError("Physical keyboard layout changed from the baseline")

    if args.after_zip is not None:
        after_prefix = after_source["member"][:-len(SONG_FILE)]
        with zipfile.ZipFile(args.after_zip) as archive:
            for record in sample_records:
                if sha_bytes(archive.read(after_prefix + record["file"])) != record["sha256"]:
                    raise ValueError("Sample differs from historical after ZIP: " + record["file"])

    # Render from the original song origin, then crop. All earlier natural
    # tails crossing the left boundary survive identically; no note is gated.
    selected = {label: [step for step in song["steps"] if step[1] < EXCERPT_TO]
                for label, song in (("A", before), ("B", after))}
    sample_end = max(round((helper.LEAD_SECONDS + beat * beat_seconds) * helper.RATE)
                     + len(samples[name]) for steps in selected.values() for name, beat, _ in steps)
    nominal_end = round((helper.LEAD_SECONDS + EXCERPT_TO * beat_seconds) * helper.RATE)
    full_frames = max(sample_end, nominal_end) + round(helper.TRAIL_SECONDS * helper.RATE)
    crop_frame = round(EXCERPT_FROM * beat_seconds * helper.RATE)
    frames = full_frames - crop_frame
    render = lambda steps: helper.render_layer(events(steps), 1, beat_seconds,
                                                full_frames, samples, args.output_gain)[crop_frame:]
    renders = {label: render(steps) for label, steps in selected.items()}
    removed, added = audible_difference_steps(old_scope, new_scope)
    expected_difference = render(removed) - render(added)
    residual = float(np.max(np.abs(renders["A"] - renders["B"] - expected_difference)))
    if residual > 1e-12:
        raise ValueError("Difference contains audio beyond the reviewed attack changes")
    frame_at = lambda beat: round((helper.LEAD_SECONDS + beat * beat_seconds) * helper.RATE) - crop_frame
    first_change = min(step[1] for step in removed + added)
    if not np.array_equal(renders["A"][:frame_at(first_change)], renders["B"][:frame_at(first_change)]):
        raise ValueError("Audio before the first changed attack differs")
    for label, audio in renders.items():
        helper.validate_audio(audio, label)
    gap_frames = round(GAP_SECONDS * helper.RATE)
    after_start_frame = frames + gap_frames
    combined = np.concatenate((renders["A"], np.zeros((gap_frames, 2)), renders["B"]))
    timeline = [{"label": label,
                 "description": "Frozen v2.4.1 before" if label == "A" else "Source-reviewed m5–12 after",
                 "startFrame": start, "startSeconds": start / helper.RATE,
                 "endFrame": start + frames, "endSeconds": (start + frames) / helper.RATE,
                 "beat16AttackSeconds": (start + frame_at(16)) / helper.RATE,
                 "attacksStartingInsideExcerpt": sum(EXCERPT_FROM <= s[1] < EXCERPT_TO for s in selected[label])}
                for label, start in (("A", 0), ("B", after_start_frame))]
    beat_timestamps = [{"beat": beat, "individualSeconds": frame_at(beat) / helper.RATE,
                        "beforeSeconds": frame_at(beat) / helper.RATE,
                        "afterSeconds": (after_start_frame + frame_at(beat)) / helper.RATE}
                       for beat in (16, 20, 21, 21.5, 23, 30, 31, 32, 33, 33.5, 34, 34.5,
                                    35, 35.5, 36, 37, 38, 39.5, 40, 40.5, 41, 41.5, 42,
                                    43.5, 44, 44.5, 45.5, 46, 47.5, 48, 48.5, 49)]
    carry_in = []
    for name, beat, duration in selected["A"]:
        end = round((helper.LEAD_SECONDS + beat * beat_seconds) * helper.RATE) + len(samples[name])
        if beat < EXCERPT_FROM and end > crop_frame:
            carry_in.append({"step": [name, beat, duration],
                             "tailEndSecondsInExcerpt": (end - crop_frame) / helper.RATE})
    output.mkdir(parents=True, exist_ok=True)
    files = []
    for basename, audio, title in (
        ("yun-yan-cheng-yu-middle-before-after", combined, "Yun Yan Cheng Yu: reviewed middle phrase A / B"),
        ("yun-yan-cheng-yu-middle-A-before", renders["A"], "Yun Yan Cheng Yu: v2.4.1 before"),
        ("yun-yan-cheng-yu-middle-B-after", renders["B"], "Yun Yan Cheng Yu: reviewed m5-12 after")):
        wav = output / (basename + ".wav")
        files.append(helper.write_wav(wav, audio))
        files.append(helper.write_mp3(wav, title))
    # Do not certify a render of stale input if another process updates the song.
    if args.after_zip is None and (repo / SONG_FILE).read_bytes() != after_bytes:
        raise ValueError("Repository song changed during rendering; rerun before using these outputs")
    manifest = {
        "formatVersion": 1, "renderType": "offline-dry-real-sample-middle-phrase-comparison",
        "songId": after["id"], "title": after["title"],
        "settings": {"bpm": 69, "speedFactor": 1.0, "sampleRate": helper.RATE, "channels": 2,
                     "wavEncoding": "PCM signed 16-bit", "mp3BitrateKbps": 192,
                     "reviewedOnsetRange": [SCOPE_FROM, SCOPE_TO],
                     "excerptAttackRange": [EXCERPT_FROM, EXCERPT_TO],
                     "excerptBeatOriginSeconds": frame_at(EXCERPT_FROM) / helper.RATE,
                     "fixedOutputAttenuation": args.output_gain, "voiceGain": helper.VOICE_GAIN,
                     "melodyVelocity": 1.0, "accompaniment": False,
                     "pan": "(physicalLane - 10) / 34; mono equal-power StereoPanner",
                     "sampleLengthPolicy": "Entire decoded natural decay; notation duration never gates, loops or extends samples",
                     "normalization": "None; one fixed gain for both variants",
                     "leftBoundaryPolicy": "Render all preceding attacks from song origin and crop; identical natural carry-in tails retained",
                     "prerollSeconds": helper.LEAD_SECONDS,
                     "trailSeconds": helper.TRAIL_SECONDS,
                     "comparisonGapSeconds": GAP_SECONDS, "comparisonGapFrames": gap_frames},
        "beforeSource": before_source,
        "afterSource": {**after_source,
                        "actualRepositoryBytesRecheckedAfterRender": args.after_zip is None},
        "reviewedSource": {"url": SOURCE_URL, "imageUrl": SOURCE_IMAGE_URL,
                           "sourceImageSha256": SOURCE_IMAGE_SHA256,
                           "evidenceFixtureSha256": REVIEWED_EVIDENCE_SHA256,
                           "directEvidenceFixtureCheckPerformed": args.source_evidence is not None,
                           "expectedScopedMelodyTupleSha256": REVIEWED_SCOPE_SHA256},
        "rendererFiles": [{"file": "scripts/" + p.name, "sha256": helper.sha256(p)}
                          for p in (Path(__file__), Path(helper.__file__))],
        "validation": {"actualAfterMatchesImmutableReviewedScope": True,
                       "scopedReplacementMatchesActualAfterSteps": True,
                       "allOutsideScopeMelodyStepsUnchanged": True,
                       "reviewedSourceRestWindowsUnoccupied": True,
                       "separateD5At48Point5Preserved": True,
                       "all21SampleFilesIdenticalToFrozenBaseline": True,
                       "sampleManifestAndPhysicalKeyboardLayoutIdentical": True,
                       "beforeTotalMelodyAttacks": len(before["steps"]),
                       "afterTotalMelodyAttacks": len(after["steps"]),
                       "beforeScopeAttacks": len(old_scope), "afterScopeAttacks": len(new_scope),
                       "beforeMelodyTupleSha256": tuple_hash(before["steps"]),
                       "afterMelodyTupleSha256": tuple_hash(after["steps"]),
                       "pcmIdenticalBeforeFirstChangedAttackBeat": first_change,
                       "differenceEqualsOnlyReviewedAttackChanges": True,
                       "differenceResidualMaxAbsolute": residual,
                       "gapIsExactDigitalSilence": bool(np.all(combined[frames:after_start_frame] == 0)),
                       "clippedSamplesAllDeliveredFiles": sum(f["clippedSamples"] for f in files),
                       "nonFiniteSamplesAllDeliveredFiles": sum(f["nonFiniteSamples"] for f in files)},
        "audibleAttackChanges": {"removedPitchOnsets": [s[:2] for s in removed],
                                 "addedPitchOnsets": [s[:2] for s in added]},
        "reviewedRestWindows": [{"beat": start, "duration": end - start} for start, end in RESTS],
        "reviewedTieGroups": [{"name": name, "onsetBeat": onset,
                               "noRetriggerBeat": continuation, "endBeat": end}
                              for name, onset, continuation, end in TIES],
        "naturalCarryInTails": carry_in, "timeline": timeline, "beatTimestamps": beat_timestamps,
        "audioMetrics": {label: helper.metrics(audio) for label, audio in renders.items()},
        "sampleFiles": sample_records, "files": files,
        "toolVersions": {"numpy": np.__version__,
                         "ffmpeg": helper.run("ffmpeg", "-version").decode().splitlines()[0]},
        "limitations": [
            "Dry offline sampled audio, not browser playback; excludes reverb, tone filters and compressor.",
            "No fabricated held tones; an observed rest may contain the natural decay of a preceding pluck.",
            "Only m5–12 plus the first tied continuation in m13 are source-reviewed here. The D5 attack at 48.5 is unchanged boundary context.",
            "No speech, metronome or audible section labels; the order is A, 1.5 seconds digital silence, B.",
            "WAV offsets are sample-accurate; some MP3 players may expose encoder padding offsets.",
            "Signal checks do not establish subjective quality, reference-listening acceptance, browser audio or physical playability."]}
    lookup = {entry["beat"]: entry for entry in beat_timestamps}
    when = lambda beat: f"A {lookup[beat]['beforeSeconds']:.3f}s / B {lookup[beat]['afterSeconds']:.3f}s"
    guide = [
        "《云烟成雨》第5–12小节：修正前后试听 / Source-reviewed middle-phrase A/B", "",
        "先听 yun-yan-cheng-yu-middle-before-after.mp3；WAV 为无损版本。",
        "A = 冻结的 v2.4.1；B = 依据原谱修正第5–12小节及第13小节首个延音续音后的版本。",
        f"A 0.000–{frames / helper.RATE:.6f}s；精确数字静音 1.500s；B {after_start_frame / helper.RATE:.6f}–{len(combined) / helper.RATE:.6f}s。",
        "均为 69 BPM、1.0 倍速、同一套真实 21 音采样、相同固定增益，不单独归一化，无伴奏。",
        f"取 beat 16–49 的音头（49 不含），保留 48.5 的独立 D5 与所有自然尾音。各段 beat 16 位于 {frame_at(16) / helper.RATE:.6f}s。",
        f"各段音头数量：A {timeline[0]['attacksStartingInsideExcerpt']}；B {timeline[1]['attacksStartingInsideExcerpt']}。",
        "左边界并未清空前音：先从歌曲原点渲染，再截取；相同的前音余韵在两版中完整保留。", "",
        "重点比较（以下为合并文件绝对时间）：",
        f"- 第6小节休止从 beat 20 开始（{when(20)}）；A 的 G5 在 beat 21（{when(21)}）提前进入，B 改为 beat 21.5 的 G4（{when(21.5)}）。",
        f"- 音区：第6小节末 C5 在 beat 23（{when(23)}），第8小节两个 C5 在 beat 30、31；后段 A4/B4/G4 同样回到原谱低一组音区。",
        f"- 第9小节重新保留独立 E5@34（{when(34)}），随后 G5/F5/E5 各按原谱移动半拍。E5@32、33、33.5 仍独立拨弦。",
        f"- 第11小节 A4 的四次独立拨弦保留在 beat 40.5、41、41.5、42（第一下 {when(40.5)}）。",
    ]
    for name, onset, continuation, end in TIES:
        guide.append(f"- 延音 {name}@{onset} 至 {end}：B 在 beat {continuation} 不重新拨弦（{when(continuation)}）。")
    guide.extend([
        f"- G4@44.5（{when(44.5)}）及 D5@48.5（{when(48.5)}）各自保留新音头；不能把相邻同音全部合并。",
        "", "保持播放器音量不变。采样按自然衰减播放，休止可能仍有上一音的自然余韵；没有为了长音延长、循环或合成尾音。",
        "本试听只覆盖已审阅段落，不代表整首曲谱、浏览器播放、听感优劣或实体琴可弹性已验证。",
        "独立 A/B 的 MP3 与 WAV 也已附上；manifest.json 记录精确采样点、源文件哈希、差分验证及零削波检查。", "",
        "English: Same real dry samples, 69 BPM, 1.0 speed, fixed gain and time origin.",
        "The source-rest duration, octave/register, independent repeats and five proven ties are corrected only in [16,48.5).",
        "All notation outside that range remains unchanged. Natural carry-in and final tails are kept; note durations never extend or gate sound.",
        "This is an offline signal comparison, not completed listening or physical-instrument acceptance.", "",
        "Reproduce from the portable updated repository (no Git needed):",
        "python3 scripts/render-middle-phrase-comparison.py --before-zip /path/to/kalimba-tone-trace-v2.4.1-local-preview.zip --output /path/outside/repository/kalimba-middle-listening",
        "After later corrections, add --after-zip /path/to/reviewed-middle-phrase-version.zip for historical replay.",
        "Optional --source-evidence /path/to/original-reviewed-fixture.json directly verifies the same immutable expectations.",
        "Dependencies: Python 3.10+, numpy, ffmpeg and ffprobe already installed; no downloads.", ""])
    (output / "listening-guide.txt").write_text("\n".join(guide), encoding="utf-8")
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "files": len(files),
                      "comparisonDurationSeconds": len(combined) / helper.RATE,
                      "segmentDurationSeconds": frames / helper.RATE,
                      "afterStartSeconds": after_start_frame / helper.RATE,
                      "maximumEncodedPeak": max(f["peak"] for f in files),
                      "clippedSamples": manifest["validation"]["clippedSamplesAllDeliveredFiles"],
                      "differenceResidualMaxAbsolute": residual,
                      "actualAfterSongSha256": sha_bytes(after_bytes)}, indent=2))


if __name__ == "__main__":
    main()
