/* =====================================================================
   Living hive background — same comb as quantummindsunited.com,
   plus an audio hook: app.js writes window.HiveAudio = { energy, bass, kick }
   and the comb blooms with the music.
   ===================================================================== */
(() => {
  'use strict';
  const cv = document.getElementById('hive-bg');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const grid = document.createElement('canvas');
  const gctx = grid.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const HR = 34;                     // hex radius (pointy-top)
  const HW = Math.sqrt(3) * HR;      // hex width
  const VS = 1.5 * HR;               // vertical spacing
  let W = 0, H = 0, DPR = 1, cols = 0, rows = 0;
  let lit = [], bees = [], rings = [];
  const mouse = { x: -9999, y: -9999, cell: null };
  const audio = () => window.HiveAudio || { energy: 0, bass: 0, kick: false };

  function hexPath(c, cx, cy, r) {
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (60 * k - 90);
      const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
      k ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }
  const cellCenter = (col, row) => [col * HW + (row % 2 ? HW / 2 : 0), row * VS];

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    [cv, grid].forEach((c) => { c.width = W * DPR; c.height = H * DPR; });
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    gctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cols = Math.ceil(W / HW) + 2; rows = Math.ceil(H / VS) + 2;

    gctx.clearRect(0, 0, W, H);
    gctx.lineWidth = 1;
    gctx.strokeStyle = 'rgba(242,169,59,0.055)';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const [x, y] = cellCenter(c, r);
      hexPath(gctx, x, y, HR - 2);
      gctx.stroke();
    }
    const count = Math.round(Math.min(22, Math.max(10, (W * H) / 70000)));
    bees = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      a: Math.random() * Math.PI * 2, s: 0.25 + Math.random() * 0.45,
      r: 1.2 + Math.random() * 1.6, violet: Math.random() < 0.3, ph: Math.random() * 6.28
    }));
    if (reduceMotion) { seedStatic(); drawFrame(performance.now()); }
  }

  function light(col, row, opts = {}) {
    if (lit.some((l) => l.col === col && l.row === row && l.t < 0.6)) return;
    lit.push({
      col, row, t: 0,
      dur: opts.dur || (2.5 + Math.random() * 3.5),
      violet: opts.violet ?? Math.random() < 0.18,
      peak: opts.peak || (0.12 + Math.random() * 0.2)
    });
  }
  function seedStatic() {
    lit = [];
    for (let i = 0; i < 18; i++) light(Math.floor(Math.random() * cols), Math.floor(Math.random() * rows), { dur: 2 });
    lit.forEach((l) => (l.t = 0.5));
  }

  function nearestCell(x, y) {
    const r0 = Math.round(y / VS);
    let best = null, bd = Infinity;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      const c0 = Math.round((x - (r % 2 ? HW / 2 : 0)) / HW);
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        const [cx, cy] = cellCenter(c, r);
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bd) { bd = d; best = { col: c, row: r }; }
      }
    }
    return best;
  }

  // A kick drum sends a ring of light out through the comb from a random cell.
  function ripple() {
    const col = Math.floor(Math.random() * cols), row = Math.floor(Math.random() * rows * 0.7);
    rings.push({ col, row, r: 0, max: 3 + Math.floor(Math.random() * 2), violet: Math.random() < 0.3, acc: 0 });
  }
  function stepRings(dt) {
    rings = rings.filter((g) => g.r <= g.max);
    rings.forEach((g) => {
      g.acc += dt;
      if (g.acc < 0.045) return;
      g.acc = 0;
      // light every cell roughly on the ring's radius
      const [ox, oy] = cellCenter(g.col, g.row);
      const rad = g.r * HW;
      const steps = Math.max(6, g.r * 6);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const c = nearestCell(ox + Math.cos(a) * rad, oy + Math.sin(a) * rad);
        light(c.col, c.row, { violet: g.violet, peak: 0.2 * (1 - g.r / (g.max + 1)) + 0.04, dur: 1.2 });
      }
      g.r++;
    });
  }

  let last = performance.now(), spawnAcc = 0, running = true, lastRipple = 0;
  function drawFrame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const a = audio();

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(grid, 0, 0, W, H);

    if (!reduceMotion) {
      // ambient cells — faster and brighter with the music
      spawnAcc += dt * (1 + a.energy * 1.6);
      const cap = 26 + Math.round(a.energy * 10);
      if (spawnAcc > 0.22) { spawnAcc = 0; if (lit.length < cap) light(Math.floor(Math.random() * cols), Math.floor(Math.random() * rows), { peak: 0.1 + Math.random() * 0.16 + a.energy * 0.06 }); }
      if (a.kick) { a.kick = false; if (now - lastRipple > 650 && rings.length < 2) { ripple(); lastRipple = now; } }
      stepRings(dt);
    }

    lit = lit.filter((l) => l.t < 1);
    lit.forEach((l) => {
      if (!reduceMotion) l.t += dt / l.dur;
      const alpha = Math.sin(Math.PI * Math.min(1, l.t)) * l.peak;
      const [x, y] = cellCenter(l.col, l.row);
      hexPath(ctx, x, y, HR - 3);
      ctx.fillStyle = l.violet ? `rgba(155,123,234,${alpha})` : `rgba(242,169,59,${alpha})`;
      ctx.fill();
      ctx.strokeStyle = l.violet ? `rgba(185,160,245,${alpha * 1.8})` : `rgba(255,210,122,${alpha * 1.8})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    const speedBoost = 1 + a.energy * 1.2;
    bees.forEach((b) => {
      if (!reduceMotion) {
        b.a += (Math.random() - 0.5) * 0.25;
        const dx = mouse.x - b.x, dy = mouse.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < 220 * 220) b.a += Math.sign(Math.sin(Math.atan2(dy, dx) - b.a)) * 0.04;
        b.x += Math.cos(b.a) * b.s * 60 * dt * speedBoost;
        b.y += Math.sin(b.a) * b.s * 60 * dt * speedBoost;
        if (b.x < -20) b.x = W + 20; if (b.x > W + 20) b.x = -20;
        if (b.y < -20) b.y = H + 20; if (b.y > H + 20) b.y = -20;
        b.ph += dt * (3 + a.energy * 6);
        if (Math.random() < 0.002) { const c = nearestCell(b.x, b.y); light(c.col, c.row, { violet: b.violet, peak: 0.3, dur: 2.2 }); }
      }
      const glow = 0.55 + 0.45 * Math.sin(b.ph);
      const col = b.violet ? '185,160,245' : '255,210,122';
      const rr = b.r * (6 + a.bass * 4);
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
      g.addColorStop(0, `rgba(${col},${0.55 * glow})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${col},${0.9 * glow})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    });

    if (!reduceMotion && running) requestAnimationFrame(drawFrame);
  }

  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    const c = nearestCell(e.clientX, e.clientY);
    if (!mouse.cell || c.col !== mouse.cell.col || c.row !== mouse.cell.row) {
      mouse.cell = c;
      if (!reduceMotion) light(c.col, c.row, { peak: 0.28, dur: 1.6, violet: Math.random() < 0.25 });
    }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });

  // Save battery: stop drawing while the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (reduceMotion) return;
    if (document.hidden) running = false;
    else if (!running) { running = true; last = performance.now(); requestAnimationFrame(drawFrame); }
  });

  let rT;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(resize, 120); });
  resize();
  if (!reduceMotion) requestAnimationFrame(drawFrame);
})();
