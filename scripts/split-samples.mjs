import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const lamePackageRoot = path.dirname(require.resolve("lamejs/package.json"));
const lameContext = { console };
vm.runInNewContext(fs.readFileSync(path.join(lamePackageRoot, "lame.all.js"), "utf8"), lameContext);
const lamejs = lameContext.lamejs;

const projectRoot = process.cwd();
const sourceArg = process.argv[2];
const outputDir = path.join(projectRoot, "assets", "samples");
const recordingDirs = [
  path.join(projectRoot, "assets", "source", "recordings"),
  projectRoot
];
const sampleBitrateKbps = 80;

function getDisplayKeyNames() {
  const songsSource = fs.readFileSync(path.join(projectRoot, "src", "songs.js"), "utf8");
  return [...songsSource.matchAll(/name:\s*"([A-G][#b]?\d)"/g)].map((match) => match[1]);
}

function getRecordingPath() {
  if (sourceArg) {
    return path.resolve(projectRoot, sourceArg);
  }

  const candidates = recordingDirs
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) =>
      fs.readdirSync(dir)
        .filter((name) => /\.(m4a|mp4|aac|wav|mp3)$/i.test(name))
        .filter((name) => name.startsWith("\u5361\u6797\u5df4\u91c7\u97f3") || /kalimba/i.test(name))
        .map((name) => path.join(dir, name))
    );

  if (candidates.length !== 1) {
    throw new Error(`Expected one kalimba recording, found ${candidates.length}. Pass the path as an argument.`);
  }

  return candidates[0];
}

function getChromeExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROME_EXECUTABLE,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function encodeMp3(int16, sampleRate) {
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, sampleBitrateKbps);
  const chunks = [];
  const blockSize = 1152;

  for (let offset = 0; offset < int16.length; offset += blockSize) {
    const chunk = encoder.encodeBuffer(int16.subarray(offset, offset + blockSize));
    if (chunk.length) {
      chunks.push(Buffer.from(chunk));
    }
  }

  const flush = encoder.flush();
  if (flush.length) {
    chunks.push(Buffer.from(flush));
  }

  return Buffer.concat(chunks);
}

function base64ToInt16(base64) {
  const bytes = Buffer.from(base64, "base64");
  return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / Int16Array.BYTES_PER_ELEMENT);
}

const browserAnalysis = async (page, recordingBytesBase64, keyNames) => page.evaluate(
  async ({ recordingBytesBase64, keyNames }) => {
    const expectedEventCount = keyNames.length * 2;
    const bytesBinary = atob(recordingBytesBase64);
    const bytes = new Uint8Array(bytesBinary.length);
    for (let index = 0; index < bytesBinary.length; index += 1) {
      bytes[index] = bytesBinary.charCodeAt(index);
    }

    const context = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await context.decodeAudioData(bytes.buffer);
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const mono = new Float32Array(length);

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const data = audioBuffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        mono[index] += data[index] / audioBuffer.numberOfChannels;
      }
    }
    await context.close();

    function highPass(input, cutoffHz) {
      const output = new Float32Array(input.length);
      const rc = 1 / (2 * Math.PI * cutoffHz);
      const dt = 1 / sampleRate;
      const alpha = rc / (rc + dt);
      let previousY = 0;
      let previousX = input[0] || 0;

      for (let index = 0; index < input.length; index += 1) {
        const x = input[index];
        const y = alpha * (previousY + x - previousX);
        output[index] = y;
        previousY = y;
        previousX = x;
      }

      return output;
    }

    function median(values) {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)] || 0;
    }

    function percentile(values, ratio) {
      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * ratio)));
      return sorted[index] || 0;
    }

    function rmsBetween(data, start, end) {
      const from = Math.max(0, Math.floor(start));
      const to = Math.min(data.length, Math.floor(end));
      if (to <= from) {
        return 0;
      }

      let sum = 0;
      for (let index = from; index < to; index += 1) {
        sum += data[index] * data[index];
      }
      return Math.sqrt(sum / (to - from));
    }

    function peakBetween(data, start, end) {
      const from = Math.max(0, Math.floor(start));
      const to = Math.min(data.length, Math.floor(end));
      let peak = 0;
      for (let index = from; index < to; index += 1) {
        const value = Math.abs(data[index]);
        if (value > peak) {
          peak = value;
        }
      }
      return peak;
    }

    function clippingBetween(data, start, end) {
      const from = Math.max(0, Math.floor(start));
      const to = Math.min(data.length, Math.floor(end));
      let clipped = 0;
      for (let index = from; index < to; index += 1) {
        if (Math.abs(data[index]) >= 0.995) {
          clipped += 1;
        }
      }
      return clipped;
    }

    function makeFrames(data) {
      const hop = Math.floor(sampleRate * 0.006);
      const frame = Math.floor(sampleRate * 0.024);
      const frames = [];

      for (let start = 0; start + frame <= data.length; start += hop) {
        let sum = 0;
        let peak = 0;
        for (let offset = 0; offset < frame; offset += 1) {
          const value = Math.abs(data[start + offset]);
          sum += value * value;
          if (value > peak) {
            peak = value;
          }
        }

        frames.push({
          sample: start,
          time: start / sampleRate,
          rms: Math.sqrt(sum / frame),
          peak
        });
      }

      return { frames, hop };
    }

    function findEvents(data) {
      const { frames, hop } = makeFrames(data);
      const noise = median(frames.slice(0, Math.min(frames.length, Math.floor(2 / 0.006))).map((frame) => frame.rms));
      const globalFloor = percentile(frames.map((frame) => frame.rms), 0.12);
      const globalPeak = percentile(frames.map((frame) => frame.rms), 0.995);
      const threshold = Math.max(noise * 8, globalFloor * 7, globalPeak * 0.085, 0.0035);
      const localThreshold = Math.max(noise * 3, globalFloor * 2.4, threshold * 0.28);
      const minDistance = Math.floor(sampleRate * 1.2);
      const candidates = [];

      for (let index = 1; index < frames.length - 1; index += 1) {
        const current = frames[index];
        if (
          current.rms >= threshold &&
          current.rms >= frames[index - 1].rms &&
          current.rms > frames[index + 1].rms
        ) {
          let back = index;
          while (back > 0 && frames[back].rms > localThreshold) {
            back -= 1;
          }
          candidates.push({
            sample: frames[Math.max(0, back)].sample,
            peakSample: current.sample,
            time: frames[Math.max(0, back)].sample / sampleRate,
            peakTime: current.time,
            rms: current.rms
          });
        }
      }

      candidates.sort((a, b) => b.rms - a.rms);
      const selected = [];
      for (const candidate of candidates) {
        if (selected.every((event) => Math.abs(event.peakSample - candidate.peakSample) >= minDistance)) {
          selected.push(candidate);
        }
      }
      selected.sort((a, b) => a.peakSample - b.peakSample);

      if (selected.length > expectedEventCount) {
        const trimmed = [];
        for (const event of selected) {
          const previous = trimmed[trimmed.length - 1];
          if (!previous || event.peakSample - previous.peakSample > minDistance) {
            trimmed.push(event);
          } else if (event.rms > previous.rms) {
            trimmed[trimmed.length - 1] = event;
          }
        }
        selected.length = 0;
        selected.push(...trimmed);
      }

      if (selected.length !== expectedEventCount) {
        return {
          error: `Expected ${expectedEventCount} plucks, detected ${selected.length}`,
          events: selected.map((event) => ({
            time: Number(event.time.toFixed(3)),
            peakTime: Number(event.peakTime.toFixed(3)),
            rms: Number(event.rms.toFixed(5))
          })),
          threshold,
          noise,
          globalFloor,
          globalPeak
        };
      }

      return { events: selected, threshold, noise, globalFloor, globalPeak };
    }

    function segmentEnd(data, event, nextEvent) {
      const start = event.sample;
      const maxEnd = nextEvent
        ? Math.min(nextEvent.sample - Math.floor(sampleRate * 0.12), start + Math.floor(sampleRate * 2.85))
        : Math.min(data.length, start + Math.floor(sampleRate * 2.85));
      const minEnd = Math.min(maxEnd, start + Math.floor(sampleRate * 1.45));
      const frame = Math.floor(sampleRate * 0.09);
      const holdFrames = 4;
      const noise = rmsBetween(data, Math.max(0, start - sampleRate * 0.42), Math.max(0, start - sampleRate * 0.08));
      const peak = peakBetween(data, start, Math.min(maxEnd, start + sampleRate * 0.22));
      const tailThreshold = Math.max(noise * 2.8, peak * 0.012, 0.002);
      let quietCount = 0;

      for (let cursor = minEnd; cursor + frame < maxEnd; cursor += frame) {
        const level = rmsBetween(data, cursor, cursor + frame);
        if (level < tailThreshold) {
          quietCount += 1;
          if (quietCount >= holdFrames) {
            return Math.max(minEnd, cursor + frame);
          }
        } else {
          quietCount = 0;
        }
      }

      return maxEnd;
    }

    function candidateMetrics(data, event, nextEvent) {
      const start = Math.max(0, event.sample - Math.floor(sampleRate * 0.04));
      const end = segmentEnd(data, event, nextEvent);
      const preNoise = rmsBetween(data, event.sample - sampleRate * 0.35, event.sample - sampleRate * 0.08);
      const attackPeak = peakBetween(data, event.sample, event.sample + sampleRate * 0.16);
      const clipped = clippingBetween(data, event.sample, Math.min(end, event.sample + sampleRate * 0.5));
      const snr = 20 * Math.log10((attackPeak + 1e-6) / (preNoise + 1e-6));
      const score = snr - clipped * 12 - preNoise * 140;

      return {
        start,
        end,
        preNoise,
        attackPeak,
        clipped,
        snr,
        score
      };
    }

    function makeSample(data, metrics) {
      const start = metrics.start;
      const end = metrics.end;
      const rawLength = Math.max(1, end - start);
      const out = new Float32Array(rawLength);
      out.set(data.subarray(start, end));

      const fadeIn = Math.min(out.length, Math.floor(sampleRate * 0.004));
      const fadeOut = Math.min(out.length, Math.floor(sampleRate * 0.14));
      for (let index = 0; index < fadeIn; index += 1) {
        out[index] *= index / fadeIn;
      }
      for (let index = 0; index < fadeOut; index += 1) {
        const position = out.length - 1 - index;
        out[position] *= index / fadeOut;
      }

      const peak = peakBetween(out, 0, out.length);
      const gain = peak > 0 ? Math.min(2.4, 0.78 / peak) : 1;
      const int16 = new Int16Array(out.length);
      for (let index = 0; index < out.length; index += 1) {
        const value = Math.max(-0.98, Math.min(0.98, out[index] * gain));
        int16[index] = Math.round(value * 32767);
      }

      const bytes = new Uint8Array(int16.buffer);
      let binary = "";
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }

      return {
        base64: btoa(binary),
        duration: out.length / sampleRate,
        gain,
        peak
      };
    }

    const filtered = highPass(mono, 55);
    const detection = findEvents(filtered);
    if (detection.error) {
      return detection;
    }

    const samples = [];
    for (let keyIndex = 0; keyIndex < keyNames.length; keyIndex += 1) {
      const firstEvent = detection.events[keyIndex * 2];
      const secondEvent = detection.events[keyIndex * 2 + 1];
      const afterSecond = detection.events[keyIndex * 2 + 2];
      const firstMetrics = candidateMetrics(filtered, firstEvent, secondEvent);
      const secondMetrics = candidateMetrics(filtered, secondEvent, afterSecond);
      const useSecond = secondMetrics.score > firstMetrics.score;
      const chosen = useSecond ? secondEvent : firstEvent;
      const chosenMetrics = useSecond ? secondMetrics : firstMetrics;
      const sample = makeSample(filtered, chosenMetrics);

      samples.push({
        name: keyNames[keyIndex],
        file: `${keyNames[keyIndex].toLowerCase()}.mp3`,
        take: useSecond ? 2 : 1,
        onsetTime: chosen.time,
        peakTime: chosen.peakTime,
        duration: sample.duration,
        gain: sample.gain,
        peak: sample.peak,
        metrics: {
          preNoise: chosenMetrics.preNoise,
          attackPeak: chosenMetrics.attackPeak,
          clipped: chosenMetrics.clipped,
          snr: chosenMetrics.snr,
          score: chosenMetrics.score
        },
        int16Base64: sample.base64
      });
    }

    return {
      sampleRate,
      sourceDuration: length / sampleRate,
      thresholds: {
        detection: detection.threshold,
        noise: detection.noise,
        globalFloor: detection.globalFloor,
        globalPeak: detection.globalPeak
      },
      events: detection.events.map((event) => ({
        time: Number(event.time.toFixed(3)),
        peakTime: Number(event.peakTime.toFixed(3)),
        rms: Number(event.rms.toFixed(5))
      })),
      samples
    };
  },
  { recordingBytesBase64, keyNames }
);

async function main() {
  const keyNames = getDisplayKeyNames();
  if (keyNames.length !== 21) {
    throw new Error(`Expected 21 DISPLAY_KEYS entries, found ${keyNames.length}.`);
  }

  const recordingPath = getRecordingPath();
  const chromeExecutable = getChromeExecutable();
  if (!chromeExecutable) {
    throw new Error("Chrome or Edge was not found. Set PLAYWRIGHT_CHROME_EXECUTABLE.");
  }

  const recordingBytesBase64 = fs.readFileSync(recordingPath).toString("base64");
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromeExecutable
  });

  try {
    const page = await browser.newPage();
    const analysis = await browserAnalysis(page, recordingBytesBase64, keyNames);
    if (analysis.error) {
      console.log(JSON.stringify(analysis, null, 2));
      throw new Error(analysis.error);
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const manifest = {
      generatedAt: new Date().toISOString(),
      source: path.relative(projectRoot, recordingPath).replace(/\\/g, "/"),
      sourceDuration: analysis.sourceDuration,
      sampleRate: analysis.sampleRate,
      bitrateKbps: sampleBitrateKbps,
      files: []
    };

    for (const sample of analysis.samples) {
      const int16 = base64ToInt16(sample.int16Base64);
      const mp3 = encodeMp3(int16, analysis.sampleRate);
      const outputPath = path.join(outputDir, sample.file);
      fs.writeFileSync(outputPath, mp3);
      manifest.files.push({
        name: sample.name,
        file: `assets/samples/${sample.file}`,
        take: sample.take,
        onsetTime: Number(sample.onsetTime.toFixed(3)),
        duration: Number(sample.duration.toFixed(3)),
        gain: Number(sample.gain.toFixed(3)),
        peak: Number(sample.peak.toFixed(4)),
        snr: Number(sample.metrics.snr.toFixed(2)),
        clipped: sample.metrics.clipped,
        size: mp3.length
      });
    }

    fs.writeFileSync(
      path.join(outputDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );

    console.log(`Decoded ${path.basename(recordingPath)} (${analysis.sourceDuration.toFixed(2)}s).`);
    console.log(`Detected ${analysis.events.length} plucks and wrote ${manifest.files.length} samples.`);
    console.table(manifest.files.map((file) => ({
      note: file.name,
      take: file.take,
      duration: file.duration,
      snr: file.snr,
      clipped: file.clipped,
      size: file.size
    })));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
