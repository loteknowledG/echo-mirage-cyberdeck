let audioCtx = null;
let enabled = true;
let fallbackClickAudio = null;
let fallbackChirpAudio = null;
let masterGainNode = null;
let masterCompressorNode = null;
let sonarIntervalId = null;
let sonarLoopIntervalMs = 3200;
let sonarLoopVolumeScale = 1;
const KEYBOARD_EFFECTS_GAIN = 0.15;
const KEYBOARD_NAV_GAIN = 0.5;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function getOutputNode() {
  const ctx = getCtx();
  if (!masterGainNode) {
    masterCompressorNode = ctx.createDynamicsCompressor();
    masterCompressorNode.threshold.value = -22;
    masterCompressorNode.knee.value = 18;
    masterCompressorNode.ratio.value = 3.5;
    masterCompressorNode.attack.value = 0.004;
    masterCompressorNode.release.value = 0.22;

    masterGainNode = ctx.createGain();
    // Final stage loudness boost so every synth/noise effect is louder.
    masterGainNode.gain.value = 6.2;

    masterCompressorNode.connect(masterGainNode);
    masterGainNode.connect(ctx.destination);
  }
  return masterCompressorNode;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function makeCrunchCurve(amount) {
  const samples = 256;
  const curve = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] =
      ((3 + amount) * x * 20 * (Math.PI / 180)) /
      (Math.PI + amount * Math.abs(x));
  }

  return curve;
}

function playTone({
  freqStart,
  freqEnd,
  duration,
  type = "square",
  volume = 0.14,
  crunch = false,
}) {
  if (!enabled) return;

  const ctx = getCtx();
  const t = ctx.currentTime;

  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, t);

  if (freqEnd) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + duration);
  }

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  if (crunch) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeCrunchCurve(rand(10, 22));
    osc.connect(shaper);
    shaper.connect(gain);
  } else {
    osc.connect(gain);
  }

  gain.connect(getOutputNode());

  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function playNoiseClick({ duration = 0.02, volume = 0.07, filterFreq = 2600 }) {
  if (!enabled) return;

  const ctx = getCtx();
  const t = ctx.currentTime;

  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = rand(-1, 1) * (1 - i / bufferSize);
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.setValueAtTime(filterFreq, t);

  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(getOutputNode());

  source.start(t);
  source.stop(t + duration);
}

function wobble(startFreq, endFreq, duration = 0.45, gain = 0.08, type = "sawtooth") {
  if (!enabled) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(30, startFreq), t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t + duration);

  lfo.type = "sine";
  lfo.frequency.setValueAtTime(9, t);
  lfoGain.gain.setValueAtTime(45, t);
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(amp);
  amp.connect(getOutputNode());

  lfo.start(t);
  osc.start(t);
  lfo.stop(t + duration);
  osc.stop(t + duration + 0.05);
}

function classifyKey(key) {
  if (key === "Enter") return "enter";
  if (key === "Escape") return "escape";
  if (key === "Backspace" || key === "Delete") return "delete";
  if (key === " ") return "space";
  if (key === "Shift" || key === "Control" || key === "Alt" || key === "Meta") {
    return "modifier";
  }
  if (/^[0-9]$/.test(key)) return "number";
  if (/^[a-zA-Z]$/.test(key)) return "letter";
  if (key.length > 1) return "system";
  return "symbol";
}

function playFallbackClip(kind, volume = 0.4) {
  if (typeof Audio === "undefined") return;
  const v = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.4));
  try {
    const base = "/chime_quiet.wav";
    const ref = kind === "chirp" || kind === "lock" ? "chirp" : "click";
    if (ref === "chirp") {
      if (!fallbackChirpAudio) fallbackChirpAudio = new Audio(base);
      fallbackChirpAudio.currentTime = 0;
      fallbackChirpAudio.volume = v * 0.5;
      fallbackChirpAudio.play().catch(() => {});
    } else {
      if (!fallbackClickAudio) fallbackClickAudio = new Audio(base);
      fallbackClickAudio.currentTime = 0;
      fallbackClickAudio.volume = v * 0.5;
      fallbackClickAudio.play().catch(() => {});
    }
  } catch {
    /* ignore fallback audio errors */
  }
}

export function playKeySound(key, options = {}) {
  const mode = options.mode || "cyberdeck";
  const volume = (options.volume ?? 1) * 2.6 * KEYBOARD_EFFECTS_GAIN;
  const kind = classifyKey(key);
  const v = (n) => n * volume;

  if (mode === "soft") {
    playNoiseClick({
      duration: rand(0.012, 0.025),
      volume: v(0.024),
      filterFreq: rand(1800, 2800),
    });
    return;
  }

  switch (kind) {
    case "letter": {
      const keyCode = key.toLowerCase().charCodeAt(0);
      const baseFreq = 280 + (keyCode - 97) * 18;
      playTone({
        freqStart: baseFreq + rand(-30, 30),
        freqEnd: baseFreq + rand(-50, 50),
        duration: rand(0.03, 0.06),
        type: "sine",
        volume: v(rand(0.02, 0.035)),
      });
      break;
    }

    case "number": {
      const keyCode = key.charCodeAt(0);
      const baseFreq = 600 + (keyCode - 48) * 80;
      playTone({
        freqStart: baseFreq + rand(-40, 40),
        freqEnd: baseFreq + rand(-60, 60),
        duration: rand(0.03, 0.055),
        type: "sine",
        volume: v(rand(0.025, 0.04)),
      });
      break;
    }

    case "symbol": {
      const symbolChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const idx = symbolChars.indexOf(key);
      const baseFreq = idx >= 0 ? 700 + idx * 35 : rand(800, 1200);
      playTone({
        freqStart: baseFreq + rand(-30, 30),
        freqEnd: baseFreq * 0.7 + rand(-30, 30),
        duration: rand(0.025, 0.045),
        type: "sine",
        volume: v(rand(0.025, 0.04)),
      });
      break;
    }

    case "space":
      playTone({
        freqStart: rand(180, 260),
        freqEnd: rand(150, 220),
        duration: rand(0.04, 0.07),
        type: "sine",
        volume: v(0.025),
      });
      break;

    case "enter":
      playTone({
        freqStart: rand(440, 560),
        freqEnd: rand(800, 1000),
        duration: rand(0.06, 0.1),
        type: "sine",
        volume: v(0.04),
      });
      break;

    case "escape":
      playTone({
        freqStart: rand(360, 480),
        freqEnd: rand(200, 300),
        duration: rand(0.05, 0.08),
        type: "sine",
        volume: v(0.03),
      });
      break;

    case "delete":
      playTone({
        freqStart: rand(600, 800),
        freqEnd: rand(200, 350),
        duration: rand(0.06, 0.1),
        type: "sine",
        volume: v(0.035),
      });
      break;

    case "modifier":
      playNoiseClick({
        duration: rand(0.012, 0.022),
        volume: v(0.025),
        filterFreq: rand(2200, 4200),
      });
      break;

    default:
      playTone({
        freqStart: rand(430, 620),
        freqEnd: rand(430, 620),
        duration: rand(0.025, 0.05),
        type: "triangle",
        volume: v(0.035),
      });
  }
}

/** Short feedback for cyberdeck UI keyboard navigation (separate timbre from typing sfx). */
export function playNavigationSound(variant = "step") {
  if (!enabled) return;
  const navGain = KEYBOARD_NAV_GAIN;
  const v = variant || "step";
  if (v === "commit") {
    playTone({
      freqStart: rand(580, 720),
      freqEnd: rand(880, 1050),
      duration: rand(0.048, 0.068),
      type: "triangle",
      volume: rand(0.12, 0.16) * navGain,
    });
    return;
  }
  if (v === "back") {
    playTone({
      freqStart: rand(520, 640),
      freqEnd: rand(280, 380),
      duration: rand(0.052, 0.072),
      type: "triangle",
      volume: rand(0.11, 0.15) * navGain,
    });
    return;
  }
  playNoiseClick({
    duration: rand(0.012, 0.02),
    volume: rand(0.075, 0.11) * navGain,
    filterFreq: rand(2200, 3400),
  });
}

export function bindKeyboardSfx(target = window, options = {}) {
  const handler = (event) => {
    if (!enabled || event.repeat) return;
    playKeySound(event.key, options);
  };

  target.addEventListener("keydown", handler);

  return () => {
    target.removeEventListener("keydown", handler);
  };
}

export function setKeyboardSfxEnabled(value) {
  enabled = Boolean(value);
}

export function getKeyboardSfxEnabled() {
  return enabled;
}

export function unlockKeyboardSfx() {
  const ctx = getCtx();
  if (ctx.state === "suspended") return ctx.resume();
  return Promise.resolve();
}

export function setupAudio() {
  // Compatibility init hook for older callers.
  getCtx();
}

export function playSystemSound(type = "click", vol = 0.08) {
  const gain = Math.max(0, Number.isFinite(vol) ? vol : 0.08) * 2.2;
  if (type === "chirp") {
    playKeySound("Enter", { volume: Math.max(0.05, gain * 0.1) });
    playTone({
      freqStart: rand(760, 920),
      freqEnd: rand(1200, 1500),
      duration: 0.08,
      type: "triangle",
      volume: Math.max(0.02, gain * 0.05),
    });
  } else if (type === "keypress") {
    playKeySound("a", { volume: Math.max(0.01, gain * 0.02) });
  } else if (type === "lock") {
    playKeySound("Enter", { volume: Math.max(0.05, gain * 0.1) });
    playTone({
      freqStart: rand(620, 760),
      freqEnd: rand(1260, 1600),
      duration: 0.1,
      type: "sine",
      volume: Math.max(0.02, gain * 0.05),
    });
  } else {
    playNoiseClick({ duration: 0.02, volume: Math.max(0.005, gain * 0.02) });
  }
}

export function playNetworkScanSound(stage = "start") {
  if (!enabled) return;
  if (stage === "start") {
    // Radar ping - clean sine wave with decay
    playTone({
      freqStart: 800,
      freqEnd: 800,
      duration: 0.15,
      type: "sine",
      volume: 0.08,
    });
    // Subtle echo
    setTimeout(() => {
      playTone({
        freqStart: 600,
        duration: 0.25,
        type: "sine",
        volume: 0.03,
      });
    }, 80);
    return;
  }
  if (stage === "success") {
    // Double ping for success
    playTone({
      freqStart: 1200,
      duration: 0.1,
      type: "sine",
      volume: 0.06,
    });
    setTimeout(() => {
      playTone({
        freqStart: 1600,
        duration: 0.15,
        type: "sine",
        volume: 0.04,
      });
    }, 60);
    return;
  }
  // fail - low thud
  playTone({
    freqStart: 150,
    freqEnd: 80,
    duration: 0.2,
    type: "sine",
    volume: 0.05,
  });
}

export function playSatelliteUplink() {
  playNetworkScanSound("start");
}

export function playSuccess() {
  playNetworkScanSound("success");
}

export function playCinematicSonarPing(timeOffset = 0, volumeScale = 1) {
  if (!enabled) return;
  const ctx = getCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const t = Math.max(0, Number.isFinite(timeOffset) ? timeOffset : 0);
  const s = Math.min(1.5, Math.max(0, Number.isFinite(volumeScale) ? volumeScale : 1));

  // Main deep ping + subtle harmonic shimmer.
  playTone({
    freqStart: 520,
    duration: 0.18,
    type: "sine",
    volume: 0.11 * s,
  });
  setTimeout(() => {
    playTone({
      freqStart: 1040,
      duration: 0.12,
      type: "sine",
      volume: 0.04 * s,
    });
  }, 15 + t * 1000);

  // Slow cinematic echoes.
  setTimeout(() => {
    playTone({
      freqStart: 360,
      duration: 0.35,
      type: "triangle",
      volume: 0.045 * s,
    });
  }, 900 + t * 1000);
  setTimeout(() => {
    playTone({
      freqStart: 240,
      duration: 0.6,
      type: "sine",
      volume: 0.025 * s,
    });
  }, 1800 + t * 1000);

  // Long ambient tail.
  setTimeout(() => {
    playNoiseClick({
      duration: 1.2,
      volume: 0.015 * s,
      filterFreq: 900,
    });
  }, 150 + t * 1000);
}

export function playSonarPing(timeOffset = 0) {
  playCinematicSonarPing(timeOffset);
}

export function playBleepBloop() {
  if (!enabled) return;
  const ctx = getCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  // Tiny, polite status cue for long-running network waits.
  const scheduleTone = (delayMs, opts) => {
    setTimeout(() => {
      playTone(opts);
    }, delayMs);
  };

  scheduleTone(0, {
    freqStart: 720,
    duration: 0.06,
    type: "sine",
    volume: 0.042,
  });
  scheduleTone(120, {
    freqStart: 520,
    duration: 0.08,
    type: "triangle",
    volume: 0.034,
  });

  // Keep fallback subtle as well.
  playFallbackClip("click", 0.12);
}

export function playWrongDoorShut() {
  if (!enabled) return;
  const ctx = getCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime + 0.02;

  // WRONG buzzer: harsh low-mid buzz.
  playTone({
    freqStart: 145,
    freqEnd: 125,
    duration: 0.32,
    type: "square",
    volume: 0.09,
    crunch: true,
  });

  // DOOR shut: heavy thud drop.
  setTimeout(() => {
    playTone({
      freqStart: 95,
      freqEnd: 38,
      duration: 0.42,
      type: "sine",
      volume: 0.28,
      crunch: false,
    });
  }, 340);

  // METAL clack latch.
  setTimeout(() => {
    playTone({
      freqStart: 900,
      duration: 0.035,
      type: "square",
      volume: 0.08,
    });
  }, 470);
  setTimeout(() => {
    playTone({
      freqStart: 520,
      duration: 0.045,
      type: "square",
      volume: 0.06,
    });
  }, 530);

  // Subtle click tail for tactile finish.
  playFallbackClip("click", 0.24);
}

export function playDeclined() {
  if (!enabled) return;
  playTone({
    freqStart: 420,
    freqEnd: 120,
    duration: 0.35,
    type: "sawtooth",
    volume: 0.08,
    crunch: true,
  });
  setTimeout(() => {
    playTone({
      freqStart: 180,
      duration: 0.06,
      type: "square",
      volume: 0.05,
    });
  }, 380);
}

export function playDroidDizzy401() {
  if (!enabled) return;
  playTone({ freqStart: 980, duration: 0.05, type: "triangle", volume: 0.08 });
  setTimeout(() => {
    playTone({ freqStart: 720, duration: 0.06, type: "square", volume: 0.07 });
  }, 80);
  setTimeout(() => {
    playTone({ freqStart: 1120, duration: 0.05, type: "triangle", volume: 0.07 });
  }, 160);
  setTimeout(() => {
    wobble(760, 260, 0.55, 0.09);
  }, 240);
}

export function playDroidDizzy400() {
  if (!enabled) return;
  playTone({ freqStart: 640, duration: 0.045, type: "square", volume: 0.075 });
  setTimeout(() => {
    playTone({ freqStart: 920, duration: 0.04, type: "triangle", volume: 0.065 });
  }, 70);
  setTimeout(() => {
    playTone({ freqStart: 540, duration: 0.05, type: "square", volume: 0.065 });
  }, 140);
  setTimeout(() => {
    wobble(420, 880, 0.32, 0.07);
  }, 220);
  setTimeout(() => {
    wobble(880, 360, 0.35, 0.065);
  }, 480);
}

export function playOutOfGas429() {
  if (!enabled) return;
  const ctx = getCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime + 0.02;

  // Engine sputter pulses.
  const sputters = [0, 0.08, 0.18, 0.32, 0.55];
  sputters.forEach((offset, i) => {
    const freq = 220 - i * 25;
    const volume = Math.max(0.04, 0.12 - i * 0.015);
    const duration = 0.12 + i * 0.05;
    const at = now + offset;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(35, freq * 0.5), at + 0.12);

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    osc.connect(gain);
    gain.connect(getOutputNode());
    osc.start(at);
    osc.stop(at + 0.2);
  });

  // Final dying wheeze.
  {
    const at = now + 0.8;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, at);
    osc.frequency.exponentialRampToValueAtTime(40, at + 0.6);

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.08, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);

    osc.connect(gain);
    gain.connect(getOutputNode());
    osc.start(at);
    osc.stop(at + 0.7);
  }

  // Faint static cough.
  setTimeout(() => {
    playNoiseClick({
      duration: 0.25,
      volume: 0.02,
      filterFreq: 1000,
    });
  }, 950);
}

export function playRaceReadySetGo() {
  if (!enabled) return;
  const ctx = getCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  // READY (low, spaced)
  playTone({
    freqStart: 440,
    duration: 0.12,
    type: "sine",
    volume: 0.08,
  });

  // SET (mid, closer)
  setTimeout(() => {
    playTone({
      freqStart: 660,
      duration: 0.1,
      type: "triangle",
      volume: 0.085,
    });
  }, 280);

  // GO (higher, punchy)
  setTimeout(() => {
    playTone({
      freqStart: 980,
      duration: 0.14,
      type: "sine",
      volume: 0.11,
    });
  }, 460);

  // Success sparkle tail
  setTimeout(() => {
    playTone({
      freqStart: 1320,
      duration: 0.18,
      type: "triangle",
      volume: 0.07,
    });
  }, 580);
}

export function startSonarLoop(interval = 3200, volumeScale = 1) {
  const ms = Math.max(1200, Number.isFinite(interval) ? interval : 3200);
  const s = Math.min(1.5, Math.max(0.05, Number.isFinite(volumeScale) ? volumeScale : 1));
  if (sonarIntervalId && sonarLoopIntervalMs === ms && sonarLoopVolumeScale === s) {
    return;
  }
  if (sonarIntervalId) {
    window.clearInterval(sonarIntervalId);
    sonarIntervalId = null;
  }
  sonarLoopIntervalMs = ms;
  sonarLoopVolumeScale = s;
  void unlockKeyboardSfx();
  playCinematicSonarPing(0, s);
  sonarIntervalId = window.setInterval(() => {
    playCinematicSonarPing(0, s);
  }, ms);
}

export function stopSonarLoop() {
  if (!sonarIntervalId) return;
  window.clearInterval(sonarIntervalId);
  sonarIntervalId = null;
  sonarLoopIntervalMs = 3200;
  sonarLoopVolumeScale = 1;
}

export async function satelliteConnectSequence() {
  await unlockKeyboardSfx();
  playSatelliteUplink();
  setTimeout(() => {
    playSuccess();
  }, 1900);
}