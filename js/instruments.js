// Instrumentos tocables (teclado, guitarra, bajo, batería, arpa, armónica, bandoneón, acordeón, flauta).
import { INSTRUMENTS, DRUMS } from './audio.js';
import { isBlack, noteName, pc, NOTE_COLORS, PRINCESS_COLORS, GUITAR_CHORDS, SIMPLE_CHORDS, chordNotes, chordLabel } from './music.js';

const SVG = {
  arpa: '<svg viewBox="0 0 64 64"><g stroke="#f6e7b8" stroke-width="1.6">' +
    [20, 25, 30, 35, 40, 45].map((x) => `<line x1="${x}" y1="${8 + (x - 14) * 0.15}" x2="${x}" y2="${16 + 1.5 * (52 - x)}"/>`).join('') +
    '</g><path d="M14 58 L14 9 Q31 -1 52 15 L24 58 Z" fill="none" stroke="#d9952f" stroke-width="5.5" stroke-linejoin="round"/></svg>',
  armonica: '<svg viewBox="0 0 64 64"><rect x="4" y="20" width="56" height="24" rx="6" fill="#c9d2de" stroke="#6d7a8c" stroke-width="2.5"/><rect x="4" y="28" width="56" height="8" fill="#56637a"/>' +
    [...Array(8)].map((_, i) => `<rect x="${8 + i * 6.3}" y="29.5" width="3.8" height="5" rx="1" fill="#1d2433"/>`).join('') + '</svg>',
  bandoneon: '<svg viewBox="0 0 64 64"><rect x="3" y="16" width="18" height="32" rx="3" fill="#5a2f22"/><rect x="43" y="16" width="18" height="32" rx="3" fill="#5a2f22"/>' +
    '<path d="M21 18 L25 22 L29 18 L33 22 L37 18 L41 22 L43 18 L43 46 L41 42 L37 46 L33 42 L29 46 L25 42 L21 46 Z" fill="#c0563f" stroke="#7a2a1c" stroke-width="1.5"/>' +
    [[8, 24], [15, 24], [8, 32], [15, 32], [8, 40], [15, 40], [48, 24], [55, 24], [48, 32], [55, 32], [48, 40], [55, 40]].map(([x, y]) => `<circle cx="${x + 0.5}" cy="${y}" r="2.6" fill="#f3ecdf"/>`).join('') + '</svg>',
};
export function iconHTML(inst) {
  const i = INSTRUMENTS[inst].icon;
  return i.startsWith('svg:') ? `<span class="ico svg">${SVG[i.slice(4)]}</span>` : `<span class="ico">${i}</span>`;
}

const NAT_PC = [0, 2, 4, 5, 7, 9, 11];
const fit = (w, min, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(w / min)));

function naturalsFrom(base, count) { // lista de teclas blancas desde "base" (un Do)
  const out = []; let m = base;
  while (out.length < count) { if (!isBlack(m)) out.push(m); m++; }
  return out;
}

export function buildPanel(host, A) {
  const inst = A.track.inst, I = INSTRUMENTS[inst];
  const ps = A.panelState(inst);
  const W = host.clientWidth || 360, narrow = W < 600;
  const COLS = A.princess ? PRINCESS_COLORS : NOTE_COLORS;
  const names = A.prefs.names;
  const nm = (m, oct = false) => noteName(m, names, oct);
  let controls = '', body = '', glide = false, lightable = true;

  const octCtl = (label) => `<div class="octCtl"><button class="ib sm" data-act="oct-">◀</button><span>${label}</span><button class="ib sm" data-act="oct+">▶</button></div>`;

  if (I.view === 'keys' || I.view === 'accordion') {
    glide = true;
    const nW = fit(W - (I.view === 'accordion' && !narrow ? 150 : 0), narrow ? 34 : 50, 7, 29);
    const base = 12 * (ps.oct + 1);
    const whites = naturalsFrom(base, nW), last = whites[whites.length - 1];
    const ww = 100 / nW;
    let keys = whites.map((m) => `<button class="wk" data-p="${m}"><i style="background:${COLS[pc(m)]}"></i><b>${nm(m, pc(m) === 0)}</b></button>`).join('');
    whites.forEach((m, i) => { if (m + 1 <= last && isBlack(m + 1)) keys += `<button class="bk" data-p="${m + 1}" style="left:${(i + 1) * ww - ww * 0.31}%;width:${ww * 0.62}%"></button>`; });
    controls = octCtl(nm(whites[0], true) + ' – ' + nm(last, true));
    let bass = '';
    if (I.view === 'accordion') {
      bass = `<div class="bajos">${SIMPLE_CHORDS.slice(0, narrow ? 6 : 10).map(([n, r, k]) => {
        const notes = [36 + r, ...chordNotes(r, k, 48)];
        return `<button class="bajo" data-ch="${notes.join(',')}"><b>${chordLabel(n, names)}</b></button>`;
      }).join('')}</div><div class="fuelle"></div>`;
    }
    body = `<div class="kbWrap ${I.view}">${bass}<div class="kb">${keys}</div></div>`;
  } else if (I.view === 'frets') {
    lightable = false;
    const cols = fit(W - 56, narrow ? 46 : 70, 5, I.frets + 1);
    const f0 = Math.max(0, Math.min(ps.fret, I.frets + 1 - cols));
    const rows = I.strings.map((open, si) => {
      let cells = '';
      for (let f = f0; f < f0 + cols; f++) {
        const m = open + f;
        cells += `<button class="fc${f === 0 ? ' open' : ''}" data-p="${m}"><span style="--c:${COLS[pc(m)]}">${nm(m)}</span></button>`;
      }
      return `<div class="str" style="--w:${1 + si * (inst === 'bajo' ? 1.2 : 0.55)}px"><em>${nm(open)}</em>${cells}</div>`;
    }).join('');
    let marks = '';
    for (let f = f0; f < f0 + cols; f++) marks += `<span>${[3, 5, 7, 9, 15].includes(f) ? '●' : f === 12 ? '●●' : ''}<small>${f === 0 ? 'aire' : f}</small></span>`;
    controls = octCtl('trastes ' + f0 + '–' + (f0 + cols - 1));
    const chords = inst === 'guitarra' ? `<div class="chords">${GUITAR_CHORDS.slice(0, narrow ? 8 : 11).map((c) => `<button class="chord" data-ch="${c.notes.join(',')}" data-strum="1">${chordLabel(c.n, names)}</button>`).join('')}</div>` : '';
    body = `<div class="neck n-${inst}">${chords}<div class="board">${rows}</div><div class="marks"><em></em>${marks}</div></div>`;
  } else if (I.view === 'harp') {
    glide = true;
    const n = fit(W - 20, narrow ? 24 : 32, 10, 33);
    const base = 12 * (ps.oct + 1);
    const notes = naturalsFrom(base, n);
    controls = octCtl(nm(notes[0], true) + ' – ' + nm(notes[n - 1], true));
    body = `<div class="harp">${notes.map((m, i) => `<button class="hs ${pc(m) === 0 ? 'c' : pc(m) === 5 ? 'f' : ''}" data-p="${m}" style="--h:${100 - (i / (n - 1)) * 42}%"><i></i><b>${nm(m)}</b></button>`).join('')}</div>`;
  } else if (I.view === 'harmonica') {
    glide = true;
    const blow = [60, 64, 67, 72, 76, 79, 84, 88, 91, 96], draw = [62, 67, 71, 74, 77, 81, 83, 86, 89, 93];
    controls = '<span class="hint">⬆ soplar · ⬇ aspirar</span>';
    body = `<div class="harmo"><div class="hrow">${blow.map((m) => `<button class="hh" data-p="${m}"><span>⬆</span><b>${nm(m)}</b></button>`).join('')}</div>
      <div class="hbody">${blow.map((_, i) => `<span><i></i>${i + 1}</span>`).join('')}</div>
      <div class="hrow">${draw.map((m) => `<button class="hh draw" data-p="${m}"><b>${nm(m)}</b><span>⬇</span></button>`).join('')}</div></div>`;
  } else if (I.view === 'bando') {
    const side = (from, cls) => {
      const rows = [];
      for (let r = 3; r >= 0; r--) {
        let row = '';
        for (let c = 0; c < 6; c++) { const m = from + r * 6 + c; row += `<button class="bb" data-p="${m}" style="--c:${COLS[pc(m)]}"><b>${nm(m)}</b></button>`; }
        rows.push(`<div class="brow ${r % 2 ? 'odd' : ''}">${row}</div>`);
      }
      return `<div class="bcaja ${cls}"><small>${cls === 'izq' ? 'Mano izquierda' : 'Mano derecha'}</small>${rows.join('')}</div>`;
    };
    body = `<div class="bando">${side(43, 'izq')}<div class="fuelle v"></div>${side(64, 'der')}</div>`;
  } else if (I.view === 'flute') {
    glide = true;
    const n = fit(W - 90, narrow ? 34 : 60, 8, 15);
    const base = 12 * (ps.oct + 1);
    const whites = naturalsFrom(base, n), last = whites[n - 1];
    const ww = 100 / n;
    let sharps = '';
    whites.forEach((m, i) => { if (m + 1 <= last && isBlack(m + 1)) sharps += `<button class="fk s" data-p="${m + 1}" style="left:${(i + 1) * ww}%"><b>♯</b></button>`; });
    controls = octCtl(nm(whites[0], true) + ' – ' + nm(last, true));
    body = `<div class="flute"><div class="boquilla"><i></i></div><div class="tubo"><div class="sharps">${sharps}</div><div class="nats">${whites.map((m) => `<button class="fk" data-p="${m}" style="--c:${COLS[pc(m)]}"><i></i><b>${nm(m, pc(m) === 0)}</b></button>`).join('')}</div></div></div>`;
  } else if (I.view === 'drums') {
    const wide = W >= 860;
    const tab = ps.tab || 'kit';
    const list = wide ? DRUMS : DRUMS.filter((d) => d.g === tab);
    const order = wide ? list : list;
    controls = wide ? '' : `<div class="tabs"><button class="pill ${tab === 'kit' ? 'on' : ''}" data-act="tab-kit">🥁 Batería</button><button class="pill ${tab === 'perc' ? 'on' : ''}" data-act="tab-perc">🪘 Percusión</button></div>`;
    body = `<div class="pads ${wide ? 'wide' : ''}">${order.map((d) => `<button class="pad ${[49, 51, 46, 42, 81].includes(d.id) ? 'cym' : ''} ${d.g}" data-p="${d.id}" style="--c:${COLS[(DRUMS.indexOf(d) * 5) % 12]}"><span>${d.e}</span><b>${narrow ? d.short || d.n : d.n}</b></button>`).join('')}</div>`;
  }

  host.innerHTML = `<div class="phead"><div class="pname">${iconHTML(inst)}<b>${I.short || I.name}</b></div><div class="pctl">${controls}</div></div><div class="pbody v-${I.view}">${body}</div>`;
  host.dataset.view = I.view;

  // controles
  host.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'oct-' || a === 'oct+') {
      const d = a === 'oct-' ? -1 : 1;
      if (I.view === 'frets') ps.fret = Math.max(0, Math.min(I.frets - 3, ps.fret + d * 3));
      else ps.oct = Math.max(Math.floor(I.range[0] / 12) - 1, Math.min(Math.floor(I.range[1] / 12) - 2, ps.oct + d));
    }
    if (a.startsWith('tab-')) ps.tab = a.slice(4);
    A.savePanel(); buildPanel(host, A); A.panelRebuilt();
  }));

  // tocar (multitoque + deslizar)
  const act = new Map();
  const press = (el) => {
    el.classList.add('on');
    if (el.classList.contains('hs')) { el.classList.remove('vib'); void el.offsetWidth; el.classList.add('vib'); }
    A.fx(el);
    if (el.dataset.ch) return A.chordOn(el.dataset.ch.split(',').map(Number), !!el.dataset.strum);
    return A.noteOn(+el.dataset.p);
  };
  const rel = (a) => { a.el.classList.remove('on'); A.noteOff(a.tok); };
  const pb = host.querySelector('.pbody');
  pb.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-p],[data-ch]'); if (!el) return;
    e.preventDefault();
    try { pb.setPointerCapture(e.pointerId); } catch {}
    const old = act.get(e.pointerId); if (old) rel(old);
    act.set(e.pointerId, { el, tok: press(el) });
  });
  pb.addEventListener('pointermove', (e) => {
    const a = act.get(e.pointerId); if (!a || !glide) return;
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const el = t && pb.contains(t) ? t.closest('[data-p]') : null;
    if (el && el !== a.el && !a.el.dataset.ch) { rel(a); act.set(e.pointerId, { el, tok: press(el) }); }
  });
  const up = (e) => { const a = act.get(e.pointerId); if (a) { rel(a); act.delete(e.pointerId); } };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => pb.addEventListener(ev, up));
  pb.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest('[data-p],[data-ch]'); if (!el || e.repeat) return;
    e.preventDefault(); const tok = press(el); setTimeout(() => rel({ el, tok }), 280);
  });
  pb.addEventListener('contextmenu', (e) => e.preventDefault());

  let lit = new Set();
  return {
    inst,
    base: () => (I.view === 'frets' ? I.strings[I.strings.length - 1] + 12 * (inst === 'bajo' ? 0 : 1) : 12 * (ps.oct + 1)),
    light(set) {
      if (!lightable) return;
      const next = new Set(set);
      for (const p of lit) if (!next.has(p)) host.querySelectorAll(`[data-p="${p}"]`).forEach((e) => e.classList.remove('pb'));
      for (const p of next) if (!lit.has(p)) host.querySelectorAll(`[data-p="${p}"]`).forEach((e) => e.classList.add('pb'));
      lit = next;
      host.classList.toggle('sounding', next.size > 0 || act.size > 0);
    },
  };
}
