export type PlaybackMode = 'drone' | 'keyboard';
export type EnvelopeProfile = 'percussive' | 'sustained';

export interface ADSRConfig {
  attack: number;   // seconds
  decay: number;    // seconds
  sustain: number;  // 0..1 level
  release: number;  // seconds
}

export const ENVELOPE_PROFILES: Record<EnvelopeProfile, ADSRConfig> = {
  percussive: {
    attack: 0.008,
    decay: 0.18,
    sustain: 0.08,
    release: 0.22
  },
  sustained: {
    attack: 0.045,
    decay: 0.14,
    sustain: 0.82,
    release: 0.28
  }
};

export class FourierSynthEngine {
  public static readonly NUM_HARMONICS = 8;

  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  /** Strict Float32Array(9) for Web Audio PeriodicWave: index 0 is DC (0.0), indices 1..8 are harmonics A1..A8 */
  private readonly real: Float32Array = new Float32Array(FourierSynthEngine.NUM_HARMONICS + 1);
  private readonly imag: Float32Array = new Float32Array(FourierSynthEngine.NUM_HARMONICS + 1);

  /** Unsigned harmonic amplitudes [0.0 .. 1.0] at indices 1..8 */
  private readonly amplitudes: Float32Array = new Float32Array(FourierSynthEngine.NUM_HARMONICS + 1);
  /** Polarity signs (+1 or -1) at indices 1..8 for phase-inverted series like Sawtooth */
  private readonly signs: Int8Array = new Int8Array(FourierSynthEngine.NUM_HARMONICS + 1);

  private fundamentalHz: number = 220; // Default La3 (220 Hz), range 110 Hz - 880 Hz
  private masterVolume: number = 0.45;
  private mode: PlaybackMode = 'drone';
  private envelopeProfile: EnvelopeProfile = 'sustained';

  private isDroneActive: boolean = false;
  private activeKeyboardNoteHz: number | null = null;
  private releaseTimeoutId: number | null = null;

  constructor() {
    this.real.fill(0.0);
    this.imag.fill(0.0);
    this.amplitudes.fill(0.0);
    this.signs.fill(1);

    // Default initial harmonics (Violin 1/n profile)
    const initial = [1.0, 0.50, 0.33, 0.25, 0.20, 0.16, 0.14, 0.125];
    for (let n = 1; n <= FourierSynthEngine.NUM_HARMONICS; n++) {
      this.amplitudes[n] = initial[n - 1];
      this.signs[n] = 1;
      this.imag[n] = initial[n - 1];
    }
  }

  /**
   * Unlocks and initializes the Web Audio API context safely upon user interaction.
   */
  public async initAndUnlock(): Promise<boolean> {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.82;

      this.oscillator = this.audioCtx.createOscillator();
      this.oscillator.frequency.setValueAtTime(this.fundamentalHz, this.audioCtx.currentTime);

      // Apply initial PeriodicWave
      this.applyPeriodicWave();

      // Strict routing: OscillatorNode -> GainNode -> AnalyserNode -> audioCtx.destination
      this.oscillator.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);

      this.oscillator.start();
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    return this.audioCtx.state === 'running';
  }

  public isUnlocked(): boolean {
    return this.audioCtx !== null && this.audioCtx.state === 'running';
  }

  /**
   * Rebuilds and assigns the PeriodicWave from `real` and `imag` Float32Array(9).
   * Index 0 is strictly 0.0 (DC offset). Indices 1..8 map to sin(2*pi*n*f0*t).
   */
  private applyPeriodicWave(): void {
    this.real[0] = 0.0;
    this.imag[0] = 0.0;

    for (let n = 1; n <= FourierSynthEngine.NUM_HARMONICS; n++) {
      this.real[n] = 0.0;
      this.imag[n] = this.amplitudes[n] * (this.signs[n] < 0 ? -1 : 1);
    }

    if (this.audioCtx && this.oscillator) {
      const wave = this.audioCtx.createPeriodicWave(this.real, this.imag, {
        disableNormalization: false
      });
      this.oscillator.setPeriodicWave(wave);
    }
  }

  public setHarmonicAmplitude(index: number, value: number): void {
    if (index < 1 || index > FourierSynthEngine.NUM_HARMONICS) return;
    const clamped = Math.max(0.0, Math.min(1.0, value));
    this.amplitudes[index] = clamped;
    this.applyPeriodicWave();
  }

  public toggleHarmonicSign(index: number): number {
    if (index < 1 || index > FourierSynthEngine.NUM_HARMONICS) return 1;
    this.signs[index] = this.signs[index] < 0 ? 1 : -1;
    this.applyPeriodicWave();
    return this.signs[index];
  }

  public setAllHarmonics(amplitudes: Float32Array, signs?: Int8Array): void {
    this.amplitudes[0] = 0.0;
    for (let n = 1; n <= FourierSynthEngine.NUM_HARMONICS; n++) {
      this.amplitudes[n] = Math.max(0.0, Math.min(1.0, amplitudes[n] ?? 0));
      if (signs) {
        this.signs[n] = signs[n] < 0 ? -1 : 1;
      }
    }
    this.applyPeriodicWave();
  }

  public getAmplitudes(): Float32Array {
    return this.amplitudes;
  }

  public getSigns(): Int8Array {
    return this.signs;
  }

  public getRealArray(): Float32Array {
    return this.real;
  }

  public getImagArray(): Float32Array {
    return this.imag;
  }

  /**
   * Sets fundamental frequency f0 clamped between 110 Hz (La2) and 880 Hz (La5).
   */
  public setFundamentalFrequency(hz: number): void {
    const clamped = Math.max(110, Math.min(880, hz));
    this.fundamentalHz = clamped;

    if (this.audioCtx && this.oscillator) {
      const now = this.audioCtx.currentTime;
      this.oscillator.frequency.setTargetAtTime(this.fundamentalHz, now, 0.012);
    }
  }

  public getFundamentalFrequency(): number {
    return this.fundamentalHz;
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0.0, Math.min(1.0, volume));
    if (this.mode === 'drone' && this.isDroneActive) {
      this.rampGainSmoothly(this.masterVolume, 0.025);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setPlaybackMode(mode: PlaybackMode): void {
    if (this.mode === mode) return;
    this.mode = mode;

    if (mode === 'keyboard') {
      this.isDroneActive = false;
      this.rampGainSmoothly(0.0, 0.025);
    }
  }

  public getPlaybackMode(): PlaybackMode {
    return this.mode;
  }

  public setEnvelopeProfile(profile: EnvelopeProfile): void {
    this.envelopeProfile = profile;
  }

  public getEnvelopeProfile(): EnvelopeProfile {
    return this.envelopeProfile;
  }

  public async toggleDrone(forceState?: boolean): Promise<boolean> {
    await this.initAndUnlock();
    this.isDroneActive = forceState !== undefined ? forceState : !this.isDroneActive;

    if (this.isDroneActive) {
      this.mode = 'drone';
      this.rampGainSmoothly(this.masterVolume, 0.03);
    } else {
      this.rampGainSmoothly(0.0, 0.03);
    }

    return this.isDroneActive;
  }

  public getIsDroneActive(): boolean {
    return this.isDroneActive;
  }

  /**
   * Anti-click exponential ramp using GainNode.gain.setTargetAtTime
   */
  private rampGainSmoothly(targetGain: number, timeConstant: number = 0.025): void {
    if (!this.audioCtx || !this.masterGain) return;
    const now = this.audioCtx.currentTime;
    const gainParam = this.masterGain.gain;

    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(gainParam.value, now);
    gainParam.setTargetAtTime(Math.max(0.0, targetGain), now, timeConstant);
  }

  /**
   * Triggers a note using ADSR envelope (or updates drone pitch if in Drone mode).
   */
  public async triggerNoteOn(freqHz: number): Promise<void> {
    await this.initAndUnlock();
    this.setFundamentalFrequency(freqHz);
    this.activeKeyboardNoteHz = freqHz;

    if (this.mode === 'drone') {
      if (!this.isDroneActive) {
        await this.toggleDrone(true);
      }
      return;
    }

    if (!this.audioCtx || !this.masterGain) return;
    if (this.releaseTimeoutId !== null) {
      window.clearTimeout(this.releaseTimeoutId);
      this.releaseTimeoutId = null;
    }

    const now = this.audioCtx.currentTime;
    const adsr = ENVELOPE_PROFILES[this.envelopeProfile];
    const peakGain = Math.max(0.05, this.masterVolume);
    const sustainGain = peakGain * adsr.sustain;
    const gainParam = this.masterGain.gain;

    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(gainParam.value, now);

    // Attack phase with setTargetAtTime anti-click
    gainParam.setTargetAtTime(peakGain, now, Math.max(0.004, adsr.attack / 3));

    // Decay phase towards sustain level
    gainParam.setTargetAtTime(sustainGain, now + adsr.attack, Math.max(0.015, adsr.decay / 3));

    // If percussive profile, automatically decay down to near silence if held
    if (this.envelopeProfile === 'percussive') {
      gainParam.setTargetAtTime(0.0001, now + adsr.attack + adsr.decay, adsr.release / 2);
    }
  }

  /**
   * Releases an active keyboard note with smooth exponential release ramp.
   */
  public triggerNoteOff(freqHz?: number): void {
    if (this.mode === 'drone') return;
    if (freqHz !== undefined && this.activeKeyboardNoteHz !== null && Math.abs(this.activeKeyboardNoteHz - freqHz) > 0.5) {
      return;
    }

    this.activeKeyboardNoteHz = null;
    if (!this.audioCtx || !this.masterGain) return;

    const now = this.audioCtx.currentTime;
    const adsr = ENVELOPE_PROFILES[this.envelopeProfile];
    const gainParam = this.masterGain.gain;

    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(gainParam.value, now);
    gainParam.setTargetAtTime(0.0, now, Math.max(0.015, adsr.release / 3));
  }

  public isSounding(): boolean {
    if (!this.masterGain) return false;
    return this.isDroneActive || this.activeKeyboardNoteHz !== null || this.masterGain.gain.value > 0.01;
  }

  public getCurrentOutputGain(): number {
    return this.masterGain ? this.masterGain.gain.value : 0;
  }
}
