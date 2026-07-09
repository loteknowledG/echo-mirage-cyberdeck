/** Terminal burst SFX when MUTHUR speaks long assistant replies. */
export class MotherTerminal {
  private ctx: AudioContext | null = null;
  private burstThreshold: number;

  constructor({ burstThreshold = 180 }: { burstThreshold?: number } = {}) {
    this.burstThreshold = burstThreshold;
  }

  init() {
    if (this.ctx || typeof window === "undefined") return;
    const Ctx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
  }

  async unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  beep(freq: number, time: number, duration = 0.045, gain = 0.045) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(freq, time);

    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(g).connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  }

  playBurstSound(charCount = 12) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.02;
    const pulses = Math.min(24, Math.max(6, Math.floor(charCount / 12)));
    for (let i = 0; i < pulses; i++) {
      const t = now + i * 0.025;
      const freq = 520 + Math.random() * 900;
      this.beep(freq, t, 0.035, 0.04);
    }
  }

  shouldBurst(text: string) {
    return text.length >= this.burstThreshold;
  }
}
