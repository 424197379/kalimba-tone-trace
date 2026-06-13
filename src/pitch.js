let workingBuffer = new Float32Array(4096);

export function hzToCents(freq, reference) {
  return Math.round(1200 * Math.log2(freq / reference));
}

export function getNearestNote(freq, displayKeys) {
  let nearest = displayKeys[0];
  let lane = 0;
  let bestDistance = Infinity;

  displayKeys.forEach((note, index) => {
    const distance = Math.abs(hzToCents(freq, note.freq));
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = note;
      lane = index;
    }
  });

  return {
    note: nearest,
    lane,
    cents: hzToCents(freq, nearest.freq),
    distance: bestDistance
  };
}

export function detectPitch(buffer, sampleRate) {
  const size = buffer.length;
  if (workingBuffer.length < size) {
    workingBuffer = new Float32Array(size);
  }

  let mean = 0;
  for (let i = 0; i < size; i += 1) {
    mean += buffer[i];
  }
  mean /= size;

  let rms = 0;
  for (let i = 0; i < size; i += 1) {
    const value = buffer[i] - mean;
    workingBuffer[i] = Math.abs(value) < 0.003 ? 0 : value;
    rms += value * value;
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.006) {
    return { frequency: 0, volume: rms, clarity: 0 };
  }

  const minFreq = 165;
  const maxFreq = 1400;
  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.min(Math.floor(sampleRate / minFreq), size - 2);
  const clarities = new Float32Array(maxLag + 2);

  let maxClarity = 0;
  let bestLag = -1;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let ac = 0;
    let norm = 0;
    for (let i = 0; i < size - lag; i += 1) {
      const x = workingBuffer[i];
      const y = workingBuffer[i + lag];
      ac += x * y;
      norm += x * x + y * y;
    }
    const clarity = norm ? (2 * ac) / norm : 0;
    clarities[lag] = clarity;
    if (clarity > maxClarity) {
      maxClarity = clarity;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || maxClarity < 0.62) {
    return { frequency: 0, volume: rms, clarity: maxClarity };
  }

  let selectedLag = bestLag;
  for (let lag = minLag + 1; lag < maxLag; lag += 1) {
    const clarity = clarities[lag];
    if (
      clarity > 0.58 &&
      clarity >= maxClarity * 0.9 &&
      clarity > clarities[lag - 1] &&
      clarity >= clarities[lag + 1]
    ) {
      selectedLag = lag;
      break;
    }
  }

  const left = clarities[selectedLag - 1] || clarities[selectedLag];
  const center = clarities[selectedLag];
  const right = clarities[selectedLag + 1] || clarities[selectedLag];
  const denominator = 2 * (2 * center - right - left);
  const shift = denominator ? (right - left) / denominator : 0;

  return {
    frequency: sampleRate / (selectedLag + shift),
    volume: rms,
    clarity: center
  };
}
