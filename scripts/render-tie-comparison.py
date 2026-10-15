#!/usr/bin/env python3
"""Render a reproducible Yun Yan Cheng Yu tie-correction A/B comparison.

Requires Python 3.10+, numpy, ffmpeg and ffprobe already installed. No Git or
downloads are used. The before melody is read directly from a supplied ZIP;
the after melody comes from this repository or an optional historical ZIP.
Real note samples come from this script's repository and must match both inputs.

Example, from the repository root:
  python3 scripts/render-tie-comparison.py \
    --before-zip ../kalimba-tone-trace-v2.4.0-local-preview.zip \
    --output ../kalimba-ties-listening

After later song corrections, add --after-zip /path/to/v2.4.1-local-preview.zip
to reproduce this exact historical comparison without relaxing its scope.

Only three reviewed ties and the measure-4 ending rhythm may differ between
the two melody step arrays.
Note lengths never gate, extend, loop, or synthesize the real samples.
"""

import argparse
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
EXCERPT_END_BEAT = 18
GAP_SECONDS = 1.5
TIES = (
    ("D5", 5.75, 0.25, 6, 0.5),
    ("C6", 9.5, 0.5, 10, 1),
    ("A5", 13.5, 0.5, 14, 1),
)
RHYTHM_CORRECTIONS = (
    (("F5", 15, 0.5), ("F5", 15, 0.25)),
    (("E5", 15.5, 0.25), ("E5", 15.25, 0.25)),
    (("C5", 15.75, 0.25), ("C5", 15.5, 0.5)),
)


def load_helper():
    path = Path(__file__).with_name("render-practice-comparison.py")
    spec = importlib.util.spec_from_file_location("practice_comparison", path)
    helper = importlib.util.module_from_spec(spec)
    previous_bytecode_setting = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(helper)
    finally:
        sys.dont_write_bytecode = previous_bytecode_setting
    return helper


def bytes_sha256(data):
    return hashlib.sha256(data).hexdigest()


def tuple_hash(steps):
    return bytes_sha256(json.dumps(steps, separators=(",", ":")).encode())


def read_baseline(path):
    with zipfile.ZipFile(path) as archive:
        names = [name for name in archive.namelist()
                 if name == SONG_FILE or name.endswith("/" + SONG_FILE)]
        if len(names) != 1:
            raise ValueError("Baseline ZIP must contain exactly one " + SONG_FILE)
        member = names[0]
        data = archive.read(member)
    return json.loads(data), {
        "archiveFile": path.name,
        "archiveSha256": bytes_sha256(path.read_bytes()),
        "member": member,
        "memberSha256": bytes_sha256(data),
    }


def validate_changes(before, after):
    for field in ("schemaVersion", "id", "bpm", "beatsPerMeasure", "key"):
        if before.get(field) != after.get(field):
            raise ValueError(f"Unexpected change in {field}")
    expected = [list(step) for step in before["steps"]]
    removed_steps, corrections = [], []
    for name, beat, duration, continuation, continuation_duration in TIES:
        first = [name, beat, duration]
        second = [name, continuation, continuation_duration]
        if expected.count(first) != 1 or expected.count(second) != 1:
            raise ValueError(f"Baseline must contain exactly one reviewed pair: {first}, {second}")
        index = expected.index(first)
        if expected[index + 1] != second or beat + duration != continuation:
            raise ValueError(f"Tie pair is not contiguous: {first}, {second}")
        merged = [name, beat, duration + continuation_duration]
        expected[index:index + 2] = [merged]
        removed_steps.append(second)
        corrections.append({"before": [first, second], "after": merged})
    for original, corrected in RHYTHM_CORRECTIONS:
        original, corrected = list(original), list(corrected)
        if expected.count(original) != 1:
            raise ValueError(f"Baseline must contain exactly one reviewed rhythm step: {original}")
        expected[expected.index(original)] = corrected
    if after["steps"] != expected:
        raise ValueError("After melody must contain exactly the three reviewed tie merges and measure-4 ending rhythm correction")
    return removed_steps, corrections


def events(steps):
    return [{"beat": beat, "duration": duration,
             "notes": [{"name": name, "velocity": 1.0}]}
            for name, beat, duration in steps]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before-zip", required=True, type=Path,
                        help="Frozen v2.4.0 local-preview ZIP containing the before melody")
    parser.add_argument("--after-zip", type=Path,
                        help="Optional frozen v2.4.1 after ZIP for historical replay")
    parser.add_argument("--output", required=True, type=Path,
                        help="Output directory outside the repository")
    parser.add_argument("--output-gain", default=0.8, type=float,
                        help="One fixed attenuation shared by both versions (default .8)")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if output.is_relative_to(repo):
        parser.error("Audio artifacts must be generated outside the public repository")
    if not math.isfinite(args.output_gain) or not 0 < args.output_gain <= 1:
        parser.error("--output-gain must be finite, greater than 0 and at most 1")
    if not args.before_zip.is_file():
        parser.error("--before-zip must point to an existing archive")
    if args.after_zip is not None and not args.after_zip.is_file():
        parser.error("--after-zip must point to an existing archive")
    for command in ("ffmpeg", "ffprobe"):
        if not shutil.which(command):
            parser.error(f"{command} must already be installed")

    helper = load_helper()
    before, before_source = read_baseline(args.before_zip.resolve())
    if args.after_zip is not None:
        after, after_source = read_baseline(args.after_zip.resolve())
    else:
        after_bytes = (repo / SONG_FILE).read_bytes()
        after = json.loads(after_bytes)
        after_source = {"file": SONG_FILE, "sha256": bytes_sha256(after_bytes)}
    removed_steps, corrections = validate_changes(before, after)
    beat_seconds = 60 / float(before["bpm"])
    samples, sample_records = helper.load_samples(repo)
    archive_prefix = before_source["member"][:-len(SONG_FILE)]
    with zipfile.ZipFile(args.before_zip) as archive:
        for record in sample_records:
            archived_hash = bytes_sha256(archive.read(archive_prefix + record["file"]))
            if archived_hash != record["sha256"]:
                raise ValueError("Sample differs from the frozen baseline: " + record["file"])
    if args.after_zip is not None:
        after_prefix = after_source["member"][:-len(SONG_FILE)]
        with zipfile.ZipFile(args.after_zip) as archive:
            for record in sample_records:
                if bytes_sha256(archive.read(after_prefix + record["file"])) != record["sha256"]:
                    raise ValueError("Sample differs from historical after ZIP: " + record["file"])
    selected = {label: [step for step in song["steps"] if step[1] < EXCERPT_END_BEAT]
                for label, song in (("A", before), ("B", after))}
    sample_end = max(beat * beat_seconds + len(samples[name]) / helper.RATE
                     for name, beat, _ in selected["A"])
    # Retain all tails from attacks before beat 18, even if they outlast it.
    frames = math.ceil((helper.LEAD_SECONDS
                        + max(EXCERPT_END_BEAT * beat_seconds, sample_end)
                        + helper.TRAIL_SECONDS) * helper.RATE)
    renders = {
        label: helper.render_layer(events(steps), 1, beat_seconds, frames,
                                   samples, args.output_gain)
        for label, steps in selected.items()
    }
    removed_layer = helper.render_layer(events(removed_steps), 1, beat_seconds,
                                        frames, samples, args.output_gain)
    old_rhythm = helper.render_layer(events([old for old, new in RHYTHM_CORRECTIONS]),
                                     1, beat_seconds, frames, samples, args.output_gain)
    new_rhythm = helper.render_layer(events([new for old, new in RHYTHM_CORRECTIONS]),
                                     1, beat_seconds, frames, samples, args.output_gain)
    expected_difference = removed_layer + old_rhythm - new_rhythm
    error = float(np.max(np.abs(renders["A"] - renders["B"] - expected_difference)))
    if error > 1e-12:
        raise ValueError("Audible difference is not exactly the reviewed removed and shifted attacks")
    first_removed_frame = round((helper.LEAD_SECONDS + TIES[0][3] * beat_seconds) * helper.RATE)
    if not np.array_equal(renders["A"][:first_removed_frame], renders["B"][:first_removed_frame]):
        raise ValueError("Audio before the first removed attack unexpectedly changed")
    for label, render in renders.items():
        helper.validate_audio(render, label)

    gap_frames = round(GAP_SECONDS * helper.RATE)
    combined = np.concatenate((renders["A"], np.zeros((gap_frames, 2)), renders["B"]))
    after_start_frame = frames + gap_frames
    after_start = after_start_frame / helper.RATE
    timeline = []
    for label, start in (("A", 0), ("B", after_start_frame)):
        timeline.append({
            "label": label,
            "description": "Before: v2.4.0" if label == "A" else "After: three reviewed ties and measure-4 ending rhythm corrected",
            "startFrame": start,
            "startSeconds": start / helper.RATE,
            "firstNoteSeconds": (start + round((helper.LEAD_SECONDS + selected[label][0][1] * beat_seconds) * helper.RATE)) / helper.RATE,
            "endFrame": start + frames,
            "endSeconds": (start + frames) / helper.RATE,
            "melodyAttacks": len(selected[label]),
        })
    focus = []
    for name, beat, _, continuation, _ in TIES:
        onset_frame = round((helper.LEAD_SECONDS + beat * beat_seconds) * helper.RATE)
        continuation_frame = round((helper.LEAD_SECONDS + continuation * beat_seconds) * helper.RATE)
        focus.append({
            "name": name, "tiedOnsetBeat": beat, "removedAttackBeat": continuation,
            "beforeFirstAttackSeconds": onset_frame / helper.RATE,
            "beforeExtraAttackSeconds": continuation_frame / helper.RATE,
            "afterFirstAttackSeconds": (after_start_frame + onset_frame) / helper.RATE,
            "afterNoNewAttackSeconds": (after_start_frame + continuation_frame) / helper.RATE,
        })
    rhythm_focus = []
    for original, corrected in RHYTHM_CORRECTIONS:
        old_frame = round((helper.LEAD_SECONDS + original[1] * beat_seconds) * helper.RATE)
        new_frame = round((helper.LEAD_SECONDS + corrected[1] * beat_seconds) * helper.RATE)
        rhythm_focus.append({
            "name": original[0], "beforeStep": original, "afterStep": corrected,
            "beforeAttackSeconds": old_frame / helper.RATE,
            "afterAttackSeconds": (after_start_frame + new_frame) / helper.RATE,
            "individualBeforeAttackSeconds": old_frame / helper.RATE,
            "individualAfterAttackSeconds": new_frame / helper.RATE,
        })

    output.mkdir(parents=True, exist_ok=True)
    files = []
    variants = (
        ("yun-yan-cheng-yu-ties-before-after", combined, "Yun Yan Cheng Yu: before / after reviewed tie and rhythm corrections"),
        ("yun-yan-cheng-yu-A-before", renders["A"], "Yun Yan Cheng Yu: A before tie corrections"),
        ("yun-yan-cheng-yu-B-after", renders["B"], "Yun Yan Cheng Yu: B after three tie and measure-4 rhythm corrections"),
    )
    for basename, render, title in variants:
        wav_path = output / (basename + ".wav")
        files.append(helper.write_wav(wav_path, render))
        files.append(helper.write_mp3(wav_path, title))

    manifest = {
        "formatVersion": 1,
        "renderType": "offline-dry-real-sample-tie-comparison",
        "songId": after["id"], "title": after["title"],
        "settings": {
            "bpm": before["bpm"], "speedFactor": 1.0,
            "sampleRate": helper.RATE, "channels": 2,
            "wavEncoding": "PCM signed 16-bit", "mp3BitrateKbps": 192,
            "excerptEndBeatExclusive": EXCERPT_END_BEAT,
            "preserveOpeningRests": True,
            "fixedOutputAttenuation": args.output_gain,
            "voiceGain": helper.VOICE_GAIN, "melodyVelocity": 1.0,
            "pan": "(physicalLane - 10) / 34; mono equal-power StereoPanner",
            "sampleLengthPolicy": "Full decoded natural sample decay; note durations do not gate, loop, extend, or synthesize sound",
            "normalization": "None; identical fixed gain for before and after",
            "leadSeconds": helper.LEAD_SECONDS,
            "trailSeconds": helper.TRAIL_SECONDS,
            "comparisonGapSeconds": GAP_SECONDS,
            "comparisonGapFrames": gap_frames,
        },
        "beforeSource": before_source,
        "afterSource": after_source,
        "rendererFiles": [{"file": "scripts/" + p.name, "sha256": helper.sha256(p)}
                          for p in (Path(__file__), Path(helper.__file__))],
        "corrections": corrections,
        "measure4RhythmCorrections": [{"before": old, "after": new}
                                     for old, new in RHYTHM_CORRECTIONS],
        "validation": {
            "onlyThreeSpecifiedTieMergesAndMeasure4RhythmCorrection": True,
            "allOtherMelodyStepsUnchanged": True,
            "openingTripletUnchanged": before["steps"][:3] == after["steps"][:3],
            "allSampleFilesIdenticalToFrozenBaseline": True,
            "beforeTotalMelodyAttacks": len(before["steps"]),
            "afterTotalMelodyAttacks": len(after["steps"]),
            "beforeMelodyTupleSha256": tuple_hash(before["steps"]),
            "afterMelodyTupleSha256": tuple_hash(after["steps"]),
            "pcmIdenticalBeforeFirstRemovedAttack": True,
            "differenceEqualsOnlyReviewedRemovedAndShiftedSampleAttacks": True,
            "differenceResidualMaxAbsolute": error,
            "gapIsExactDigitalSilence": bool(np.all(combined[frames:after_start_frame] == 0)),
            "clippedSamplesAllDeliveredFiles": sum(item["clippedSamples"] for item in files),
            "nonFiniteSamplesAllDeliveredFiles": sum(item["nonFiniteSamples"] for item in files),
        },
        "timeline": timeline,
        "focusTimestamps": focus,
        "measure4RhythmTimestamps": rhythm_focus,
        "audioMetrics": {label: helper.metrics(render) for label, render in renders.items()},
        "sampleFiles": sample_records,
        "files": files,
        "toolVersions": {"numpy": np.__version__,
                         "ffmpeg": helper.run("ffmpeg", "-version").decode().splitlines()[0]},
        "limitations": [
            "Dry offline sample render, not a browser recording: excludes browser reverb, tone filter and compressor.",
            "A tied note removes a second attack; its real sample is not artificially sustained for the notation duration.",
            "The beat-18 excerpt cutoff selects attacks, and all triggered sample tails are preserved.",
            "No speech, metronome or synthetic section-label sounds are added.",
            "WAV timestamps are sample-accurate; some MP3 players may expose a small encoder-padding offset.",
            "Numerical checks do not establish subjective musical quality or confirm any unreviewed source notation.",
        ],
    }
    guide = [
        "《云烟成雨》延音线与第4小节节奏修正：前后试听 / Tie and rhythm listening guide", "",
        "先听 yun-yan-cheng-yu-ties-before-after.mp3（WAV 为无损版本）。",
        "A = v2.4.0 修正前；B = 合并三处延音线，并还原第4小节尾部节奏后的版本。",
        f"A: 0.000–{frames / helper.RATE:.3f}s；中间静音 {GAP_SECONDS:.3f}s；B: {after_start:.3f}–{len(combined) / helper.RATE:.3f}s。",
        f"首音：A {timeline[0]['firstNoteSeconds']:.3f}s；B {timeline[1]['firstNoteSeconds']:.3f}s。开头三拍休止保留。",
        "两版均为 69 BPM、1.0 倍速、相同音量与真实琴音采样，不单独归一化。",
        f"本段选取 beat < {EXCERPT_END_BEAT} 的音头并完整保留自然衰减；A 有 {len(selected['A'])} 次拨弦，B 有 {len(selected['B'])} 次。",
        "", "听这三处多余的第二次拨弦（以下均为合并文件中的绝对时间）：",
    ]
    for item in focus:
        guide.append(
            f"- {item['name']}：A 在 {item['beforeFirstAttackSeconds']:.3f}s 起音，"
            f"{item['beforeExtraAttackSeconds']:.3f}s 又拨一次；"
            f"B 在 {item['afterFirstAttackSeconds']:.3f}s 起音，"
            f"{item['afterNoNewAttackSeconds']:.3f}s 不再重拨。")
    guide.extend(["", "第4小节结尾的 F5、E5、C5 改回十六分、十六分、八分音符："])
    for item in rhythm_focus:
        guide.append(f"- {item['name']} 起音：A {item['beforeAttackSeconds']:.3f}s；B {item['afterAttackSeconds']:.3f}s。")
    guide.extend([
        "E5、C5 各提前四分之一拍；F5 仍在同一拍起音。这里没有改变音高。",
        "", "开头三连音原本已经正确，本次保持不变。除上列修正，其余旋律和休止均未修改。",
        "延音线表示不重复拨弦。音色自然衰减，没有用循环、延长采样或合成尾音伪造持续音。",
        "这是干声离线对比，不包含网页混响、滤波和压缩效果。请保持播放器音量不变。",
        "合并版中的中间 1.500 秒为精确数字静音；WAV 时间精确到采样点，少数 MP3 播放器可能显示微小编码补偿偏移。",
        "另附独立 A / B WAV、MP3，方便切换。manifest.json 记录基线 ZIP、歌曲 JSON、真实采样和输出的 SHA-256，以及峰值和零削波检查。",
        "", "English: A is the frozen v2.4.0 baseline; B merges three reviewed tied pairs and restores the measure-4 ending rhythm.",
        "Extra attacks at beats 6 (D5), 10 (C6), and 14 (A5) are removed; the ending E5 and C5 attacks each move 0.25 beat earlier.",
        "The measure-4 F5/E5/C5 durations become 0.25/0.25/0.5 beat. All other melody steps and the original triplets are unchanged.",
        "Pitch and tempo are unchanged. Real samples decay naturally; notation durations do not gate or extend them.",
        "", "Reproduce from a portable repository archive (no Git needed):",
        "python3 scripts/render-tie-comparison.py --before-zip /path/to/kalimba-tone-trace-v2.4.0-local-preview.zip --output /path/outside/repository/kalimba-ties-listening",
        "When the current song has later corrections, add --after-zip /path/to/kalimba-tone-trace-v2.4.1-local-preview.zip for the historical after version.",
        "Dependencies: Python 3.10+, numpy, ffmpeg and ffprobe already installed; no downloads are performed.",
        "",
    ])
    (output / "listening-guide.txt").write_text("\n".join(guide), encoding="utf-8")
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(output), "files": len(files),
        "comparisonDurationSeconds": len(combined) / helper.RATE,
        "afterStartSeconds": after_start,
        "beforeAttacks": len(selected["A"]), "afterAttacks": len(selected["B"]),
        "maximumEncodedPeak": max(item["peak"] for item in files),
        "clippedSamples": manifest["validation"]["clippedSamplesAllDeliveredFiles"],
        "differenceResidualMaxAbsolute": error,
    }, indent=2))


if __name__ == "__main__":
    main()
