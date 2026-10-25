import './style.css';
import { FourierSynthEngine } from './audio/FourierSynthEngine';
import { SpectrumRenderer } from './graphics/SpectrumRenderer';
import { PresetManager } from './ui/PresetManager';
import { Controls } from './ui/Controls';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('spectrum-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Elemento #spectrum-canvas no encontrado en el DOM.');
  }

  const engine = new FourierSynthEngine();
  const presetManager = new PresetManager();

  let controls: Controls;

  const renderer = new SpectrumRenderer(canvas, engine, {
    onHarmonicChange: (index: number, newAmplitude: number) => {
      presetManager.setCurrentPresetId('custom');
      engine.setHarmonicAmplitude(index, newAmplitude);
      controls.syncAllUI();
    },
    onPolarityToggle: (index: number) => {
      presetManager.setCurrentPresetId('custom');
      engine.toggleHarmonicSign(index);
      controls.syncAllUI();
    }
  });

  controls = new Controls(engine, renderer, presetManager);
  controls.init();

  // Start high-DPI dual domain rendering loop
  renderer.start();
});
