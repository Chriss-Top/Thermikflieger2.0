/* Thermikflieger 2.0 – HUD: Rundinstrumente, Anzeigen, Streckenprofil, Meldungen */
(function () {
  'use strict';
  var DEG = TF.DEG, clamp = TF.clamp, smoothstep = TF.smoothstep;
  var FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

  TF.HUD = function () {
    this.cache = {};
    this.size = 0;
    this.msgs = [];
  };
  var H = TF.HUD.prototype;

  H.toast = function (text, sub, opts) {
    opts = opts || {};
    // gleiche Meldung nicht stapeln
    for (var i = 0; i < this.msgs.length; i++) {
      if (this.msgs[i].text === text) { this.msgs[i].t = 0; this.msgs[i].sub = sub; return; }
    }
    this.msgs.push({ text: text, sub: sub || '', t: 0, dur: opts.dur || 3.2, color: opts.color || '#ffffff', big: !!opts.big });
    if (this.msgs.length > 3) this.msgs.shift();
  };

  H.update = function (dt) {
    for (var i = this.msgs.length - 1; i >= 0; i--) {
      this.msgs[i].t += dt;
      if (this.msgs[i].t > this.msgs[i].dur) this.msgs.splice(i, 1);
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  TF.roundRect = roundRect;

  function panel(ctx, x, y, w, h, r) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = 'rgba(18,30,46,0.42)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ------------------------------------------------------------
  // Statische Instrumentenzifferblätter
  // ------------------------------------------------------------
  function bezel(g, r) {
    var gr = g.createLinearGradient(-r, -r, r, r);
    gr.addColorStop(0, '#5d6874');
    gr.addColorStop(0.5, '#2a3138');
    gr.addColorStop(1, '#151a1f');
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0f1419';
    g.beginPath(); g.arc(0, 0, r * 0.9, 0, Math.PI * 2); g.fill();
    var fg = g.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r * 0.9);
    fg.addColorStop(0, '#222a33');
    fg.addColorStop(1, '#10151b');
    g.fillStyle = fg;
    g.beginPath(); g.arc(0, 0, r * 0.88, 0, Math.PI * 2); g.fill();
  }

  function asiAngle(v, vmax) { return (135 + 270 * clamp(v / vmax, 0, 1.02)) * DEG; }
  function varioAngle(v) { return Math.PI + clamp(v, -5.3, 5.3) / 5 * 150 * DEG; }

  H.buildFaces = function (d, A, dpr) {
    var key = d + '|' + A.id + '|' + dpr;
    if (this.cache.key === key) return;
    this.cache.key = key;
    var r = d / 2;
    var vmax = Math.ceil((A.vne * 3.6 + 15) / 20) * 20;
    this.cache.vmax = vmax;
    // Fahrtmesser
    var c = TF.makeCanvas(d * dpr, d * dpr);
    var g = c.getContext('2d');
    g.scale(dpr, dpr); g.translate(r, r);
    bezel(g, r);
    var arc = function (v0, v1, col, w, rr) {
      g.strokeStyle = col; g.lineWidth = w;
      g.beginPath(); g.arc(0, 0, rr, asiAngle(v0, vmax), asiAngle(v1, vmax)); g.stroke();
    };
    var vs = A.vs * 3.6, vne = A.vne * 3.6;
    arc(vs * 1.05, A.vtrim * 3.6 * 1.55, '#3ec46d', r * 0.07, r * 0.8);
    arc(A.vtrim * 3.6 * 1.55, vne, '#f2c230', r * 0.07, r * 0.8);
    arc(vne, vne + 2, '#ff3b30', r * 0.16, r * 0.8);
    g.strokeStyle = '#e8edf2';
    g.fillStyle = '#e8edf2';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 ' + (r * 0.17) + 'px ' + FONT;
    for (var v = 0; v <= vmax; v += 10) {
      var a = asiAngle(v, vmax);
      var major = v % 20 === 0;
      g.lineWidth = major ? 2 : 1;
      var r0 = major ? r * 0.66 : r * 0.72;
      g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86); g.stroke();
      if (major && (v % 40 === 0 || vmax <= 200)) {
        g.fillText(String(v), Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
      }
    }
    g.font = '600 ' + (r * 0.13) + 'px ' + FONT;
    g.fillStyle = '#9fb0c0';
    g.fillText('km/h', 0, r * 0.36);
    this.cache.asi = c;

    // Variometer
    c = TF.makeCanvas(d * dpr, d * dpr);
    g = c.getContext('2d');
    g.scale(dpr, dpr); g.translate(r, r);
    bezel(g, r);
    g.lineWidth = r * 0.07;
    g.strokeStyle = 'rgba(62,196,109,0.85)';
    g.beginPath(); g.arc(0, 0, r * 0.8, varioAngle(0.05), varioAngle(5)); g.stroke();
    g.strokeStyle = 'rgba(255,90,70,0.75)';
    g.beginPath(); g.arc(0, 0, r * 0.8, varioAngle(-5), varioAngle(-0.05)); g.stroke();
    g.strokeStyle = '#e8edf2'; g.fillStyle = '#e8edf2';
    g.font = '600 ' + (r * 0.18) + 'px ' + FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (var q = -10; q <= 10; q++) {
      var vv = q / 2;
      var aa = varioAngle(vv);
      var mj = q % 2 === 0;
      g.lineWidth = mj ? 2 : 1;
      var rr0 = mj ? r * 0.66 : r * 0.73;
      g.beginPath(); g.moveTo(Math.cos(aa) * rr0, Math.sin(aa) * rr0); g.lineTo(Math.cos(aa) * r * 0.86, Math.sin(aa) * r * 0.86); g.stroke();
      if (mj && Math.abs(vv) <= 5) g.fillText(String(Math.abs(vv)), Math.cos(aa) * r * 0.5, Math.sin(aa) * r * 0.5);
    }
    g.font = '600 ' + (r * 0.13) + 'px ' + FONT;
    g.fillStyle = '#9fb0c0';
    g.fillText('m/s', r * 0.28, -r * 0.05);
    g.fillText('▲', -r * 0.62, -r * 0.42);
    g.fillText('▼', -r * 0.62, r * 0.42);
    this.cache.vario = c;
  };

  function needle(ctx, cx, cy, a, len, col, w) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = col;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(-len * 0.18, -w);
    ctx.lineTo(len, 0);
    ctx.lineTo(-len * 0.18, w);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2b333c';
    ctx.beginPath(); ctx.arc(0, 0, w * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  H.drawASI = function (ctx, cx, cy, d, g) {
    var r = d / 2, vmax = this.cache.vmax;
    ctx.drawImage(this.cache.asi, cx - r, cy - r, d, d);
    var A = g.A;
    // dynamische Mindestfahrt-Markierung (wandert in der Kurve nach oben)
    var vsE = (g.vsEff || A.vs) * 3.6;
    ctx.lineWidth = r * 0.1;
    ctx.strokeStyle = 'rgba(255,59,48,0.9)';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.71, asiAngle(0, vmax), asiAngle(vsE, vmax)); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,170,40,0.95)';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.71, asiAngle(vsE, vmax), asiAngle(vsE * 1.12, vmax)); ctx.stroke();
    var am = asiAngle(vsE * 1.12, vmax);
    ctx.fillStyle = '#ffb02e';
    ctx.save();
    ctx.translate(cx + Math.cos(am) * r * 0.92, cy + Math.sin(am) * r * 0.92);
    ctx.rotate(am);
    ctx.beginPath(); ctx.moveTo(-r * 0.1, 0); ctx.lineTo(r * 0.04, -r * 0.07); ctx.lineTo(r * 0.04, r * 0.07); ctx.closePath(); ctx.fill();
    ctx.restore();
    var v = g.V * 3.6;
    needle(ctx, cx, cy, asiAngle(v, vmax), r * 0.8, '#ffffff', r * 0.045);
    ctx.fillStyle = g.warn > 0.4 ? '#ff6b5b' : '#dfe8f0';
    ctx.font = '700 ' + (r * 0.22) + 'px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(v), cx, cy + r * 0.62);
  };

  H.drawVario = function (ctx, cx, cy, d, te, avg) {
    var r = d / 2;
    ctx.drawImage(this.cache.vario, cx - r, cy - r, d, d);
    // Mittelwert-Marke
    var am = varioAngle(avg);
    ctx.fillStyle = '#4fc3ff';
    ctx.save();
    ctx.translate(cx + Math.cos(am) * r * 0.91, cy + Math.sin(am) * r * 0.91);
    ctx.rotate(am);
    ctx.beginPath(); ctx.moveTo(-r * 0.1, 0); ctx.lineTo(r * 0.04, -r * 0.07); ctx.lineTo(r * 0.04, r * 0.07); ctx.closePath(); ctx.fill();
    ctx.restore();
    needle(ctx, cx, cy, varioAngle(te), r * 0.8, '#ffd34a', r * 0.045);
    ctx.fillStyle = te >= 0 ? '#7ef0a4' : '#ff8a7a';
    ctx.font = '700 ' + (r * 0.2) + 'px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((te >= 0 ? '+' : '') + te.toFixed(1), cx + r * 0.28, cy + r * 0.38);
  };

  H.drawAI = function (ctx, cx, cy, d, g, band) {
    var r = d / 2;
    // Rahmen
    var gr = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    gr.addColorStop(0, '#5d6874'); gr.addColorStop(0.5, '#2a3138'); gr.addColorStop(1, '#151a1f');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-g.phi);
    var ppd = r * 0.028; // Pixel pro Grad
    var off = (g.theta / DEG) * ppd;
    var sky = ctx.createLinearGradient(0, -r * 1.5 + off, 0, off);
    sky.addColorStop(0, '#1f5fae'); sky.addColorStop(1, '#5ea9e8');
    ctx.fillStyle = sky;
    ctx.fillRect(-r * 1.6, -r * 3 + off, r * 3.2, r * 3);
    var gnd = ctx.createLinearGradient(0, off, 0, off + r * 1.5);
    gnd.addColorStop(0, '#8a5a32'); gnd.addColorStop(1, '#4e3119');
    ctx.fillStyle = gnd;
    ctx.fillRect(-r * 1.6, off, r * 3.2, r * 3);
    // Zielband beim Windenstart
    if (band) {
      var y0 = off - (band.hi / DEG) * ppd, y1 = off - (band.lo / DEG) * ppd;
      ctx.fillStyle = 'rgba(70,230,120,0.38)';
      ctx.fillRect(-r * 0.7, y0, r * 1.4, y1 - y0);
      ctx.strokeStyle = 'rgba(120,255,160,0.9)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-r * 0.7, y0, r * 1.4, y1 - y0);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 1.5, off); ctx.lineTo(r * 1.5, off); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 ' + (r * 0.12) + 'px ' + FONT;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (var p = -40; p <= 60; p += 10) {
      if (p === 0) continue;
      var y = off - p * ppd;
      var w = p % 20 === 0 ? r * 0.32 : r * 0.18;
      ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.stroke();
      if (p % 20 === 0) ctx.fillText(String(Math.abs(p)), w + 3, y);
    }
    ctx.restore();
    // Querlagenskala
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#e8edf2';
    var marks = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];
    for (var i = 0; i < marks.length; i++) {
      var a = (-90 + marks[i]) * DEG;
      var r0 = marks[i] % 30 === 0 ? r * 0.7 : r * 0.76;
      ctx.lineWidth = marks[i] === 0 ? 3 : 1.5;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86); ctx.stroke();
    }
    // Zeiger
    ctx.rotate(-g.phi);
    ctx.fillStyle = '#ffb02e';
    ctx.beginPath(); ctx.moveTo(0, -r * 0.69); ctx.lineTo(-r * 0.06, -r * 0.58); ctx.lineTo(r * 0.06, -r * 0.58); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Flugzeugsymbol
    ctx.strokeStyle = '#ffb02e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy); ctx.lineTo(cx - r * 0.18, cy);
    ctx.lineTo(cx - r * 0.08, cy + r * 0.08); ctx.lineTo(cx, cy);
    ctx.lineTo(cx + r * 0.08, cy + r * 0.08); ctx.lineTo(cx + r * 0.18, cy);
    ctx.lineTo(cx + r * 0.5, cy);
    ctx.stroke();
    ctx.fillStyle = '#ffb02e';
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
    // Ring
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2); ctx.stroke();
  };

  // ------------------------------------------------------------
  // Gesamtes HUD
  // ------------------------------------------------------------
  H.draw = function (ctx, W, Hh, st) {
    var g = st.glider, world = st.world;
    var u = clamp(Math.min(W, Hh * 1.6) / 1150, 0.68, 1.35);
    var d = Math.round(118 * u);
    var dpr = st.dpr || 1;
    this.buildFaces(d, g.A, dpr);

    // Warn-Vignette
    var warnLvl = g.stalled ? 1 : smoothstep(0.35, 0.9, g.warn || 0);
    if (warnLvl > 0.02 && g.mode === 'air') {
      var pulse = 0.55 + 0.45 * Math.sin(st.t * (g.stalled ? 14 : 9));
      var vg = ctx.createRadialGradient(W / 2, Hh / 2, Math.max(W, Hh) * 0.42, W / 2, Hh / 2, Math.max(W, Hh) * 0.72);
      vg.addColorStop(0, 'rgba(255,40,20,0)');
      vg.addColorStop(1, 'rgba(255,40,20,' + (0.45 * warnLvl * pulse).toFixed(3) + ')');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, Hh);
    }

    // Instrumente unten links
    var pad = 14 * u;
    var gap = 10 * u;
    var pw = d * 3 + gap * 4, ph = d + gap * 2 + 16 * u;
    var px = pad, py = Hh - ph - pad;
    panel(ctx, px, py, pw, ph, 14 * u);
    var cy = py + gap + d / 2;
    var lblY = py + ph - 9 * u;
    var band = null;
    if (g.mode === 'launch' && g.launch && g.launch.phase === 'climb') band = { lo: g.launch.band - 7 * DEG, hi: g.launch.band + 7 * DEG };
    this.drawASI(ctx, px + gap + d / 2, cy, d, g);
    this.drawAI(ctx, px + gap * 2 + d * 1.5, cy, d, g, band);
    this.drawVario(ctx, px + gap * 3 + d * 2.5, cy, d, g.te, st.avgClimb || 0);
    ctx.fillStyle = 'rgba(220,232,244,0.8)';
    ctx.font = '600 ' + (10.5 * u) + 'px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('FAHRT', px + gap + d / 2, lblY);
    ctx.fillText('HORIZONT', px + gap * 2 + d * 1.5, lblY);
    ctx.fillText('VARIO', px + gap * 3 + d * 2.5, lblY);

    // Datenpanel oben links
    var gh = world.hC(g.x);
    var agl = Math.max(0, g.y - gh - TF.GEAR_H);
    var tw = 210 * u, th = 128 * u;
    panel(ctx, pad, pad, tw, th, 14 * u);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200,215,230,0.85)';
    ctx.font = '600 ' + (11 * u) + 'px ' + FONT;
    ctx.fillText('HÖHE', pad + 14 * u, pad + 22 * u);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 ' + (30 * u) + 'px ' + FONT;
    ctx.fillText(TF.fmtNum(Math.round(g.y)) + ' m', pad + 14 * u, pad + 54 * u);
    ctx.font = '600 ' + (12.5 * u) + 'px ' + FONT;
    ctx.fillStyle = agl < 120 ? '#ffb38a' : 'rgba(225,236,246,0.92)';
    ctx.fillText('über Grund  ' + TF.fmtNum(Math.round(agl)) + ' m', pad + 14 * u, pad + 75 * u);
    ctx.fillStyle = 'rgba(225,236,246,0.92)';
    ctx.fillText('Flugzeit  ' + TF.fmtTime(st.flightTime || 0), pad + 14 * u, pad + 97 * u);
    ctx.fillText('Strecke  ' + TF.fmtNum((st.distance || 0) / 1000, 1) + ' km', pad + 14 * u, pad + 117 * u);
    // Höhenband (Grund bis Wolkenbasis)
    var bx = pad + tw - 22 * u, by0 = pad + 14 * u, by1 = pad + th - 14 * u;
    var cbv = world.cloudBase(st.t);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, bx, by0, 8 * u, by1 - by0, 4 * u); ctx.fill();
    var frac = clamp((g.y - gh) / Math.max(200, cbv - gh), 0, 1);
    ctx.fillStyle = frac < 0.15 ? '#ff8a5a' : '#7fd7ff';
    roundRect(ctx, bx, by1 - (by1 - by0) * frac, 8 * u, (by1 - by0) * frac, 4 * u); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = (10 * u) + 'px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText('☁', bx - 3 * u, by0 + 8 * u);

    // Wind oben rechts
    this.drawWind(ctx, W, u, g, st);

    // Streckenprofil unten rechts
    this.drawProfile(ctx, W, Hh, u, g, world, st);

    // Startphase-Hilfe
    if (g.mode === 'launch') this.drawLaunchHelp(ctx, W, Hh, u, g, st);

    // Warnungen
    if (g.mode === 'air') {
      var msg = null, col = '#ffb02e';
      if (g.stalled) { msg = 'STRÖMUNGSABRISS – nachdrücken!'; col = '#ff4a3a'; }
      else if (g.warn > 0.3) { msg = 'Zu langsam – nachdrücken!'; col = '#ffb02e'; }
      else if (g.overspeed > 0.2) { msg = 'Zu schnell – Fahrt reduzieren!'; col = '#ffd84a'; }
      if (msg) {
        ctx.font = '800 ' + (24 * u) + 'px ' + FONT;
        ctx.textAlign = 'center';
        var mw = ctx.measureText(msg).width + 40 * u;
        var my = Hh * 0.2;
        panel(ctx, W / 2 - mw / 2, my - 26 * u, mw, 40 * u, 12 * u);
        ctx.fillStyle = col;
        ctx.fillText(msg, W / 2, my + 2 * u);
      }
    }

    // Meldungen
    var yy = Hh * 0.29;
    for (var i = 0; i < this.msgs.length; i++) {
      var m = this.msgs[i];
      var a = Math.min(1, m.t * 4) * Math.min(1, (m.dur - m.t) * 2);
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.textAlign = 'center';
      ctx.font = '800 ' + ((m.big ? 34 : 24) * u) + 'px ' + FONT;
      ctx.lineWidth = 5 * u;
      ctx.strokeStyle = 'rgba(10,25,40,0.45)';
      ctx.strokeText(m.text, W / 2, yy);
      ctx.fillStyle = m.color;
      ctx.fillText(m.text, W / 2, yy);
      if (m.sub) {
        ctx.font = '600 ' + (15 * u) + 'px ' + FONT;
        ctx.lineWidth = 4 * u;
        ctx.strokeText(m.sub, W / 2, yy + 24 * u);
        ctx.fillStyle = 'rgba(240,248,255,0.95)';
        ctx.fillText(m.sub, W / 2, yy + 24 * u);
      }
      yy += (m.sub ? 62 : 42) * u;
    }
    ctx.globalAlpha = 1;

    // Ton-Symbol + Tasten
    ctx.textAlign = 'right';
    ctx.font = '600 ' + (11 * u) + 'px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText((st.muted ? '🔇 Ton aus [M]' : '🔊 Ton an [M]') + '   ⏸ Pause [P]   ⛶ Vollbild [F]', W - pad, Hh - pad - 96 * u);
  };

  H.drawWind = function (ctx, W, u, g, st) {
    var world = st.world;
    var pad = 14 * u;
    var pw = 230 * u, ph = 112 * u;
    var x = W - pw - pad, y = pad;
    panel(ctx, x, y, pw, ph, 14 * u);
    var gh = world.hC(g.x);
    var wind = world.windAt(g.y - gh, st.t);
    var kmh = Math.abs(wind) * 3.6;
    // Pfeil
    var cx = x + 46 * u, cy = y + 42 * u, r = 28 * u;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    var dir = wind >= 0 ? 1 : -1;
    var len = r * (0.35 + 0.6 * clamp(kmh / 30, 0, 1));
    ctx.strokeStyle = '#8fdcff'; ctx.fillStyle = '#8fdcff';
    ctx.lineWidth = 4 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - dir * len, cy); ctx.lineTo(cx + dir * len * 0.55, cy); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + dir * len, cy);
    ctx.lineTo(cx + dir * (len - 12 * u), cy - 8 * u);
    ctx.lineTo(cx + dir * (len - 12 * u), cy + 8 * u);
    ctx.closePath(); ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200,215,230,0.85)';
    ctx.font = '600 ' + (11 * u) + 'px ' + FONT;
    ctx.fillText('WIND', x + 86 * u, y + 24 * u);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 ' + (21 * u) + 'px ' + FONT;
    ctx.fillText(Math.round(kmh) + ' km/h', x + 86 * u, y + 48 * u);
    var head = g.mode === 'ground' && g.gHeading !== undefined ? g.gHeading : g.psi;
    var along = Math.cos(head);
    var comp = wind * (along >= 0 ? 1 : -1);
    ctx.font = '600 ' + (12 * u) + 'px ' + FONT;
    var txt = kmh < 4 ? 'kaum Wind' : (comp < -0.5 ? 'Gegenwind' : (comp > 0.5 ? 'Rückenwind' : 'Seitenwind'));
    ctx.fillStyle = comp < -0.5 ? '#ffcf8a' : '#a8f0c0';
    if (kmh < 4) ctx.fillStyle = 'rgba(225,236,246,0.9)';
    ctx.fillText(txt + ' · GS ' + Math.round((g.groundSpeed || 0) * 3.6), x + 86 * u, y + 68 * u);
    // Nächster Flugplatz
    var dirX = Math.cos(head) >= 0 ? 1 : -1;
    var nf = world.nextAirfield(g.x, dirX);
    ctx.fillStyle = 'rgba(225,236,246,0.92)';
    ctx.font = '600 ' + (12 * u) + 'px ' + FONT;
    if (nf) {
      var dist = nf.dist;
      var arrow = dirX > 0 ? '→' : '←';
      var label = dist < 1 ? 'Über Flugplatz ' + nf.af.name : '✈ ' + nf.af.name + '  ' + TF.fmtNum(dist / 1000, 1) + ' km ' + arrow;
      ctx.fillText(label, x + 14 * u, y + 92 * u);
      // Erreichbarkeit grob (Gleitzahl mit Reserve & Wind)
      var A = g.A;
      var wAlong = world.windAt(300, st.t) * dirX;
      var Eeff = A.E * 0.62 * clamp((A.vmd + wAlong) / A.vmd, 0.25, 1.6);
      var need = dist / Math.max(3, Eeff) + 80;
      var have = g.y - nf.af.h;
      var ok = have > need;
      ctx.fillStyle = ok ? '#7ef0a4' : '#ff9a7a';
      ctx.fillText(dist < 1 ? '' : (ok ? '✓ im Gleitbereich' : '✗ außer Reichweite'), x + 14 * u, y + 106 * u);
    }
  };

  H.drawProfile = function (ctx, W, Hh, u, g, world, st) {
    var pad = 14 * u;
    var pw = Math.min(460 * u, W * 0.34), ph = 74 * u;
    var x = W - pw - pad, y = Hh - ph - pad;
    panel(ctx, x, y, pw, ph, 12 * u);
    var range0 = -2500, range1 = 6500;
    var cb = world.cloudBase(st.t);
    var ymax = cb + 250;
    var ix = function (wx) { return x + 8 * u + (wx - (g.x + range0)) / (range1 - range0) * (pw - 16 * u); };
    var iy = function (wy) { return y + ph - 8 * u - clamp(wy / ymax, 0, 1.05) * (ph - 16 * u); };
    ctx.save();
    roundRect(ctx, x, y, pw, ph, 12 * u);
    ctx.clip();
    // Gelände
    ctx.beginPath();
    ctx.moveTo(ix(g.x + range0), y + ph);
    for (var i = 0; i <= 90; i++) {
      var wx = g.x + range0 + (range1 - range0) * i / 90;
      ctx.lineTo(ix(wx), iy(world.hC(wx)));
    }
    ctx.lineTo(ix(g.x + range1), y + ph);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120,180,90,0.75)';
    ctx.fill();
    // Wolkenbasis
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.setLineDash([4 * u, 4 * u]);
    ctx.beginPath(); ctx.moveTo(x, iy(cb)); ctx.lineTo(x + pw, iy(cb)); ctx.stroke();
    ctx.setLineDash([]);
    // Flugplätze
    var A = world.airfields;
    for (i = 0; i < A.length; i++) {
      var af = A[i];
      if (af.x1 < g.x + range0 || af.x0 > g.x + range1) continue;
      ctx.fillStyle = '#ffe28a';
      ctx.fillRect(ix(af.x0), iy(af.h) - 2 * u, Math.max(3, ix(af.x1) - ix(af.x0)), 3 * u);
      ctx.font = (11 * u) + 'px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('✈', ix(af.xc), iy(af.h) - 6 * u);
    }
    // Wolken (sichtbare Cumuli)
    var T = world.thermals;
    for (i = 0; i < T.length; i++) {
      var th = T[i];
      if (!th.hasCloud) continue;
      var ce = TF.cloudEnv(th);
      if (ce < 0.2) continue;
      var tx = world.thermalX(th);
      if (tx < g.x + range0 || tx > g.x + range1) continue;
      ctx.globalAlpha = 0.5 + 0.5 * ce;
      ctx.fillStyle = '#ffffff';
      var cw = (6 + th.R / 25) * u * (0.5 + 0.5 * ce);
      ctx.beginPath();
      ctx.ellipse(ix(tx), iy(cb + th.cbOff) - 3 * u, cw, 4 * u * (0.6 + 0.4 * ce), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Flugzeug
    var gx = ix(g.x), gy = iy(g.y);
    ctx.fillStyle = '#ff9a2e';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(gx, gy, 4 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    var dirX = Math.cos(g.psi);
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + dirX * 12 * u, gy - Math.sin(g.gamma) * 12 * u); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(220,232,244,0.75)';
    ctx.font = '600 ' + (10 * u) + 'px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('STRECKENPROFIL', x + 10 * u, y + 14 * u);
  };

  H.drawLaunchHelp = function (ctx, W, Hh, u, g, st) {
    var L = g.launch;
    ctx.textAlign = 'center';
    var y = Hh * 0.17;
    var txt, sub = '';
    if (L.phase === 'ready') { txt = 'Windenstart'; sub = 'Seil straff … gleich geht es los'; }
    else if (L.phase === 'roll') { txt = 'Anrollen'; sub = 'Flügel gerade halten (← →)'; }
    else {
      txt = 'Steigflug am Seil';
      var dp = (g.theta - L.band) / DEG;
      if (dp < -7) sub = 'Ziehen (↓ / S) – Nase höher in den grünen Bereich';
      else if (dp > 7) sub = 'Zu steil! Nachlassen (↑ / W)';
      else sub = 'Sehr gut – Lage im grünen Bereich halten';
      if (Math.abs(g.phi) > 12 * DEG) sub = 'Flügel gerade halten! (← →)';
    }
    ctx.font = '800 ' + (26 * u) + 'px ' + FONT;
    ctx.lineWidth = 5 * u;
    ctx.strokeStyle = 'rgba(10,25,40,0.45)';
    ctx.strokeText(txt, W / 2, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(txt, W / 2, y);
    ctx.font = '600 ' + (16 * u) + 'px ' + FONT;
    ctx.lineWidth = 4 * u;
    ctx.strokeText(sub, W / 2, y + 26 * u);
    ctx.fillStyle = '#e8fff0';
    ctx.fillText(sub, W / 2, y + 26 * u);
    if (L.phase === 'climb') {
      // Lagebalken
      var bw = 26 * u, bh = 170 * u;
      var bx = W / 2 + 230 * u, by = Hh * 0.5 - bh / 2;
      panel(ctx, bx - 8 * u, by - 22 * u, bw + 16 * u, bh + 52 * u, 10 * u);
      var toY = function (deg) { return by + bh - clamp(deg / 60, 0, 1) * bh; };
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(bx, by, bw, bh);
      var b0 = (L.band / DEG) - 7, b1 = (L.band / DEG) + 7;
      ctx.fillStyle = 'rgba(70,230,120,0.6)';
      ctx.fillRect(bx, toY(b1), bw, toY(b0) - toY(b1));
      var cur = toY(g.theta / DEG);
      ctx.fillStyle = '#ffb02e';
      ctx.fillRect(bx - 5 * u, cur - 2 * u, bw + 10 * u, 4 * u);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 ' + (10 * u) + 'px ' + FONT;
      ctx.fillText('NASE', bx + bw / 2, by - 8 * u);
      ctx.fillText(Math.round(L.quality * 100) + '%', bx + bw / 2, by + bh + 16 * u);
      ctx.fillText('Seil', bx + bw / 2, by + bh + 27 * u);
    }
    ctx.font = '600 ' + (12 * u) + 'px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Leertaste: früh ausklinken', W / 2, Hh * 0.17 + 48 * u);
  };
})();
