import { state } from './state.js';

const soundMap = {
  hover: [680, 0.03, 'sine', 0.03],
  select: [420, 0.11, 'triangle', 0.08],
  back: [240, 0.12, 'sawtooth', 0.05],
  reset: [180, 0.16, 'square', 0.04]
};

export async function initAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!state.audioContext) state.audioContext = new AudioContext();
  if (state.audioContext.state === 'suspended') await state.audioContext.resume();
}

export function playSound(name) {
  const context = state.audioContext;
  const config = soundMap[name];
  if (!context || !config) return;

  const [frequency, duration, type, gainValue] = config;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.type = type;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(gainValue, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}
