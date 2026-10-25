import { EnvelopeProfile, FourierSynthEngine, PlaybackMode } from '../audio/FourierSynthEngine';
import { SpectrumRenderer, TimeDisplayMode } from '../graphics/SpectrumRenderer';
import { HarmonicPreset, PresetManager } from './PresetManager';

interface VirtualNote {
  note: string;
  freq: number;
  isSharp: boolean;
  keyShortcut: string;
}

const VIRTUAL_KEYBOARD_NOTES: VirtualNote[] = [
  { note: 'La3 (A3)', freq: 220.00, isSharp: false, keyShortcut: 'A' },
  { note: 'La#3', freq: 233.08, isSharp: true, keyShortcut: 'W' },
  { note: 'Si3 (B3)', freq: 246.94, isSharp: false, keyShortcut: 'S' },
  { note: 'Do4 (C4)', freq: 261.63, isSharp: false, keyShortcut: 'D' },
  { note: 'Do#4', freq: 277.18, isSharp: true, keyShortcut: 'E' },
  { note: 'Re4 (D4)', freq: 293.66, isSharp: false, keyShortcut: 'F' },
  { note: 'Re#4', freq: 311.13, isSharp: true, keyShortcut: 'T' },
  { note: 'Mi4 (E4)', freq: 329.63, isSharp: false, keyShortcut: 'G' },
  { note: 'Fa4 (F4)', freq: 349.23, isSharp: false, keyShortcut: 'H' },
  { note: 'Fa#4', freq: 369.99, isSharp: true, keyShortcut: 'U' },
  { note: 'Sol4 (G4)', freq: 392.00, isSharp: false, keyShortcut: 'J' },
  { note: 'Sol#4', freq: 415.30, isSharp: true, keyShortcut: 'I' },
  { note: 'La4 (A4)', freq: 440.00, isSharp: false, keyShortcut: 'K' },
  { note: 'La#4', freq: 466.16, isSharp: true, keyShortcut: 'O' },
  { note: 'Si4 (B4)', freq: 493.88, isSharp: false, keyShortcut: 'L' },
  { note: 'Do5 (C5)', freq: 523.25, isSharp: false, keyShortcut: 'Ñ' }
];

export class Controls {
  private engine: FourierSynthEngine;
  private renderer: SpectrumRenderer;
  private presetManager: PresetManager;

  private harmonicSliders: HTMLInputElement[] = [];
  private harmonicValueLabels: HTMLElement[] = [];
  private harmonicFreqLabels: HTMLElement[] = [];
  private harmonicSignBtns: HTMLButtonElement[] = [];

  constructor(
    engine: FourierSynthEngine,
    renderer: SpectrumRenderer,
    presetManager: PresetManager
  ) {
    this.engine = engine;
    this.renderer = renderer;
    this.presetManager = presetManager;
  }

  public init(): void {
    this.renderPresetsSection();
    this.renderHarmonicSliders();
    this.renderVirtualKeyboard();
    this.bindMasterTransportControls();
    this.bindScopeControls();
    this.bindKeyboardShortcuts();

    // Initial full UI sync
    this.syncAllUI();
  }

  private renderPresetsSection(): void {
    const container = document.getElementById('presets-container');
    if (!container) return;

    container.innerHTML = '';
    const presets = this.presetManager.getPresets();

    for (const preset of presets) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.presetId = preset.id;
      btn.className =
        'preset-btn group text-left px-3 py-2 rounded border transition-all duration-150 flex flex-col justify-between bg-lab-surface border-lab-border hover:border-lab-phosphor/60';

      btn.innerHTML = `
        <div class="flex items-center justify-between gap-1.5 w-full">
          <span class="font-mono text-xs font-semibold text-emerald-100 group-hover:text-lab-phosphor truncate">${preset.name}</span>
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-lab-amber border border-lab-amber/30 shrink-0">${preset.badge}</span>
        </div>
        <p class="text-[11px] text-emerald-300/60 mt-1 line-clamp-1">${preset.description}</p>
      `;

      btn.addEventListener('click', () => {
        this.applyPreset(preset);
      });

      container.appendChild(btn);
    }
  }

  public applyPreset(preset: HarmonicPreset): void {
    this.presetManager.transitionToPreset(
      preset,
      this.engine.getAmplitudes(),
      (amps, signs) => {
        this.engine.setAllHarmonics(amps, signs);
        this.syncAllUI();
      },
      220
    );

    const noteEl = document.getElementById('preset-acoustic-note');
    if (noteEl) {
      noteEl.textContent = `${preset.name}: ${preset.acousticNote}`;
    }
  }

  private renderHarmonicSliders(): void {
    const container = document.getElementById('harmonic-sliders-container');
    if (!container) return;
    container.innerHTML = '';

    this.harmonicSliders = [];
    this.harmonicValueLabels = [];
    this.harmonicFreqLabels = [];
    this.harmonicSignBtns = [];

    for (let n = 1; n <= FourierSynthEngine.NUM_HARMONICS; n++) {
      const row = document.createElement('div');
      row.className =
        'flex items-center gap-2.5 px-2.5 py-1.5 rounded bg-lab-surface/70 border border-lab-border/80 hover:border-lab-phosphor/40 transition-colors';

      row.addEventListener('mouseenter', () => this.renderer.setHoveredHarmonic(n));
      row.addEventListener('mouseleave', () => this.renderer.setHoveredHarmonic(null));

      const badge = document.createElement('div');
      badge.className = 'w-14 shrink-0';
      badge.innerHTML = `
        <div class="font-mono text-xs font-bold ${n === 1 ? 'text-lab-phosphor' : 'text-emerald-100'}">A<sub>${n}</sub> (${n}f₀)</div>
        <div id="harm-freq-${n}" class="font-mono text-[10px] text-emerald-400/60">220 Hz</div>
      `;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '1';
      slider.step = '0.01';
      slider.value = this.engine.getAmplitudes()[n].toFixed(2);
      slider.className = `lab-slider flex-1 ${n === 1 ? '' : 'lab-slider-amber'}`;
      slider.ariaLabel = `Amplitud Armónico ${n}`;

      const signBtn = document.createElement('button');
      signBtn.type = 'button';
      signBtn.title = 'Invertir polaridad de fase (+sen / -sen)';
      signBtn.className =
        'font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-lab-border bg-black/40 text-lab-phosphor hover:border-lab-phosphor transition-colors w-8 text-center shrink-0';
      signBtn.textContent = '+1';

      const valLabel = document.createElement('span');
      valLabel.className = 'font-mono text-xs font-semibold text-right w-11 shrink-0 text-emerald-100';
      valLabel.textContent = this.engine.getAmplitudes()[n].toFixed(2);

      slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        this.presetManager.setCurrentPresetId('custom');
        this.engine.setHarmonicAmplitude(n, val);
        this.syncAllUI();
      });

      signBtn.addEventListener('click', () => {
        this.presetManager.setCurrentPresetId('custom');
        this.engine.toggleHarmonicSign(n);
        this.syncAllUI();
      });

      row.appendChild(badge);
      row.appendChild(slider);
      row.appendChild(signBtn);
      row.appendChild(valLabel);
      container.appendChild(row);

      this.harmonicSliders[n] = slider;
      this.harmonicValueLabels[n] = valLabel;
      this.harmonicFreqLabels[n] = badge.querySelector(`#harm-freq-${n}`) as HTMLElement;
      this.harmonicSignBtns[n] = signBtn;
    }
  }

  private renderVirtualKeyboard(): void {
    const container = document.getElementById('virtual-keyboard-container');
    if (!container) return;
    container.innerHTML = '';

    for (const item of VIRTUAL_KEYBOARD_NOTES) {
      const keyBtn = document.createElement('button');
      keyBtn.type = 'button';
      keyBtn.dataset.freq = item.freq.toString();
      keyBtn.dataset.shortcut = item.keyShortcut;

      if (item.isSharp) {
        keyBtn.className =
          'vk-key px-2 py-2.5 rounded bg-[#0c1411] border border-lab-amber/40 text-lab-amber hover:bg-lab-amber/20 active:bg-lab-amber active:text-black transition-all flex flex-col items-center justify-between min-w-[44px] shadow-md';
      } else {
        keyBtn.className =
          'vk-key px-2.5 py-3 rounded bg-lab-surface border border-lab-border text-emerald-100 hover:border-lab-phosphor active:bg-lab-phosphor active:text-black transition-all flex flex-col items-center justify-between min-w-[52px]';
      }

      keyBtn.innerHTML = `
        <span class="font-mono text-[10px] opacity-60">[${item.keyShortcut}]</span>
        <span class="font-mono text-xs font-bold mt-1">${item.note.split(' ')[0]}</span>
        <span class="font-mono text-[10px] text-lab-phosphor/80 mt-0.5">${Math.round(item.freq)}Hz</span>
      `;

      const startNote = async (e: Event) => {
        e.preventDefault();
        keyBtn.classList.add('ring-2', 'ring-lab-phosphor', 'bg-lab-phosphor/20');
        await this.engine.triggerNoteOn(item.freq);
        this.syncAllUI();
      };

      const endNote = (e: Event) => {
        e.preventDefault();
        keyBtn.classList.remove('ring-2', 'ring-lab-phosphor', 'bg-lab-phosphor/20');
        this.engine.triggerNoteOff(item.freq);
        this.syncAudioStatusUI();
      };

      keyBtn.addEventListener('pointerdown', startNote);
      keyBtn.addEventListener('pointerup', endNote);
      keyBtn.addEventListener('pointerleave', endNote);
      keyBtn.addEventListener('pointercancel', endNote);

      container.appendChild(keyBtn);
    }
  }

  private bindMasterTransportControls(): void {
    const startAudioBtn = document.getElementById('btn-audio-power') as HTMLButtonElement | null;
    const modeDroneBtn = document.getElementById('btn-mode-drone') as HTMLButtonElement | null;
    const modeKeyboardBtn = document.getElementById('btn-mode-keyboard') as HTMLButtonElement | null;
    const envSustainedBtn = document.getElementById('btn-env-sustained') as HTMLButtonElement | null;
    const envPercussiveBtn = document.getElementById('btn-env-percussive') as HTMLButtonElement | null;

    const f0Slider = document.getElementById('slider-f0') as HTMLInputElement | null;
    const volSlider = document.getElementById('slider-volume') as HTMLInputElement | null;
    const btnClearHarmonics = document.getElementById('btn-clear-harmonics');
    const btnResetFundamental = document.getElementById('btn-reset-sine');

    startAudioBtn?.addEventListener('click', async () => {
      if (this.engine.getPlaybackMode() === 'keyboard') {
        this.engine.setPlaybackMode('drone');
      }
      await this.engine.toggleDrone();
      this.syncAllUI();
    });

    modeDroneBtn?.addEventListener('click', () => {
      this.setMode('drone');
    });

    modeKeyboardBtn?.addEventListener('click', async () => {
      await this.engine.initAndUnlock();
      this.setMode('keyboard');
    });

    envSustainedBtn?.addEventListener('click', () => {
      this.setEnvelope('sustained');
    });

    envPercussiveBtn?.addEventListener('click', () => {
      this.setEnvelope('percussive');
    });

    f0Slider?.addEventListener('input', () => {
      const hz = parseFloat(f0Slider.value);
      this.engine.setFundamentalFrequency(hz);
      this.syncAllUI();
    });

    // Quick pitch reference buttons (110, 220, 440, 880 Hz)
    document.querySelectorAll<HTMLButtonElement>('[data-quick-f0]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hz = parseFloat(btn.dataset.quickF0 || '220');
        this.engine.setFundamentalFrequency(hz);
        this.syncAllUI();
      });
    });

    volSlider?.addEventListener('input', () => {
      const vol = parseFloat(volSlider.value);
      this.engine.setMasterVolume(vol);
      this.syncAllUI();
    });

    btnClearHarmonics?.addEventListener('click', () => {
      this.presetManager.setCurrentPresetId('custom');
      const zero = new Float32Array(9);
      zero[1] = 1.0; // Leave fundamental at 1.0 or clear overtones
      const signs = new Int8Array(9).fill(1);
      this.engine.setAllHarmonics(zero, signs);
      this.syncAllUI();
    });

    btnResetFundamental?.addEventListener('click', () => {
      const violin = this.presetManager.getPresetById('violin');
      if (violin) this.applyPreset(violin);
    });
  }

  private bindScopeControls(): void {
    const btnFlow = document.getElementById('btn-scope-flow');
    const btnStatic = document.getElementById('btn-scope-static');
    const chkDecomp = document.getElementById('chk-decomposition') as HTMLInputElement | null;
    const chkNorm = document.getElementById('chk-normalize') as HTMLInputElement | null;

    btnFlow?.addEventListener('click', () => {
      this.setTimeMode('flow');
    });

    btnStatic?.addEventListener('click', () => {
      this.setTimeMode('static');
    });

    chkDecomp?.addEventListener('change', () => {
      this.renderer.setShowDecomposition(chkDecomp.checked);
    });

    chkNorm?.addEventListener('change', () => {
      this.renderer.setAutoNormalizeScope(chkNorm.checked);
    });
  }

  private bindKeyboardShortcuts(): void {
    const activeKeys = new Set<string>();

    window.addEventListener('keydown', async (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const key = e.key.toUpperCase();
      const match = VIRTUAL_KEYBOARD_NOTES.find((n) => n.keyShortcut === key);
      if (match) {
        activeKeys.add(key);
        const btn = document.querySelector<HTMLButtonElement>(`.vk-key[data-shortcut="${key}"]`);
        btn?.classList.add('ring-2', 'ring-lab-phosphor', 'bg-lab-phosphor/20');
        await this.engine.triggerNoteOn(match.freq);
        this.syncAllUI();
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const match = VIRTUAL_KEYBOARD_NOTES.find((n) => n.keyShortcut === key);
      if (match && activeKeys.has(key)) {
        activeKeys.delete(key);
        const btn = document.querySelector<HTMLButtonElement>(`.vk-key[data-shortcut="${key}"]`);
        btn?.classList.remove('ring-2', 'ring-lab-phosphor', 'bg-lab-phosphor/20');
        this.engine.triggerNoteOff(match.freq);
        this.syncAudioStatusUI();
      }
    });
  }

  private setMode(mode: PlaybackMode): void {
    this.engine.setPlaybackMode(mode);
    this.syncAllUI();
  }

  private setEnvelope(profile: EnvelopeProfile): void {
    this.engine.setEnvelopeProfile(profile);
    this.syncAllUI();
  }

  private setTimeMode(mode: TimeDisplayMode): void {
    this.renderer.setTimeDisplayMode(mode);
    const btnFlow = document.getElementById('btn-scope-flow');
    const btnStatic = document.getElementById('btn-scope-static');
    if (btnFlow && btnStatic) {
      if (mode === 'flow') {
        btnFlow.className = 'px-2.5 py-1 text-xs font-mono rounded bg-lab-phosphor text-black font-semibold';
        btnStatic.className = 'px-2.5 py-1 text-xs font-mono rounded bg-lab-surface text-emerald-200 border border-lab-border hover:border-lab-phosphor/50';
      } else {
        btnStatic.className = 'px-2.5 py-1 text-xs font-mono rounded bg-lab-phosphor text-black font-semibold';
        btnFlow.className = 'px-2.5 py-1 text-xs font-mono rounded bg-lab-surface text-emerald-200 border border-lab-border hover:border-lab-phosphor/50';
      }
    }
  }

  public syncAllUI(): void {
    const amps = this.engine.getAmplitudes();
    const signs = this.engine.getSigns();
    const f0 = this.engine.getFundamentalFrequency();
    const vol = this.engine.getMasterVolume();

    // Sync f0 and volume sliders + labels
    const f0Slider = document.getElementById('slider-f0') as HTMLInputElement | null;
    const f0Readout = document.getElementById('readout-f0');
    if (f0Slider) f0Slider.value = f0.toString();
    if (f0Readout) f0Readout.textContent = `${f0.toFixed(1)} Hz (${this.freqToNoteName(f0)})`;

    const volSlider = document.getElementById('slider-volume') as HTMLInputElement | null;
    const volReadout = document.getElementById('readout-volume');
    if (volSlider) volSlider.value = vol.toString();
    if (volReadout) volReadout.textContent = `${Math.round(vol * 100)}%`;

    // Sync harmonic sliders, frequencies, and polarity buttons
    for (let n = 1; n <= FourierSynthEngine.NUM_HARMONICS; n++) {
      const a = amps[n];
      const s = signs[n] < 0 ? -1 : 1;

      if (this.harmonicSliders[n]) {
        this.harmonicSliders[n].value = a.toFixed(2);
      }
      if (this.harmonicValueLabels[n]) {
        this.harmonicValueLabels[n].textContent = `${s < 0 ? '-' : ''}${a.toFixed(2)}`;
      }
      if (this.harmonicFreqLabels[n]) {
        this.harmonicFreqLabels[n].textContent = `${Math.round(n * f0)} Hz`;
      }
      if (this.harmonicSignBtns[n]) {
        this.harmonicSignBtns[n].textContent = s < 0 ? '−1' : '+1';
        this.harmonicSignBtns[n].className = s < 0
          ? 'font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-lab-amber bg-lab-amber/20 text-lab-amber w-8 text-center shrink-0'
          : 'font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-lab-border bg-black/40 text-lab-phosphor hover:border-lab-phosphor w-8 text-center shrink-0';
      }
    }

    // Highlight active preset button
    const activePresetId = this.presetManager.getCurrentPresetId();
    document.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach((btn) => {
      const isSelected = btn.dataset.presetId === activePresetId;
      btn.className = isSelected
        ? 'preset-btn group text-left px-3 py-2 rounded border transition-all duration-150 flex flex-col justify-between bg-lab-phosphor/15 border-lab-phosphor shadow-[0_0_12px_rgba(0,255,157,0.18)]'
        : 'preset-btn group text-left px-3 py-2 rounded border transition-all duration-150 flex flex-col justify-between bg-lab-surface border-lab-border hover:border-lab-phosphor/60';
    });

    this.syncAudioStatusUI();
    this.syncTelemetryPanel();
  }

  private syncAudioStatusUI(): void {
    const startAudioBtn = document.getElementById('btn-audio-power');
    const statusDot = document.getElementById('audio-status-dot');
    const statusText = document.getElementById('audio-status-text');

    const modeDroneBtn = document.getElementById('btn-mode-drone');
    const modeKeyboardBtn = document.getElementById('btn-mode-keyboard');
    const envSustainedBtn = document.getElementById('btn-env-sustained');
    const envPercussiveBtn = document.getElementById('btn-env-percussive');

    const isDrone = this.engine.getIsDroneActive();
    const isUnlocked = this.engine.isUnlocked();
    const mode = this.engine.getPlaybackMode();
    const env = this.engine.getEnvelopeProfile();

    if (startAudioBtn) {
      if (isDrone) {
        startAudioBtn.className =
          'w-full py-2.5 px-4 rounded font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-lab-phosphor text-black shadow-[0_0_18px_rgba(0,255,157,0.5)]';
        startAudioBtn.innerHTML = `
          <span class="w-2.5 h-2.5 rounded-full bg-black animate-ping"></span>
          <span>DRON ACTIVO — DETENER EMISIÓN</span>
        `;
      } else {
        startAudioBtn.className =
          'w-full py-2.5 px-4 rounded font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-lab-surface border border-lab-phosphor text-lab-phosphor hover:bg-lab-phosphor hover:text-black';
        startAudioBtn.innerHTML = `
          <span class="w-2.5 h-2.5 rounded-full bg-lab-phosphor"></span>
          <span>${isUnlocked ? 'ACTIVAR DRON CONTINUO' : 'INICIAR MOTOR DSP / DRON'}</span>
        `;
      }
    }

    if (statusDot && statusText) {
      if (isDrone) {
        statusDot.className = 'w-2.5 h-2.5 rounded-full bg-lab-phosphor shadow-[0_0_8px_#00ff9d]';
        statusText.textContent = 'DSP ONLINE · SÍNTESIS ACTIVA';
        statusText.className = 'font-mono text-xs text-lab-phosphor';
      } else if (isUnlocked) {
        statusDot.className = 'w-2.5 h-2.5 rounded-full bg-lab-amber shadow-[0_0_8px_#ffb300]';
        statusText.textContent = mode === 'keyboard' ? 'DSP LISTO · MODO TECLADO ADSR' : 'DSP EN ESPERA (STANDBY)';
        statusText.className = 'font-mono text-xs text-lab-amber';
      } else {
        statusDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-700';
        statusText.textContent = 'AUDIO BLOQUEADO (CLIC PARA INICIAR)';
        statusText.className = 'font-mono text-xs text-emerald-400/70';
      }
    }

    if (modeDroneBtn && modeKeyboardBtn) {
      modeDroneBtn.className = mode === 'drone'
        ? 'flex-1 py-1.5 px-2 rounded font-mono text-xs font-semibold bg-lab-phosphor text-black'
        : 'flex-1 py-1.5 px-2 rounded font-mono text-xs text-emerald-200 bg-lab-surface border border-lab-border hover:border-lab-phosphor/40';
      modeKeyboardBtn.className = mode === 'keyboard'
        ? 'flex-1 py-1.5 px-2 rounded font-mono text-xs font-semibold bg-lab-amber text-black'
        : 'flex-1 py-1.5 px-2 rounded font-mono text-xs text-emerald-200 bg-lab-surface border border-lab-border hover:border-lab-amber/40';
    }

    if (envSustainedBtn && envPercussiveBtn) {
      envSustainedBtn.className = env === 'sustained'
        ? 'flex-1 py-1 px-2 rounded font-mono text-[11px] font-semibold bg-lab-amber/20 border border-lab-amber text-lab-amber'
        : 'flex-1 py-1 px-2 rounded font-mono text-[11px] text-emerald-300/70 bg-lab-surface border border-lab-border';
      envPercussiveBtn.className = env === 'percussive'
        ? 'flex-1 py-1 px-2 rounded font-mono text-[11px] font-semibold bg-lab-amber/20 border border-lab-amber text-lab-amber'
        : 'flex-1 py-1 px-2 rounded font-mono text-[11px] text-emerald-300/70 bg-lab-surface border border-lab-border';
    }
  }

  private syncTelemetryPanel(): void {
    const telemetry = PresetManager.computeTelemetry(
      this.engine.getAmplitudes(),
      this.engine.getSigns(),
      this.engine.getFundamentalFrequency()
    );

    const eqTextEl = document.getElementById('telemetry-equation-text');
    const eqLatexEl = document.getElementById('telemetry-equation-latex');
    const fundPctEl = document.getElementById('telemetry-fund-pct');
    const harmPctEl = document.getElementById('telemetry-harm-pct');
    const thdEl = document.getElementById('telemetry-thd');
    const oddEvenEl = document.getElementById('telemetry-odd-even');
    const centroidEl = document.getElementById('telemetry-centroid');
    const energyBarFund = document.getElementById('telemetry-bar-fund');
    const energyBarHarm = document.getElementById('telemetry-bar-harm');
    const charTitleEl = document.getElementById('telemetry-char-title');
    const charDescEl = document.getElementById('telemetry-char-desc');

    if (eqTextEl) eqTextEl.textContent = telemetry.equationText;
    if (eqLatexEl) eqLatexEl.textContent = telemetry.equationLatex;
    if (fundPctEl) fundPctEl.textContent = `${telemetry.fundamentalEnergyPct.toFixed(1)}%`;
    if (harmPctEl) harmPctEl.textContent = `${telemetry.harmonicEnergyPct.toFixed(1)}%`;
    if (thdEl) thdEl.textContent = `${telemetry.thdPct.toFixed(1)}%`;
    if (oddEvenEl) oddEvenEl.textContent = telemetry.oddEvenRatio;
    if (centroidEl) {
      const centroidHz = Math.round(telemetry.spectralCentroidRatio * this.engine.getFundamentalFrequency());
      centroidEl.textContent = `${telemetry.spectralCentroidRatio.toFixed(2)}·f₀ (${centroidHz} Hz)`;
    }

    if (energyBarFund) energyBarFund.style.width = `${telemetry.fundamentalEnergyPct}%`;
    if (energyBarHarm) energyBarHarm.style.width = `${telemetry.harmonicEnergyPct}%`;

    if (charTitleEl) charTitleEl.textContent = telemetry.characterTitle;
    if (charDescEl) charDescEl.textContent = telemetry.characterDescription;
  }

  private freqToNoteName(freq: number): string {
    const noteNames = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
    const midi = Math.round(69 + 12 * Math.log2(freq / 440));
    const name = noteNames[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${name}${octave}`;
  }
}
