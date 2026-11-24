// Estudio Mágico — herramienta para crear música en familia.
import { INSTRUMENTS, INST_ORDER, DRUMS, audioCtx, masterBus, channel, voice, click, warm, setMasterVolume, setMetroVolume } from './audio.js';
import { barSteps, totalSteps, beatSteps, stepDur, METERS, newSong, newTrack, demos, cleanSong, toMidi, renderWav, noteName } from './music.js';
import { Roll } from './roll.js';
import { Staff } from './staff.js';
import { buildPanel, iconHTML } from './instruments.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const QS = new URLSearchParams(location.search);
const HUB = (QS.get('hub') || '').replace(/\D/g, '').slice(0, 4) || null;
const HUB_URL = 'https://pf-juegos.vercel.app';
const KEY = 'estudio-magico-v1';
const ANIMALS = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦄', '🐔', '🐧', '🐢', '🐙', '🦋', '🐝', '🐞', '🦖', '🐳', '🦉'];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- datos guardados ----------
const DEFAULT_PREFS = { theme: 'normal', night: false, names: 'solfeo', colorNotes: true, follow: true, ghost: true, metroVol: 0.5, vol: 0.9 };
let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch { S = null; }
if (!S || !Array.isArray(S.players)) S = { players: [], sel: [], songs: [], panels: {} };
S.prefs = { ...DEFAULT_PREFS, ...(S.prefs || {}) };
S.panels ||= {};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('No hay más lugar para guardar 😕'); } };
const selPlayers = () => S.players.filter((p) => S.sel.includes(p.id));

// ---------- estado del estudio ----------
const A = {
  song: null, ti: 0, pos: null, cursor: 0, noteLen: 4, sharp: false, write: false, loop: true, metro: false,
  view: 'roll', sounding: new Set(), liveChanged: false, prefs: S.prefs,
  get track() { return this.song.tracks[this.ti]; },
  get princess() { return S.prefs.theme === 'princess'; },
  get snap() { return Math.min(this.noteLen, 4); },
};
let undoStack = [], redoStack = [];
A.commit = () => { undoStack.push(JSON.stringify(A.song)); if (undoStack.length > 80) undoStack.shift(); redoStack = []; syncUndo(); };
A.changed = () => { roll.dirty = true; staff.dirty = true; scheduleSave(); renderTracks(); };
let saveT = 0;
function scheduleSave() { clearTimeout(saveT); saveT = setTimeout(saveSong, 500); }
function saveSong() {
  const s = A.song; if (!s) return;
  s.updated = Date.now();
  if (!s.authors || !s.authors.length) s.authors = S.sel.slice();
  const i = S.songs.findIndex((x) => x.id === s.id);
  const copy = JSON.parse(JSON.stringify(s));
  if (i >= 0) S.songs[i] = copy; else S.songs.unshift(copy);
  S.lastSong = s.id; save();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(A.song)); A.song = JSON.parse(undoStack.pop());
  A.ti = Math.min(A.ti, A.song.tracks.length - 1); afterSongChange(false); scheduleSave(); syncUndo();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(A.song)); A.song = JSON.parse(redoStack.pop());
  A.ti = Math.min(A.ti, A.song.tracks.length - 1); afterSongChange(false); scheduleSave(); syncUndo();
}
function syncUndo() { $('#bUndo').disabled = !undoStack.length; $('#bRedo').disabled = !redoStack.length; }

A.panelState = (inst) => {
  const def = { piano: 4, acordeon: 4, arpa: 3, flauta: 4 }[inst] ?? 4;
  return (S.panels[inst] ||= { oct: def, fret: 0, tab: 'kit' });
};
A.savePanel = save;
A.panelRebuilt = () => { panelW = $('#panel').clientWidth; };

// ---------- secuenciador ----------
const seq = { playing: false, rec: false, nextStep: 0, nextTime: 0, timer: 0, marks: [], voices: [], endAt: 0 };
const audible = (tr) => { const solo = A.song.tracks.some((t) => t.solo); return !tr.mute && (!solo || tr.solo); };
function scheduleStep(st, t) {
  const s = A.song, c = audioCtx(), bus = masterBus(), sd = stepDur(s);
  if ((A.metro || seq.rec) && st % beatSteps(s) === 0) click(bus, t, st % barSteps(s) === 0);
  for (const tr of s.tracks) {
    if (!audible(tr)) continue;
    const out = channel(bus, tr);
    for (const n of tr.notes) if (n.s === st) {
      const v = voice(c, out, tr.inst, n.p, t, n.v ?? 0.85), end = t + n.d * sd;
      v.stop(end); seq.voices.push({ v, end });
    }
  }
}
function tick() {
  const c = audioCtx(), s = A.song, sd = stepDur(s), total = totalSteps(s);
  while (!seq.endAt && seq.nextTime < c.currentTime + 0.12) {
    if (seq.nextStep >= total) { if (A.loop || seq.rec) seq.nextStep = 0; else { seq.endAt = seq.nextTime; break; } }
    scheduleStep(seq.nextStep, seq.nextTime);
    seq.marks.push({ t: seq.nextTime, step: seq.nextStep });
    seq.nextTime += sd; seq.nextStep++;
  }
  const old = c.currentTime - 1; while (seq.marks.length > 2 && seq.marks[1].t < old) seq.marks.shift();
  seq.voices = seq.voices.filter((x) => x.end > c.currentTime);
  if (seq.endAt && c.currentTime > seq.endAt + 0.05) stop(true);
}
function curPos() {
  if (!seq.playing || !seq.marks.length) return null;
  const c = audioCtx(), t = c.currentTime - (c.outputLatency || 0) * 0.5, sd = stepDur(A.song);
  let m = seq.marks[0];
  for (const k of seq.marks) { if (k.t <= t) m = k; else break; }
  if (m.t > t) return m.step;
  return Math.min(totalSteps(A.song) - 0.0001, m.step + Math.min(1, (t - m.t) / sd));
}
function play(from) {
  const c = audioCtx();
  if (seq.playing) stopVoices();
  seq.playing = true; seq.endAt = 0; seq.marks = [];
  const total = totalSteps(A.song);
  seq.nextStep = from ?? (A.cursor >= total ? 0 : A.cursor);
  seq.nextTime = c.currentTime + 0.08;
  clearInterval(seq.timer); seq.timer = setInterval(tick, 25); tick();
  syncTransport();
}
function stopVoices() { const t = audioCtx().currentTime; for (const x of seq.voices) x.v.stop(t); seq.voices = []; }
function stop(finished) {
  if (!seq.playing) return;
  clearInterval(seq.timer); seq.playing = false; stopVoices();
  if (seq.rec) { seq.rec = false; toast('⏺ Grabación guardada'); }
  if (finished) A.cursor = 0;
  A.pos = null; roll.dirty = staff.dirty = true; syncTransport();
}
A.seek = (st) => {
  st = Math.max(0, Math.min(totalSteps(A.song) - 1, st));
  A.cursor = st;
  if (seq.playing) play(st);
  roll.dirty = staff.dirty = true;
};
function toggleRec() {
  if (seq.rec) { seq.rec = false; syncTransport(); toast('⏺ Grabación guardada'); return; }
  A.commit(); seq.rec = true;
  if (!seq.playing) { A.cursor = 0; play(0); }
  toast(A.princess ? '👑 ¡Grabando! Tocá el instrumento' : '⏺ ¡Grabando! Tocá el instrumento');
  syncTransport();
}

// ---------- tocar en vivo ----------
const held = new Map(); // pitch -> cantidad
function holdP(p, d) { const n = (held.get(p) || 0) + d; if (n > 0) held.set(p, n); else held.delete(p); A.liveChanged = true; }
const PLUCK = ['guitarra', 'bajo', 'arpa'];
A.noteOn = (p, vel = 0.9, opt = {}) => {
  const c = audioCtx(), tr = A.track, t = c.currentTime + 0.004 + (opt.delay || 0);
  const v = voice(c, channel(masterBus(), tr), tr.inst, p, t, vel);
  holdP(p, 1);
  const tok = { p, v, tr, startPos: seq.rec ? curPos() : null, inst: tr.inst };
  if (A.write && !seq.playing && !opt.noWrite) {
    A.commit();
    const total = totalSteps(A.song);
    if (A.cursor >= total) A.cursor = 0;
    tr.notes.push({ p, s: A.cursor, d: INSTRUMENTS[tr.inst].drums ? 1 : Math.min(A.noteLen, total - A.cursor), v: 0.85 });
    if (!opt.chord) A.cursor = Math.min(total, A.cursor + A.noteLen);
    A.changed();
  }
  return tok;
};
A.noteOff = (tok) => {
  if (!tok) return;
  if (Array.isArray(tok)) { tok.forEach(A.noteOff); return; }
  holdP(tok.p, -1);
  if (!PLUCK.includes(tok.inst)) tok.v.stop(audioCtx().currentTime);
  if (tok.startPos != null && seq.rec) {
    const total = totalSteps(A.song), snap = A.snap;
    let end = curPos(); if (end == null) end = tok.startPos + 1;
    let dur = end - tok.startPos; if (dur < 0) dur += total;
    const s = (Math.round(tok.startPos / snap) * snap) % total;
    const d = INSTRUMENTS[tok.inst].drums ? 1 : Math.max(snap, Math.round(dur / snap) * snap);
    if (!tok.tr.notes.some((n) => n.p === tok.p && n.s === s)) tok.tr.notes.push({ p: tok.p, s, d: Math.min(d, total - s), v: 0.85 });
    A.changed();
  }
};
A.chordOn = (notes, strum) => {
  const toks = notes.map((p, i) => A.noteOn(p, 0.8, { delay: strum ? i * 0.022 : 0, chord: true }));
  if (A.write && !seq.playing) { A.cursor = Math.min(totalSteps(A.song), A.cursor + A.noteLen); roll.dirty = staff.dirty = true; }
  return toks;
};
A.audition = (p, len = 0.4) => {
  const tok = A.noteOn(p, 0.8, { noWrite: true });
  tok.startPos = null;
  setTimeout(() => A.noteOff(tok), len * 1000);
};

// chispitas al tocar
let fxCount = 0;
A.fx = (el) => {
  if (fxCount > 18) return;
  const r = el.getBoundingClientRect(), d = document.createElement('span');
  const set = A.princess ? ['💖', '✨', '🌸', '👑', '💫'] : ['♪', '♫', '♬', '✨', '♩'];
  d.className = 'spark'; d.textContent = set[Math.floor(Math.random() * set.length)];
  d.style.left = r.left + r.width / 2 + 'px'; d.style.top = r.top + Math.min(r.height / 2, 40) + 'px';
  d.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px');
  d.style.color = ['#ffc94d', '#7bdcff', '#ff8fc8', '#9bff8f'][Math.floor(Math.random() * 4)];
  document.body.appendChild(d); fxCount++;
  setTimeout(() => { d.remove(); fxCount--; }, 1000);
};

// ---------- vistas ----------
let roll, staff, panel, panelW = 0;
function afterSongChange(resetView = true) {
  if (A.ti >= A.song.tracks.length) A.ti = 0;
  if (resetView) { roll.resetView(); staff.sy = 0; }
  const total = totalSteps(A.song); if (A.cursor > total) A.cursor = 0;
  renderTracks(); renderPanel(); syncSongBar();
  roll.dirty = staff.dirty = true;
}
function renderPanel() {
  const host = $('#panel');
  panel = buildPanel(host, A); panelW = host.clientWidth;
  const tr = A.track, I = INSTRUMENTS[tr.inst];
  if (I.range) { const ps = A.panelState(tr.inst); const b = 12 * (ps.oct + 1); const ns = []; for (let m = b; m < b + 30; m++) ns.push(m); setTimeout(() => warm(tr.inst, ns), 50); }
  $('#studio').style.setProperty('--inst', I.color);
}
function selectTrack(i) {
  if (i === A.ti) { trackMenu(i); return; }
  A.ti = i; roll.resetView(); renderTracks(); renderPanel(); roll.dirty = staff.dirty = true;
}
function renderTracks() {
  const s = A.song, host = $('#tracks');
  host.innerHTML = s.tracks.map((t, i) => {
    const I = INSTRUMENTS[t.inst];
    return `<button class="tchip ${i === A.ti ? 'on' : ''} ${t.mute ? 'muted' : ''}" data-i="${i}" style="--c:${I.color}">${iconHTML(t.inst)}<b>${I.short || I.name}</b>${t.mute ? '<small>🔇</small>' : t.solo ? '<small>🎧</small>' : ''}${i === A.ti ? '<small class="more">⚙️</small>' : ''}</button>`;
  }).join('') + (s.tracks.length < 10 ? '<button class="tchip add" data-i="add"><span class="ico">➕</span><b>Instrumento</b></button>' : '');
  $$('.tchip', host).forEach((b) => b.onclick = () => (b.dataset.i === 'add' ? instPicker() : selectTrack(+b.dataset.i)));
}
function syncTransport() {
  $('#bPlay').textContent = seq.playing ? '⏸' : '▶';
  $('#bPlay').classList.toggle('on', seq.playing);
  $('#bRec').classList.toggle('rec', seq.rec);
  $('#bLoop').classList.toggle('on', A.loop);
  $('#bMetro').classList.toggle('on', A.metro);
  $('#bWrite').classList.toggle('on', A.write);
  $('#bSharp').classList.toggle('on', A.sharp);
  $$('#durs button').forEach((b) => b.classList.toggle('on', +b.dataset.len === A.noteLen));
  $$('#viewTabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === A.view));
  $('#rollHost').classList.toggle('hidden', A.view !== 'roll');
  $('#staffHost').classList.toggle('hidden', A.view !== 'staff');
  $('#bSharp').classList.toggle('hidden', A.view !== 'staff');
  $$('.zoomB').forEach((b) => b.classList.toggle('hidden', A.view !== 'roll'));
}
function syncSongBar() {
  const s = A.song;
  $('#songName').textContent = s.name;
  $('#songInfo').innerHTML = `<b>♩${s.bpm}</b><span>${s.num}/${s.den}</span><span>${s.bars} comp.</span>`;
}

// ---------- marco de animación ----------
function frame() {
  requestAnimationFrame(frame);
  if ($('#studio').classList.contains('hidden')) return;
  A.pos = curPos();
  const set = new Set(held.keys());
  if (A.pos != null) for (const n of A.track.notes) if (A.pos >= n.s && A.pos < n.s + n.d) set.add(n.p);
  const changed = set.size !== A.sounding.size || [...set].some((p) => !A.sounding.has(p));
  A.sounding = set;
  if (changed) { A.liveChanged = true; panel && panel.light(set); }
  if (A.view === 'roll') roll.draw(); else staff.draw();
  A.liveChanged = false;
  const pw = $('#panel').clientWidth;
  if (panel && Math.abs(pw - panelW) > 40) renderPanel();
}

// ---------- superposiciones ----------
function showOv(html, cls = '') {
  const ov = $('#ov'); $('#ovCard').className = 'card ' + cls;
  $('#ovCard').innerHTML = `<button class="ib close" data-x>✕</button>` + html;
  ov.classList.remove('hidden');
  $$('[data-x]', ov).forEach((b) => b.onclick = hideOv);
  setTimeout(() => { const f = $('#ovCard [data-focus]') || $('#ovCard button:not(.close)'); f && f.focus(); }, 30);
}
function hideOv() { $('#ov').classList.add('hidden'); }
$('#ov').addEventListener('pointerdown', (e) => { if (e.target.id === 'ov') hideOv(); });
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2300); }

function instPicker(replaceIdx) {
  showOv(`<h2>${replaceIdx != null ? 'Cambiar instrumento' : '¿Qué instrumento sumamos?'}</h2>
    <div class="instGrid">${INST_ORDER.map((k) => `<button class="instTile" data-k="${k}" style="--c:${INSTRUMENTS[k].color}">${iconHTML(k)}<b>${INSTRUMENTS[k].name}</b></button>`).join('')}</div>`, 'wide');
  $$('.instTile').forEach((b) => b.onclick = () => {
    const k = b.dataset.k;
    A.commit();
    if (replaceIdx != null) {
      const t = A.song.tracks[replaceIdx];
      if (!!INSTRUMENTS[t.inst].drums !== !!INSTRUMENTS[k].drums) t.notes = [];
      t.inst = k;
    } else { A.song.tracks.push(newTrack(k)); A.ti = A.song.tracks.length - 1; }
    hideOv(); roll.resetView(); afterSongChange(false); A.changed();
  });
}
function trackMenu(i) {
  const t = A.song.tracks[i], I = INSTRUMENTS[t.inst];
  showOv(`<h2>${iconHTML(t.inst)} ${I.name}</h2>
    <label class="slider">🔊 Volumen <input type="range" min="0" max="1" step="0.05" value="${t.vol}" id="tVol"></label>
    <div class="row">
      <button class="pill ${t.mute ? 'on' : ''}" data-a="mute">🔇 Silenciar</button>
      <button class="pill ${t.solo ? 'on' : ''}" data-a="solo">🎧 Solo esta</button>
      <button class="pill" data-a="inst">🔁 Cambiar instrumento</button>
    </div>
    <div class="row">
      <button class="pill" data-a="clear">🧽 Borrar sus notas</button>
      ${A.song.tracks.length > 1 ? '<button class="pill danger" data-a="del">🗑️ Quitar instrumento</button>' : ''}
    </div>`);
  $('#tVol').oninput = (e) => { t.vol = +e.target.value; channel(masterBus(), t); scheduleSave(); };
  $$('#ovCard [data-a]').forEach((b) => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'mute') { t.mute = !t.mute; if (t.mute) t.solo = false; }
    if (a === 'solo') { t.solo = !t.solo; if (t.solo) t.mute = false; }
    if (a === 'inst') { instPicker(i); return; }
    if (a === 'clear') { if (!t.notes.length) return; A.commit(); t.notes = []; toast('🧽 Notas borradas (podés deshacer ↶)'); }
    if (a === 'del') { A.commit(); A.song.tracks.splice(i, 1); A.ti = Math.max(0, i - 1); afterSongChange(); }
    hideOv(); A.changed();
  });
}
function songMenu() {
  const s = A.song;
  showOv(`<h2>🎼 La canción</h2>
    <label class="field">Nombre <input id="sName" maxlength="40" value="${esc(s.name)}"></label>
    <div class="ctlRow"><span>Velocidad</span><button class="ib" data-b="-5">−</button><b id="sBpm">♩ ${s.bpm}</b><button class="ib" data-b="5">+</button><button class="pill" id="tap">👆 Marcar</button></div>
    <div class="ctlRow"><span>Compás</span><div class="row tight">${METERS.map(([n, d]) => `<button class="pill ${s.num === n && s.den === d ? 'on' : ''}" data-m="${n}/${d}">${n}/${d}</button>`).join('')}</div></div>
    <div class="ctlRow"><span>Largo</span><button class="ib" data-c="-1">−</button><b id="sBars">${s.bars} compases</b><button class="ib" data-c="1">+</button></div>
    <div class="row"><button class="big" data-x>Listo</button></div>`);
  const nm = $('#sName');
  nm.oninput = () => { s.name = nm.value.trim() || 'Sin nombre'; syncSongBar(); scheduleSave(); };
  $$('[data-b]').forEach((b) => b.onclick = () => { s.bpm = Math.max(40, Math.min(240, s.bpm + +b.dataset.b)); $('#sBpm').textContent = '♩ ' + s.bpm; syncSongBar(); scheduleSave(); });
  $$('[data-m]').forEach((b) => b.onclick = () => {
    const [n, d] = b.dataset.m.split('/').map(Number);
    const oldBs = barSteps(s);
    A.commit(); s.num = n; s.den = d;
    const nb = barSteps(s);
    // reacomodar notas por compás para no desordenar todo
    for (const t of s.tracks) t.notes = t.notes.map((x) => { const bar = Math.floor(x.s / oldBs), off = x.s - bar * oldBs; return off < nb ? { ...x, s: bar * nb + off } : null; }).filter(Boolean);
    $$('[data-m]').forEach((x) => x.classList.toggle('on', x === b)); syncSongBar(); afterSongChange(false); A.changed();
  });
  $$('[data-c]').forEach((b) => b.onclick = () => {
    const nb = Math.max(1, Math.min(32, s.bars + +b.dataset.c));
    if (nb === s.bars) return;
    A.commit(); s.bars = nb;
    const total = totalSteps(s);
    for (const t of s.tracks) t.notes = t.notes.filter((x) => x.s < total).map((x) => ({ ...x, d: Math.min(x.d, total - x.s) }));
    $('#sBars').textContent = s.bars + (s.bars === 1 ? ' compás' : ' compases'); syncSongBar(); A.changed();
  });
  let taps = [];
  $('#tap').onclick = () => {
    const t = performance.now(); taps = taps.filter((x) => t - x < 2500); taps.push(t);
    audioCtx(); click(masterBus(), audioCtx().currentTime, taps.length === 1);
    if (taps.length >= 3) {
      const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      s.bpm = Math.max(40, Math.min(240, Math.round(60000 / iv))); $('#sBpm').textContent = '♩ ' + s.bpm; syncSongBar(); scheduleSave();
    }
  };
}
function mySongs() { const ids = new Set(S.sel); return S.songs.filter((s) => (s.authors || []).some((a) => ids.has(a))).sort((a, b) => (b.updated || 0) - (a.updated || 0)); }
function openSong(s, asCopy) {
  stop();
  let song = cleanSong(s);
  if (asCopy) { song.id = 's' + Date.now().toString(36); song.authors = S.sel.slice(); delete song.updated; }
  A.song = song; A.ti = 0; A.cursor = 0; undoStack = []; redoStack = []; syncUndo();
  afterSongChange();
  if (asCopy) saveSong();
  S.lastSong = song.id; save();
}
function songsMenu() {
  const list = mySongs();
  const when = (t) => (t ? new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '');
  showOv(`<h2>🎵 Canciones</h2>
    <div class="row"><button class="big" data-new data-focus>➕ Canción nueva</button></div>
    <h3>Mis canciones</h3>
    <div class="slist">${list.length ? list.map((s) => `<div class="sitem ${s.id === A.song.id ? 'cur' : ''}"><button class="sopen" data-open="${s.id}"><b>${esc(s.name)}</b><small>${s.tracks.map((t) => INSTRUMENTS[t.inst] ? iconHTML(t.inst) : '').join('')} · ${when(s.updated)}</small></button><button class="ib sm" data-dup="${s.id}" title="Duplicar">📄</button><button class="ib sm" data-del="${s.id}" title="Borrar">🗑️</button></div>`).join('') : '<p class="sub">Todavía no hay canciones guardadas. ¡Todo lo que hagas se guarda solo!</p>'}</div>
    <h3>✨ Para escuchar y cambiar</h3>
    <div class="slist">${demos().map((s, i) => `<div class="sitem"><button class="sopen" data-demo="${i}"><b>${esc(s.name)}</b><small>${s.tracks.map((t) => iconHTML(t.inst)).join('')}</small></button></div>`).join('')}</div>`, 'wide');
  $('[data-new]').onclick = () => { const s = newSong(); openSong(s, true); hideOv(); toast('🎶 ¡Canción nueva!'); };
  $$('[data-open]').forEach((b) => b.onclick = () => { openSong(S.songs.find((x) => x.id === b.dataset.open)); hideOv(); });
  $$('[data-demo]').forEach((b) => b.onclick = () => { openSong(demos()[+b.dataset.demo], true); hideOv(); toast('▶ Dale play para escucharla'); });
  $$('[data-dup]').forEach((b) => b.onclick = () => { const s = S.songs.find((x) => x.id === b.dataset.dup); const c = cleanSong(s); c.name = s.name + ' (copia)'; openSong(c, true); songsMenu(); });
  $$('[data-del]').forEach((b) => b.onclick = () => {
    const s = S.songs.find((x) => x.id === b.dataset.del);
    confirmOv(`¿Borrar “${esc(s.name)}”?`, '🗑️ Sí, borrar', () => {
      S.songs = S.songs.filter((x) => x !== s); save();
      if (A.song.id === s.id) { const next = mySongs()[0]; openSong(next || newSong(), !next); }
      songsMenu();
    }, songsMenu);
  });
}
function confirmOv(msg, yes, onYes, onNo = hideOv) {
  showOv(`<h2>${msg}</h2><div class="row"><button class="pill" data-no data-focus>No</button><button class="pill danger" data-yes>${yes}</button></div>`);
  $('[data-yes]').onclick = onYes; $('[data-no]').onclick = onNo;
}
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
const fileName = (ext) => (A.song.name.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'cancion') + '.' + ext;
function exportMenu() {
  showOv(`<h2>📤 Llevarte la canción</h2>
    <div class="row col">
      <button class="big" data-e="wav" data-focus>🎧 Bajar audio (WAV)</button>
      <button class="pill" data-e="mid">🎹 Bajar MIDI (para otros programas)</button>
      <button class="pill" data-e="json">💾 Bajar copia de la canción</button>
      <label class="pill file">📂 Abrir una copia<input type="file" accept=".json,application/json" hidden></label>
    </div><p class="sub" id="expMsg"></p>`);
  $$('[data-e]').forEach((b) => b.onclick = async () => {
    const e = b.dataset.e;
    if (e === 'wav') {
      $('#expMsg').textContent = '⏳ Armando el audio…';
      try { download(await renderWav(A.song, A.loop ? 2 : 1), fileName('wav')); $('#expMsg').textContent = '✅ ¡Listo!'; }
      catch (err) { $('#expMsg').textContent = '😕 No se pudo armar el audio'; console.error(err); }
    }
    if (e === 'mid') { download(new Blob([toMidi(A.song)], { type: 'audio/midi' }), fileName('mid')); $('#expMsg').textContent = '✅ ¡Listo!'; }
    if (e === 'json') { download(new Blob([JSON.stringify(A.song)], { type: 'application/json' }), fileName('json')); $('#expMsg').textContent = '✅ ¡Listo!'; }
  });
  $('#ovCard input[type=file]').onchange = async (ev) => {
    try {
      const s = JSON.parse(await ev.target.files[0].text());
      if (!s.tracks) throw 0;
      openSong(s, true); hideOv(); toast('📂 Canción abierta');
    } catch { $('#expMsg').textContent = '😕 Ese archivo no es una canción del estudio'; }
  };
}
function optionsMenu() {
  const o = S.prefs;
  const pill = (k, label, on) => `<button class="pill ${on ? 'on' : ''}" data-o="${k}">${label}</button>`;
  showOv(`<h2>⚙️ Opciones</h2>
    <div class="row">${pill('theme', o.theme === 'princess' ? '👑 Modo princesa' : '🌟 Modo normal', true)}${pill('night', '🌙 Noche', o.night)}</div>
    <div class="row">${pill('names', o.names === 'letras' ? '🔤 Notas: C D E' : '🎵 Notas: Do Re Mi', true)}${pill('colorNotes', '🌈 Notas de colores', o.colorNotes)}</div>
    <div class="row">${pill('follow', '👀 Seguir la línea', o.follow)}${pill('ghost', '👻 Ver otras pistas', o.ghost)}</div>
    <label class="slider">🔊 Volumen general <input type="range" min="0" max="1" step="0.05" value="${o.vol}" data-v="vol"></label>
    <label class="slider">🥢 Volumen del metrónomo <input type="range" min="0" max="1" step="0.05" value="${o.metroVol}" data-v="metroVol"></label>
    <div class="row"><button class="pill" data-o="home">👥 Cambiar quién toca</button>${HUB ? '<button class="pill" data-o="hub">🏠 Todos los juegos</button>' : ''}</div>`);
  $$('[data-o]').forEach((b) => b.onclick = () => {
    const k = b.dataset.o;
    if (k === 'home') { hideOv(); goStart(); return; }
    if (k === 'hub') { goHub(); return; }
    if (k === 'theme') o.theme = o.theme === 'princess' ? 'normal' : 'princess';
    else if (k === 'names') o.names = o.names === 'letras' ? 'solfeo' : 'letras';
    else o[k] = !o[k];
    save(); applyTheme(); renderPanel(); roll.dirty = staff.dirty = true; optionsMenu();
  });
  $$('[data-v]').forEach((r) => r.oninput = () => { o[r.dataset.v] = +r.value; applyVolumes(); save(); });
}
function applyVolumes() { setMasterVolume(S.prefs.vol); setMetroVolume(S.prefs.metroVol); }
function applyTheme() {
  const P = S.prefs.theme === 'princess';
  document.body.classList.toggle('princess', P);
  document.body.classList.toggle('night', !!S.prefs.night);
  $('#title').textContent = P ? 'Estudio de Princesas' : 'Estudio Mágico';
  $('#logo').textContent = P ? '👑' : '🎼';
  $('#btnTheme').textContent = P ? '🌟 Modo normal' : '👑 Modo princesa';
  document.querySelector('meta[name=theme-color]').content = P && !S.prefs.night ? '#ffd3e8' : '#1d2540';
}

// ---------- ¿quién toca? ----------
let editingWho = false;
function renderWho() {
  const host = $('#who');
  host.classList.toggle('editing', editingWho);
  host.innerHTML = S.players.map((p) => {
    const n = S.songs.filter((s) => (s.authors || []).includes(p.id)).length;
    const on = S.sel.includes(p.id);
    return `<button class="wb ${on ? 'on' : ''}" data-id="${p.id}"><span class="ck">${editingWho ? '✏️' : on ? '✓' : ''}</span><span class="av">${p.av}</span><span class="nm">${esc(p.name)}</span><small>🎵 ${n} · 🎹 ${p.notes || 0}</small></button>`;
  }).join('') + '<button class="wb add" data-add><span class="av">➕</span><span class="nm">Nuevo</span></button>';
  $$('.wb', host).forEach((b) => b.onclick = () => {
    if (b.dataset.add != null) { editPlayer(null); return; }
    const id = b.dataset.id;
    if (editingWho) { editPlayer(id); return; }
    S.sel = S.sel.includes(id) ? S.sel.filter((x) => x !== id) : [...S.sel, id];
    save(); renderWho();
  });
  $('#editWho').classList.toggle('hidden', !S.players.length);
  $('#editWho').textContent = editingWho ? '✅ Listo' : '✏️ Editar';
  const ok = S.sel.length > 0;
  $('#btnOpen').classList.toggle('off', !ok);
  $('#btnOpen').textContent = S.players.length ? (ok ? '🎶 Abrir el estudio' : '👆 Elegí quién toca') : '➕ Primero creá tu jugador';
}
function editPlayer(id) {
  const p = id ? S.players.find((x) => x.id === id) : { id: 'p' + Date.now().toString(36), name: '', av: ANIMALS[S.players.length % ANIMALS.length], notes: 0 };
  let av = p.av;
  showOv(`<h2>${id ? 'Editar jugador' : '¡Hola! ¿Cómo te llamás?'}</h2>
    <label class="field"><input id="pName" maxlength="14" placeholder="Tu nombre" value="${esc(p.name)}" data-focus></label>
    <div class="animals">${ANIMALS.map((a) => `<button class="an ${a === av ? 'on' : ''}" data-a="${a}">${a}</button>`).join('')}</div>
    <div class="row"><button class="big" id="pOk">✅ Listo</button></div>
    ${id ? '<div class="row"><button class="pill" id="pReset">🔄 Reiniciar puntajes</button><button class="pill danger" id="pDel">🗑️ Borrar jugador</button></div>' : ''}`);
  $$('.an').forEach((b) => b.onclick = () => { av = b.dataset.a; $$('.an').forEach((x) => x.classList.toggle('on', x === b)); });
  $('#pOk').onclick = () => {
    const name = $('#pName').value.trim(); if (!name) { $('#pName').focus(); toast('Escribí un nombre ✍️'); return; }
    p.name = name; p.av = av;
    if (!id) { S.players.push(p); S.sel = [...new Set([...S.sel, p.id])]; }
    save(); hideOv(); renderWho();
  };
  if (id) {
    $('#pReset').onclick = () => confirmOv(`¿Reiniciar los puntajes de ${esc(p.name)}?`, '🔄 Reiniciar', () => { p.notes = 0; p.stars = 0; save(); hideOv(); renderWho(); }, () => editPlayer(id));
    $('#pDel').onclick = () => confirmOv(`¿Borrar a ${esc(p.name)} y sus canciones?`, '🗑️ Borrar', () => {
      S.players = S.players.filter((x) => x !== p); S.sel = S.sel.filter((x) => x !== p.id);
      S.songs = S.songs.filter((s) => (s.authors || []).some((a) => a !== p.id));
      for (const s of S.songs) s.authors = (s.authors || []).filter((a) => a !== p.id);
      save(); hideOv(); renderWho();
    }, () => editPlayer(id));
  }
}

// ---------- pantallas ----------
function goStart() { stop(); $('#studio').classList.add('hidden'); $('#start').classList.remove('hidden'); editingWho = false; renderWho(); }
function openStudio() {
  if (!S.players.length) { editPlayer(null); return; }
  if (!S.sel.length) { toast('👆 Tocá tu burbuja para elegir quién toca'); return; }
  audioCtx(); applyVolumes();
  $('#start').classList.add('hidden'); $('#studio').classList.remove('hidden');
  if (!A.song || !(A.song.authors || []).some((a) => S.sel.includes(a))) {
    const mine = mySongs();
    const last = mine.find((s) => s.id === S.lastSong) || mine[0];
    if (last) openSong(last); else { openSong(demos()[0], true); toast('⭐ Dale ▶ para escuchar “Estrellita”'); }
  } else afterSongChange(false);
  requestAnimationFrame(() => { roll.resize(); staff.resize(); renderPanel(); });
  if (isTouch() && !fsEl() && !standalone()) enterFS();
}
function goHub() { location.href = HUB_URL + '/?tv'; }

// ---------- pantalla completa ----------
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
const standalone = () => matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const isTouch = () => matchMedia('(pointer: coarse)').matches;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function enterFS() {
  const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (rq) { try { const r = rq.call(el, { navigationUI: 'hide' }); r && r.catch && r.catch(() => {}); } catch {} }
  else if (isIOS()) toast('En iPhone: Compartir ⬆️ → “Agregar a inicio” para verlo en pantalla completa');
}
function toggleFS() {
  if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else enterFS();
}
function syncFS() { const b = $('#fsBtn'), on = !!fsEl(); b.textContent = on ? '🗗' : '⛶'; b.title = on ? 'Salir de pantalla completa' : 'Pantalla completa'; b.classList.toggle('on', on); }
document.addEventListener('fullscreenchange', syncFS); document.addEventListener('webkitfullscreenchange', syncFS);
if (standalone()) $('#fsBtn').classList.add('hidden');

// ---------- teclado de la compu y control remoto ----------
const LOW = 'zsxdcvgbhnjm,l.ñ-', HIGH = 'q2w3er5t6y7ui9o0p';
const DRUM_KEYS = 'zxcvbnm,.-asdfghjklñ';
const keyToks = new Map();
function keyNote(k) {
  const tr = A.track; if (!tr || !panel) return null;
  if (INSTRUMENTS[tr.inst].drums) { const i = DRUM_KEYS.indexOf(k); return i >= 0 && DRUMS[i] ? DRUMS[i].id : null; }
  const base = panel.base();
  let i = LOW.indexOf(k); if (i >= 0) return base + i;
  i = HIGH.indexOf(k); if (i >= 0) return base + 12 + i;
  return null;
}
function spatial(dir) {
  const els = $$('button, input, [tabindex="0"]').filter((e) => e.offsetParent && !e.disabled && !e.closest('.hidden') && (!$('#ov').classList.contains('hidden') ? e.closest('#ov') : true));
  const cur = document.activeElement && els.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) { els[0] && els[0].focus(); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bd = 1e9;
  for (const e of els) {
    if (e === cur) continue;
    const q = e.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2, dx = x - cx, dy = y - cy;
    const ok = dir === 'ArrowRight' ? dx > 4 : dir === 'ArrowLeft' ? dx < -4 : dir === 'ArrowDown' ? dy > 4 : dy < -4;
    if (!ok) continue;
    const main = dir === 'ArrowRight' || dir === 'ArrowLeft' ? Math.abs(dx) : Math.abs(dy);
    const side = dir === 'ArrowRight' || dir === 'ArrowLeft' ? Math.abs(dy) : Math.abs(dx);
    const d = main + side * 2.5; if (d < bd) { bd = d; best = e; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}
document.addEventListener('keydown', (e) => {
  const typing = e.target.matches('input[type=text], input:not([type]), textarea');
  if (e.key.startsWith('Arrow') && !typing) { e.preventDefault(); spatial(e.key); return; }
  if (e.key === 'Escape' || e.key === 'Backspace' && !typing) { if (!$('#ov').classList.contains('hidden')) { hideOv(); e.preventDefault(); } return; }
  if (typing || $('#studio').classList.contains('hidden') || !$('#ov').classList.contains('hidden')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ' && !e.target.closest('.pbody')) { e.preventDefault(); seq.playing ? stop() : play(); return; }
  const k = e.key.toLowerCase();
  if (e.repeat) { if (keyNote(k) != null) e.preventDefault(); return; }
  const p = keyNote(k);
  if (p != null && !keyToks.has(k)) {
    e.preventDefault(); keyToks.set(k, A.noteOn(p));
    const el = $(`#panel [data-p="${p}"]`); if (el) { el.classList.add('on'); A.fx(el); }
  }
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase(), tok = keyToks.get(k);
  if (tok) { keyToks.delete(k); A.noteOff(tok); const el = $(`#panel [data-p="${tok.p}"]`); el && el.classList.remove('on'); }
});

// ---------- botones ----------
function bind() {
  $('#fsBtn').onclick = toggleFS;
  $('#btnOpen').onclick = openStudio;
  $('#editWho').onclick = () => { editingWho = !editingWho; renderWho(); };
  $('#btnTheme').onclick = () => { S.prefs.theme = S.prefs.theme === 'princess' ? 'normal' : 'princess'; save(); applyTheme(); };
  $('#btnGame').onclick = () => toast('🎮 El modo juego viene pronto: ¡primero armamos el estudio!');
  $('#btnOpt0').onclick = optionsMenu;
  $$('.hubBtn').forEach((b) => { b.classList.toggle('hidden', !HUB); b.onclick = goHub; });
  $('#bMenu').onclick = () => showOv(`<h2>${A.princess ? '👑' : '🎼'} Menú</h2><div class="row col">
      <button class="big" data-m="songs" data-focus>🎵 Canciones</button>
      <button class="pill" data-m="song">🎼 Velocidad, compás y largo</button>
      <button class="pill" data-m="exp">📤 Bajar audio o MIDI</button>
      <button class="pill" data-m="opt">⚙️ Opciones</button>
      <button class="pill" data-m="who">👥 Cambiar quién toca</button>
      ${HUB ? '<button class="pill" data-m="hub">🏠 Todos los juegos</button>' : ''}</div>`);
  $('#ov').addEventListener('click', (e) => {
    const m = e.target.closest('[data-m]'); if (!m) return;
    ({ songs: songsMenu, song: songMenu, exp: exportMenu, opt: optionsMenu, who: () => { hideOv(); goStart(); }, hub: goHub })[m.dataset.m]();
  });
  $('#songBtn').onclick = songMenu;
  $('#bPlay').onclick = () => (seq.playing ? stop() : play());
  $('#bStop').onclick = () => { if (seq.playing) stop(); A.cursor = 0; roll.sx = 0; staff.sy = 0; roll.dirty = staff.dirty = true; };
  $('#bRec').onclick = toggleRec;
  $('#bLoop').onclick = () => { A.loop = !A.loop; syncTransport(); toast(A.loop ? '🔁 Repetir: sí' : '🔁 Repetir: no'); };
  $('#bMetro').onclick = () => { A.metro = !A.metro; syncTransport(); toast(A.metro ? '🥢 Metrónomo prendido' : '🥢 Metrónomo apagado'); };
  $('#bWrite').onclick = () => { A.write = !A.write; syncTransport(); toast(A.write ? '✍️ Tocá el instrumento y las notas se escriben en la línea punteada' : '✍️ Escribir apagado'); };
  $('#bSharp').onclick = () => { A.sharp = !A.sharp; syncTransport(); };
  $('#bUndo').onclick = undo; $('#bRedo').onclick = redo;
  $$('.zoomB').forEach((b) => b.onclick = () => roll.zoomBy(b.dataset.z === '+' ? 1.3 : 1 / 1.3));
  $$('#durs button').forEach((b) => b.onclick = () => { A.noteLen = +b.dataset.len; syncTransport(); });
  $$('#viewTabs button').forEach((b) => b.onclick = () => { A.view = b.dataset.v; syncTransport(); (A.view === 'roll' ? roll : staff).resize(); });
}

// ---------- arranque ----------
roll = new Roll($('#rollHost'), A);
staff = new Staff($('#staffHost'), A);
bind(); applyTheme(); renderWho(); syncTransport();
A.song = null;
requestAnimationFrame(frame);
// contar notas tocadas por jugador (para el modo juego que viene)
const _on = A.noteOn;
A.noteOn = (...args) => { for (const p of selPlayers()) p.notes = (p.notes || 0) + 1; clearTimeout(A._st); A._st = setTimeout(save, 1500); return _on(...args); };
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__estudio = A; // para depurar
