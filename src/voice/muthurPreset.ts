export const MUTHUR_PRESET = Object.freeze(
{
  backend: {
    language: "en-US",
    voiceType: "MichelleNeural",
    gender: "Female",
    ratePercent: -28,
    pitchHz: -10,
  },
  playback: {
    highpassHz: 260,
    lowpassHz: 2400,
    presenceHz: 1500,
    presenceGainDb: 3,
    presenceQ: 1.3,
    reverbWet: 0.012,
    reverbSeconds: 0.1,
    reverbDecay: 0.6,
    tingyTailDelayMs: 24,
    tingyTailHighpassHz: 2400,
    tingyTailPresenceHz: 4300,
    tingyTailPresenceGainDb: 2,
    tingyTailPresenceQ: 1.1,
    tingyTailGain: 0.045,
    compressor: true,
  },
  fallback: {
    rate: 0.86,
    pitch: 0.94,
    volume: 1,
  },
  testPhrase: "Priority one. Mission parameters remain unchanged.",
} as const
);
