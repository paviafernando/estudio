// Pentagrama: muestra la canción en partitura (con notas de colores) y deja escribir tocando.
import { INSTRUMENTS, DRUM_BY_ID } from './audio.js';
import { pc, NOTE_COLORS, PRINCESS_COLORS, barSteps, totalSteps } from './music.js';

const SPELL = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
const NAT = [0, 2, 4, 5, 7, 9, 11];
const diat = (m) => (Math.floor(m / 12) - 1) * 7 + SPELL[pc(m)][0];
const sharp = (m) => SPELL[pc(m)][1];
const fromDiat = (d) => (Math.floor(d / 7) + 1) * 12 + NAT[((d % 7) + 7) % 7];

// Batería en el pentagrama (posición desde la primera línea, x = cabeza en cruz)
const DRUM_POS = { 49: [10, 1], 51: [8, 1], 46: [9, 1], 42: [9, 1], 50: [7], 47: [6], 43: [3], 38: [5], 37: [5, 1], 36: [1], 39: [4, 1], 54: [11, 1], 70: [12, 1], 56: [11], 63: [7], 64: [4], 60: [8], 61: [6], 76: [12], 75: [13], 81: [13, 1] };
const DRUM_TAP = { 1: 36, 3: 43, 4: 64, 5: 38, 6: 47, 7: 50, 8: 51, 9: 42, 10: 49, 11: 54, 12: 70, 13: 81 };

function clefsFor(inst) {
  if (INSTRUMENTS[inst].drums) return [{ clef: 'perc', ref: 30, test: () => true }];
  if (['piano', 'arpa', 'bandoneon'].includes(inst)) return [
    { clef: 'G', ref: 30, test: (p) => p >= 60, shift: 0 },
    { clef: 'F', ref: 18, test: (p) => p < 60, shift: 0 }];
  if (inst === 'bajo') return [{ clef: 'F', ref: 18, test: () => true, shift: 12, eight: true }];
  if (inst === 'guitarra') return [{ clef: 'G', ref: 30, test: () => true, shift: 12, eight: true }];
  return [{ clef: 'G', ref: 30, test: () => true, shift: 0 }];
}
const DURS = [[16, 'w', 0], [12, 'h', 1], [8, 'h', 0], [6, 'q', 1], [4, 'q', 0], [3, 'e', 1], [2, 'e', 0], [1, 's', 0]];
const glyphFor = (d) => DURS.find(([n]) => n <= d) || DURS[DURS.length - 1];

let glyphOK = null;
function hasClefGlyphs() {
  if (glyphOK != null) return glyphOK;
  const c = document.createElement('canvas').getContext('2d');
  c.font = '40px "Noto Music", "Bravura", "Segoe UI Symbol", serif';
  const a = c.measureText('𝄞').width, b = c.measureText('\u{10FFFD}').width;
  glyphOK = a > 5 && Math.abs(a - b) > 0.5;
  return glyphOK;
}

export class Staff {
  constructor(host, A) {
    this.A = A; this.host = host;
    this.cv = document.createElement('canvas'); this.cv.className = 'staffCv';
    host.appendChild(this.cv); this.g = this.cv.getContext('2d');
    this.sy = 0; this.dirty = true;
    new ResizeObserver(() => this.resize()).observe(host);
    this.cv.addEventListener('pointerdown', (e) => { this.cv.setPointerCapture(e.pointerId); const p = this.pt(e); this.drag = { ...p, sy0: this.sy, moved: false }; });
    this.cv.addEventListener('pointermove', (e) => {
      const d = this.drag; if (!d) return; const p = this.pt(e);
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) > 8) d.moved = true;
      if (d.moved) { this.sy = d.sy0 - (p.y - d.y); this.clampY(); this.dirty = true; }
    });
    this.cv.addEventListener('pointerup', () => { const d = this.drag; this.drag = null; if (d && !d.moved) this.tap(d.x, d.y); });
    this.cv.addEventListener('pointercancel', () => { this.drag = null; });
    this.cv.addEventListener('wheel', (e) => { e.preventDefault(); this.sy += e.deltaY; this.clampY(); this.dirty = true; }, { passive: false });
    this.resize();
  }
  pt(e) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = this.host.clientWidth; this.H = this.host.clientHeight;
    this.cv.width = Math.max(1, Math.round(this.W * dpr)); this.cv.height = Math.max(1, Math.round(this.H * dpr));
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0); this.dirty = true;
  }
  L() {
    const s = this.A.song, small = this.W < 640;
    const LS = small ? 10 : Math.min(15, Math.max(11, this.H / 26));
    const staves = clefsFor(this.A.track.inst);
    const bs = barSteps(s), total = totalSteps(s);
    const margin = small ? 8 : 18, clefW = LS * 3.4, tsW = LS * 2.4;
    const minBar = Math.max(LS * 8, bs * (small ? 12 : 15) + LS * 2);
    const avail = this.W - margin * 2 - clefW - tsW;
    const bpl = Math.max(1, Math.min(s.bars, Math.floor(avail / minBar)));
    const barW = avail / bpl;
    const staffBlock = LS * 4, padTop = LS * 4.5, gap = LS * 7, padBot = LS * 4.5;
    const sysH = padTop + staves.length * staffBlock + (staves.length - 1) * gap + padBot;
    const nSys = Math.ceil(s.bars / bpl);
    return { LS, staves, bs, total, margin, clefW, tsW, bpl, barW, staffBlock, padTop, gap, sysH, nSys, top: 8, small };
  }
  clampY() { const L = this.L(); this.sy = Math.max(0, Math.min(this.sy, Math.max(0, L.top + L.nSys * L.sysH - this.H + 10))); }
  sysY(L, i) { return L.top + i * L.sysH - this.sy; }
  staffBottom(L, sysTop, k) { return sysTop + L.padTop + k * (L.staffBlock + L.gap) + L.staffBlock; }
  barX(L, b) { return L.margin + L.clefW + L.tsW + (b % L.bpl) * L.barW; }
  noteX(L, st) {
    const b = Math.floor(st / L.bs), x0 = this.barX(L, b), padL = L.LS * 1.8, padR = L.LS * 1.2;
    return x0 + padL + ((st - b * L.bs) / L.bs) * (L.barW - padL - padR);
  }
  ypos(L, bottom, step) { return bottom - step * (L.LS / 2); }
  stepOf(st, n) {
    if (st.clef === 'perc') return (DRUM_POS[n.p] || [5])[0];
    return diat(n.p + (st.shift || 0)) - st.ref;
  }

  tap(x, y) {
    const L = this.L(), A = this.A, tr = A.track, drums = INSTRUMENTS[tr.inst].drums;
    const si = Math.floor((y + this.sy - L.top) / L.sysH); if (si < 0 || si >= L.nSys) return;
    const sysTop = this.sysY(L, si);
    // ¿qué pentagrama?
    let k = 0, best = 1e9;
    L.staves.forEach((st, i) => { const mid = this.staffBottom(L, sysTop, i) - L.LS * 2; const d = Math.abs(y - mid); if (d < best) { best = d; k = i; } });
    const st = L.staves[k], bottom = this.staffBottom(L, sysTop, k);
    const col = Math.floor((x - L.margin - L.clefW - L.tsW) / L.barW); if (col < 0 || col >= L.bpl) return;
    const bar = si * L.bpl + col; if (bar >= A.song.bars) return;
    // ¿tocó una nota? la borra
    for (let i = tr.notes.length - 1; i >= 0; i--) {
      const n = tr.notes[i]; if (Math.floor(n.s / L.bs) !== bar || !st.test(n.p)) continue;
      const nx = this.noteX(L, n.s), ny = this.ypos(L, bottom, this.stepOf(st, n));
      if (Math.abs(nx - x) < L.LS * 0.9 && Math.abs(ny - y) < L.LS * 0.55) { A.commit(); tr.notes.splice(i, 1); A.changed(); return; }
    }
    const padL = L.LS * 1.8, padR = L.LS * 1.2, x0 = this.barX(L, bar);
    let inBar = ((x - x0 - padL) / (L.barW - padL - padR)) * L.bs;
    inBar = Math.max(0, Math.min(L.bs - 1, Math.round(inBar / A.snap - 0.25) * A.snap));
    const step = Math.round((bottom - y) / (L.LS / 2));
    let p;
    if (drums) {
      const keys = Object.keys(DRUM_TAP).map(Number);
      const near = keys.reduce((a, b) => (Math.abs(b - step) < Math.abs(a - step) ? b : a));
      p = DRUM_TAP[near];
    } else {
      p = fromDiat(st.ref + step) - (st.shift || 0) + (A.sharp ? 1 : 0);
      const [lo, hi] = INSTRUMENTS[tr.inst].range; if (p < lo - 12 || p > hi + 12) return;
    }
    const s = bar * L.bs + inBar;
    A.commit();
    tr.notes.push({ p, s, d: drums ? 1 : Math.min(A.noteLen, L.total - s), v: 0.85 });
    A.audition(p); A.cursor = Math.min(L.total, s + A.noteLen); A.changed();
  }

  drawClef(g, L, st, x, bottom, ink) {
    const LS = L.LS;
    if (st.clef === 'perc') { g.fillStyle = ink; g.fillRect(x + LS * 0.6, bottom - LS * 3, LS * 0.45, LS * 2); g.fillRect(x + LS * 1.4, bottom - LS * 3, LS * 0.45, LS * 2); return; }
    if (hasClefGlyphs()) {
      g.fillStyle = ink; g.textBaseline = 'alphabetic';
      if (st.clef === 'G') { g.font = `${LS * 4.4}px "Noto Music","Bravura","Segoe UI Symbol",serif`; g.fillText('𝄞', x, bottom - LS * 0.95); }
      else { g.font = `${LS * 3.6}px "Noto Music","Bravura","Segoe UI Symbol",serif`; g.fillText('𝄢', x + 2, bottom - LS * 1.05); }
    } else {
      g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = Math.max(2, LS * 0.2); g.lineCap = 'round';
      const cx = x + LS * 1.3;
      if (st.clef === 'G') {
        const gy = bottom - LS; // línea de Sol
        g.beginPath();
        g.moveTo(cx + LS * 0.2, bottom + LS * 1.3);
        g.quadraticCurveTo(cx - LS * 0.6, bottom + LS * 1.5, cx - LS * 0.3, bottom + LS * 0.9);
        g.lineTo(cx + LS * 0.3, bottom - LS * 4.7);
        g.quadraticCurveTo(cx + LS * 1.1, bottom - LS * 4.2, cx + LS * 0.2, bottom - LS * 3.2);
        g.bezierCurveTo(cx - LS * 1.3, bottom - LS * 2.2, cx - LS * 1.2, gy + LS * 0.9, cx + LS * 0.2, gy + LS * 0.9);
        g.bezierCurveTo(cx + LS * 1.3, gy + LS * 0.9, cx + LS * 1.2, gy - LS * 0.9, cx + LS * 0.1, gy - LS * 0.8);
        g.quadraticCurveTo(cx - LS * 0.5, gy - LS * 0.6, cx - LS * 0.3, gy + LS * 0.1);
        g.stroke();
        g.beginPath(); g.arc(cx - LS * 0.25, bottom + LS * 1.1, LS * 0.35, 0, 7); g.fill();
      } else {
        const fy = bottom - LS * 3; // línea de Fa
        g.beginPath(); g.arc(cx - LS * 0.4, fy, LS * 0.38, 0, 7); g.fill();
        g.beginPath(); g.moveTo(cx - LS * 0.4, fy - LS * 0.3);
        g.bezierCurveTo(cx + LS * 0.2, fy - LS * 1.4, cx + LS * 1.6, fy - LS * 0.8, cx + LS * 1.3, fy + LS * 0.5);
        g.quadraticCurveTo(cx + LS * 1, fy + LS * 2, cx - LS * 0.8, fy + LS * 2.8); g.stroke();
        g.beginPath(); g.arc(cx + LS * 2, fy - LS * 0.5, LS * 0.2, 0, 7); g.arc(cx + LS * 2, fy + LS * 0.5, LS * 0.2, 0, 7); g.fill();
      }
    }
    if (st.eight) { g.fillStyle = ink; g.font = `800 ${LS}px serif`; g.textBaseline = 'middle'; g.fillText('8', x + LS * 1.1, bottom + LS * 2.1); }
  }

  drawRest(g, L, x, bottom, d, ink) {
    const LS = L.LS; g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = Math.max(1.5, LS * 0.18);
    const mid = bottom - LS * 2;
    if (d >= 16) { g.fillRect(x - LS * 0.6, bottom - LS * 3, LS * 1.2, LS * 0.5); return; }
    if (d >= 8) { g.fillRect(x - LS * 0.6, bottom - LS * 2.5, LS * 1.2, LS * 0.5); return; }
    if (d >= 4) {
      g.beginPath(); g.moveTo(x - LS * 0.2, mid - LS * 1.4); g.lineTo(x + LS * 0.35, mid - LS * 0.6); g.lineTo(x - LS * 0.25, mid + LS * 0.1);
      g.lineTo(x + LS * 0.3, mid + LS * 0.8); g.quadraticCurveTo(x - LS * 0.5, mid + LS * 0.5, x, mid + LS * 1.4); g.stroke(); return;
    }
    const flags = d >= 2 ? 1 : 2;
    g.beginPath(); g.moveTo(x + LS * 0.4, mid - LS * 0.6); g.lineTo(x - LS * 0.1, mid + LS * 1.2); g.stroke();
    for (let i = 0; i < flags; i++) { g.beginPath(); g.arc(x - LS * 0.25 - i * LS * 0.2, mid - LS * 0.5 + i * LS * 0.8, LS * 0.25, 0, 7); g.fill(); }
  }

  draw(force) {
    const A = this.A;
    if (!force && !this.dirty && A.pos == null) return;
    this.dirty = false;
    const g = this.g, W = this.W, H = this.H; if (!W || !H) return;
    const L = this.L(), s = A.song, tr = A.track, LS = L.LS;
    const P = A.princess, COLS = P ? PRINCESS_COLORS : NOTE_COLORS;
    const paper = P ? '#fffafd' : '#fbfaf5', ink = P ? '#6b2257' : '#1f2340', line = P ? '#e6a3c7' : '#8d93ad';
    g.fillStyle = paper; g.fillRect(0, 0, W, H);
    const pos = A.pos;
    // seguir la reproducción
    if (pos != null && A.prefs.follow && !this.drag) {
      const si = Math.floor(Math.floor(pos / L.bs) / L.bpl), top = L.top + si * L.sysH;
      if (top - this.sy < 0 || top + L.sysH - this.sy > H) { this.sy = top - 4; this.clampY(); }
    }
    for (let si = 0; si < L.nSys; si++) {
      const sysTop = this.sysY(L, si); if (sysTop > H || sysTop + L.sysH < 0) continue;
      const b0 = si * L.bpl, b1 = Math.min(s.bars, b0 + L.bpl);
      const xEnd = this.barX(L, b0) + (b1 - b0) * L.barW;
      L.staves.forEach((st, k) => {
        const bottom = this.staffBottom(L, sysTop, k);
        g.strokeStyle = line; g.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) { const y = Math.round(bottom - i * LS) + 0.5; g.beginPath(); g.moveTo(L.margin, y); g.lineTo(xEnd, y); g.stroke(); }
        this.drawClef(g, L, st, L.margin + 2, bottom, ink);
        // compás
        if (si === 0 || true) {
          g.fillStyle = ink; g.font = `900 ${LS * 2.1}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          const tx = L.margin + L.clefW + L.tsW * 0.45;
          if (si === 0) { g.fillText(String(s.num), tx, bottom - LS * 3); g.fillText(String(s.den), tx, bottom - LS); }
          g.textAlign = 'left';
        }
        // barras de compás
        g.strokeStyle = ink; g.lineWidth = 1.5;
        for (let b = b0; b <= b1; b++) {
          const x = Math.round(b < b1 ? this.barX(L, b) : xEnd) + 0.5;
          if (b === b0 && si > 0) continue;
          g.beginPath(); g.moveTo(x, bottom - LS * 4); g.lineTo(x, bottom); g.stroke();
          if (b === s.bars) { g.lineWidth = 4; g.beginPath(); g.moveTo(x + 4, bottom - LS * 4); g.lineTo(x + 4, bottom); g.stroke(); g.lineWidth = 1.5; }
        }
        // número de compás
        if (k === 0) { g.fillStyle = line; g.font = `700 ${Math.max(10, LS * 0.9)}px ui-rounded, system-ui, sans-serif`; g.textBaseline = 'alphabetic'; g.fillText(String(b0 + 1), L.margin + L.clefW + L.tsW, bottom - LS * 4.6); }
        // silencios
        for (let b = b0; b < b1; b++) {
          const cover = new Array(L.bs).fill(false);
          for (const n of tr.notes) {
            if (!st.test(n.p) || Math.floor(n.s / L.bs) !== b) continue;
            for (let i = n.s - b * L.bs; i < Math.min(L.bs, n.s - b * L.bs + n.d); i++) cover[i] = true;
          }
          if (!cover.some(Boolean)) { this.drawRest(g, L, this.barX(L, b) + L.barW / 2, bottom, 16, ink); continue; }
          let i = 0;
          while (i < L.bs) {
            if (cover[i]) { i++; continue; }
            let j = i; while (j < L.bs && !cover[j]) j++;
            while (i < j) {
              const dur = [16, 8, 4, 2, 1].find((dd) => dd <= L.bs && i % dd === 0 && i + dd <= j);
              this.drawRest(g, L, this.noteX(L, b * L.bs + i) + LS * 0.3, bottom, dur, ink);
              i += dur;
            }
          }
        }
        // notas (agrupadas en acordes por inicio y duración)
        const groups = new Map();
        for (const n of tr.notes) {
          if (!st.test(n.p) || n.s >= L.total) continue;
          const b = Math.floor(n.s / L.bs); if (b < b0 || b >= b1) continue;
          const key = n.s + ':' + glyphFor(n.d)[0];
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(n);
        }
        for (const notes of groups.values()) {
          const n0 = notes[0], [, type, dot] = glyphFor(n0.d);
          const x = this.noteX(L, n0.s) + LS * 0.6;
          const steps = notes.map((n) => this.stepOf(st, n));
          const on = notes.map((n) => pos != null && pos >= n.s && pos < n.s + n.d);
          const avg = steps.reduce((a, b) => a + b, 0) / steps.length;
          const up = avg < 4;
          const rx = LS * 0.62, ry = LS * 0.46;
          // líneas adicionales
          g.strokeStyle = ink; g.lineWidth = 1.3;
          for (const stp of steps) {
            for (let k2 = -2; k2 >= stp; k2 -= 2) { const y = this.ypos(L, bottom, k2); g.beginPath(); g.moveTo(x - rx * 1.7, y); g.lineTo(x + rx * 1.7, y); g.stroke(); }
            for (let k2 = 10; k2 <= stp; k2 += 2) { const y = this.ypos(L, bottom, k2); g.beginPath(); g.moveTo(x - rx * 1.7, y); g.lineTo(x + rx * 1.7, y); g.stroke(); }
          }
          // plica
          if (type !== 'w') {
            const ys = steps.map((stp) => this.ypos(L, bottom, stp));
            const sx = up ? x + rx * 0.92 : x - rx * 0.92;
            const yA = up ? Math.max(...ys) : Math.min(...ys), yB = up ? Math.min(...ys) - LS * 3.4 : Math.max(...ys) + LS * 3.4;
            g.strokeStyle = ink; g.lineWidth = Math.max(1.4, LS * 0.13);
            g.beginPath(); g.moveTo(sx, yA); g.lineTo(sx, yB); g.stroke();
            const flags = type === 'e' ? 1 : type === 's' ? 2 : 0;
            for (let f = 0; f < flags; f++) {
              const fy = yB + (up ? 1 : -1) * f * LS * 0.8;
              g.beginPath(); g.moveTo(sx, fy);
              g.bezierCurveTo(sx + LS * 0.2, fy + (up ? 1 : -1) * LS * 0.9, sx + LS * 1.3, fy + (up ? 1 : -1) * LS * 1.2, sx + LS * 0.8, fy + (up ? 1 : -1) * LS * 2.4);
              g.stroke();
            }
          }
          notes.forEach((n, i) => {
            const y = this.ypos(L, bottom, steps[i]);
            const col = st.clef === 'perc' ? INSTRUMENTS.bateria.color : COLS[pc(n.p)];
            const cross = st.clef === 'perc' && (DRUM_POS[n.p] || [])[1];
            if (on[i]) { g.shadowColor = col; g.shadowBlur = 18; }
            const scale = on[i] ? 1.25 : 1;
            if (cross) {
              g.strokeStyle = on[i] ? col : ink; g.lineWidth = 2.2;
              g.beginPath(); g.moveTo(x - rx * scale, y - ry * scale); g.lineTo(x + rx * scale, y + ry * scale); g.moveTo(x - rx * scale, y + ry * scale); g.lineTo(x + rx * scale, y - ry * scale); g.stroke();
            } else {
              g.beginPath(); g.ellipse(x, y, rx * scale, ry * scale, -0.35, 0, Math.PI * 2);
              const hollow = type === 'w' || type === 'h';
              if (A.prefs.colorNotes !== false) {
                g.fillStyle = col; g.fill(); g.lineWidth = hollow ? 2.4 : 1.3; g.strokeStyle = ink; g.stroke();
                if (hollow) { g.beginPath(); g.ellipse(x, y, rx * 0.45, ry * 0.42, -0.35, 0, 7); g.fillStyle = paper; g.fill(); }
              } else if (hollow) { g.lineWidth = 2.2; g.strokeStyle = on[i] ? col : ink; g.stroke(); }
              else { g.fillStyle = on[i] ? col : ink; g.fill(); }
            }
            g.shadowBlur = 0;
            if (dot) { g.fillStyle = ink; g.beginPath(); g.arc(x + rx * 1.8, y - (steps[i] % 2 === 0 ? LS * 0.25 : 0), LS * 0.16, 0, 7); g.fill(); }
            if (st.clef !== 'perc' && sharp(n.p + (st.shift || 0))) {
              g.fillStyle = ink; g.font = `700 ${LS * 1.6}px Georgia, serif`; g.textBaseline = 'middle'; g.fillText('♯', x - rx - LS * 1.15, y + 1);
            }
          });
        }
      });
      // línea que avanza
      const mark = pos != null ? pos : A.cursor;
      const mb = Math.floor(Math.min(mark, L.total - 0.001) / L.bs);
      if (mb >= b0 && mb < b1) {
        const x = this.noteX(L, mark) + LS * 0.6;
        const yA = this.staffBottom(L, sysTop, 0) - LS * 6, yB = this.staffBottom(L, sysTop, L.staves.length - 1) + LS * 2;
        if (pos != null) {
          g.fillStyle = P ? 'rgba(255,79,151,.75)' : 'rgba(255,170,0,.8)';
          g.shadowColor = g.fillStyle; g.shadowBlur = 8; g.fillRect(x - 1.5, yA, 3, yB - yA); g.shadowBlur = 0;
          if (P) { g.font = '16px serif'; g.textBaseline = 'alphabetic'; g.fillText('👑', x - 9, yA); }
        } else {
          g.strokeStyle = P ? '#ff4f97' : '#f0a020'; g.lineWidth = 2; g.setLineDash([5, 5]);
          g.beginPath(); g.moveTo(x, yA); g.lineTo(x, yB); g.stroke(); g.setLineDash([]);
        }
      }
    }
  }
}
