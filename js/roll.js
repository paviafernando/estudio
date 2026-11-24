// "Escalera": diagrama de tiempo (piano roll). Cada nota es un bloque: su altura es la nota
// y su largo es cuánto dura. La línea que avanza va marcando lo que suena y cuánto le falta.
import { DRUMS, INSTRUMENTS } from './audio.js';
import { isBlack, noteName, pc, NOTE_COLORS, PRINCESS_COLORS, barSteps, totalSteps, beatSteps } from './music.js';

const THEMES = {
  normal: { bg: '#141c38', alt: '#172042', blk: '#10172e', grid: '#222d55', beat: '#33427a', bar: '#6f85dd', text: '#d4dcff', soft: 'rgba(212,220,255,.55)', ruler: '#0d132b', dim: 'rgba(5,8,20,.55)', head: '#ffc94d', keyW: '#e9edff', keyB: '#2a3360', ghost: .22 },
  princess: { bg: '#fff6fb', alt: '#ffedf6', blk: '#fbe0ee', grid: '#f6d0e2', beat: '#eeb0cf', bar: '#d070a8', text: '#7d2963', soft: 'rgba(125,41,99,.6)', ruler: '#ffe3f0', dim: 'rgba(255,220,238,.6)', head: '#ff4f97', keyW: '#ffffff', keyB: '#e7a6cb', ghost: .3 },
};

const rr = (g, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };

export class Roll {
  constructor(host, A) {
    this.A = A; this.host = host;
    this.cv = document.createElement('canvas'); this.cv.className = 'rollCv';
    host.appendChild(this.cv);
    this.g = this.cv.getContext('2d');
    this.sx = 0; this.sy = null; this.zoom = 1; this.dirty = true;
    new ResizeObserver(() => { this.resize(); }).observe(host);
    this.cv.addEventListener('pointerdown', (e) => this.down(e));
    this.cv.addEventListener('pointermove', (e) => this.move(e));
    this.cv.addEventListener('pointerup', (e) => this.up(e));
    this.cv.addEventListener('pointercancel', () => { this.drag = null; });
    this.cv.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    this.resize();
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = this.host.clientWidth; this.H = this.host.clientHeight;
    this.cv.width = Math.max(1, Math.round(this.W * dpr)); this.cv.height = Math.max(1, Math.round(this.H * dpr));
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dirty = true;
  }
  get drums() { return !!INSTRUMENTS[this.A.track.inst].drums; }
  rows() {
    if (this.drums) return DRUMS.map((d) => d.id);
    const [lo, hi] = INSTRUMENTS[this.A.track.inst].range;
    const out = []; for (let m = hi; m >= lo; m--) out.push(m);
    return out;
  }
  L() {
    const small = this.W < 640, d = this.drums;
    const KW = d ? (small ? 96 : 150) : (small ? 46 : 64);
    const RH = small ? 22 : 26;
    const rowH = d ? (small ? 26 : Math.max(26, Math.min(34, (this.H - RH) / DRUMS.length))) : (small ? 18 : 21);
    const bars = small ? 1 : this.W < 1100 ? 2 : 2;
    const cellW = Math.max(6, Math.min(90, ((this.W - KW) / (barSteps(this.A.song) * bars)) * this.zoom));
    const rows = this.rows();
    return { small, KW, RH, rowH, cellW, rows, total: totalSteps(this.A.song) };
  }
  clamp(L) {
    const cw = L.total * L.cellW, ch = L.rows.length * L.rowH;
    this.sx = Math.max(0, Math.min(this.sx, Math.max(0, cw - (this.W - L.KW) + 20)));
    this.sy = Math.max(0, Math.min(this.sy, Math.max(0, ch - (this.H - L.RH))));
  }
  center(L) { // al cambiar de pista: centrar en las notas o en el Do central
    const notes = this.A.track.notes;
    let idx;
    if (this.drums) idx = 0;
    else {
      const avg = notes.length ? notes.reduce((a, n) => a + n.p, 0) / notes.length : 66;
      idx = L.rows.indexOf(Math.round(avg)); if (idx < 0) idx = Math.floor(L.rows.length / 2);
    }
    this.sy = idx * L.rowH - (this.H - L.RH) / 2;
    this.clamp(L);
  }
  resetView() { this.sy = null; this.sx = 0; this.dirty = true; }
  zoomBy(f) {
    const L0 = this.L(); const st = this.sx / L0.cellW;
    this.zoom = Math.max(0.35, Math.min(4, this.zoom * f));
    const L1 = this.L(); this.sx = st * L1.cellW; this.clamp(L1); this.dirty = true;
  }
  stepAt(x, L) { return (x - L.KW + this.sx) / L.cellW; }
  rowAt(y, L) { return Math.floor((y - L.RH + this.sy) / L.rowH); }
  hit(x, y, L) {
    const tr = this.A.track, row = this.rowAt(y, L), st = this.stepAt(x, L);
    if (row < 0 || row >= L.rows.length) return null;
    const p = L.rows[row];
    for (let i = tr.notes.length - 1; i >= 0; i--) { const n = tr.notes[i]; if (n.p === p && st >= n.s && st < n.s + n.d) return n; }
    return null;
  }
  pt(e) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  down(e) {
    const L = this.L(), { x, y } = this.pt(e), A = this.A;
    this.cv.setPointerCapture(e.pointerId);
    const d = { x0: x, y0: y, sx0: this.sx, sy0: this.sy, moved: false, mode: 'pan' };
    if (y < L.RH && x > L.KW) { d.mode = 'seek'; A.seek(Math.max(0, Math.floor(this.stepAt(x, L) / A.snap) * A.snap)); }
    else if (x < L.KW && y > L.RH) { d.mode = 'key'; const r = this.rowAt(y, L); if (L.rows[r] != null) A.audition(L.rows[r]); }
    else {
      const n = this.hit(x, y, L);
      if (n) {
        const right = L.KW + (n.s + n.d) * L.cellW - this.sx;
        d.mode = !this.drums && x > right - Math.min(14, n.d * L.cellW / 3) ? 'resize' : 'move';
        d.note = n; d.orig = { ...n };
      }
    }
    this.drag = d; this.dirty = true;
  }
  move(e) {
    const d = this.drag; if (!d) return;
    const L = this.L(), { x, y } = this.pt(e), A = this.A;
    const dx = x - d.x0, dy = y - d.y0;
    if (!d.moved && Math.hypot(dx, dy) > 7) {
      d.moved = true;
      if (d.mode === 'move' || d.mode === 'resize') A.commit();
    }
    if (!d.moved) return;
    if (d.mode === 'pan') { this.sx = d.sx0 - dx; this.sy = d.sy0 - dy; this.clamp(L); }
    else if (d.mode === 'seek') A.seek(Math.max(0, Math.floor(this.stepAt(x, L) / A.snap) * A.snap));
    else if (d.mode === 'move') {
      const ds = Math.round(dx / L.cellW / A.snap) * A.snap;
      const dr = Math.round(dy / L.rowH);
      const r0 = L.rows.indexOf(d.orig.p), r = Math.max(0, Math.min(L.rows.length - 1, r0 + dr));
      const np = L.rows[r];
      d.note.s = Math.max(0, Math.min(L.total - 1, d.orig.s + ds));
      if (np !== d.note.p) { d.note.p = np; A.audition(np, 0.25); }
    } else if (d.mode === 'resize') {
      d.note.d = Math.max(1, Math.round((d.orig.d * L.cellW + dx) / L.cellW / A.snap) * A.snap || 1);
    }
    this.dirty = true;
  }
  up(e) {
    const d = this.drag; this.drag = null; if (!d) return;
    const L = this.L(), A = this.A, tr = A.track;
    if (!d.moved && d.mode === 'pan') {
      const row = this.rowAt(d.y0, L); const p = L.rows[row];
      if (p != null && d.y0 > L.RH) {
        const s = Math.floor(this.stepAt(d.x0, L) / A.snap) * A.snap;
        if (s >= 0 && s < L.total) {
          A.commit();
          tr.notes.push({ p, s, d: this.drums ? 1 : Math.min(A.noteLen, L.total - s), v: 0.85 });
          A.audition(p); A.cursor = Math.min(L.total, s + A.noteLen); A.changed();
        }
      }
    } else if (!d.moved && (d.mode === 'move' || d.mode === 'resize')) {
      A.commit(); tr.notes.splice(tr.notes.indexOf(d.note), 1); A.changed();
    } else if (d.moved && (d.mode === 'move' || d.mode === 'resize')) A.changed();
    this.dirty = true;
  }
  wheel(e) {
    e.preventDefault();
    if (e.ctrlKey) { this.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); return; }
    const L = this.L();
    if (e.shiftKey) this.sx += e.deltaY; else { this.sx += e.deltaX; this.sy += e.deltaY; }
    this.clamp(L); this.dirty = true;
  }

  draw(force) {
    const A = this.A;
    if (!force && !this.dirty && A.pos == null && !A.liveChanged) return;
    this.dirty = false;
    const g = this.g, W = this.W, H = this.H; if (!W || !H) return;
    const L = this.L(); if (this.sy == null) this.center(L);
    const T = THEMES[A.princess ? 'princess' : 'normal'];
    const COLS = A.princess ? PRINCESS_COLORS : NOTE_COLORS;
    const s = A.song, tr = A.track, pos = A.pos, bs = barSteps(s), bt = beatSteps(s);
    // seguir la reproducción
    if (pos != null && A.prefs.follow && !this.drag) {
      const px = L.KW + pos * L.cellW - this.sx;
      if (px > W - 30 || px < L.KW) { this.sx = pos * L.cellW - (W - L.KW) * 0.08; this.clamp(L); }
    }
    const X = (st) => L.KW + st * L.cellW - this.sx;
    const Y = (r) => L.RH + r * L.rowH - this.sy;
    g.fillStyle = T.bg; g.fillRect(0, 0, W, H);
    const r0 = Math.max(0, Math.floor(this.sy / L.rowH)), r1 = Math.min(L.rows.length - 1, Math.ceil((this.sy + H - L.RH) / L.rowH));
    const s0 = Math.max(0, Math.floor(this.sx / L.cellW)), s1 = Math.ceil((this.sx + W - L.KW) / L.cellW);
    // filas
    for (let r = r0; r <= r1; r++) {
      const p = L.rows[r];
      if (this.drums) g.fillStyle = DRUMS[r].g === 'perc' ? T.alt : (r % 2 ? T.bg : T.alt);
      else g.fillStyle = isBlack(p) ? T.blk : (Math.floor(p / 12) % 2 ? T.alt : T.bg);
      g.fillRect(L.KW, Y(r), W - L.KW, L.rowH);
      if (!this.drums && pc(p) === 0) { g.fillStyle = T.grid; g.fillRect(L.KW, Y(r) + L.rowH - 1, W - L.KW, 1); }
    }
    // líneas de tiempo
    for (let st = s0; st <= Math.min(s1, L.total); st++) {
      const x = Math.round(X(st)) + 0.5;
      const isBar = st % bs === 0, isBeat = st % bt === 0;
      if (!isBar && !isBeat && L.cellW < 9) continue;
      g.strokeStyle = isBar ? T.bar : isBeat ? T.beat : T.grid; g.lineWidth = isBar ? 2 : 1;
      g.beginPath(); g.moveTo(x, L.RH); g.lineTo(x, H); g.stroke();
    }
    // fuera del loop
    const endX = X(L.total); if (endX < W) { g.fillStyle = T.dim; g.fillRect(Math.max(L.KW, endX), L.RH, W - endX, H); }
    // notas de las otras pistas (fantasma)
    if (!this.drums && A.prefs.ghost !== false) for (const ot of s.tracks) {
      if (ot === tr || INSTRUMENTS[ot.inst].drums) continue;
      g.fillStyle = INSTRUMENTS[ot.inst].color; g.globalAlpha = T.ghost;
      for (const n of ot.notes) {
        const r = L.rows.indexOf(n.p); if (r < r0 || r > r1 || n.s + n.d < s0 || n.s > s1) continue;
        rr(g, X(n.s) + 1, Y(r) + 3, n.d * L.cellW - 2, L.rowH - 6, 4); g.fill();
      }
      g.globalAlpha = 1;
    }
    // notas de la pista elegida
    const fontPx = Math.min(13, L.rowH - 6);
    g.font = `800 ${fontPx}px ui-rounded, Nunito, system-ui, sans-serif`; g.textBaseline = 'middle';
    for (const n of tr.notes) {
      const r = this.drums ? DRUMS.findIndex((d) => d.id === n.p) : L.rows.indexOf(n.p);
      if (r < 0 || r < r0 - 1 || r > r1 + 1 || n.s + n.d < s0 - 1 || n.s > s1 + 1) continue;
      const x = X(n.s) + 1, y = Y(r) + 1, w = Math.max(3, n.d * L.cellW - 2), h = L.rowH - 2;
      const col = this.drums ? COLS[(r * 5) % 12] : COLS[pc(n.p)];
      const on = pos != null && pos >= n.s && pos < n.s + n.d;
      if (on) { g.shadowColor = col; g.shadowBlur = 16; }
      g.fillStyle = col; rr(g, x, y, w, h, Math.min(7, h / 2.5)); g.fill();
      g.shadowBlur = 0;
      if (on) { // lo que ya sonó de la nota
        g.save(); rr(g, x, y, w, h, Math.min(7, h / 2.5)); g.clip();
        g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x, y, w * (pos - n.s) / n.d, h);
        g.restore();
        g.strokeStyle = '#fff'; g.lineWidth = 2; rr(g, x, y, w, h, Math.min(7, h / 2.5)); g.stroke();
      } else { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; rr(g, x + .5, y + .5, w - 1, h - 1, Math.min(7, h / 2.5)); g.stroke(); }
      if (this.drag && this.drag.note === n) { g.strokeStyle = T.head; g.lineWidth = 3; rr(g, x, y, w, h, 6); g.stroke(); }
      if (!this.drums && w > 26 && h >= 13) {
        g.fillStyle = 'rgba(20,15,40,.85)';
        const label = (A.princess ? '♥ ' : '') + noteName(n.p, A.prefs.names, w > 44);
        g.fillText(label, x + 5, y + h / 2 + 1, w - 8);
      } else if (A.princess && w > 14 && h >= 13) { g.fillStyle = 'rgba(255,255,255,.9)'; g.fillText('♥', x + 3, y + h / 2 + 1); }
    }
    // regla de compases
    g.fillStyle = T.ruler; g.fillRect(L.KW, 0, W - L.KW, L.RH);
    g.fillStyle = T.text; g.font = `800 ${L.small ? 12 : 14}px ui-rounded, Nunito, system-ui, sans-serif`;
    for (let b = 0; b * bs <= L.total; b++) {
      const x = X(b * bs); if (x < L.KW - 40 || x > W) continue;
      if (b * bs < L.total) g.fillText(String(b + 1), x + 5, L.RH / 2 + 1);
      g.fillRect(Math.round(x), 0, 2, L.RH);
    }
    // cursor de escritura / línea que avanza
    if (pos != null) {
      const x = X(pos);
      if (x >= L.KW) {
        g.fillStyle = T.head; g.shadowColor = T.head; g.shadowBlur = 10;
        g.fillRect(x - 1.5, L.RH, 3, H - L.RH); g.shadowBlur = 0;
        g.beginPath(); g.moveTo(x - 8, 0); g.lineTo(x + 8, 0); g.lineTo(x, L.RH - 4); g.fill();
        if (A.princess) { g.font = '16px serif'; g.fillText('👑', x - 9, L.RH + 10); }
      }
    } else {
      const x = X(A.cursor);
      if (x >= L.KW && x <= W) {
        g.strokeStyle = T.head; g.lineWidth = 2; g.setLineDash([6, 5]);
        g.beginPath(); g.moveTo(x, L.RH); g.lineTo(x, H); g.stroke(); g.setLineDash([]);
        g.fillStyle = T.head; g.beginPath(); g.moveTo(x - 7, 0); g.lineTo(x + 7, 0); g.lineTo(x, L.RH - 6); g.fill();
      }
    }
    // teclas / nombres de la izquierda
    g.fillStyle = T.ruler; g.fillRect(0, 0, L.KW, H);
    const sounding = A.sounding;
    for (let r = r0; r <= r1; r++) {
      const p = L.rows[r], y = Y(r);
      const lit = sounding.has(p);
      if (this.drums) {
        const dd = DRUMS[r];
        g.fillStyle = lit ? COLS[(r * 5) % 12] : (r % 2 ? T.bg : T.alt); g.fillRect(0, y, L.KW - 2, L.rowH - 1);
        g.font = `${Math.min(18, L.rowH - 8)}px serif`; g.fillStyle = T.text; g.fillText(dd.e, 4, y + L.rowH / 2 + 1);
        g.font = `800 ${L.small ? 11 : 13}px ui-rounded, Nunito, system-ui, sans-serif`;
        g.fillText(L.small ? (dd.short || dd.n) : dd.n, 4 + Math.min(22, L.rowH), y + L.rowH / 2 + 1, L.KW - 30);
      } else {
        const blk = isBlack(p);
        g.fillStyle = lit ? COLS[pc(p)] : blk ? T.keyB : T.keyW;
        g.fillRect(0, y, blk ? L.KW * 0.62 : L.KW - 2, L.rowH - 1);
        if (!blk && (pc(p) === 0 || L.rowH >= 20 || lit)) {
          g.fillStyle = pc(p) === 0 ? '#20284f' : '#556';
          g.font = `800 ${Math.min(12, L.rowH - 7)}px ui-rounded, Nunito, system-ui, sans-serif`;
          g.fillText(noteName(p, A.prefs.names, pc(p) === 0), L.KW * 0.38, y + L.rowH / 2 + 1, L.KW * 0.6);
        }
      }
    }
    g.fillStyle = T.ruler; g.fillRect(0, 0, L.KW, L.RH);
  }
}
