// ================================================================
//  FREE THROW — PewPlay
//  @bg #1a1430
//  @accent #ff8a3d
//  60 secondi per segnare più canestri possibile. Trascina indietro dal
//  pallone e rilascia. Ferro e tabellone con rimbalzi, bonus per i
//  canestri puliti, tiri da tre oltre la linea, serie.
// ================================================================
(function () {
  'use strict';
  const { clamp, rand, sfx, store } = PP;

  const GAME_ID = 'free-throw';
  const GRAV = 980, BR = 17;
  const RIM = { x1: 618, x2: 682, y: 232 }, BOARD = { x: 700, y0: 120, y1: 262 }, FLOOR = 520, ARC_X = 300;

  let v, ball, timeLeft, score, made, shots, streak, spawnT, aim, net = 0, msgs = [], ended = false;

  const best = () => store.get('best', 0);

  function spawn() {
    const x = rand(150, 470);
    ball = { x, y: FLOOR - 70, vx: 0, vy: 0, flying: false, scored: false, touched: false, rot: 0, three: x < ARC_X, resting: false, t: 0 };
    aim = null;
  }

  function start() { timeLeft = 60; score = 0; made = 0; shots = 0; streak = 0; spawnT = 0; net = 0; msgs = []; ended = false; spawn(); }

  function shoot(vx, vy) {
    if (ball.flying || ended) return;
    ball.vx = vx; ball.vy = vy; ball.flying = true; shots++;
    sfx.tone(220, 0.08, 'sine', 0.2, 160);
  }

  function rimHit(px, py) {
    const dx = ball.x - px, dy = ball.y - py, d = Math.hypot(dx, dy);
    if (d >= BR + 3 || d === 0) return;
    const nx = dx / d, ny = dy / d, dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) { ball.vx -= 1.55 * dot * nx; ball.vy -= 1.55 * dot * ny; ball.touched = true; sfx.tone(520, 0.06, 'square', Math.min(0.12, -dot / 3000)); }
    ball.x = px + nx * (BR + 3.2); ball.y = py + ny * (BR + 3.2);
  }

  function step(dt) {
    if (!ball.flying) return;
    ball.t += dt;
    const prevY = ball.y;
    ball.vy += GRAV * dt;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.rot += ball.vx * dt * 0.03;
    rimHit(RIM.x1, RIM.y); rimHit(RIM.x2, RIM.y);
    // tabellone
    if (ball.x + BR > BOARD.x && ball.x < BOARD.x + 10 && ball.y > BOARD.y0 && ball.y < BOARD.y1 && ball.vx > 0) { ball.x = BOARD.x - BR; ball.vx *= -0.6; ball.touched = true; sfx.tone(160, 0.08, 'square', 0.1); }
    // canestro: passa verso il basso dentro il ferro
    if (!ball.scored && prevY < RIM.y && ball.y >= RIM.y && ball.vy > 0 && ball.x > RIM.x1 + 4 && ball.x < RIM.x2 - 4) {
      ball.scored = true; made++; streak++;
      const swish = !ball.touched;
      const pts = (ball.three ? 3 : 2) + (swish ? 1 : 0) + Math.min(3, Math.floor(streak / 3));
      score += pts; net = 1;
      const p = S(650, RIM.y + 30);
      msgs.push({ t: 0, text: `${swish ? 'SWISH! ' : ''}+${pts}`, x: p.x, y: p.y });
      if (streak >= 3) msgs.push({ t: -0.25, text: `${streak} in a row!`, x: p.x, y: p.y - 34 });
      PP.burst(p.x, p.y, swish ? ['#ffd23f', '#fff', '#ff8a3d'] : ['#ff8a3d', '#fff'], swish ? 28 : 14, 220, 4, 0.8, 300);
      sfx.chord(swish ? [660, 880, 1320] : [523, 784], 0.14, 'triangle', 0.14, 0.05);
      ball.vx *= 0.3;
    }
    if (ball.y > FLOOR - BR) { ball.y = FLOOR - BR; ball.vy *= -0.55; ball.vx *= 0.8; if (Math.abs(ball.vy) > 60) sfx.tone(110, 0.06, 'sine', 0.15); }
    if (ball.x < -60 || ball.x > 860 || ball.t > 3.2 || (ball.y >= FLOOR - BR - 1 && Math.abs(ball.vy) < 40 && ball.t > 1)) {
      if (!ball.scored) streak = 0;
      ball.flying = false; ball.resting = true; spawnT = 0.35;
    }
  }

  function update(dt) {
    if (!ended) timeLeft -= dt;
    if (timeLeft <= 0 && !ended && !(ball && ball.flying)) return end();
    for (let i = 0; i < 4; i++) step(dt / 4);
    net = Math.max(0, net - dt * 2.5);
    for (const m of msgs) m.t += dt;
    msgs = msgs.filter(m => m.t < 1.2);
    if (ball.resting) { spawnT -= dt; if (spawnT <= 0) spawn(); }
  }

  function end() {
    ended = true; timeLeft = 0;
    const b = best(), rec = score > b;
    if (rec) store.set('best', score);
    if (rec && score) sfx.win(); else sfx.lose();
    PP.over(rec && score ? 'New record!' : "Time's up!", `Score ${score} · ${made}/${shots} baskets (${shots ? Math.round(made / shots * 100) : 0}%)\nBest: ${Math.max(b, score)}`);
  }

  // ── VISTA ───────────────────────────────────────
  function S(x, y) { return { x: v.x + x * v.s, y: v.y + y * v.s }; }
  function layout() { const W = PP.W, H = PP.H; const s = Math.min(W / 680, H / 600); v = { s, x: W / 2 - 430 * s, y: H / 2 - 300 * s + 10 }; if (W / s > 800) v.x = W / 2 - 400 * s; }

  function draw(ctx, W, H) {
    layout();
    // palestra
    ctx.fillStyle = PP.vgrad(0, H, '#2a2150', '#120d24'); ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) { const x = W * (i + 0.5) / 6; const g = ctx.createRadialGradient(x, 0, 2, x, 0, H * 0.5); g.addColorStop(0, 'rgba(255,240,200,.25)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.6); }
    const fy = S(0, FLOOR).y;
    ctx.fillStyle = PP.vgrad(fy, H, '#c98a4b', '#8a5a2b'); ctx.fillRect(0, fy, W, H - fy);
    ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 2; for (let x = (v.x % (60 * v.s)); x < W; x += 60 * v.s) { ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x - 30 * v.s, H); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4 * v.s;
    const arc = S(ARC_X, FLOOR + 4); ctx.beginPath(); ctx.moveTo(arc.x, fy + 2); ctx.lineTo(arc.x - 40 * v.s, H); ctx.stroke();
    PP.text('3PT', arc.x - 20 * v.s, fy + 24 * v.s, 14 * v.s, 'rgba(255,255,255,.7)', 'center', 900);
    // palo e tabellone
    const pole = S(760, 120), pb = S(760, FLOOR);
    ctx.fillStyle = '#444b5e'; ctx.fillRect(pole.x, pole.y, 16 * v.s, pb.y - pole.y);
    const b0 = S(BOARD.x, BOARD.y0 - 20), b1 = S(BOARD.x + 12, BOARD.y1 + 10);
    ctx.fillStyle = 'rgba(230,240,255,.9)'; ctx.fillRect(b0.x, b0.y, b1.x - b0.x, b1.y - b0.y);
    ctx.fillStyle = '#ff8a3d'; const sq = S(BOARD.x - 2, 170); ctx.fillRect(sq.x, sq.y, 4 * v.s, 50 * v.s);
    const arm = S(BOARD.x + 12, 150); ctx.fillStyle = '#444b5e'; ctx.fillRect(arm.x, arm.y, (760 - BOARD.x - 12) * v.s, 10 * v.s);
    // rete (dietro la palla davanti al ferro)
    drawNet(ctx);
    if (ball) drawBall(ctx);
    // ferro davanti
    const r1 = S(RIM.x1, RIM.y), r2 = S(RIM.x2, RIM.y), rc = S(BOARD.x, RIM.y);
    ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 6 * v.s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(r1.x, r1.y); ctx.lineTo(r2.x, r2.y); ctx.lineTo(rc.x, rc.y); ctx.stroke();
    // mira
    if (aim && aim.cur && PP.state === 'playing') {
      const vel = aimVel();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      let x = ball.x, y = ball.y, vx = vel.vx, vy = vel.vy;
      for (let i = 0; i < 26; i++) { for (let k = 0; k < 3; k++) { vy += GRAV * 0.012; x += vx * 0.012; y += vy * 0.012; } if (i % 2 === 0) { const p = S(x, y); ctx.beginPath(); ctx.arc(p.x, p.y, 4 * v.s * (1 - i / 34), 0, 7); ctx.fill(); } }
    }
    PP.drawFx();
    for (const m of msgs) { if (m.t < 0) continue; ctx.globalAlpha = 1 - m.t / 1.2; PP.text(m.text, m.x, m.y - m.t * 50, Math.max(20, 30 * v.s), '#ffd23f', 'center', 900); ctx.globalAlpha = 1; }
    if (PP.state === 'menu' || !ball) return;
    // tabellone punteggio
    const tl = Math.max(0, Math.ceil(timeLeft));
    PP.rr(W / 2 - 90, 10, 180, 54, 12); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
    PP.text(`${score}`, W / 2 - 40, 38, 28, '#ffd23f', 'center', 900);
    PP.text(`0:${String(tl).padStart(2, '0')}`, W / 2 + 40, 38, 24, tl <= 10 ? '#ff6b6b' : '#fff', 'center', 900);
    PP.text(`${made}/${shots}${streak >= 2 ? ` · streak ${streak}` : ''}`, W < 640 ? W / 2 : 14, W < 640 ? 80 : 30, 14, 'rgba(255,255,255,.8)', W < 640 ? 'center' : 'left', 700);
    if (!ball.flying && !aim && shots === 0) { const p = S(ball.x, ball.y + 60); PP.text('Drag back and release to shoot', p.x + 40, p.y, 15, '#fff', 'center', 800); }
  }
  function drawBall(ctx) {
    const p = S(ball.x, ball.y), r = BR * v.s;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; const sh = S(ball.x, FLOOR); ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r * clamp(1 - (FLOOR - ball.y) / 600, 0.3, 1), r * 0.3, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ball.rot);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r); g.addColorStop(0, '#ffb36b'); g.addColorStop(1, '#e0601e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#4a2410'; ctx.lineWidth = 1.6 * v.s;
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
    ctx.beginPath(); ctx.arc(-r * 1.15, 0, r * 0.8, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(r * 1.15, 0, r * 0.8, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
    ctx.restore();
  }
  function drawNet(ctx) {
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5 * v.s;
    const sway = Math.sin(PP.time * 30) * net * 4;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, x0 = PP.lerp(RIM.x1, RIM.x2, t), x1 = PP.lerp(RIM.x1 + 12, RIM.x2 - 12, t) + sway;
      const a = S(x0, RIM.y), b = S(x1, RIM.y + 52 + net * 10);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let k = 1; k <= 3; k++) { const y = RIM.y + k * 16 + net * k * 3, inset = k * 4; const a = S(RIM.x1 + inset + sway * k / 3, y), b = S(RIM.x2 - inset + sway * k / 3, y); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  }

  // ── INPUT ───────────────────────────────────────
  function aimVel() {
    const dx = (aim.sx - aim.cur.x) / v.s, dy = (aim.sy - aim.cur.y) / v.s;
    const k = 4.4;
    let vx = dx * k, vy = dy * k;
    const sp = Math.hypot(vx, vy), max = 1050;
    if (sp > max) { vx *= max / sp; vy *= max / sp; }
    return { vx, vy };
  }
  function pointerDown(p) { if (!ball.flying && !ball.resting && !ended) aim = { sx: p.x, sy: p.y, cur: null }; }
  function pointerMove(p) { if (aim) aim.cur = p; }
  function pointerUp(p) {
    if (!aim) return;
    if (aim.cur && Math.hypot(aim.cur.x - aim.sx, aim.cur.y - aim.sy) > 12) { const vel = aimVel(); shoot(vel.vx, vel.vy); }
    aim = null;
  }
  // tastiera: tiro automatico "giusto" con un piccolo errore, per chi non usa il mouse
  function keyDown(code) {
    if (code !== 'Space' || ball.flying || ball.resting || ended) return;
    const tx = 650 + rand(-14, 14), ty = RIM.y;
    const T = 0.95 + (650 - ball.x) / 1200;
    shoot((tx - ball.x) / T, (ty - ball.y - 0.5 * GRAV * T * T) / T);
  }

  function demo(n) {
    start();
    score = [0, 14, 31, 8][n]; made = [0, 6, 12, 3][n]; shots = [0, 8, 15, 4][n]; timeLeft = [60, 42, 17, 51][n]; streak = [0, 2, 5, 0][n];
    if (n === 1) {
      ball.x = 380; ball.y = FLOOR - 70;
      // trascinamento che corrisponde a un tiro giusto (stessa formula del tiro da tastiera)
      const T = 0.95 + (650 - ball.x) / 1200, vx = (650 - ball.x) / T, vy = (RIM.y - ball.y - 0.5 * GRAV * T * T) / T;
      aim = { sx: 300, sy: 300, cur: { x: 300 - vx / 4.4 * v.s, y: 300 - vy / 4.4 * v.s } };
    }
    if (n === 2) { ball.flying = true; ball.x = 646; ball.y = RIM.y + 18; ball.three = true; net = 0.8; const p = S(650, RIM.y + 30); msgs = [{ t: 0.15, text: 'SWISH! +5', x: p.x, y: p.y }]; PP.burst(p.x, p.y, ['#ffd23f', '#fff', '#ff8a3d'], 28, 160, 4, 2, 0); }
    if (n === 3) { ball.flying = true; ball.x = 520; ball.y = 150; ball.rot = 1; }
    PP.game.update = () => {};
  }

  function icon(c, S2) {
    const g = c.createLinearGradient(0, 0, 0, S2); g.addColorStop(0, '#2a2150'); g.addColorStop(1, '#120d24');
    c.fillStyle = g; c.fillRect(0, 0, S2, S2);
    c.fillStyle = 'rgba(230,240,255,.9)'; c.fillRect(S2 * 0.6, S2 * 0.2, S2 * 0.06, S2 * 0.3);
    c.strokeStyle = '#ff5a1f'; c.lineWidth = S2 * 0.02; c.lineCap = 'round'; c.beginPath(); c.moveTo(S2 * 0.38, S2 * 0.4); c.lineTo(S2 * 0.6, S2 * 0.4); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = S2 * 0.006;
    for (let i = 0; i <= 5; i++) { c.beginPath(); c.moveTo(S2 * (0.38 + i * 0.044), S2 * 0.4); c.lineTo(S2 * (0.41 + i * 0.032), S2 * 0.55); c.stroke(); }
    const bx = S2 * 0.36, by = S2 * 0.62, r = S2 * 0.12;
    const bg = c.createRadialGradient(bx - r * 0.35, by - r * 0.35, r * 0.1, bx, by, r); bg.addColorStop(0, '#ffb36b'); bg.addColorStop(1, '#e0601e');
    c.fillStyle = bg; c.beginPath(); c.arc(bx, by, r, 0, 7); c.fill();
    c.strokeStyle = '#4a2410'; c.lineWidth = S2 * 0.008; c.beginPath(); c.moveTo(bx - r, by); c.lineTo(bx + r, by); c.moveTo(bx, by - r); c.lineTo(bx, by + r); c.stroke();
  }

  const realUpdate = update;
  PP.run({
    id: GAME_ID,
    title: 'Free Throw',
    intro: 'Score as many baskets as you can in 60 seconds.\nDrag back from anywhere and release to shoot. Swishes and three-pointers score more.',
    bestText: () => (best() ? `Best: ${best()}` : ''),
    pauseText: () => `Score ${score} · ${Math.ceil(timeLeft)}s left`,
    init() { layout(); },
    start() { PP.game.update = realUpdate; layout(); start(); },
    update, draw, pointerDown, pointerMove, pointerUp, keyDown, demo, icon,
  });
})();
