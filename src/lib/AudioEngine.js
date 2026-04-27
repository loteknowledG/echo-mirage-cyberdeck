let audioCtx = null;
let enabled = true;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
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
  volume = 0.06,
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

  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function playNoiseClick({ duration = 0.02, volume = 0.025, filterFreq = 2600 }) {
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
  gain.connect(ctx.destination);

  source.start(t);
  source.stop(t + duration);
}

function classifyKey(key) {
  if (key === "Enter") return "enter";
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

export function playKeySound(key, options = {}) {
  const mode = options.mode || "cyberdeck";
  const volume = options.volume ?? 1;
  const kind = classifyKey(key);
  const v = (n) => n * volume;

  if (mode === "soft") {
    playNoiseClick({
      duration: rand(0.012, 0.025),
      volume: v(0.018),
      filterFreq: rand(1800, 2800),
    });
    return;
  }

  switch (kind) {
    case "letter":
      playTone({
        freqStart: rand(520, 760),
        freqEnd: rand(500, 840),
        duration: rand(0.035, 0.075),
        type: Math.random() > 0.5 ? "square" : "triangle",
        volume: v(rand(0.032, 0.055)),
        crunch: Math.random() > 0.65,
      });
      playNoiseClick({
        duration: rand(0.01, 0.018),
        volume: v(0.014),
        filterFreq: rand(1800, 3600),
      });
      break;

    case "number":
      playTone({
        freqStart: rand(740, 980),
        freqEnd: rand(860, 1180),
        duration: rand(0.04, 0.075),
        type: "square",
        volume: v(0.05),
        crunch: true,
      });
      break;

    case "symbol":
      playTone({
        freqStart: rand(900, 1300),
        freqEnd: rand(500, 900),
        duration: rand(0.025, 0.055),
        type: "triangle",
        volume: v(0.045),
        crunch: true,
      });
      playNoiseClick({
        duration: 0.014,
        volume: v(0.018),
        filterFreq: 3600,
      });
      break;

    case "space":
      playTone({
        freqStart: rand(210, 320),
        freqEnd: rand(180, 260),
        duration: rand(0.045, 0.08),
        type: "triangle",
        volume: v(0.042),
      });
      break;

    case "enter":
      playTone({
        freqStart: rand(520, 680),
        freqEnd: rand(980, 1250),
        duration: rand(0.09, 0.14),
        type: "sine",
        volume: v(0.075),
      });

      setTimeout(() => {
        playTone({
          freqStart: rand(900, 1150),
          freqEnd: rand(1150, 1500),
          duration: 0.055,
          type: "triangle",
          volume: v(0.045),
        });
      }, 45);
      break;

    case "delete":
      playTone({
        freqStart: rand(950, 1200),
        freqEnd: rand(220, 360),
        duration: rand(0.07, 0.11),
        type: "square",
        volume: v(0.065),
        crunch: true,
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

export function playSystemSound(type = "click", vol = 0.08) {
  if (type === "chirp") {
    playKeySound("Enter");
  } else if (type === "keypress") {
    playKeySound("a", { volume: 0.8 });
  } else {
    playNoiseClick({ duration: 0.02, volume: 0.025 });
  }
}