type MuthurEffectOptions = {
  highpassHz?: number;
  lowpassHz?: number;
  presenceHz?: number;
  presenceGainDb?: number;
  presenceQ?: number;
  reverbWet?: number;
  reverbSeconds?: number;
  reverbDecay?: number;
  tingyTailDelayMs?: number;
  tingyTailHighpassHz?: number;
  tingyTailPresenceHz?: number;
  tingyTailPresenceGainDb?: number;
  tingyTailPresenceQ?: number;
  tingyTailGain?: number;
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
  const highpassHz = options.highpassHz ?? 260;
  const lowpassHz = options.lowpassHz ?? 2400;
  const presenceHz = options.presenceHz ?? 1500;
  const presenceGainDb = options.presenceGainDb ?? 3.0;
  const presenceQ = options.presenceQ ?? 1.3;
  const reverbWet = options.reverbWet ?? 0.008;
  const reverbSeconds = options.reverbSeconds ?? 0.08;
  const reverbDecay = options.reverbDecay ?? 0.5;
  const tingyTailDelayMs = options.tingyTailDelayMs ?? 0;
  const tingyTailHighpassHz = options.tingyTailHighpassHz ?? 0;
  const tingyTailPresenceHz = options.tingyTailPresenceHz ?? 0;
  const tingyTailPresenceGainDb = options.tingyTailPresenceGainDb ?? 0;
  const tingyTailPresenceQ = options.tingyTailPresenceQ ?? 1.0;
  const tingyTailGain = options.tingyTailGain ?? 0;
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

  const tingyTailDelay = ctx.createDelay(0.05);
  tingyTailDelay.delayTime.value = Math.max(0, tingyTailDelayMs) / 1000;

  const tingyTailHighpass = ctx.createBiquadFilter();
  tingyTailHighpass.type = "highpass";
  tingyTailHighpass.frequency.value = tingyTailHighpassHz;
  tingyTailHighpass.Q.value = 0.7;

  const tingyTailPresence = ctx.createBiquadFilter();
  tingyTailPresence.type = "peaking";
  tingyTailPresence.frequency.value = tingyTailPresenceHz;
  tingyTailPresence.Q.value = tingyTailPresenceQ;
  tingyTailPresence.gain.value = tingyTailPresenceGainDb;

  const tingyTailGainNode = ctx.createGain();
  tingyTailGainNode.gain.value = tingyTailGain;

  if (compressorEnabled) {
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -36;
    compressor.knee.value = 20;
    compressor.ratio.value = 6.5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;

    source.connect(input);
    input.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(presence);
    presence.connect(dryGain);
    lowpass.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(tingyTailDelay);
    tingyTailDelay.connect(tingyTailHighpass);
    tingyTailHighpass.connect(tingyTailPresence);
    tingyTailPresence.connect(tingyTailGainNode);
    dryGain.connect(compressor);
    wetGain.connect(compressor);
    tingyTailGainNode.connect(compressor);
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
  wetGain.connect(tingyTailDelay);
  tingyTailDelay.connect(tingyTailHighpass);
  tingyTailHighpass.connect(tingyTailPresence);
  tingyTailPresence.connect(tingyTailGainNode);
  dryGain.connect(output);
  wetGain.connect(output);
  tingyTailGainNode.connect(output);
  return output;
}
