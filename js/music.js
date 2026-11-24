// Teoría, canciones de ejemplo y exportación (MIDI / WAV).
import { INSTRUMENTS, makeBus, channel, voice } from './audio.js';

export const SOLFEO = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
export const LETRAS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const isBlack = (m) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
export const pc = (m) => ((m % 12) + 12) % 12;
// Colores de las notas (arcoíris, igual en todas las vistas)
export const NOTE_COLORS = ['#ff5252', '#ff7a45', '#ffa53a', '#ffcc33', '#c6dc3a', '#55cf6a', '#2fc4a0', '#29b6e8', '#4d7cfe', '#7b61ff', '#b25cf0', '#ec5bc4'];
export const PRINCESS_COLORS = ['#ff8fb8', '#ffa0a0', '#ffb88a', '#ffd46b', '#d7e27a', '#9be3a6', '#7fdcc9', '#8fd3f2', '#a3b5ff', '#c3a8ff', '#dba4f5', '#f7a3dd'];

export function noteName(m, mode = 'solfeo', octave = true) {
  const n = (mode === 'letras' ? LETRAS : SOLFEO)[pc(m)];
  return octave ? n + (Math.floor(m / 12) - 1) : n;
}

export const barSteps = (s) => s.num * (16 / s.den);
export const totalSteps = (s) => s.bars * barSteps(s);
export const beatSteps = (s) => (s.den === 8 ? 2 : 4);
export const stepDur = (s) => 60 / s.bpm / 4; // semicorchea

export const METERS = [[2, 4], [3, 4], [4, 4], [5, 4], [6, 8], [7, 8], [12, 8]];

// ---------- Acordes ----------
export const GUITAR_CHORDS = [
  { n: 'Do', root: 0, notes: [48, 52, 55, 60, 64] },
  { n: 'Re', root: 2, notes: [50, 57, 62, 66] },
  { n: 'Rem', root: 2, notes: [50, 57, 62, 65] },
  { n: 'Mi', root: 4, notes: [40, 47, 52, 56, 59, 64] },
  { n: 'Mim', root: 4, notes: [40, 47, 52, 55, 59, 64] },
  { n: 'Fa', root: 5, notes: [41, 48, 53, 57, 60, 65] },
  { n: 'Sol', root: 7, notes: [43, 47, 50, 55, 59, 67] },
  { n: 'Sol7', root: 7, notes: [43, 47, 50, 55, 59, 65] },
  { n: 'La', root: 9, notes: [45, 52, 57, 61, 64] },
  { n: 'Lam', root: 9, notes: [45, 52, 57, 60, 64] },
  { n: 'Si7', root: 11, notes: [47, 51, 57, 59, 66] },
];
export const CHORD_KINDS = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10] };
export function chordNotes(root, kind, base = 48) {
  const r = base + ((root - base) % 12 + 12) % 12;
  return CHORD_KINDS[kind].map((i) => r + i);
}
export const SIMPLE_CHORDS = [['Do', 0, ''], ['Rem', 2, 'm'], ['Mim', 4, 'm'], ['Fa', 5, ''], ['Sol', 7, ''], ['Lam', 9, 'm'], ['Sol7', 7, '7'], ['Re', 2, ''], ['Mi', 4, ''], ['La', 9, '']];
export function chordLabel(name, mode) {
  if (mode !== 'letras') return name.replace(/m$/, ' m');
  const map = { Do: 'C', Re: 'D', Mi: 'E', Fa: 'F', Sol: 'G', La: 'A', Si: 'B' };
  return name.replace(/^(Do|Re|Mi|Fa|Sol|La|Si)/, (x) => map[x]);
}

// ---------- Canciones ----------
let uid = 1;
export const newId = () => 't' + Date.now().toString(36) + (uid++);
export function newTrack(inst) { return { id: newId(), inst, vol: inst === 'bateria' ? 0.85 : 0.8, mute: false, solo: false, notes: [] }; }
export function newSong(name = 'Canción nueva') {
  return { v: 1, id: 's' + Date.now().toString(36), name, bpm: 100, num: 4, den: 4, bars: 4, tracks: [newTrack('piano'), newTrack('bateria')] };
}

// "C4:4 D4:2 R:4" -> notas (R = silencio). Duración en semicorcheas.
const L = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function parse(str, start = 0, vel = 0.85) {
  const out = []; let s = start;
  for (const tok of str.trim().split(/\s+/)) {
    const [n, d] = tok.split(':'); const dur = +d;
    if (n !== 'R') for (const p of n.split('+')) {
      const mm = p.match(/^([A-G])(#|b)?(-?\d)$/);
      const m = L[mm[1]] + (mm[2] === '#' ? 1 : mm[2] === 'b' ? -1 : 0) + (+mm[3] + 1) * 12;
      out.push({ p: m, s, d: dur, v: vel });
    }
    s += dur;
  }
  return out;
}
function drums(map, bars, len = 16) {
  const out = [];
  for (let b = 0; b < bars; b++) for (const [id, pat] of Object.entries(map)) {
    const steps = pat.replace(/\s/g, '');
    for (let i = 0; i < steps.length; i++) {
      const ch = steps[i]; if (ch === '.' || ch === '-') continue;
      out.push({ p: +id, s: b * len + i * (len / steps.length), d: 1, v: ch === 'X' ? 1 : ch === 'x' ? 0.75 : 0.5 });
    }
  }
  return out;
}

export function demos() {
  const est = newSong('Estrellita ⭐');
  est.bpm = 96; est.bars = 12;
  const melody = 'C5:4 C5:4 G5:4 G5:4 A5:4 A5:4 G5:8 F5:4 F5:4 E5:4 E5:4 D5:4 D5:4 C5:8 ' +
    'G5:4 G5:4 F5:4 F5:4 E5:4 E5:4 D5:8 G5:4 G5:4 F5:4 F5:4 E5:4 E5:4 D5:8 ' +
    'C5:4 C5:4 G5:4 G5:4 A5:4 A5:4 G5:8 F5:4 F5:4 E5:4 E5:4 D5:4 D5:4 C5:8';
  const bass = 'C3:8 E3:8 F3:8 C3:8 F3:8 C3:8 G3:8 C3:8 C3:8 F3:8 C3:8 G3:8 C3:8 F3:8 C3:8 G3:8 C3:8 E3:8 F3:8 C3:8 F3:8 C3:8 G3:8 C3:8';
  const t1 = newTrack('flauta'); t1.notes = parse(melody);
  const t2 = newTrack('arpa'); t2.notes = parse(bass, 0, 0.7); t2.vol = 0.7;
  const t3 = newTrack('bateria'); t3.notes = drums({ 36: 'X...x...', 75: '..x...x.', 81: 'x.......' }, 12); t3.vol = 0.6;
  est.tracks = [t1, t2, t3];

  const cum = newSong('Cumbia del patio 🌴');
  cum.bpm = 98; cum.bars = 4;
  const c1 = newTrack('bateria');
  c1.notes = drums({ 36: 'X.......X.......', 70: 'x.xXx.xXx.xXx.xX', 37: '....X.......X...', 63: '..x...x...x.x.x.', 64: 'X.......X.......', 76: '......x.......x.' }, 4);
  const c2 = newTrack('bajo');
  c2.notes = parse('A2:6 E2:2 A2:4 E2:4 D2:6 A2:2 D2:4 A2:4 E2:6 B2:2 E2:4 B2:4 A2:6 E2:2 A2:4 C3:4');
  const c3 = newTrack('acordeon');
  c3.notes = parse('R:2 A4+C5+E5:2 R:2 A4+C5+E5:2 R:2 A4+C5+E5:2 R:2 A4+C5+E5:2 R:2 A4+D5+F5:2 R:2 A4+D5+F5:2 R:2 A4+D5+F5:2 R:2 A4+D5+F5:2 ' +
    'R:2 G#4+B4+E5:2 R:2 G#4+B4+E5:2 R:2 G#4+B4+E5:2 R:2 G#4+B4+E5:2 E5:2 D5:2 C5:2 B4:2 A4:4 R:4', 0, 0.7);
  c3.vol = 0.6;
  cum.tracks = [c1, c2, c3];

  const tango = newSong('Tanguito 🌹');
  tango.bpm = 116; tango.bars = 4;
  const g1 = newTrack('bandoneon');
  g1.notes = parse('A4:3 B4:1 C5:4 E5:4 D5:4 C5:3 B4:1 A4:4 G#4:4 B4:4 F5:6 E5:2 D5:4 C5:4 B4:8 A4:4 C5:4 E5:4 A5:8 R:4');
  const g2 = newTrack('piano');
  g2.notes = parse('A2+A3:2 R:2 E3:2 R:2 A2+A3:2 R:2 E3:2 R:2 D3+D4:2 R:2 A2:2 R:2 E3+E4:2 R:2 G#3:2 R:2 E2+E3:2 R:2 B2:2 R:2 E2+E3:2 R:2 G#2:2 R:2 A2+A3:2 R:2 E3:2 R:2 A2+A3:2 R:1 A2:1 A2:4', 0, 0.75);
  g2.vol = 0.65;
  const g3 = newTrack('bateria'); g3.notes = drums({ 36: 'X...X...X...X...', 76: '..x...x...x.x.x.' }, 4); g3.vol = 0.45;
  tango.tracks = [g1, g2, g3];

  const rock = newSong('Rock de la cocina 🎸');
  rock.bpm = 120; rock.bars = 4;
  const r1 = newTrack('bateria');
  r1.notes = drums({ 36: 'X.....X.X.......', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.' }, 3)
    .concat(drums({ 36: 'X.....X.X.......', 38: '....X...X.X.XXXX', 49: '' }, 1).map((n) => ({ ...n, s: n.s + 48 })))
    .concat([{ p: 49, s: 0, d: 1, v: 1 }]);
  const r2 = newTrack('bajo');
  r2.notes = parse('E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 G2:2 A2:2 C3:2 C3:2 C3:2 C3:2 D3:2 D3:2 D3:2 D3:2 E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 G2:2 A2:2 C3:2 C3:2 D3:2 D3:2 E3:4 R:4');
  const r3 = newTrack('guitarra');
  r3.notes = parse('E3+B3+E4:6 E3+B3+E4:2 R:4 G3+D4+G4:2 A3+E4+A4:2 C3+G3+C4:8 D3+A3+D4:8 E3+B3+E4:6 E3+B3+E4:2 R:4 G3+D4+G4:2 A3+E4+A4:2 C3+G3+C4:4 D3+A3+D4:4 E3+B3+E4:8', 0, 0.8);
  rock.tracks = [r1, r2, r3];

  return [est, cum, tango, rock];
}

export function cleanSong(s) {
  const out = JSON.parse(JSON.stringify(s));
  out.tracks = out.tracks.filter((t) => INSTRUMENTS[t.inst]);
  for (const t of out.tracks) t.notes = (t.notes || []).filter((n) => n.d > 0 && n.s >= 0);
  return out;
}

// ---------- MIDI ----------
function vlq(n) { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; }
function chunk(id, data) { const l = data.length; return [...id].map((c) => c.charCodeAt(0)).concat([l >>> 24, (l >> 16) & 255, (l >> 8) & 255, l & 255], data); }
function str(s) { return [...new TextEncoder().encode(s)]; }

export function toMidi(song) {
  const TPQ = 480, ST = TPQ / 4;
  const tempo = Math.round(60000000 / song.bpm);
  const t0 = [0, 0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255,
    0, 0xff, 0x58, 4, song.num, Math.log2(song.den), 24, 8,
    0, 0xff, 0x03, ...vlq(str(song.name).length), ...str(song.name), 0, 0xff, 0x2f, 0];
  const chunks = [chunk('MTrk', t0)];
  let chan = 0;
  for (const tr of song.tracks) {
    const inst = INSTRUMENTS[tr.inst];
    let ch = 9;
    if (!inst.drums) { ch = chan++ % 15; if (ch >= 9) ch++; }
    const ev = [];
    for (const n of tr.notes) {
      const vel = Math.max(1, Math.round((n.v ?? 0.85) * 127 * (tr.vol ?? 0.8) / 0.8));
      ev.push({ t: n.s * ST, on: 1, p: n.p, vel: Math.min(127, vel) });
      ev.push({ t: (n.s + n.d) * ST - 1, on: 0, p: n.p });
    }
    ev.sort((a, b) => a.t - b.t || a.on - b.on);
    const name = str(inst.name);
    const d = [0, 0xff, 0x03, ...vlq(name.length), ...name];
    if (!inst.drums) d.push(0, 0xc0 | ch, inst.gm);
    let last = 0;
    for (const e of ev) {
      d.push(...vlq(Math.max(0, e.t - last)), (e.on ? 0x90 : 0x80) | ch, e.p, e.on ? e.vel : 0);
      last = Math.max(last, e.t);
    }
    d.push(0, 0xff, 0x2f, 0);
    chunks.push(chunk('MTrk', d));
  }
  const head = chunk('MThd', [0, 1, 0, chunks.length, TPQ >> 8, TPQ & 255]);
  return new Uint8Array(head.concat(...chunks));
}

// ---------- WAV ----------
export async function renderWav(song, times = 2) {
  const sr = 44100, sd = stepDur(song), len = totalSteps(song) * sd;
  const dur = len * times + 2.5;
  const oc = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
  const b = makeBus(oc, oc.destination);
  const solo = song.tracks.some((t) => t.solo);
  for (let k = 0; k < times; k++) for (const tr of song.tracks) {
    if (tr.mute || (solo && !tr.solo)) continue;
    const out = channel(b, tr);
    for (const n of tr.notes) {
      const t = 0.05 + k * len + n.s * sd;
      voice(oc, out, tr.inst, n.p, t, n.v ?? 0.85).stop(t + n.d * sd);
    }
  }
  const buf = await oc.startRendering();
  return encodeWav(buf);
}
function encodeWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, buf.sampleRate, true); data.setUint32(28, buf.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const chans = [...Array(ch)].map((_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([data], { type: 'audio/wav' });
}
