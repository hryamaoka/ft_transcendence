// Tiny procedural chiptune per phase, built with the Web Audio API (no audio files).
// The AudioContext is created on first user click to satisfy browser autoplay rules.

const THEMES = {
  night: { bpm: 70, wave: 'triangle', notes: [45, 48, 52, 48, 45, 43, 47, 43], bass: 33 },
  day: { bpm: 112, wave: 'square', notes: [60, 64, 67, 72, 67, 64, 62, 65], bass: 48 },
  vote: { bpm: 150, wave: 'sawtooth', notes: [57, 57, 60, 57, 63, 57, 62, 60], bass: 45 },
  ended: { bpm: 96, wave: 'square', notes: [72, 67, 64, 60, 64, 67, 72, 0], bass: 48 },
};

const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);

let ctx = null;
let master = null;
let timer = null;
let current = null;

function note(midi, wave, start, length, volume) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = freq(midi);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + length);
}

function schedule(theme) {
  const step = 60 / theme.bpm / 2;
  let t = ctx.currentTime + 0.05;
  let i = 0;
  // schedule a little ahead of time so playback stays smooth
  timer = setInterval(() => {
    while (t < ctx.currentTime + 0.3) {
      const n = theme.notes[i % theme.notes.length];
      if (n) note(n, theme.wave, t, step * 0.9, 0.08);
      if (i % 4 === 0) note(theme.bass, 'sine', t, step * 3, 0.15);
      t += step;
      i++;
    }
  }, 50);
}

export function playTheme(phase) {
  if (phase === 'runoff') phase = 'vote';
  if (!ctx || phase === current) return;
  clearInterval(timer);
  current = phase;
  if (THEMES[phase]) schedule(THEMES[phase]);
}

// Call from a click handler. Returns the new muted state.
export function toggleMusic(phase) {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    playTheme(phase);
    return false;
  }
  if (ctx.state === 'running') {
    ctx.suspend();
    return true;
  }
  ctx.resume();
  return false;
}

export function stopMusic() {
  clearInterval(timer);
  current = null;
  ctx?.close();
  ctx = null;
}

// Short sound effects for announcements; silent unless music was turned on.
const SFX = {
  // drum roll then a low hit
  execute: [...Array(10)].map((_, i) => [40 + (i % 2), 'triangle', i * 0.12, 0.1, 0.12]).concat([[28, 'sawtooth', 1.35, 1.2, 0.25], [35, 'square', 1.35, 0.8, 0.1]]),
  morning: [[72, 'sine', 0, 0.5, 0.12], [76, 'sine', 0.2, 0.5, 0.12], [79, 'sine', 0.4, 0.9, 0.12]],
  death: [[52, 'triangle', 0, 0.5, 0.15], [48, 'triangle', 0.35, 0.5, 0.15], [44, 'triangle', 0.7, 1.2, 0.15]],
  // rising, unresolved notes for a tied vote
  tie: [[45, 'sawtooth', 0, 0.3, 0.1], [48, 'sawtooth', 0.3, 0.3, 0.1], [51, 'sawtooth', 0.6, 0.3, 0.1], [54, 'sawtooth', 0.9, 1.4, 0.12], [30, 'sine', 0.9, 1.6, 0.2]],
  win: [[60, 'square', 0, 0.2, 0.1], [64, 'square', 0.15, 0.2, 0.1], [67, 'square', 0.3, 0.2, 0.1], [72, 'square', 0.45, 0.8, 0.12]],
  // one short blip per second in the last seconds of a phase
  tick: [[84, 'square', 0, 0.05, 0.06]],
};

export function playSfx(name) {
  if (!ctx || ctx.state !== 'running' || !SFX[name]) return;
  const t = ctx.currentTime + 0.05;
  for (const [midi, wave, at, length, volume] of SFX[name]) note(midi, wave, t + at, length, volume);
}
