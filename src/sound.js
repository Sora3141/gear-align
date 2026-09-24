// 小さな効果音。音声ファイルは持たず WebAudio で作る。
const KEY = 'gear-align:sound';
let ctx = null;
let on = (() => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } })();
setAudioSession(on);

// iPhone のマナーモードでも鳴らす（Safari 16.4 以降）。
// 'playback' にすると音楽アプリの曲が止まるので、音がオンのときだけにする。
function setAudioSession(soundOn) {
  try { if (navigator.audioSession) navigator.audioSession.type = soundOn ? 'playback' : 'auto'; } catch { /* 対応していない */ }
}

export function setEnabled(v) {
  on = v;
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* 保存できなくても続行 */ }
  setAudioSession(v);
}
export function isEnabled() { return on; }

// 音は操作のたびに鳴るので、ここで作る・再開する（ブラウザは触る前の音を止める）。
function audio() {
  if (!on) return null;
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; setAudioSession(true); ctx = new C(); }
  if (ctx.state === 'suspended') { setAudioSession(true); ctx.resume(); }
  return ctx;
}

function blip({ freq = 420, to = null, dur = 0.09, type = 'triangle', gain = 0.05, delay = 0 }) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

// 歯が 1 枚送られるたびのカチッ。送り歯数ぶん細かく鳴らす。
export const tick = (teethMoved = 1) => {
  const count = Math.min(teethMoved, 6);
  for (let i = 0; i < count; i++) blip({ freq: 1200, to: 700, dur: 0.035, type: 'square', gain: 0.022, delay: i * 0.035 });
};
export const lift = () => blip({ freq: 300, to: 520, dur: 0.12, gain: 0.05 });
export const drop = () => blip({ freq: 520, to: 260, dur: 0.12, gain: 0.05 });
export const undo = () => blip({ freq: 360, to: 240, dur: 0.1, type: 'sine', gain: 0.05 });
export const win = () => {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    blip({ freq: f, dur: 0.3, type: 'sine', gain: 0.07, delay: i * 0.1 }));
};
