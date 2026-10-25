import { FourierSynthEngine } from '../audio/FourierSynthEngine';

export type TimeDisplayMode = 'flow' | 'static';

export interface HarmonicBarHit {
  harmonicIndex: number; // 1..8
  amplitude: number;     // 0.0..1.0
  isPolarityClick: boolean;
}

const HARMONIC_COLORS = [
  '#00ff9d', // n=1 Fundamental (Phosphor Green)
  '#ffb300', // n=2 Octave (Amber)
  '#00e5ff', // n=3 Fifth above octave (Cyan)
  '#a78bfa', // n=4 Double octave (Violet)
  '#fb7185', // n=5 Major third (Rose)
  '#38bdf8', // n=6 Fifth (Sky)
  '#facc15', // n=7 Natural seventh (Yellow)
  '#f472b6', // n=8 Triple octave (Pink)
];

const HARMONIC_INTERVAL_LABELS = [
  'Fundamental (1f₀)',
  'Octava (2f₀)',
  'Docena / 5ª Justa (3f₀)',
  'Doble Octava (4f₀)',
  '17ª / 3ª Mayor (5f₀)',
  '19ª / 5ª Justa (6f₀)',
  '7ª Menor Nat. (7f₀)',
  'Triple Octava (8f₀)',
];

export class SpectrumRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: FourierSynthEngine;

  private dpr: number = 1;
  private width: number = 900;
  private height: number = 580;

  private timeMode: TimeDisplayMode = 'flow';
  private showDecomposition: boolean = true;
  private autoNormalizeScope: boolean = true;
  private phaseOffset: number = 0;
  private lastFrameTime: number = performance.now();
  private animFrameId: number | null = null;

  private hoveredHarmonic: number | null = null;
  private draggingHarmonic: number | null = null;

  private onHarmonicChange?: (index: number, newAmplitude: number) => void;
  private onPolarityToggle?: (index: number) => void;

  // Layout geometry cache for interactive hit-testing
  private barRects: Array<{
    index: number;
    x: number;
    y: number;
    w: number;
    h: number;
    polarityBadgeRect: { x: number; y: number; w: number; h: number };
  }> = [];

  constructor(
    canvas: HTMLCanvasElement,
    engine: FourierSynthEngine,
    callbacks?: {
      onHarmonicChange?: (index: number, newAmplitude: number) => void;
      onPolarityToggle?: (index: number) => void;
    }
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo inicializar el contexto Canvas 2D.');
    }
    this.ctx = context;
    this.engine = engine;
    this.onHarmonicChange = callbacks?.onHarmonicChange;
    this.onPolarityToggle = callbacks?.onPolarityToggle;

    this.setupResizeObserver();
    this.setupPointerInteractions();
  }

  public setTimeDisplayMode(mode: TimeDisplayMode): void {
    this.timeMode = mode;
    if (mode === 'static') {
      this.phaseOffset = 0;
    }
  }

  public getTimeDisplayMode(): TimeDisplayMode {
    return this.timeMode;
  }

  public setShowDecomposition(show: boolean): void {
    this.showDecomposition = show;
  }

  public getShowDecomposition(): boolean {
    return this.showDecomposition;
  }

  public setAutoNormalizeScope(normalize: boolean): void {
    this.autoNormalizeScope = normalize;
  }

  public setHoveredHarmonic(index: number | null): void {
    this.hoveredHarmonic = index;
  }

  public start(): void {
    if (this.animFrameId !== null) return;
    this.lastFrameTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;
      this.render(dt);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private setupResizeObserver(): void {
    const updateSize = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = Math.max(320, rect.width);
      this.height = Math.max(460, rect.height);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(this.canvas);
    window.addEventListener('resize', updateSize);
  }

  private setupPointerInteractions(): void {
    const getPointerCoords = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const updateAmplitudeFromY = (barIdx: number, pointerY: number) => {
      const bar = this.barRects.find((b) => b.index === barIdx);
      if (!bar) return;
      const ratio = 1.0 - (pointerY - bar.y) / bar.h;
      const clamped = Math.max(0.0, Math.min(1.0, Math.round(ratio * 100) / 100));
      if (this.onHarmonicChange) {
        this.onHarmonicChange(barIdx, clamped);
      }
    };

    this.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      const { x, y } = getPointerCoords(e);

      for (const bar of this.barRects) {
        // Check polarity badge click first
        const pb = bar.polarityBadgeRect;
        if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
          if (this.onPolarityToggle) {
            this.onPolarityToggle(bar.index);
          }
          return;
        }

        // Check bar track area
        if (x >= bar.x - 6 && x <= bar.x + bar.w + 6 && y >= bar.y - 12 && y <= bar.y + bar.h + 12) {
          this.draggingHarmonic = bar.index;
          this.hoveredHarmonic = bar.index;
          this.canvas.setPointerCapture(e.pointerId);
          updateAmplitudeFromY(bar.index, y);
          return;
        }
      }
    });

    this.canvas.addEventListener('pointermove', (e: PointerEvent) => {
      const { x, y } = getPointerCoords(e);

      if (this.draggingHarmonic !== null) {
        updateAmplitudeFromY(this.draggingHarmonic, y);
        return;
      }

      let foundHover: number | null = null;
      let cursorStyle = 'default';

      for (const bar of this.barRects) {
        const pb = bar.polarityBadgeRect;
        if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
          foundHover = bar.index;
          cursorStyle = 'pointer';
          break;
        }
        if (x >= bar.x - 6 && x <= bar.x + bar.w + 6 && y >= bar.y - 10 && y <= bar.y + bar.h + 10) {
          foundHover = bar.index;
          cursorStyle = 'ns-resize';
          break;
        }
      }

      this.hoveredHarmonic = foundHover;
      this.canvas.style.cursor = cursorStyle;
    });

    const endDrag = (e: PointerEvent) => {
      if (this.draggingHarmonic !== null) {
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch {
          // ignore if not captured
        }
        this.draggingHarmonic = null;
      }
    };

    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
    this.canvas.addEventListener('pointerleave', () => {
      if (this.draggingHarmonic === null) {
        this.hoveredHarmonic = null;
      }
    });
  }

  private render(dt: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const w = this.width;
    const h = this.height;

    // Clear master background
    ctx.fillStyle = '#090e0c';
    ctx.fillRect(0, 0, w, h);

    // Split height: Top 50% Time Domain, Bottom 50% Frequency Domain
    const dividerY = Math.round(h * 0.50);

    // Advance phase in temporal flow mode (wave moves toward the right: x(t - phase))
    const f0 = this.engine.getFundamentalFrequency();
    if (this.timeMode === 'flow') {
      // Speed proportional to log2(f0/110) so pitch changes are visually reflected without aliasing
      const speedCyclesPerSec = 0.65 * (0.75 + 0.35 * Math.log2(f0 / 110));
      this.phaseOffset = (this.phaseOffset + dt * speedCyclesPerSec) % 1.0;
    } else {
      this.phaseOffset = 0;
    }

    this.drawTimeDomainPanel(ctx, 0, 0, w, dividerY);
    this.drawDivider(ctx, dividerY, w);
    this.drawFrequencyDomainPanel(ctx, 0, dividerY + 1, w, h - dividerY - 1);

    ctx.restore();
  }

  /**
   * PANEL 1: Time Domain Oscilloscope (Fourier Reconstruction & Harmonic Decomposition)
   */
  private drawTimeDomainPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const padLeft = 52;
    const padRight = 24;
    const padTop = 38;
    const padBottom = 26;

    const plotX = x + padLeft;
    const plotY = y + padTop;
    const plotW = Math.max(100, w - padLeft - padRight);
    const plotH = Math.max(80, h - padTop - padBottom);
    const centerY = plotY + plotH / 2;

    // Subtle oscilloscope grid
    this.drawScopeGrid(ctx, plotX, plotY, plotW, plotH, centerY);

    // Panel Header Banner
    ctx.fillStyle = '#00ff9d';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('DOMINIO DEL TIEMPO // OSCILOSCOPIO DE RECONSTRUCCIÓN DE FOURIER x(t)', plotX, y + 20);

    ctx.fillStyle = '#739686';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    const periodMs = (1000 / this.engine.getFundamentalFrequency()).toFixed(2);
    const modeLabel = this.timeMode === 'flow' ? 'FLUJO TEMPORAL →' : `PERIODO ESTÁTICO T₀ = ${periodMs} ms`;
    ctx.fillText(modeLabel, plotX + plotW, y + 20);

    const amps = this.engine.getAmplitudes();
    const signs = this.engine.getSigns();

    // Determine normalization factor so the summed wave fits cleanly inside the oscilloscope
    // In Static mode we show 1 full period (t in [0, 1]) for clean geometric symmetry analysis;
    // In Flow mode we show 2 periods moving rightwards.
    const cyclesShown = this.timeMode === 'static' ? 1.0 : 2.0;
    const numSamples = Math.min(720, Math.max(360, Math.floor(plotW)));

    let peakSum = 0;
    const sumSamples = new Float32Array(numSamples + 1);

    for (let i = 0; i <= numSamples; i++) {
      const normX = i / numSamples; // 0..1 across screen
      const t = normX * cyclesShown - this.phaseOffset;
      let sum = 0;
      for (let n = 1; n <= FourierSynthEngine.NUM_HARMONICS; n++) {
        const a = amps[n];
        if (a > 0.001) {
          const s = signs[n] < 0 ? -1 : 1;
          sum += s * a * Math.sin(2 * Math.PI * n * t);
        }
      }
      sumSamples[i] = sum;
      if (Math.abs(sum) > peakSum) {
        peakSum = Math.abs(sum);
      }
    }

    const scaleFactor = this.autoNormalizeScope
      ? (peakSum > 1.0 ? 1.0 / peakSum : 1.0)
      : 0.45;
    const maxRadiusY = (plotH / 2) * 0.84;

    // 1. Draw Individual Harmonic Traces (Decomposition)
    if (this.showDecomposition) {
      for (let n = 1; n <= FourierSynthEngine.NUM_HARMONICS; n++) {
        const a = amps[n];
        if (a <= 0.004) continue;

        const isHovered = this.hoveredHarmonic === n;
        const s = signs[n] < 0 ? -1 : 1;
        const color = HARMONIC_COLORS[n - 1];

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.globalAlpha = isHovered ? 0.92 : (this.hoveredHarmonic !== null ? 0.14 : 0.34);
        ctx.lineWidth = isHovered ? 2.2 : 1.15;

        if (isHovered) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
        }

        for (let i = 0; i <= numSamples; i++) {
          const normX = i / numSamples;
          const t = normX * cyclesShown - this.phaseOffset;
          const val = s * a * Math.sin(2 * Math.PI * n * t) * scaleFactor;
          const px = plotX + normX * plotW;
          const py = centerY - val * maxRadiusY;

          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Draw Resultant Summed Waveform (Thick, bright phosphor trace with shadowBlur)
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = '#00ff9d';
    ctx.lineWidth = 2.8;
    ctx.shadowColor = '#00ff9d';
    ctx.shadowBlur = 14;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i <= numSamples; i++) {
      const normX = i / numSamples;
      const val = sumSamples[i] * scaleFactor;
      const px = plotX + normX * plotW;
      const py = centerY - val * maxRadiusY;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Inner bright core for authentic CRT phosphor bloom
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#d8fff0';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();

    // If a harmonic is hovered, display a floating telemetry tag on the top-left of the scope
    if (this.hoveredHarmonic !== null) {
      const n = this.hoveredHarmonic;
      const a = amps[n];
      const s = signs[n] < 0 ? '-' : '+';
      const freq = Math.round(n * this.engine.getFundamentalFrequency());
      const badgeText = `ARMÓNICO n=${n} (${HARMONIC_INTERVAL_LABELS[n - 1]}) | ${freq} Hz | A${n} = ${s}${a.toFixed(2)}`;

      ctx.save();
      ctx.font = '600 11px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(badgeText).width;
      ctx.fillStyle = 'rgba(10, 15, 13, 0.88)';
      ctx.strokeStyle = HARMONIC_COLORS[n - 1];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(plotX + 8, plotY + 8, textWidth + 18, 24, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = HARMONIC_COLORS[n - 1];
      ctx.textAlign = 'left';
      ctx.fillText(badgeText, plotX + 17, plotY + 24);
      ctx.restore();
    }
  }

  private drawScopeGrid(
    ctx: CanvasRenderingContext2D,
    plotX: number,
    plotY: number,
    plotW: number,
    plotH: number,
    centerY: number
  ): void {
    ctx.save();
    // Outer frame
    ctx.strokeStyle = '#1b2e26';
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, plotY, plotW, plotH);

    // Horizontal subdivisions
    const hRows = 4;
    for (let r = 1; r < hRows; r++) {
      const ry = plotY + (plotH / hRows) * r;
      ctx.beginPath();
      ctx.strokeStyle = r === 2 ? '#29473b' : '#13211b';
      ctx.setLineDash(r === 2 ? [] : [3, 4]);
      ctx.moveTo(plotX, ry);
      ctx.lineTo(plotX + plotW, ry);
      ctx.stroke();
    }

    // Vertical phase subdivisions (8 subdivisions)
    const vCols = 8;
    for (let c = 1; c < vCols; c++) {
      const cx = plotX + (plotW / vCols) * c;
      ctx.beginPath();
      ctx.strokeStyle = c === 4 ? '#233d33' : '#13211b';
      ctx.setLineDash([3, 4]);
      ctx.moveTo(cx, plotY);
      ctx.lineTo(cx, plotY + plotH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Y-axis labels (+1.0, 0.0, -1.0)
    ctx.fillStyle = '#5c7d6e';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('+1.0', plotX - 8, plotY + 10);
    ctx.fillText(' 0.0', plotX - 8, centerY + 3);
    ctx.fillText('-1.0', plotX - 8, plotY + plotH - 3);

    // Phase markers along bottom of scope
    ctx.textAlign = 'center';
    const isSinglePeriod = this.timeMode === 'static';
    const labels = isSinglePeriod
      ? ['0', 'T/4', 'T/2', '3T/4', 'T₀']
      : ['0', 'T/2', 'T₀', '3T/2', '2T₀'];

    for (let i = 0; i < labels.length; i++) {
      const lx = plotX + (plotW * i) / (labels.length - 1);
      ctx.fillText(labels[i], lx, plotY + plotH + 15);
    }

    ctx.restore();
  }

  private drawDivider(ctx: CanvasRenderingContext2D, y: number, w: number): void {
    ctx.save();
    ctx.strokeStyle = '#1f332b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * PANEL 2: Frequency Domain Interactive Harmonic Analyzer (Bars A1..A8)
   */
  private drawFrequencyDomainPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const padLeft = 52;
    const padRight = 24;
    const padTop = 36;
    const padBottom = 56;

    const plotX = x + padLeft;
    const plotY = y + padTop;
    const plotW = Math.max(100, w - padLeft - padRight);
    const plotH = Math.max(80, h - padTop - padBottom);

    // Header
    ctx.fillStyle = '#ffb300';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('DOMINIO DE LA FRECUENCIA // ANALIZADOR ESPECTRAL INTERACTIVO (A₁ – A₈)', plotX, y + 20);

    ctx.fillStyle = '#739686';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('ARRASTRA LAS BARRAS (0.00–1.00) · CLIC EN [±] PARA INVERTIR FASE', plotX + plotW, y + 20);

    // Background Grid for Spectrum
    ctx.save();
    ctx.strokeStyle = '#1b2e26';
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, plotY, plotW, plotH);

    const gridLevels = [1.0, 0.75, 0.5, 0.25, 0.0];
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#5c7d6e';
    ctx.textAlign = 'right';

    for (const lvl of gridLevels) {
      const gy = plotY + plotH * (1 - lvl);
      if (lvl > 0 && lvl < 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#13211b';
        ctx.setLineDash([3, 4]);
        ctx.moveTo(plotX, gy);
        ctx.lineTo(plotX + plotW, gy);
        ctx.stroke();
      }
      ctx.fillText(lvl.toFixed(2), plotX - 8, gy + 3);
    }
    ctx.setLineDash([]);
    ctx.restore();

    // Calculate and draw each Harmonic Bar (n = 1..8)
    const numBars = FourierSynthEngine.NUM_HARMONICS;
    const slotWidth = plotW / numBars;
    const barWidth = Math.min(54, Math.max(24, slotWidth * 0.52));

    const amps = this.engine.getAmplitudes();
    const signs = this.engine.getSigns();
    const f0 = this.engine.getFundamentalFrequency();

    this.barRects = [];

    for (let n = 1; n <= numBars; n++) {
      const amp = amps[n];
      const sign = signs[n] < 0 ? -1 : 1;
      const color = HARMONIC_COLORS[n - 1];
      const isHovered = this.hoveredHarmonic === n || this.draggingHarmonic === n;

      const slotX = plotX + (n - 1) * slotWidth;
      const bx = slotX + (slotWidth - barWidth) / 2;
      const by = plotY;
      const bh = plotH;
      const filledH = Math.max(2, amp * bh);
      const fillTopY = by + bh - filledH;

      // Polarity toggle badge rect at bottom under label
      const badgeW = 36;
      const badgeH = 16;
      const badgeX = slotX + (slotWidth - badgeW) / 2;
      const badgeY = by + bh + 34;

      this.barRects.push({
        index: n,
        x: bx,
        y: by,
        w: barWidth,
        h: bh,
        polarityBadgeRect: { x: badgeX, y: badgeY, w: badgeW, h: badgeH }
      });

      // Empty bar track slot
      ctx.save();
      ctx.fillStyle = isHovered ? '#15251f' : '#0e1814';
      ctx.strokeStyle = isHovered ? color : '#1d3028';
      ctx.lineWidth = isHovered ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, barWidth, bh, 4);
      ctx.fill();
      ctx.stroke();

      // Active harmonic amplitude fill
      if (amp > 0.002) {
        const grad = ctx.createLinearGradient(0, fillTopY, 0, by + bh);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0, 255, 157, 0.12)');

        ctx.fillStyle = grad;
        if (isHovered) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
        }
        ctx.beginPath();
        ctx.roundRect(bx + 2, fillTopY, barWidth - 4, filledH, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draggable thumb cap at top of bar
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx + 2, fillTopY - 2, barWidth - 4, 4);

      // Numeric amplitude readout above thumb
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillStyle = isHovered ? '#ffffff' : color;
      ctx.textAlign = 'center';
      const valText = `${sign < 0 ? '-' : ''}${amp.toFixed(2)}`;
      const labelY = Math.max(plotY + 13, fillTopY - 7);
      ctx.fillText(valText, bx + barWidth / 2, labelY);

      // Bottom Labels: A_n & n*f0 + Hz
      const centerX = slotX + slotWidth / 2;
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = n === 1 ? '#00ff9d' : '#d5e8df';
      ctx.fillText(n === 1 ? '1f₀ (Fund.)' : `${n}f₀ (A${n})`, centerX, by + bh + 15);

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#739686';
      ctx.fillText(`${Math.round(n * f0)} Hz`, centerX, by + bh + 28);

      // Polarity pill [ +SEN ] or [ -SEN ]
      ctx.fillStyle = sign < 0 ? 'rgba(255, 179, 0, 0.18)' : 'rgba(0, 255, 157, 0.10)';
      ctx.strokeStyle = sign < 0 ? '#ffb300' : '#244236';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
      ctx.fill();
      ctx.stroke();

      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.fillStyle = sign < 0 ? '#ffb300' : '#00ff9d';
      ctx.fillText(sign < 0 ? '−FASE' : '+FASE', centerX, badgeY + 11);

      ctx.restore();
    }
  }
}
