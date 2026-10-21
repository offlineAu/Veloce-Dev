/**
 * The homepage intro's score, generated with the Web Audio API (no audio files to fetch or license). The intro calls
 * step() each time a photo advances, so the beat follows the film rather than a fixed clock: a kick on every other
 * frame, a hat on each, and a filtered saw that opens up as progress climbs. drop() lands the zoom into the hero with a
 * kick, a sub and a falling whoosh, then the context closes itself. Browsers only allow audio after a user gesture, so
 * create it inside the click handler.
 */
export type IntroSound = { step(frame: number, progress: number): void; drop(): void; close(): void };

export function createIntroSound(): IntroSound | null {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  void ctx.resume();
  let closed = false;

  const master = ctx.createGain();
  master.gain.value = 0.7;
  const limiter = ctx.createDynamicsCompressor();
  master.connect(limiter).connect(ctx.destination);

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  // Riser: a detuned saw pair through a resonant low-pass that opens with progress.
  const riserFilter = ctx.createBiquadFilter();
  riserFilter.type = "lowpass";
  riserFilter.frequency.value = 300;
  riserFilter.Q.value = 8;
  const riserGain = ctx.createGain();
  riserGain.gain.value = 0.0001;
  riserFilter.connect(riserGain).connect(master);
  const riser = [0, 7].map((cents) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 110;
    osc.detune.value = cents;
    osc.connect(riserFilter);
    osc.start();
    return osc;
  });

  const kick = (t: number, level: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.45);
  };

  const hiss = (t: number, level: number, length: number, type: BiquadFilterType, from: number, to = from) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, t);
    if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, t + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    src.stop(t + length + 0.05);
  };

  const close = () => {
    if (closed) return;
    closed = true;
    void ctx.close();
  };

  return {
    step(frame, progress) {
      if (closed) return;
      const t = ctx.currentTime + 0.01;
      if (frame % 2 === 0) kick(t, 0.9);
      hiss(t, frame % 2 ? 0.3 : 0.14, 0.06, "highpass", 7000);
      riserFilter.frequency.setTargetAtTime(300 + progress * 3200, t, 0.08);
      riserGain.gain.setTargetAtTime(0.02 + progress * 0.1, t, 0.08);
      riser.forEach((osc) => osc.frequency.setTargetAtTime(110 * (1 + progress), t, 0.1));
    },
    drop() {
      if (closed) return;
      const t = ctx.currentTime + 0.01;
      riserGain.gain.setTargetAtTime(0.0001, t, 0.04);
      kick(t, 1.2);
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.frequency.value = 55;
      subGain.gain.setValueAtTime(0.8, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      sub.connect(subGain).connect(master);
      sub.start(t);
      sub.stop(t + 1.7);
      hiss(t, 0.4, 1.1, "bandpass", 3000, 200);
      window.setTimeout(close, 2_200);
    },
    close,
  };
}
