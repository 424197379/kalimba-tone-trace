#!/usr/bin/env python3
"""Render reproducible dry-sample A/B/C listening comparisons, outside the repo.

Requires Python 3, numpy, ffmpeg and ffprobe already installed. No downloads.
Example:
  python3 scripts/render-practice-comparison.py --output ../kalimba-listening

A = unchanged V1 melody, B = melody + practiceAccompaniment,
C = melody + original autoAccompaniment (not the judged chord targets).
This deliberately does not emulate the browser's reverb/filter/compressor.
"""

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np


RATE = 48000
VOICE_GAIN = 0.92
LEAD_SECONDS = 0.25
TRAIL_SECONDS = 0.5
GAP_SECONDS = 1.25
VARIANTS = {
    "A": ("melody-only", None),
    "B": ("light-support", "practiceAccompaniment"),
    "C": ("original-auto-backing", "autoAccompaniment"),
}
EXCERPT_BEATS = {"birthday": 12, "xiao-xing-xing": 16}


def run(*args, data=None):
    return subprocess.run(args, input=data, check=True, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE).stdout


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def metrics(samples):
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2))) if samples.size else 0.0
    return {
        "frames": len(samples), "durationSeconds": round(len(samples) / RATE, 6),
        "peak": round(peak, 9),
        "peakDbfs": round(20 * math.log10(peak), 4) if peak else None,
        "rms": round(rms, 9),
        "rmsDbfs": round(20 * math.log10(rms), 4) if rms else None,
        "clippedSamples": int(np.count_nonzero(np.abs(samples) >= 1.0)),
        "nonFiniteSamples": int(np.count_nonzero(~np.isfinite(samples))),
    }


def validate_audio(samples, label):
    result = metrics(samples)
    if result["clippedSamples"] or result["nonFiniteSamples"]:
        raise ValueError(f"Clipping or non-finite audio in {label}: {result}")
    return result


def load_samples(repo):
    source = (repo / "src/songs.js").read_text(encoding="utf-8")
    match = re.search(r"export const DISPLAY_KEYS = (\[.*?\]);", source, re.S)
    if not match:
        raise ValueError("Cannot read physical DISPLAY_KEYS from generated src/songs.js")
    names = [key["name"] for key in json.loads(match.group(1))]
    samples, records = {}, []
    manifest = read_json(repo / "assets/samples/manifest.json")
    for item in manifest["files"]:
        path = (repo / item["file"]).resolve()
        if not path.is_relative_to(repo):
            raise ValueError("Sample file must be inside the repository")
        probe = json.loads(run("ffprobe", "-v", "error", "-show_streams", "-of", "json", str(path)))
        stream = next(s for s in probe["streams"] if s["codec_type"] == "audio")
        if stream["channels"] != 1:
            raise ValueError("This renderer expects the repository's mono samples")
        pcm = np.frombuffer(run("ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le",
                                "-acodec", "pcm_f32le", "-ac", "1", "-ar", str(RATE), "-"),
                            dtype="<f4").astype(np.float64)
        lane = names.index(item["name"])
        pan = (lane - 10) / 34
        # Web Audio StereoPannerNode equal-power pan for mono input.
        angle = (pan + 1) * math.pi / 4
        stereo = pcm[:, None] * np.array([math.cos(angle), math.sin(angle)])
        samples[item["name"]] = stereo
        records.append({"name": item["name"], "file": item["file"],
                        "sha256": sha256(path), "physicalLane": lane, "pan": pan,
                        "decodedFrames": len(pcm), "decodedDurationSeconds": len(pcm) / RATE})
    return samples, records


def melody_tuples(song):
    if "steps" in song:
        return [tuple(step) for step in song["steps"]]
    return [(note["name"], event["beat"], event["duration"])
            for event in song["events"] for note in event["notes"]
            if note.get("role") == "melody"]


def melody_events(song):
    return [{"beat": beat, "duration": duration,
             "notes": [{"name": name, "velocity": 1.0}]}
            for name, beat, duration in melody_tuples(song)]


def select_events(events, end_beat):
    return [event for event in events if end_beat is None or event["beat"] < end_beat]


def render_layer(events, volume, beat_seconds, frames, samples, output_gain):
    layer = np.zeros((frames, 2), dtype=np.float64)
    for event in events:
        onset = round((LEAD_SECONDS + event["beat"] * beat_seconds) * RATE)
        for note in event["notes"]:
            velocity = float(note.get("velocity", 0.45)) * volume
            if not math.isfinite(velocity) or velocity < 0:
                raise ValueError("Velocity must be finite and nonnegative")
            sample = samples[note["name"]]
            gain = VOICE_GAIN * min(1.2, velocity) * output_gain
            # duration is a notation/target length, never a sample gate.
            layer[onset:onset + len(sample)] += sample * gain
    return layer


def render_song(repo, sid, samples, output_gain, end_beat=None):
    melody_path = repo / f"data/songs/{sid}.json"
    chord_path = repo / f"data/songs/{sid}-chord.json"
    melody, chord = read_json(melody_path), read_json(chord_path)
    tuples = melody_tuples(melody)
    if tuples != melody_tuples(chord):
        raise ValueError(f"V1/chord melody mismatch: {sid}")
    if melody["bpm"] != chord["bpm"]:
        raise ValueError(f"V1/chord tempo mismatch: {sid}")
    chord_melody = [note for event in chord["events"] for note in event["notes"]
                    if note.get("role") == "melody"]
    if any(float(note.get("velocity", 1)) != 1 for note in chord_melody):
        raise ValueError(f"V1/chord melody velocity mismatch: {sid}")
    for field in ("practiceAccompaniment", "autoAccompaniment"):
        if not chord.get(field, {}).get("events"):
            raise ValueError(f"{sid}-chord is missing {field}. Add reviewed data before rendering.")
    beat_seconds = 60 / melody["bpm"]
    main = select_events(melody_events(melody), end_beat)
    backings = {key: select_events(chord[field]["events"], end_beat)
                for key, (_, field) in VARIANTS.items() if field}
    all_events = main + [event for events in backings.values() for event in events]
    nominal_end = max(event["beat"] + event["duration"] for event in main)
    sample_end = max(event["beat"] * beat_seconds + len(samples[note["name"]]) / RATE
                     for event in all_events for note in event["notes"])
    frames = math.ceil((LEAD_SECONDS + max(nominal_end * beat_seconds, sample_end) + TRAIL_SECONDS) * RATE)
    melody_layer = render_layer(main, 1, beat_seconds, frames, samples, output_gain)
    renders, info = {}, {}
    for key, (_, field) in VARIANTS.items():
        backing = backings.get(key, [])
        volume = float(chord[field].get("volume", 0.38)) if field else 0
        if not 0 <= volume <= 1:
            raise ValueError("Accompaniment volume must be between zero and one")
        layer = render_layer(backing, volume, beat_seconds, frames, samples, output_gain)
        mix = melody_layer + layer
        # The same array is used, never independently normalized per variant.
        if not np.array_equal(mix - layer, melody_layer):
            if np.max(np.abs(mix - layer - melody_layer)) > 1e-14:
                raise ValueError("Melody changed between mixes")
        renders[key] = mix
        info[key] = {"label": VARIANTS[key][0], "supportField": field,
                     "supportVolume": volume, "supportEvents": len(backing),
                     "supportTones": sum(len(e["notes"]) for e in backing),
                     "melodyAttacks": len(main), "supportOnlyMetrics": metrics(layer),
                     "audioMetrics": validate_audio(mix, sid + key)}
    record = {"songId": sid, "title": melody["title"], "bpm": melody["bpm"],
              "speedFactor": 1, "excerptEndBeatExclusive": end_beat,
              "sourceFiles": [{"file": str(p.relative_to(repo)), "sha256": sha256(p)}
                              for p in (melody_path, chord_path)],
              "v1ChordMelodyTupleEquality": True,
              "sharedUnchangedMelodyArray": True,
              "melodyTupleSha256": hashlib.sha256(json.dumps(tuples, separators=(",", ":")).encode()).hexdigest(),
              "melodyStemPcmFloat64Sha256": hashlib.sha256(melody_layer.tobytes()).hexdigest(),
              "melodyTupleCount": len(tuples), "variants": info}
    return renders, record


def write_wav(path, samples):
    validate_audio(samples, path.name)
    pcm = np.round(samples * 32767).astype("<i2")
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    with wave.open(str(path), "rb") as wav:
        decoded = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2").reshape(-1, 2) / 32768.0
    result = validate_audio(decoded, path.name)
    result.update({"file": path.name, "sha256": sha256(path), "sizeBytes": path.stat().st_size})
    return result


def write_mp3(wav_path, title):
    path = wav_path.with_suffix(".mp3")
    run("ffmpeg", "-y", "-v", "error", "-i", str(wav_path), "-codec:a", "libmp3lame",
        "-b:a", "192k", "-metadata", "title=" + title,
        "-metadata", "comment=Dry sampled kalimba comparison; shared fixed gain; no browser effects",
        str(path))
    pcm = np.frombuffer(run("ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le",
                            "-acodec", "pcm_f32le", "-ac", "2", "-ar", str(RATE), "-"),
                        dtype="<f4").reshape(-1, 2)
    result = validate_audio(pcm, path.name)
    result.update({"file": path.name, "sha256": sha256(path), "sizeBytes": path.stat().st_size})
    return result


def concatenate(segments):
    silence = np.zeros((round(GAP_SECONDS * RATE), 2), dtype=np.float64)
    parts, timeline, frame = [], [], 0
    for index, (label, samples) in enumerate(segments):
        if index:
            parts.append(silence)
            frame += len(silence)
        timeline.append({"label": label, "startSeconds": round(frame / RATE, 6),
                         "firstNoteSeconds": round(frame / RATE + LEAD_SECONDS, 6),
                         "endSeconds": round((frame + len(samples)) / RATE, 6)})
        parts.append(samples)
        frame += len(samples)
    return np.concatenate(parts), timeline


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path,
                        help="Artifact directory outside the repository")
    parser.add_argument("--songs", nargs="+", default=["birthday", "xiao-xing-xing"])
    parser.add_argument("--output-gain", type=float, default=0.8,
                        help="One fixed attenuation shared by every song and variant (default .8)")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if output.is_relative_to(repo):
        parser.error("Audio artifacts must be generated outside the public repository")
    if not 0 < args.output_gain <= 1:
        parser.error("--output-gain must be an attenuation greater than 0 and at most 1")
    for sid in args.songs:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", sid):
            parser.error("Song ids must be lowercase ASCII names without path separators")
    for command in ("ffmpeg", "ffprobe"):
        if not shutil.which(command):
            parser.error(f"{command} must already be installed")
    samples, sample_records = load_samples(repo)
    # Validate every requested input before writing a partial comparison.
    full = {sid: render_song(repo, sid, samples, args.output_gain) for sid in args.songs}
    output.mkdir(parents=True, exist_ok=True)
    manifest = {
        "formatVersion": 1, "renderType": "offline-dry-sample-comparison",
        "settings": {"sampleRate": RATE, "channels": 2, "wavEncoding": "PCM signed 16-bit",
                     "mp3BitrateKbps": 192, "speedFactor": 1.0,
                     "noteGain": "0.92 * clamp(velocity * accompanimentVolume, 0, 1.2)",
                     "melodyVelocity": 1.0, "fixedOutputAttenuation": args.output_gain,
                     "pan": "(physicalLane - 10) / 34; mono equal-power StereoPanner",
                     "sampleLengthPolicy": "Full decoded sample decay; never gate by note duration",
                     "sampleManifestGain": "Already baked into source sample; not applied again",
                     "leadSeconds": LEAD_SECONDS, "trailSeconds": TRAIL_SECONDS,
                     "comparisonGapSeconds": GAP_SECONDS,
                     "normalization": "None; same attenuation for all tracks and excerpts"},
        "limitations": ["Not a browser recording: excludes reverb, master tone filter, bus/dry gains and compressor.",
                        "FFmpeg MP3 decoding and offline sample-accurate scheduling may differ slightly from browser decoding and frame scheduling.",
                        "C includes original automatic backing only, not the chord version's additional judged targets.",
                        "Excerpts preserve all samples triggered before the exclusive beat cutoff, including their natural decay.",
                        "No speech, metronome or audible section labels are added; order and timestamps are in this manifest and listening-guide.txt.",
                        "Signal checks establish playback validity and matching melody, not subjective musical improvement or physical playability."],
        "toolVersions": {"numpy": np.__version__, "ffmpeg": run("ffmpeg", "-version").decode().splitlines()[0]},
        "sampleFiles": sample_records, "songs": [], "files": [], "comparisons": []}
    short_segments = []
    for sid, (renders, record) in full.items():
        manifest["songs"].append(record)
        for key, samples_out in renders.items():
            path = output / f"{sid}-{key}-{VARIANTS[key][0]}.wav"
            manifest["files"].append(write_wav(path, samples_out))
            manifest["files"].append(write_mp3(path, f"{sid}: {key} {VARIANTS[key][0]}"))
        combined, timeline = concatenate([(f"{sid} {key}: {VARIANTS[key][0]}", renders[key]) for key in VARIANTS])
        path = output / f"{sid}-full-ABC.wav"
        manifest["files"].append(write_wav(path, combined))
        manifest["files"].append(write_mp3(path, sid + ": full A / B / C comparison"))
        manifest["comparisons"].append({"file": path.with_suffix(".mp3").name, "sections": timeline})
        end_beat = EXCERPT_BEATS.get(sid, 16)
        excerpts, excerpt_record = render_song(repo, sid, samples, args.output_gain, end_beat)
        record["excerpt"] = excerpt_record
        short_segments.extend([(f"{sid} {key}: {VARIANTS[key][0]} (beats < {end_beat})", excerpts[key]) for key in VARIANTS])
    combined, timeline = concatenate(short_segments)
    path = output / "listening-comparison-short-ABC.wav"
    manifest["files"].append(write_wav(path, combined))
    manifest["files"].append(write_mp3(path, "Birthday and Twinkle: short A / B / C comparison"))
    manifest["comparisons"].insert(0, {"file": path.with_suffix(".mp3").name, "sections": timeline})
    guide = ["Kalimba listening comparison", "", "A: original single-note melody only",
             "B: exactly the same melody + new conservative light support",
             "C: exactly the same melody + original automatic backing", "",
             "Play listening-comparison-short-ABC.mp3 first. Keep the same player volume.",
             "Birthday: 104 BPM. Twinkle (xiao-xing-xing): 80 BPM. Both at 1.0x speed.",
             "All variants share melody gain and one fixed output attenuation; no per-track normalization.",
             "The native note samples retain their whole natural decay. No speech or label sounds were added.",
             "This is a dry offline render, not exact browser reverb/filter/compressor output.",
             "C is the old automatic backing layer, not all simultaneous targets from the chord exercise.", ""]
    for comparison in manifest["comparisons"]:
        guide.append(comparison["file"])
        for section in comparison["sections"]:
            guide.append(f"  {section['startSeconds']:.2f}s - {section['endSeconds']:.2f}s: {section['label']}")
        guide.append("")
    guide.extend(["Individual full-song WAV and MP3 tracks are included for direct switching.",
                  "Manifest includes source hashes, exact melody equality, durations, peaks and clipping checks.",
                  "Listening judgment and physical kalimba play-through remain for human review.", "",
                  "Reproduce from the repository:",
                  "python3 scripts/render-practice-comparison.py --output ../kalimba-listening", ""])
    (output / "listening-guide.txt").write_text("\n".join(guide), encoding="utf-8")
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "files": len(manifest["files"]),
                      "maxEncodedPeak": max(f["peak"] for f in manifest["files"]),
                      "clippedSamples": sum(f["clippedSamples"] for f in manifest["files"]),
                      "shortComparisonSeconds": len(combined) / RATE}, indent=2))


if __name__ == "__main__":
    main()
