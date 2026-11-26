// Skyward Vale — synthesised WebAudio: engine drone, wind rush, ring chime,
// touchdown thump and crash noise. No audio files.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.windSrc = null;
    this.windGain = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine: two detuned sawtooths through a low-pass filter.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 55 * 1.5;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    osc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    osc2.start();
    this.engineOsc2 = osc2;
    // Wind: looped filtered noise.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    this.windSrc = this.ctx.createBufferSource();
    this.windSrc.buffer = buf;
    this.windSrc.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSrc.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    this.windSrc.start();
  }

  /** Call every frame with the flight state. */
  update(throttle, speed, airborne) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const rpm = 40 + throttle * 90 + speed * 0.4;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 1.5, t, 0.1);
    this.engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.06 : throttle * 0.05, t, 0.15);
    this.windGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.0016), t, 0.2);
  }

  blip(freq, dur, type = 'sine', vol = 0.15) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  ringChime() { this.blip(880, 0.5); this.blip(1318, 0.6, 'sine', 0.1); }
  lowPassWhoosh() { this.blip(320, 0.35, 'triangle', 0.12); }
  touchdown() { this.blip(70, 0.25, 'sine', 0.3); this.blip(140, 0.18, 'triangle', 0.12); }
  crash() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.4;
    src.connect(g); g.connect(this.ctx.destination);
    src.start(t);
    this.blip(55, 0.6, 'sawtooth', 0.2);
  }
  toggleMute() { this.muted = !this.muted; return this.muted; }
}
