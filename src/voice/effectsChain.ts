type MuthurEffectOptions = {
  highpassHz?: number;
  lowpassHz?: number;
  presenceHz?: number;
  presenceGainDb?: number;
  presenceQ?: number;
  reverbWet?: number;
  reverbSeconds?: number;
  reverbDecay?: number;
  compressor?: boolean;
};

function createImpulseResponse(
  ctx: AudioContext,
  seconds: number,
  decay: number,
): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }

  return buffer;
}

export function applyMuthurEffectChain(
  ctx: AudioContext,
  source: AudioBufferSourceNode,
  options: MuthurEffectOptions = {},
) {
  const highpassHz = options.highpassHz ?? 120;
  const lowpassHz = options.lowpassHz ?? 3600;
  const presenceHz = options.presenceHz ?? 2800;
  const presenceGainDb = options.presenceGainDb ?? -0.5;
  const presenceQ = options.presenceQ ?? 1.0;
  const reverbWet = options.reverbWet ?? 0.06;
  const reverbSeconds = options.reverbSeconds ?? 0.45;
  const reverbDecay = options.reverbDecay ?? 0.9;
  const compressorEnabled = options.compressor ?? true;

  const input = ctx.createGain();
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = highpassHz;
  highpass.Q.value = 0.7;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = lowpassHz;
  lowpass.Q.value = 0.7;

  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = presenceHz;
  presence.Q.value = presenceQ;
  presence.gain.value = presenceGainDb;

  const dryGain = ctx.createGain();
  dryGain.gain.value = 1 - reverbWet;

  const wetGain = ctx.createGain();
  wetGain.gain.value = reverbWet;

  const output = ctx.createGain();

  const convolver = ctx.createConvolver();
  convolver.buffer = createImpulseResponse(ctx, reverbSeconds, reverbDecay);

  if (compressorEnabled) {
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -28;
    compressor.knee.value = 20;
    compressor.ratio.value = 5.0;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;

    source.connect(input);
    input.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(presence);
    presence.connect(dryGain);
    lowpass.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(compressor);
    wetGain.connect(compressor);
    compressor.connect(output);
    return output;
  }

  source.connect(input);
  input.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(presence);
  presence.connect(dryGain);
  lowpass.connect(convolver);
  convolver.connect(wetGain);
  dryGain.connect(output);
  wetGain.connect(output);
  return output;
}
