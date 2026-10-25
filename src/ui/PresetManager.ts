export interface HarmonicPreset {
  id: string;
  name: string;
  category: 'instrument' | 'waveform';
  badge: string;
  /** Amplitudes for harmonics A1..A8 (0.0 to 1.0) */
  amplitudes: [number, number, number, number, number, number, number, number];
  /** Polarity signs (+1 or -1) for each harmonic n=1..8. Used for alternating series (e.g. Sawtooth Gibbs center). */
  signs: [number, number, number, number, number, number, number, number];
  description: string;
  acousticNote: string;
}

export interface PsychoacousticTelemetry {
  equationText: string;
  equationLatex: string;
  fundamentalEnergyPct: number;
  harmonicEnergyPct: number;
  thdPct: number;
  oddEvenRatio: string;
  spectralCentroidRatio: number;
  characterTitle: string;
  characterDescription: string;
}

export const HARMONIC_PRESETS: HarmonicPreset[] = [
  {
    id: 'sine',
    name: 'Senoidal Pura',
    category: 'waveform',
    badge: '1f₀',
    amplitudes: [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    signs: [1, 1, 1, 1, 1, 1, 1, 1],
    description: 'Tono fundamental puro sin sobretonos armónicos (A₁ = 1.0).',
    acousticNote: 'Referencia acústica elemental: toda la energía reside en f₀.'
  },
  {
    id: 'flute',
    name: 'Flauta Traversa',
    category: 'instrument',
    badge: 'Viento Madera',
    amplitudes: [1.0, 0.15, 0.05, 0.01, 0.0, 0.0, 0.0, 0.0],
    signs: [1, 1, 1, 1, 1, 1, 1, 1],
    description: 'Tubo abierto con rápido decaimiento espectral (A₁=1.0, A₂=0.15, A₃=0.05).',
    acousticNote: 'Timbre cristalino, aéreo y suave con muy baja densidad de armónicos superiores.'
  },
  {
    id: 'clarinet',
    name: 'Clarinete',
    category: 'instrument',
    badge: 'Impar Dominante',
    amplitudes: [1.0, 0.03, 0.75, 0.02, 0.40, 0.02, 0.15, 0.0],
    signs: [1, 1, 1, 1, 1, 1, 1, 1],
    description: 'Tubo cilíndrico cerrado en un extremo: predominio de armónicos impares (1, 3, 5, 7).',
    acousticNote: 'Carácter hueco y amaderado ("woody") en su registro chalumeau.'
  },
  {
    id: 'violin',
    name: 'Violín',
    category: 'instrument',
    badge: 'Cuerda Frotada',
    amplitudes: [1.0, 0.50, 0.33, 0.25, 0.20, 0.16, 0.14, 0.125],
    signs: [1, 1, 1, 1, 1, 1, 1, 1],
    description: 'Vibración Helmholtz de cuerda frotada con decaimiento continuo Aₙ = 1/n.',
    acousticNote: 'Rico en armónicos pares e impares, otorgando calidez expresiva y proyección.'
  },
  {
    id: 'trumpet',
    name: 'Trompeta / Cobre',
    category: 'instrument',
    badge: 'Formante Brillante',
    amplitudes: [0.80, 1.0, 0.90, 0.65, 0.40, 0.20, 0.10, 0.05],
    signs: [1, 1, 1, 1, 1, 1, 1, 1],
    description: 'Resonancia de campana metálica donde A₂ y A₃ superan a la fundamental A₁.',
    acousticNote: 'Timbre incisivo, brillante y metálico con fuerte presencia en frecuencias medias-altas.'
  },
  {
    id: 'square',
    name: 'Onda Cuadrada Teórica',
    category: 'waveform',
    badge: 'Impares 1/n',
    amplitudes: [1.0, 0.0, 0.333, 0.0, 0.20, 0.0, 0.143, 0.0],
    signs: [1, 1, 1, 1, 1, 1, 1, 1],
    description: 'Serie de Fourier de armónicos exclusivamente impares con amplitud Aₙ = 1/n.',
    acousticNote: 'Simetría de media onda con sobreimpulso de Gibbs en los flancos de conmutación.'
  },
  {
    id: 'sawtooth',
    name: 'Onda Diente de Sierra',
    category: 'waveform',
    badge: 'Gibbs (-1)ⁿ⁺¹/n',
    amplitudes: [1.0, 0.50, 0.333, 0.25, 0.20, 0.167, 0.143, 0.125],
    signs: [1, -1, 1, -1, 1, -1, 1, -1],
    description: 'Todos los armónicos Aₙ = 1/n con signo alternado (-1)ⁿ⁺¹ para observar el fenómeno de Gibbs.',
    acousticNote: 'Rampa lineal con discontinuidad abrupta y rizado de Gibbs (~9% de sobreimpulso).'
  }
];

export class PresetManager {
  private currentPresetId: string = 'violin';
  private interpolationFrameId: number | null = null;

  public getPresets(): HarmonicPreset[] {
    return HARMONIC_PRESETS;
  }

  public getPresetById(id: string): HarmonicPreset | undefined {
    return HARMONIC_PRESETS.find((p) => p.id === id);
  }

  public getCurrentPresetId(): string {
    return this.currentPresetId;
  }

  public setCurrentPresetId(id: string): void {
    this.currentPresetId = id;
  }

  /**
   * Smoothly interpolates from current amplitudes to target preset amplitudes over `durationMs`.
   */
  public transitionToPreset(
    preset: HarmonicPreset,
    currentAmps: Float32Array,
    onStep: (amps: Float32Array, signs: Int8Array) => void,
    durationMs: number = 220
  ): void {
    if (this.interpolationFrameId !== null) {
      cancelAnimationFrame(this.interpolationFrameId);
      this.interpolationFrameId = null;
    }

    this.currentPresetId = preset.id;
    const startAmps = new Float32Array(currentAmps);
    const targetSigns = new Int8Array(9);
    targetSigns[0] = 1;
    for (let n = 1; n <= 8; n++) {
      targetSigns[n] = preset.signs[n - 1];
    }

    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - t, 3);

      const nextAmps = new Float32Array(9);
      nextAmps[0] = 0;
      for (let n = 1; n <= 8; n++) {
        const startVal = startAmps[n] ?? 0;
        const endVal = preset.amplitudes[n - 1] ?? 0;
        nextAmps[n] = startVal + (endVal - startVal) * ease;
      }

      onStep(nextAmps, targetSigns);

      if (t < 1) {
        this.interpolationFrameId = requestAnimationFrame(step);
      } else {
        this.interpolationFrameId = null;
      }
    };

    this.interpolationFrameId = requestAnimationFrame(step);
  }

  /**
   * Computes real-time mathematical equation, energy distribution, and psychoacoustic descriptors.
   */
  public static computeTelemetry(
    amplitudes: Float32Array,
    signs: Int8Array,
    f0: number
  ): PsychoacousticTelemetry {
    const termsText: string[] = [];
    const termsLatex: string[] = [];

    let e1 = Math.pow(amplitudes[1] || 0, 2);
    let eHarmonics = 0;
    let eEven = 0;
    let eOddHigher = 0;
    let weightedFreqSum = 0;
    let totalAmpSum = 0;

    for (let n = 1; n <= 8; n++) {
      const amp = amplitudes[n] || 0;
      const sign = signs[n] < 0 ? -1 : 1;
      const energy = amp * amp;

      if (n > 1) {
        eHarmonics += energy;
        if (n % 2 === 0) {
          eEven += energy;
        } else {
          eOddHigher += energy;
        }
      }

      weightedFreqSum += n * amp;
      totalAmpSum += amp;

      if (amp >= 0.005) {
        const coeffStr = amp.toFixed(2);
        const signStr = termsText.length === 0
          ? (sign < 0 ? '-' : '')
          : (sign < 0 ? ' - ' : ' + ');

        const freqHz = Math.round(n * f0);
        if (n === 1) {
          termsText.push(`${signStr}${coeffStr}·sin(2π·${freqHz}t)`);
          termsLatex.push(`${signStr}${coeffStr}\\sin(2\\pi f_0 t)`);
        } else {
          termsText.push(`${signStr}${coeffStr}·sin(2π·${n}f₀t)`);
          termsLatex.push(`${signStr}${coeffStr}\\sin(2\\pi \\cdot ${n}f_0 t)`);
        }
      }
    }

    const totalEnergy = e1 + eHarmonics;
    const fundamentalEnergyPct = totalEnergy > 1e-6 ? (e1 / totalEnergy) * 100 : 0;
    const harmonicEnergyPct = totalEnergy > 1e-6 ? (eHarmonics / totalEnergy) * 100 : 0;
    const thdPct = e1 > 1e-6 ? (Math.sqrt(eHarmonics) / Math.sqrt(e1)) * 100 : (eHarmonics > 0 ? 999 : 0);
    const centroid = totalAmpSum > 1e-6 ? weightedFreqSum / totalAmpSum : 1.0;

    let oddEvenRatio = 'Equilibrado';
    if (eHarmonics < 0.002) {
      oddEvenRatio = 'Sin sobretonos';
    } else if (eOddHigher > eEven * 3.5) {
      oddEvenRatio = 'Predominio Impar (>78%)';
    } else if (eEven > eOddHigher * 2.5) {
      oddEvenRatio = 'Predominio Par (Octavado)';
    } else {
      const oddPct = Math.round(((e1 + eOddHigher) / totalEnergy) * 100);
      const evenPct = 100 - oddPct;
      oddEvenRatio = `Impar ${oddPct}% / Par ${evenPct}%`;
    }

    const { title, description } = PresetManager.classifyPsychoacoustics(
      totalEnergy,
      fundamentalEnergyPct,
      eOddHigher,
      eEven,
      centroid,
      amplitudes
    );

    return {
      equationText: termsText.length > 0 ? `x(t) = ${termsText.join('')}` : 'x(t) = 0.00 (Silencio Espectral)',
      equationLatex: termsLatex.length > 0 ? `x(t) = ${termsLatex.join('')}` : 'x(t) = 0',
      fundamentalEnergyPct,
      harmonicEnergyPct,
      thdPct,
      oddEvenRatio,
      spectralCentroidRatio: centroid,
      characterTitle: title,
      characterDescription: description
    };
  }

  private static classifyPsychoacoustics(
    totalEnergy: number,
    fundamentalPct: number,
    eOddHigher: number,
    eEven: number,
    centroid: number,
    amps: Float32Array
  ): { title: string; description: string } {
    if (totalEnergy < 0.001) {
      return {
        title: 'Silencio / Portadora Nula',
        description: 'Todos los coeficientes de Fourier están en 0. Incrementa A₁–A₈ para sintetizar una onda.'
      };
    }

    if (fundamentalPct >= 98.5) {
      return {
        title: 'Senoidal Puro / Sin Timbre Complejo',
        description: 'Energía concentrada al ~100% en la fundamental f₀. Sensación suave, etérea y libre de rugosidad.'
      };
    }

    if (fundamentalPct >= 90 && centroid < 1.35) {
      return {
        title: 'Cálido, Redondo y Flautado',
        description: 'Fuerte predominio de la fundamental con ligeros primeros armónicos que aportan cuerpo sin aspereza.'
      };
    }

    if (eOddHigher > eEven * 3.2 && fundamentalPct < 92) {
      return {
        title: 'Hueco / Nasal / Tipo Madera (Clarinete)',
        description: 'Dominancia de armónicos impares (3f₀, 5f₀, 7f₀) propia de resonadores cilíndricos cerrados.'
      };
    }

    if ((amps[2] > amps[1] * 0.9 || amps[3] > amps[1] * 0.8) && centroid >= 2.15) {
      return {
        title: 'Brillante, Incisivo y Metálico (Cobre)',
        description: 'Los armónicos medios-superiores rivalizan o superan a f₀, generando un formante penetrante y rico.'
      };
    }

    if (centroid >= 2.75) {
      return {
        title: 'Áspero, Brillante y Rico en Agudos',
        description: 'Centroide espectral elevado con fuerte energía en armónicos de orden alto (5f₀–8f₀).'
      };
    }

    return {
      title: 'Rico, Expresivo y Continuo (Cuerda / Sierra)',
      description: 'Distribución progresiva de armónicos pares e impares que produce plenitud armónica y definición.'
    };
  }
}
