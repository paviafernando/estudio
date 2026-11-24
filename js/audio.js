// Motor de sonido del Estudio Mágico: todos los instrumentos están sintetizados
// (no hay archivos de audio), así funciona sin internet y se puede exportar a WAV.

export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------- Instrumentos ----------
export const INSTRUMENTS = {
  piano:     { name: 'Teclado',    icon: '🎹', color: '#4d7cfe', range: [36, 96], view: 'keys',   gm: 0,  rev: .18 },
  guitarra:  { name: 'Guitarra',   icon: '🎸', color: '#f0a030', range: [40, 86], view: 'frets',  gm: 24, rev: .2, strings: [64, 59, 55, 50, 45, 40], frets: 15 },
  bajo:      { name: 'Bajo',       icon: '🎸', color: '#9b59ff', range: [28, 67], view: 'frets',  gm: 33, rev: .06, strings: [43, 38, 33, 28], frets: 15, clef: 'bass' },
  bateria:   { name: 'Batería',    icon: '🥁', color: '#ff5d6c', view: 'drums',   gm: 0, drums: true, rev: .12 },
  arpa:      { name: 'Arpa',       icon: 'svg:arpa', color: '#35c4b5', range: [36, 91], view: 'harp', gm: 46, rev: .32 },
  armonica:  { name: 'Armónica',   icon: 'svg:armonica', color: '#8a9bb3', range: [60, 93], view: 'harmonica', gm: 22, rev: .16 },
  bandoneon: { name: 'Bandoneón',  icon: 'svg:bandoneon', color: '#c0563f', range: [43, 88], view: 'bando', gm: 23, rev: .22 },
  acordeon:  { name: 'Acordeón',   icon: '🪗', color: '#e8447a', range: [48, 89], view: 'accordion', gm: 21, rev: .18 },
  flauta:    { name: 'Flauta traversa', short: 'Flauta', icon: '🪈', color: '#6ccf5f', range: [60, 96], view: 'flute', gm: 73, rev: .3 },
};
export const INST_ORDER = ['piano', 'guitarra', 'bajo', 'bateria', 'arpa', 'armonica', 'bandoneon', 'acordeon', 'flauta'];

// Batería y percusión (números General MIDI, sirven para exportar a MIDI)
export const DRUMS = [
  { id: 49, n: 'Platillo', e: '💫', g: 'kit' },
  { id: 51, n: 'Ride', e: '🌀', g: 'kit' },
  { id: 46, n: 'Charles abierto', short: 'Charles ab.', e: '🔆', g: 'kit' },
  { id: 42, n: 'Charles', e: '✴️', g: 'kit' },
  { id: 50, n: 'Tom agudo', e: '🟠', g: 'kit' },
  { id: 47, n: 'Tom medio', e: '🟤', g: 'kit' },
  { id: 43, n: 'Tom de piso', short: 'Tom piso', e: '⚫', g: 'kit' },
  { id: 38, n: 'Redoblante', e: '🥁', g: 'kit' },
  { id: 37, n: 'Aro', e: '⭕', g: 'kit' },
  { id: 36, n: 'Bombo', e: '💥', g: 'kit' },
  { id: 39, n: 'Aplauso', e: '👏', g: 'perc' },
  { id: 54, n: 'Pandereta', e: '🎊', g: 'perc' },
  { id: 70, n: 'Maracas', e: '🪇', g: 'perc' },
  { id: 56, n: 'Cencerro', e: '🐄', g: 'perc' },
  { id: 63, n: 'Conga aguda', short: 'Conga ag.', e: '🪘', g: 'perc' },
  { id: 64, n: 'Conga grave', short: 'Conga gr.', e: '🪘', g: 'perc' },
  { id: 60, n: 'Bongó agudo', short: 'Bongó ag.', e: '🥥', g: 'perc' },
  { id: 61, n: 'Bongó grave', short: 'Bongó gr.', e: '🥥', g: 'perc' },
  { id: 76, n: 'Taco de madera', short: 'Taco', e: '🪵', g: 'perc' },
  { id: 75, n: 'Claves', e: '🥢', g: 'perc' },
  { id: 81, n: 'Triángulo', e: '🔺', g: 'perc' },
];
export const DRUM_BY_ID = Object.fromEntries(DRUMS.map((d) => [d.id, d]));

// ---------- Contexto y mezcla ----------
let ctx = null;
let bus = null;
const channels = new Map(); // trackId -> {gain, pan}

export function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    bus = makeBus(ctx, ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export const now = () => (ctx ? ctx.currentTime : 0);
export const masterBus = () => (audioCtx(), bus);

function impulse(c, secs, decay) {
  const len = Math.floor(c.sampleRate * secs);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

export function makeBus(c, dest) {
  const master = c.createGain(); master.gain.value = 0.9;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  const dry = c.createGain();
  const rev = c.createGain(); rev.gain.value = 1;
  const conv = c.createConvolver(); conv.buffer = impulse(c, 2.4, 2.6);
  const revOut = c.createGain(); revOut.gain.value = 0.5;
  dry.connect(comp); rev.connect(conv); conv.connect(revOut); revOut.connect(comp);
  comp.connect(master); master.connect(dest);
  const metro = c.createGain(); metro.gain.value = 0.5; metro.connect(dest);
  return { c, dry, rev, master, metro, ch: new Map() };
}

// Canal por pista (volumen + envío a reverb)
export function channel(b, track) {
  let ch = b.ch.get(track.id);
  if (!ch) {
    const c = b.c;
    const g = c.createGain();
    const send = c.createGain();
    g.connect(b.dry); g.connect(send); send.connect(b.rev);
    ch = { g, send };
    b.ch.set(track.id, ch);
  }
  const inst = INSTRUMENTS[track.inst];
  ch.g.gain.value = track.vol ?? 0.8;
  ch.send.gain.value = inst ? inst.rev : 0.15;
  return ch.g;
}
export function setMasterVolume(v) { if (bus) bus.master.gain.value = v; }
export function setMetroVolume(v) { if (bus) bus.metro.gain.value = v; }

// ---------- utilidades ----------
const noiseCache = new WeakMap();
function noise(c) {
  let b = noiseCache.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(c, b);
  }
  return b;
}
function noiseSrc(c, t) {
  const s = c.createBufferSource(); s.buffer = noise(c); s.loop = true;
  s.start(t, Math.random() * 1.5);
  return s;
}
const waveCache = new WeakMap();
function wave(c, kind) {
  let m = waveCache.get(c); if (!m) { m = {}; waveCache.set(c, m); }
  if (m[kind]) return m[kind];
  const H = {
    piano: [0, 1, 0.55, 0.32, 0.22, 0.12, 0.08, 0.05, 0.03, 0.02, 0.012],
    reed: [0, 1, 0.3, 0.75, 0.2, 0.5, 0.15, 0.35, 0.1, 0.22, 0.08, 0.14, 0.05, 0.08],
    harm: [0, 1, 0.85, 0.6, 0.45, 0.42, 0.3, 0.22, 0.18, 0.12, 0.08, 0.05],
    bando: [0, 1, 0.5, 0.6, 0.35, 0.4, 0.2, 0.22, 0.12, 0.1, 0.06],
  }[kind];
  const real = new Float32Array(H.length), imag = new Float32Array(H);
  m[kind] = c.createPeriodicWave(real, imag);
  return m[kind];
}
function release(param, t, tc) {
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
  else param.cancelScheduledValues(t);
  param.setTargetAtTime(0, t, tc);
}
function osc(c, type, f, t) {
  const o = c.createOscillator();
  if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
  o.frequency.value = f; o.start(t);
  return o;
}

// Karplus-Strong: cuerda pulsada (guitarra, bajo, arpa). Se cachea por nota.
const ksCache = new WeakMap();
function ks(c, m, kind) {
  let cache = ksCache.get(c); if (!cache) { cache = new Map(); ksCache.set(c, cache); }
  const key = kind + m;
  if (cache.has(key)) return cache.get(key);
  const sr = c.sampleRate, P = sr / hz(m), N = Math.max(2, Math.floor(P));
  const cfg = {
    guitarra: { dur: 3.2, rho: 0.9965, S: 0.5, smooth: 1, pos: 0.18 },
    bajo: { dur: 3.5, rho: 0.996, S: 0.5, smooth: 3, pos: 0.25 },
    arpa: { dur: 4.5, rho: 0.9985, S: 0.5, smooth: 2, pos: 0.5 },
  }[kind];
  const len = Math.floor(sr * cfg.dur);
  const buf = c.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const line = new Float32Array(N);
  for (let i = 0; i < N; i++) line[i] = Math.random() * 2 - 1;
  for (let p = 0; p < cfg.smooth; p++) for (let i = 0; i < N; i++) line[i] = (line[i] + line[(i + 1) % N]) / 2;
  // "punto de pulsado": restar una copia corrida le da el color de la cuerda
  const off = Math.max(1, Math.floor(N * cfg.pos)), ex = Float32Array.from(line);
  for (let i = 0; i < N; i++) line[i] = ex[i] - ex[(i + off) % N];
  let mean = 0; for (let i = 0; i < N; i++) mean += line[i]; mean /= N;
  let peak = 0; for (let i = 0; i < N; i++) { line[i] -= mean; peak = Math.max(peak, Math.abs(line[i])); }
  for (let i = 0; i < N; i++) line[i] /= peak || 1;
  // las notas agudas se apagan más rápido en la vida real, pero el promedio ya las apaga demasiado
  const rho = m > 76 ? Math.min(0.9995, cfg.rho + (m - 76) * 0.00025) : cfg.rho;
  let idx = 0;
  for (let n = 0; n < len; n++) {
    const a = line[idx], b = line[(idx + 1) % N];
    d[n] = a;
    line[idx] = rho * ((1 - cfg.S) * a + cfg.S * b);
    idx = (idx + 1) % N;
  }
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
  const res = { buf, rate: N / P, dur: cfg.dur };
  cache.set(key, res);
  return res;
}

// ---------- Voces ----------
// Cada voz: (c, out, m, t, vel) => { stop(t) }. "out" es el canal de la pista.

function vPiano(c, out, m, t, v) {
  const f = hz(m);
  const g = c.createGain();
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.3;
  lp.frequency.setValueAtTime(Math.min(15000, f * 10 + 1500), t);
  lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * 3 + 400), t + 1.5);
  const o1 = osc(c, wave(c, 'piano'), f, t);
  const o2 = osc(c, 'sine', f * 1.0015, t); // segunda cuerda apenas desafinada: coro
  const g2 = c.createGain(); g2.gain.value = 0.35;
  o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out);
  const decay = clamp(6 - (m - 36) * 0.075, 1.1, 6);
  const a = 0.42 * v;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(a, t + 0.005);
  g.gain.exponentialRampToValueAtTime(a * 0.4, t + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
  // golpe del martillo
  const n = noiseSrc(c, t), nb = c.createBiquadFilter(), ng = c.createGain();
  nb.type = 'bandpass'; nb.frequency.value = Math.min(8000, f * 4); nb.Q.value = 1;
  ng.gain.setValueAtTime(0.05 * v, t); ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.04);
  n.connect(nb); nb.connect(ng); ng.connect(out); n.stop(t + 0.06);
  const end = t + decay + 0.05; o1.stop(end); o2.stop(end);
  return { stop(t2) { if (t2 >= end) return; release(g.gain, t2, 0.09); o1.stop(t2 + 0.6); o2.stop(t2 + 0.6); } };
}

function vPluck(kind) {
  return (c, out, m, t, v) => {
    const k = ks(c, m, kind);
    const s = c.createBufferSource(); s.buffer = k.buf; s.playbackRate.value = k.rate;
    const g = c.createGain();
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = kind === 'bajo' ? 1400 : kind === 'arpa' ? 6000 : 5200;
    let last = lp;
    s.connect(lp);
    if (kind === 'guitarra') { // caja de resonancia
      const body = c.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 220; body.Q.value = 1.2; body.gain.value = 5;
      lp.connect(body); last = body;
    }
    if (kind === 'bajo') { // refuerzo de graves
      const sub = c.createBiquadFilter(); sub.type = 'lowshelf'; sub.frequency.value = 120; sub.gain.value = 6;
      lp.connect(sub); last = sub;
    }
    last.connect(g); g.connect(out);
    const a = (kind === 'bajo' ? 0.75 : kind === 'arpa' ? 0.5 : 0.55) * v;
    g.gain.setValueAtTime(a, t);
    s.start(t);
    const end = t + k.dur / k.rate;
    s.stop(end);
    const rel = kind === 'arpa' ? 0.7 : kind === 'bajo' ? 0.12 : 0.25;
    return { stop(t2) { if (t2 >= end) return; release(g.gain, t2, rel); s.stop(Math.min(end, t2 + rel * 6)); } };
  };
}

function vAccordion(c, out, m, t, v) {
  const f = hz(m), g = c.createGain(), lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = Math.min(5000, 1600 + f * 2); lp.Q.value = 0.7;
  const os = [0, 7, -7].map((cents) => { const o = osc(c, wave(c, 'reed'), f, t); o.detune.value = cents; o.connect(lp); return o; });
  lp.connect(g); g.connect(out);
  const a = 0.17 * v;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.035);
  return { stop(t2) { release(g.gain, t2, 0.04); os.forEach((o) => o.stop(t2 + 0.3)); } };
}

function vBandoneon(c, out, m, t, v) {
  const f = hz(m), g = c.createGain(), lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = Math.min(3200, 900 + f * 2.5); lp.Q.value = 1.2;
  const o1 = osc(c, wave(c, 'bando'), f, t); o1.detune.value = -3;
  const o2 = osc(c, wave(c, 'bando'), f * 2, t); o2.detune.value = 4; // lengüeta en octava
  const g2 = c.createGain(); g2.gain.value = 0.45;
  o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out);
  const a = 0.2 * v;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * 0.75, t + 0.06); g.gain.linearRampToValueAtTime(a, t + 0.35);
  return { stop(t2) { release(g.gain, t2, 0.05); o1.stop(t2 + 0.35); o2.stop(t2 + 0.35); } };
}

function vibrato(c, o, f, t, depthCents, rate, delay) {
  const lfo = c.createOscillator(); lfo.frequency.value = rate;
  const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depthCents, t + delay);
  lfo.connect(lg); lg.connect(o.detune); lfo.start(t);
  return lfo;
}

function vHarmonica(c, out, m, t, v) {
  const f = hz(m), g = c.createGain();
  const o = osc(c, wave(c, 'harm'), f, t);
  const bp = c.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 1300; bp.Q.value = 1.2; bp.gain.value = 7;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
  const lfo = vibrato(c, o, f, t, 14, 5.6, 0.35);
  o.connect(bp); bp.connect(lp); lp.connect(g);
  const n = noiseSrc(c, t), nb = c.createBiquadFilter(), ng = c.createGain();
  nb.type = 'bandpass'; nb.frequency.value = f * 2; nb.Q.value = 4; ng.gain.value = 0.25;
  n.connect(nb); nb.connect(ng); ng.connect(g);
  g.connect(out);
  const a = 0.2 * v;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.04);
  return { stop(t2) { release(g.gain, t2, 0.05); [o, lfo, n].forEach((x) => x.stop(t2 + 0.35)); } };
}

function vFlute(c, out, m, t, v) {
  const f = hz(m), g = c.createGain();
  const o1 = osc(c, 'sine', f, t), o2 = osc(c, 'sine', f * 2, t), o3 = osc(c, 'sine', f * 3, t);
  const g2 = c.createGain(); g2.gain.value = 0.18; const g3 = c.createGain(); g3.gain.value = 0.06;
  const lfo = c.createOscillator(); lfo.frequency.value = 5; const lg = c.createGain();
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(12, t + 0.45);
  lfo.connect(lg); lg.connect(o1.detune); lg.connect(o2.detune); lg.connect(o3.detune); lfo.start(t);
  o1.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g);
  // soplido
  const n = noiseSrc(c, t), nb = c.createBiquadFilter(), ng = c.createGain();
  nb.type = 'bandpass'; nb.frequency.value = Math.min(9000, f * 1.5); nb.Q.value = 1.5;
  ng.gain.setValueAtTime(0.35, t); ng.gain.exponentialRampToValueAtTime(0.08, t + 0.15);
  n.connect(nb); nb.connect(ng); ng.connect(g);
  g.connect(out);
  const a = 0.26 * v;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * 1.15, t + 0.07); g.gain.linearRampToValueAtTime(a, t + 0.18);
  return { stop(t2) { release(g.gain, t2, 0.06); [o1, o2, o3, lfo, n].forEach((x) => x.stop(t2 + 0.4)); } };
}

// ---------- Batería ----------
function env(c, out, t, a, d, attack = 0.001) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0005, t + d);
  g.connect(out);
  return g;
}
function metal(c, t, end) {
  const out = c.createGain();
  const os = [2, 3, 4.16, 5.43, 6.79, 8.21].map((r) => { const o = osc(c, 'square', 40 * r, t); o.connect(out); o.stop(end); return o; });
  out.gain.value = 0.25;
  return out;
}
function nz(c, t, end, type, freq, q = 1) {
  const s = noiseSrc(c, t), f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  s.connect(f); s.stop(end);
  return f;
}
function drumTone(c, out, t, f0, f1, d, a, type = 'sine') {
  const o = c.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d * 0.6);
  o.connect(env(c, out, t, a, d)); o.start(t); o.stop(t + d + 0.05);
}

export function playDrum(c, out, id, t, v = 1) {
  switch (id) {
    case 36: { // bombo
      drumTone(c, out, t, 160, 45, 0.5, 1.1 * v);
      const n = nz(c, t, t + 0.03, 'highpass', 3000); n.connect(env(c, out, t, 0.15 * v, 0.02)); break;
    }
    case 38: { // redoblante
      drumTone(c, out, t, 240, 170, 0.12, 0.45 * v, 'triangle');
      const n = nz(c, t, t + 0.3, 'highpass', 1400); n.connect(env(c, out, t, 0.55 * v, 0.22)); break;
    }
    case 37: { // aro
      drumTone(c, out, t, 1700, 1600, 0.04, 0.3 * v, 'square');
      const n = nz(c, t, t + 0.05, 'bandpass', 3000, 2); n.connect(env(c, out, t, 0.4 * v, 0.04)); break;
    }
    case 39: { // aplauso
      const n = nz(c, t, t + 0.3, 'bandpass', 1300, 1.5);
      const g = c.createGain(); g.gain.setValueAtTime(0, t);
      [0, 0.011, 0.022].forEach((o) => { g.gain.setValueAtTime(0.9 * v, t + o); g.gain.exponentialRampToValueAtTime(0.1, t + o + 0.009); });
      g.gain.setValueAtTime(0.7 * v, t + 0.032); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.25);
      n.connect(g); g.connect(out); break;
    }
    case 42: case 46: case 49: case 51: { // charles, platillos
      const d = { 42: 0.06, 46: 0.4, 49: 1.8, 51: 1.1 }[id];
      const a = { 42: 0.5, 46: 0.45, 49: 0.5, 51: 0.28 }[id] * v;
      const m = metal(c, t, t + d + 0.05);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = id === 51 ? 7000 : 10000; bp.Q.value = 0.8;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = id === 49 ? 4500 : 7000;
      m.connect(bp); bp.connect(hp); hp.connect(env(c, out, t, a, d));
      if (id === 49) { const n = nz(c, t, t + d, 'highpass', 5000); n.connect(env(c, out, t, 0.25 * v, d * 0.8)); }
      if (id === 51) { const b = osc(c, 'sine', 2600, t); b.stop(t + 0.6); b.connect(env(c, out, t, 0.06 * v, 0.5)); }
      break;
    }
    case 50: case 48: case 47: case 45: case 43: case 41: {
      const f = { 50: 220, 48: 180, 47: 150, 45: 120, 43: 95, 41: 80 }[id];
      drumTone(c, out, t, f * 1.4, f, 0.45, 0.8 * v);
      const n = nz(c, t, t + 0.05, 'lowpass', 2500); n.connect(env(c, out, t, 0.12 * v, 0.04)); break;
    }
    case 56: { // cencerro
      const g = env(c, out, t, 0.35 * v, 0.35);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2640; bp.Q.value = 1;
      [540, 800].forEach((f) => { const o = osc(c, 'square', f, t); o.stop(t + 0.4); o.connect(bp); });
      bp.connect(g); break;
    }
    case 54: { // pandereta
      const m = metal(c, t, t + 0.3); const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8000;
      m.connect(hp); hp.connect(env(c, out, t, 0.35 * v, 0.25));
      const n = nz(c, t, t + 0.25, 'highpass', 6000);
      const g = c.createGain(); g.gain.setValueAtTime(0, t);
      [0, 0.02, 0.045].forEach((o, i) => { g.gain.setValueAtTime(0.4 * v / (i + 1), t + o); g.gain.exponentialRampToValueAtTime(0.01, t + o + 0.018); });
      n.connect(g); g.connect(out); break;
    }
    case 70: { const n = nz(c, t, t + 0.12, 'highpass', 5500); n.connect(env(c, out, t, 0.45 * v, 0.08, 0.012)); break; }
    case 62: case 63: case 64: {
      const f = { 62: 340, 63: 330, 64: 220 }[id];
      drumTone(c, out, t, f * 1.15, f, id === 62 ? 0.1 : 0.32, 0.75 * v);
      const n = nz(c, t, t + 0.03, 'bandpass', 2000, 1); n.connect(env(c, out, t, 0.2 * v, 0.02)); break;
    }
    case 60: case 61: drumTone(c, out, t, id === 60 ? 560 : 400, id === 60 ? 480 : 330, 0.14, 0.7 * v); break;
    case 76: case 77: { // taco de madera
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = id === 76 ? 1000 : 800; bp.Q.value = 6;
      const o = osc(c, 'triangle', id === 76 ? 1000 : 800, t); o.stop(t + 0.1); o.connect(bp); bp.connect(env(c, out, t, 1.1 * v, 0.07)); break;
    }
    case 75: { const o = osc(c, 'sine', 2500, t); o.stop(t + 0.1); o.connect(env(c, out, t, 0.5 * v, 0.06)); break; }
    case 81: {
      [4400, 6100, 8300].forEach((f, i) => { const o = osc(c, 'sine', f, t); o.stop(t + 2); o.connect(env(c, out, t, (0.12 / (i + 1)) * v, 1.8)); });
      break;
    }
    default: drumTone(c, out, t, 300, 200, 0.1, 0.4 * v);
  }
}

const VOICES = {
  piano: vPiano, guitarra: vPluck('guitarra'), bajo: vPluck('bajo'), arpa: vPluck('arpa'),
  acordeon: vAccordion, bandoneon: vBandoneon, armonica: vHarmonica, flauta: vFlute,
};

// Toca una nota. Devuelve un objeto con stop(t) (para instrumentos que sostienen).
export function voice(c, out, inst, m, t, vel = 0.85) {
  if (inst === 'bateria') { playDrum(c, out, m, t, vel); return { stop() {} }; }
  const fn = VOICES[inst] || vPiano;
  return fn(c, out, m, t, vel);
}

export function click(b, t, accent) {
  const c = b.c;
  const o = osc(c, 'sine', accent ? 1760 : 1100, t); o.stop(t + 0.08);
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(accent ? 0.9 : 0.55, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
  o.connect(g); g.connect(b.metro);
}

// Precalienta los buffers de cuerdas para que la primera nota no tarde.
export function warm(inst, notes) {
  if (!['guitarra', 'bajo', 'arpa'].includes(inst) || !ctx) return;
  for (const m of notes) ks(ctx, m, inst);
}
