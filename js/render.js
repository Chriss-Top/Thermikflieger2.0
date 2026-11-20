/* Thermikflieger 2.0 – Renderer: Kamera, Himmel, perspektivische Landschaft, Objekte, Effekte */
(function () {
  'use strict';
  var clamp = TF.clamp, smoothstep = TF.smoothstep, LU = TF.LU;

  // Tiefenebenen der Landschaft (z in m, Kamera steht bei z = -D)
  var ZS = [-262, -205, -140, -70, 4, 88, 185, 305, 460, 670, 960, 1360, 1900, 2650, 3650, 5000, 6900, 9500, 13000, 18000];
  var NZ = ZS.length;
  var D = 350;
  var MAXS = 1400;

  var SKY_TOP = [52, 112, 196], SKY_MID = [108, 166, 226], SKY_HOR = [204, 226, 240];
  var HAZE = [196, 218, 234];
  var LIGHT = (function () { var l = [-0.45, 0.78, -0.42]; var n = Math.sqrt(l[0] * l[0] + l[1] * l[1] + l[2] * l[2]); return [l[0] / n, l[1] / n, l[2] / n]; })();

  var COL = {
    meadow: [[106, 164, 66], [118, 172, 72], [98, 154, 62], [126, 178, 80]],
    field: [[218, 192, 108], [206, 174, 92], [146, 186, 82], [154, 116, 80], [226, 210, 76], [176, 198, 98], [196, 160, 98], [134, 176, 74]],
    forest: [[46, 90, 50], [52, 98, 54], [42, 82, 48]],
    village: [[128, 152, 94], [140, 158, 100]],
    airfield: [[122, 180, 82], [134, 190, 90]],
    runway: [150, 202, 102]
  };

  TF.Renderer = function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.W = 800; this.H = 600; this.dpr = 1;
    this.cam = { x: 0, y: 300, Vm: 600, s: 1, F: 350, D: D, eyeY: 0, eyeH: 0, py: 0, shakeX: 0, shakeY: 0, shake: 0, pos: [0, 0, -D] };
    this.levels = [];
    for (var j = 0; j < NZ; j++) {
      this.levels.push({ z: ZS[j], x0: 0, step: 10, n: 0, sx: new Float32Array(MAXS), sy: new Float32Array(MAXS), h: new Float32Array(MAXS), k: 1 });
    }
    this.cells = [];
    for (j = 0; j < NZ; j++) this.cells.push({ n: 0, x0: 0, w: 1, lu: new Int8Array(2048), seedv: new Float32Array(2048) });
    this.items = [];
    this.dust = [];
    this.motes = [];
    this.farClouds = [];
    this.parachute = null;
    var rng = TF.RNG(4242);
    for (var i = 0; i < 46; i++) {
      this.farClouds.push({
        xm: rng() * 90000, z: 1300 + Math.pow(rng(), 1.3) * 15000, dy: rng() * 380 - 120,
        w: 700 + rng() * 1400 + rng() * rng() * 2000, v: (rng() * 6) | 0, a: 0.75 + rng() * 0.25
      });
    }
    this.p = [0, 0, 0];
    var self = this;
    this.camObj = {
      pos: this.cam.pos,
      project: function (x, y, z) { return self.project(x, y, z); }
    };
  };

  var R = TF.Renderer.prototype;

  R.resize = function (w, h, dpr) {
    this.W = w; this.H = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  };

  R.project = function (x, y, z) {
    var c = this.cam;
    var d = z + D;
    if (d < 2) return null;
    var k = c.F / d;
    var p = this.p;
    p[0] = this.W * 0.5 + (x - c.x) * k + c.shakeX;
    p[1] = c.py + (c.eyeY - y) * k + c.shakeY;
    p[2] = k;
    return p;
  };

  // ------------------------------------------------------------
  // Kamera
  // ------------------------------------------------------------
  R.updateCamera = function (dt, g, world, opts) {
    var c = this.cam;
    opts = opts || {};
    var agl = g.y - world.hC(g.x);
    var tVm = opts.Vm || TF.lerp(480, 1000, smoothstep(60, 800, agl));
    var tRow = opts.row || TF.lerp(0.56, 0.73, smoothstep(110, 420, agl));
    if (c.row === undefined || opts.snap) c.row = tRow;
    c.row += (tRow - c.row) * Math.min(1, dt * 0.8);
    if (opts.snap) c.Vm = tVm; else c.Vm += (tVm - c.Vm) * Math.min(1, dt * 0.7);
    c.s = this.H / c.Vm;
    c.F = c.s * D;
    var aspect = this.W / this.H;
    // geglättete Bahngeschwindigkeit: beim Kreisen pendelt die Kamera nicht mit
    if (c.vxs === undefined || opts.snap) c.vxs = g.vx || 0;
    c.vxs += ((g.vx || 0) - c.vxs) * Math.min(1, dt * 0.35);
    var look = clamp(c.vxs * 1.9, -0.26 * c.Vm * aspect, 0.26 * c.Vm * aspect);
    if (opts.look !== undefined) look = opts.look;
    var tx = g.x + look;
    c.eyeH = 0.21 * c.Vm;
    // Tiefe kompensieren, damit das Flugzeug vertikal im Bild bleibt
    var ty = g.y + c.eyeH * (g.z || 0) / D * 0.8;
    if (opts.snap) { c.x = tx; c.y = ty; }
    c.x += (tx - c.x) * Math.min(1, dt * 1.8);
    c.y += (ty - c.y) * Math.min(1, dt * 3.2);
    var lim = 0.22 * c.Vm;
    if (c.y < ty - lim) c.y = ty - lim;
    if (c.y > ty + lim) c.y = ty + lim;
    c.eyeY = c.y + c.eyeH;
    c.py = this.H * c.row - c.eyeH * c.s;
    c.pos[0] = c.x; c.pos[1] = c.eyeY; c.pos[2] = -D;
    // Schütteln
    c.shake = Math.max(0, c.shake - dt * 1.5);
    var sh = c.shake * c.shake * 14;
    c.shakeX = (Math.random() - 0.5) * sh;
    c.shakeY = (Math.random() - 0.5) * sh;
    // Flugzeug-Überhöhung (konstante Bildgröße)
    this.E = 0.18 * c.Vm / 15;
  };

  // ------------------------------------------------------------
  // Hauptzeichnung
  // ------------------------------------------------------------
  R.draw = function (st) {
    var ctx = this.ctx;
    var dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.items.length = 0;
    this.drawSky(ctx, st);
    this.collectItems(st);
    this.drawTerrain(ctx, st);
    this.drawMotes(ctx, st);
    this.drawOverlayFx(ctx, st);
  };

  R.drawSky = function (ctx, st) {
    var c = this.cam, W = this.W, H = this.H;
    var hy = c.py + c.shakeY;
    var g = ctx.createLinearGradient(0, Math.min(0, hy - H), 0, Math.max(hy + 40, 10));
    g.addColorStop(0, TF.rgb(SKY_TOP));
    g.addColorStop(0.55, TF.rgb(SKY_MID));
    g.addColorStop(0.92, TF.rgb(SKY_HOR));
    g.addColorStop(1, TF.rgb(HAZE));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Sonne
    var sx = W * 0.16, sy = hy - H * 0.36;
    var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.5);
    sg.addColorStop(0, 'rgba(255,252,232,0.95)');
    sg.addColorStop(0.05, 'rgba(255,248,220,0.75)');
    sg.addColorStop(0.2, 'rgba(255,240,205,0.22)');
    sg.addColorStop(1, 'rgba(255,240,205,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);
  };

  // ------------------------------------------------------------
  // Dynamische Objekte nach Tiefe einsortieren
  // ------------------------------------------------------------
  R.addItem = function (z, fn) { this.items.push({ z: z, fn: fn }); };

  R.collectItems = function (st) {
    var self = this, world = st.world, t = st.t, c = this.cam;
    var S = TF.Sprites;
    // ferne Deko-Wolken
    var P = 90000;
    for (var i = 0; i < this.farClouds.length; i++) {
      (function (fc) {
        var dx = ((fc.xm + world.drift * 0.9 - c.x) % P + P) % P - P / 2;
        var x = c.x + dx;
        var y = world.cloudBase(t) + fc.dy + fc.z * 0.012;
        self.addItem(fc.z, function (ctx) { self.drawCloud(ctx, S.farClouds[fc.v], x, y, fc.z, fc.w, fc.a); });
      })(this.farClouds[i]);
    }
    // Thermikwolken, Vögel, Partikel
    var cb = world.cloudBase(t);
    var T = world.thermals;
    for (i = 0; i < T.length; i++) {
      (function (th) {
        var tx = world.thermalX(th);
        if (Math.abs(tx - c.x) > 9000) return;
        var top = cb + th.cbOff;
        if (th.hasCloud) {
          var ce = TF.cloudEnv(th);
          if (ce > 0.01) {
            var wdt = (th.R * 3 + 260) * th.cloudScale * (0.35 + 0.65 * Math.sqrt(ce));
            var spr = S.clouds[th.variant % S.clouds.length];
            self.addItem(th.z + 1, function (ctx) { self.drawCloud(ctx, spr, tx, top, th.z, wdt, Math.min(1, ce * 1.2)); });
          }
        }
        var env = TF.thermalEnv(th);
        if (env > 0.15 && Math.abs(tx - c.x) < 1600) {
          self.addItem(th.z, function (ctx) { self.drawThermalMotes(ctx, th, tx, top, env, world, t); });
          if (th.birds) self.addItem(th.z - 1, function (ctx) { self.drawBirds(ctx, th, tx, top, world, t); });
        }
      })(T[i]);
    }
    // Flugplatz-Objekte
    var A = world.airfields;
    for (i = 0; i < A.length; i++) {
      (function (af) {
        if (af.x1 < c.x - 2500 || af.x0 > c.x + 2500) return;
        self.addItem(175, function (ctx) { self.drawHangar(ctx, af, world); });
        self.addItem(-75, function (ctx) { self.drawWindsock(ctx, af.x0 + 40, -75, world, t); });
        self.addItem(80, function (ctx) { self.drawWindsock(ctx, af.x1 - 40, 80, world, t); });
        if (af.start) self.addItem(-2, function (ctx) { self.drawWinch(ctx, af.x1 - 70, 0, world); });
      })(A[i]);
    }
    // Segelflugzeug, Schatten, Seil
    var g = st.glider;
    if (g && st.showGlider !== false) {
      var gz = g.z;
      self.addItem(gz + 0.2, function (ctx) { self.drawShadow(ctx, g, world); });
      if (g.mode === 'launch' && g.launch && g.launch.phase !== 'ready' || (g.mode === 'launch')) {
        self.addItem(gz + 0.1, function (ctx) { self.drawCable(ctx, g, world); });
      }
      self.addItem(gz, function (ctx) { self.drawGlider(ctx, g, world, st); });
    }
    if (this.parachute) {
      var pc = this.parachute;
      self.addItem(0.5, function (ctx) { self.drawParachute(ctx, pc); });
    }
    // Staub / Trümmer
    if (this.dust.length) self.addItem(-20, function (ctx) { self.drawDust(ctx); });
    this.items.sort(function (a, b) { return b.z - a.z; });
  };

  // ------------------------------------------------------------
  // Landschaft
  // ------------------------------------------------------------
  function quantStep(m) {
    var s = 5;
    while (s < m) s *= 2;
    return s;
  }

  R.drawTerrain = function (ctx, st) {
    var world = st.world, c = this.cam, W = this.W, H = this.H, t = st.t;
    var Fref = (H / 640) * D;
    var L = this.levels;
    var j, m;
    // Profile je Tiefenebene
    for (j = 0; j < NZ; j++) {
      var lv = L[j];
      var z = ZS[j];
      var kref = Fref / (z + D);
      var step = quantStep(13 / kref);
      lv.step = step;
      var zn = ZS[Math.min(j + 1, NZ - 1)];
      var halfW = (W * 0.5 + 80) / (c.F / (zn + D));
      var x0 = Math.floor((c.x - halfW) / step) * step;
      var n = Math.min(MAXS, Math.ceil((2 * halfW) / step) + 3);
      lv.x0 = x0; lv.n = n; lv.k = c.F / (z + D);
      for (m = 0; m < n; m++) {
        var x = x0 + m * step;
        var h = world.h(x, z);
        var p = this.project(x, h, z);
        lv.sx[m] = p[0]; lv.sy[m] = p[1]; lv.h[m] = h;
      }
    }
    // Wolkenschatten sammeln
    var shadows = [];
    var cb = world.cloudBase(t);
    for (var i = 0; i < world.thermals.length; i++) {
      var th = world.thermals[i];
      if (!th.hasCloud) continue;
      var ce = TF.cloudEnv(th);
      if (ce < 0.05) continue;
      var tx = world.thermalX(th);
      if (Math.abs(tx - c.x) > 6000) continue;
      shadows.push({ x: tx + 90, z: th.z, r: (th.R * 1.3 + 90) * th.cloudScale * (0.4 + 0.6 * Math.sqrt(ce)), a: 0.2 * ce });
    }

    var items = this.items, ip = 0;
    // Objekte jenseits der fernsten Ebene
    while (ip < items.length && items[ip].z >= ZS[NZ - 1]) { items[ip].fn(ctx); ip++; }

    ctx.lineJoin = 'round';
    for (var b = NZ - 2; b >= 0; b--) {
      this.drawBand(ctx, b, world, shadows, t);
      while (ip < items.length && items[ip].z >= ZS[b]) { items[ip].fn(ctx); ip++; }
    }
    // Vordergrund bis zum Bildrand
    this.drawForeground(ctx, world, shadows);
    while (ip < items.length) { items[ip].fn(ctx); ip++; }
  };

  function cellColor(lu, cx, ci, band, seedv) {
    var h = TF.hash3(ci, band * 7 + 3, 11);
    switch (lu) {
      case LU.MEADOW: return COL.meadow[(h * 4) | 0];
      case LU.FIELD: return COL.field[(h * COL.field.length) | 0];
      case LU.FOREST: return COL.forest[(h * 3) | 0];
      case LU.VILLAGE: return COL.village[(h * 2) | 0];
      case LU.AIRFIELD: return COL.airfield[ci & 1];
      case LU.RUNWAY: return COL.runway;
    }
    return COL.meadow[0];
  }

  R.shadeColor = function (base, dhdx, dhdz, zc, x, shadows) {
    var nx = -dhdx, ny = 1, nz = -dhdz;
    var nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    var lam = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl;
    var k = 0.48 + 0.62 * Math.max(0, lam);
    var col = [base[0] * k, base[1] * k, base[2] * k];
    // Wolkenschatten
    for (var i = 0; i < shadows.length; i++) {
      var s = shadows[i];
      var dx = (x - s.x) / s.r, dz = (zc - s.z) / (s.r * 0.8);
      var d2 = dx * dx + dz * dz;
      if (d2 < 1.6) {
        var f = s.a * (1 - smoothstep(0.5, 1.6, d2));
        col[0] *= 1 - f; col[1] *= 1 - f * 0.9; col[2] *= 1 - f * 0.7;
      }
    }
    var fog = 1 - Math.exp(-Math.max(0, zc + D - 260) / 8000);
    fog = Math.min(0.9, fog);
    return TF.mix(col, HAZE, fog);
  };

  R.drawBand = function (ctx, b, world, shadows, t) {
    var Ln = this.levels[b], Lf = this.levels[b + 1];
    var zn = ZS[b], zf = ZS[b + 1];
    var zc = (zn + zf) * 0.5;
    var sf = Lf.step, sn = Ln.step;
    var cellMin = b < 9 ? 70 : 110;
    var cw = sf * Math.max(1, Math.ceil(cellMin / sf));
    var xa = Math.ceil(Math.max(Lf.x0, Ln.x0) / cw) * cw;
    var xEnd = Math.min(Lf.x0 + (Lf.n - 1) * sf, Ln.x0 + (Ln.n - 1) * sn);
    var cells = this.cells[b];
    cells.n = 0; cells.x0 = xa; cells.w = cw;
    // Lücke links auffüllen
    xa -= cw;
    var ci = 0;
    for (var x0 = xa; x0 < xEnd; x0 += cw) {
      var x1 = Math.min(x0 + cw, xEnd);
      var xs = Math.max(x0, Math.max(Lf.x0, Ln.x0));
      if (x1 <= xs) { ci++; continue; }
      var fa = Math.round((xs - Lf.x0) / sf), fb = Math.round((x1 - Lf.x0) / sf);
      var na = Math.round((xs - Ln.x0) / sn), nb = Math.round((x1 - Ln.x0) / sn);
      fa = clamp(fa, 0, Lf.n - 1); fb = clamp(fb, 0, Lf.n - 1);
      na = clamp(na, 0, Ln.n - 1); nb = clamp(nb, 0, Ln.n - 1);
      var hfa = Lf.h[fa], hfb = Lf.h[fb], hna = Ln.h[na], hnb = Ln.h[nb];
      var xc = (xs + x1) * 0.5;
      var hc = (hfa + hfb + hna + hnb) * 0.25;
      var cellIndex = Math.floor(x0 / cw);
      var lu = world.landuse(xc, zc, hc);
      var base = cellColor(lu, xc, cellIndex, b);
      var dhdx = ((hfb - hfa) + (hnb - hna)) * 0.5 / Math.max(1, x1 - xs);
      var dhdz = ((hfa + hfb) - (hna + hnb)) * 0.5 / (zf - zn);
      var col = this.shadeColor(base, dhdx, dhdz, zc, xc, shadows);
      ctx.beginPath();
      ctx.moveTo(Lf.sx[fa], Lf.sy[fa]);
      for (var m = fa + 1; m <= fb; m++) ctx.lineTo(Lf.sx[m], Lf.sy[m]);
      for (m = nb; m >= na; m--) ctx.lineTo(Ln.sx[m], Ln.sy[m]);
      ctx.closePath();
      var cs = TF.rgb(col);
      ctx.fillStyle = cs;
      ctx.strokeStyle = cs;
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
      // Feldstruktur im Nahbereich
      if (Ln.k > 1.1 && (lu === LU.FIELD || lu === LU.AIRFIELD)) {
        this.fieldLines(ctx, Lf, Ln, fa, fb, na, nb, col, lu);
      }
      if (ci < 2048) { cells.lu[ci] = lu; }
      ci++;
    }
    cells.n = ci;
    cells.x0 = xa;
    // Pisten der Flugplätze (Bodenmarkierung innerhalb des Bandes)
    var A = world.airfields, c = this.cam;
    for (var q = 0; q < A.length; q++) {
      var af = A[q];
      if (af.x1 < c.x - 3000 || af.x0 > c.x + 3000) continue;
      var za = Math.max(zn, -14), zb = Math.min(zf, 46);
      if (zb > za) this.drawRunway(ctx, af, world, za, zb);
    }
    // Objekte (Bäume, Häuser)
    if (Lf.k > 0.16 && b < 12) this.drawBandObjects(ctx, b, world, t);
  };

  R.fieldLines = function (ctx, Lf, Ln, fa, fb, na, nb, col, lu) {
    var lc = TF.rgb(TF.scale(col, lu === LU.AIRFIELD ? 1.06 : 0.92), 0.55);
    ctx.strokeStyle = lc;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var q = 1; q < 4; q++) {
      var f = q / 4;
      var ax = TF.lerp(Ln.sx[na], Lf.sx[fa], f), ay = TF.lerp(Ln.sy[na], Lf.sy[fa], f);
      var bx = TF.lerp(Ln.sx[nb], Lf.sx[fb], f), by = TF.lerp(Ln.sy[nb], Lf.sy[fb], f);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
  };

  R.drawForeground = function (ctx, world, shadows) {
    var L0 = this.levels[0];
    var H = this.H;
    var cw = L0.step * 8;
    var zc = ZS[0] - 40;
    for (var a = 0; a < L0.n - 1; a += 8) {
      var b = Math.min(L0.n - 1, a + 8);
      var x0 = L0.x0 + a * L0.step, x1 = L0.x0 + b * L0.step;
      var xc = (x0 + x1) / 2;
      var lu = world.landuse(xc, zc, L0.h[a]);
      var base = cellColor(lu, xc, Math.floor(x0 / cw), 99);
      var col = this.shadeColor(base, (L0.h[b] - L0.h[a]) / (x1 - x0), 0, zc, xc, shadows);
      ctx.beginPath();
      ctx.moveTo(L0.sx[a], L0.sy[a]);
      for (var m = a + 1; m <= b; m++) ctx.lineTo(L0.sx[m], L0.sy[m]);
      ctx.lineTo(L0.sx[b], H + 10);
      ctx.lineTo(L0.sx[a], H + 10);
      ctx.closePath();
      var cs = TF.rgb(col);
      ctx.fillStyle = cs; ctx.strokeStyle = cs; ctx.lineWidth = 1;
      ctx.fill(); ctx.stroke();
    }
  };

  // Bäume & Häuser in einem Band, von hinten nach vorn
  R.drawBandObjects = function (ctx, b, world, t) {
    var S = TF.Sprites;
    var Ln = this.levels[b], Lf = this.levels[b + 1];
    var zn = ZS[b], zf = ZS[b + 1];
    var cells = this.cells[b];
    var c = this.cam;
    var kmid = c.F / ((zn + zf) * 0.5 + D);
    var sp = 10;
    while (sp * kmid < 14) sp *= 2;
    this._bandLn = Ln; this._bandLf = Lf; this._bandZn = zn; this._bandZf = zf;
    var W = this.W;
    var halfW = (W * 0.5 + 40) / (c.F / (zf + D));
    var xlo = Math.floor((c.x - halfW) / sp) * sp, xhi = c.x + halfW;
    var gz0 = Math.ceil(zn / sp), gz1 = Math.floor(zf / sp);
    var windG = world.windAt(0, t);
    for (var gz = gz1; gz >= gz0; gz--) {
      for (var x = xlo; x < xhi; x += sp) {
        var gx = Math.round(x / sp);
        var hh = TF.hash3(gx, gz, 77);
        var ci = Math.floor((x - cells.x0) / cells.w);
        if (ci < 0 || ci >= cells.n) continue;
        var lu = cells.lu[ci];
        var px = x + (TF.hash3(gx, gz, 78) - 0.5) * sp * 0.8;
        var pz = gz * sp + (TF.hash3(gx, gz, 79) - 0.5) * sp * 0.8;
        if (pz < zn || pz > zf) continue;
        if (lu === LU.FOREST) {
          if (hh > 0.85) continue;
          this.drawTree(ctx, px, pz, world, hh, b);
        } else if (lu === LU.VILLAGE) {
          if (sp > 20) { if (hh < 0.5) this.drawTree(ctx, px, pz, world, hh, b); continue; }
          if (hh < 0.28) this.drawHouse(ctx, px, pz, world, gx, gz, windG, t);
          else if (hh < 0.4) this.drawTree(ctx, px, pz, world, hh, b);
        } else if (lu === LU.MEADOW || lu === LU.FIELD) {
          if (hh < 0.018 * (sp / 10)) this.drawTree(ctx, px, pz, world, hh * 40, b);
        }
      }
    }
    // Kirchen
    var ci0 = Math.floor(c.x / 3000);
    for (var j = ci0 - 2; j <= ci0 + 2; j++) {
      var V = world.getChunk(j).villages;
      for (var q = 0; q < V.length; q++) {
        var v = V[q];
        if (v.church && v.z >= zn && v.z < zf) this.drawChurch(ctx, v.x, v.z, world);
      }
    }
  };

  // Geländehöhe aus den Profilen des aktuellen Bandes interpolieren
  R.bandH = function (x, z) {
    var Ln = this._bandLn, Lf = this._bandLf;
    var fn = (x - Ln.x0) / Ln.step, ff = (x - Lf.x0) / Lf.step;
    var in0 = Math.max(0, Math.min(Ln.n - 2, Math.floor(fn))), if0 = Math.max(0, Math.min(Lf.n - 2, Math.floor(ff)));
    var hn = Ln.h[in0] + (Ln.h[in0 + 1] - Ln.h[in0]) * Math.min(1, Math.max(0, fn - in0));
    var hf = Lf.h[if0] + (Lf.h[if0 + 1] - Lf.h[if0]) * Math.min(1, Math.max(0, ff - if0));
    var t = (z - this._bandZn) / (this._bandZf - this._bandZn);
    return hn + (hf - hn) * t;
  };

  R.drawTree = function (ctx, x, z, world, hh, b) {
    var S = TF.Sprites;
    var h = this.bandH(x, z);
    var p = this.project(x, h, z);
    if (!p) return;
    var k = p[2];
    var conifer = (hh * 7 % 1) < 0.35;
    var spr = conifer ? S.pines[(hh * 13 | 0) % S.pines.length] : S.trees[(hh * 17 | 0) % S.trees.length];
    var th = (13 + (hh * 31 % 1) * 9) * k * 1.25;
    if (th < 3.5) return;
    var tw = th * spr.w / spr.h;
    if (p[0] < -tw || p[0] > this.W + tw) return;
    if (b > 9) ctx.globalAlpha = 1 - (b - 9) * 0.12;
    ctx.drawImage(spr.canvas, p[0] - tw / 2, p[1] - th * 0.98, tw, th);
    ctx.globalAlpha = 1;
  };

  R.drawHouse = function (ctx, x, z, world, gx, gz, wind, t) {
    var S = TF.Sprites;
    var h = this.bandH(x, z);
    var p = this.project(x, h, z);
    if (!p) return;
    var k = p[2];
    var spr = S.houses[(TF.hash3(gx, gz, 5) * S.houses.length) | 0];
    var w = 16 * k * 1.25;
    var hh = w * spr.h / spr.w;
    if (p[0] < -w || p[0] > this.W + w) return;
    var sx = p[0] - w / 2, sy = p[1] - hh * 0.97;
    ctx.drawImage(spr.canvas, sx, sy, w, hh);
    // Rauch aus dem Schornstein
    if (k > 0.75 && TF.hash3(gx, gz, 6) < 0.35) {
      var cx = sx + spr.chimneyX * w, cy = sy + hh - spr.chimneyY * hh;
      for (var i = 0; i < 6; i++) {
        var a = (t * 0.35 + i / 6 + TF.hash3(gx, gz, 7)) % 1;
        var r = (1 + a * 4) * k * 1.2;
        var dx = wind * a * 9 * k * 1.2 + Math.sin(t * 1.3 + i) * k;
        var dy = -a * 16 * k * 1.2;
        ctx.fillStyle = 'rgba(235,238,242,' + (0.45 * (1 - a)).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  R.drawChurch = function (ctx, x, z, world) {
    var spr = TF.Sprites.church;
    var h = world.h(x, z);
    var p = this.project(x, h, z);
    if (!p) return;
    var w = 22 * p[2] * 1.3, hh = w * spr.h / spr.w;
    if (p[0] < -w || p[0] > this.W + w) return;
    ctx.drawImage(spr.canvas, p[0] - w / 2, p[1] - hh * 0.98, w, hh);
  };

  // ------------------------------------------------------------
  // Wolken, Thermik-Hinweise
  // ------------------------------------------------------------
  R.drawCloud = function (ctx, spr, x, baseY, z, widthM, alpha) {
    var p = this.project(x, baseY, z);
    if (!p) return;
    var wpx = widthM * p[2];
    var hpx = wpx * spr.h / spr.w;
    var sx = p[0] - wpx / 2, sy = p[1] - hpx * spr.baseFrac;
    if (sx > this.W || sx + wpx < 0 || sy > this.H || sy + hpx < 0) return;
    var fog = Math.min(0.55, Math.max(0, (z - 1500) / 30000));
    ctx.globalAlpha = alpha * (1 - fog * 0.6);
    ctx.drawImage(spr.canvas, sx, sy, wpx, hpx);
    ctx.globalAlpha = 1;
  };

  R.drawThermalMotes = function (ctx, th, tx, top, env, world, t) {
    var g = world.hC(tx);
    var span = top - g - 40;
    if (span < 50) return;
    ctx.fillStyle = 'rgba(255,255,250,0.85)';
    for (var i = 0; i < 16; i++) {
      var fr = (i * 0.618034) % 1;
      var y = g + 20 + ((t * th.W * 0.9 + i * 97.3) % span);
      var ang = i * 2.39996 + t * 0.35;
      var rr = th.R * 0.55 * Math.sqrt(fr);
      var x = tx + Math.cos(ang) * rr, z = th.z + Math.sin(ang) * rr * 0.8;
      var p = this.project(x, y, z);
      if (!p || p[0] < -5 || p[0] > this.W + 5 || p[1] < -5 || p[1] > this.H + 5) continue;
      var a = 0.22 * env * Math.sin(Math.PI * ((y - g - 20) / span));
      ctx.globalAlpha = Math.max(0, a);
      var r = Math.max(0.8, 0.9 * p[2]);
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  R.drawBirds = function (ctx, th, tx, top, world, t) {
    var g = world.hC(tx);
    ctx.strokeStyle = 'rgba(40,40,46,0.85)';
    ctx.lineCap = 'round';
    for (var i = 0; i < th.birds; i++) {
      var dir = (th.id + i) % 2 ? 1 : -1;
      var ang = t * 0.42 * dir + i * 2.1 + th.id;
      var rr = th.R * (0.3 + 0.12 * i);
      var range = Math.max(80, top - g - 180);
      var y = g + 140 + ((i * 173 + th.age * 1.4) % range);
      var x = tx + Math.cos(ang) * rr, z = th.z + Math.sin(ang) * rr;
      var p = this.project(x, y, z);
      if (!p || p[0] < -20 || p[0] > this.W + 20 || p[1] < -20 || p[1] > this.H + 20) continue;
      var sz = Math.max(3, 1.6 * p[2] * this.E * 0.55);
      var flap = Math.sin(t * 9 + i * 3) > 0.7 ? 0.5 : 0.15;
      ctx.lineWidth = Math.max(1, sz * 0.18);
      ctx.beginPath();
      ctx.moveTo(p[0] - sz, p[1] - sz * flap);
      ctx.quadraticCurveTo(p[0] - sz * 0.45, p[1] - sz * 0.35, p[0], p[1]);
      ctx.quadraticCurveTo(p[0] + sz * 0.45, p[1] - sz * 0.35, p[0] + sz, p[1] - sz * flap);
      ctx.stroke();
    }
  };

  // ------------------------------------------------------------
  // Flugplatz
  // ------------------------------------------------------------
  R.drawRunway = function (ctx, af, world, za, zb) {
    var z0 = za, z1 = zb;
    var seg = 60;
    for (var x = af.x0, i = 0; x < af.x1; x += seg, i++) {
      var xe = Math.min(af.x1, x + seg);
      var h0 = world.hC(x), h1 = world.hC(xe);
      var a = this.project(x, h0, z1); if (!a) return; var ax = a[0], ay = a[1];
      var b = this.project(xe, h1, z1); var bx = b[0], by = b[1];
      var c = this.project(xe, h1, z0); var cx = c[0], cy = c[1];
      var d = this.project(x, h0, z0); var dx = d[0], dy = d[1];
      if (Math.max(ax, bx, cx, dx) < -50 || Math.min(ax, bx, cx, dx) > this.W + 50) continue;
      ctx.fillStyle = i % 2 ? 'rgb(150,204,104)' : 'rgb(140,196,96)';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill();
    }
    // Randmarkierungen
    for (x = af.x0; x <= af.x1; x += 80) {
      for (var s = 0; s < 2; s++) {
        var zz = s ? 46 : -14;
        if (zz < za - 0.01 || zz > zb + 0.01) continue;
        var p = this.project(x, world.hC(x), zz);
        if (!p || p[0] < -10 || p[0] > this.W + 10) continue;
        var w = Math.max(1.5, 2.2 * p[2]), hh = Math.max(1, 0.9 * p[2]);
        ctx.fillStyle = (Math.round(x / 80) % 2) ? '#ffffff' : '#ff8a2a';
        ctx.fillRect(p[0] - w / 2, p[1] - hh, w, hh);
      }
    }
    // Schwellenmarkierung
    var thr = [af.x0 + 20, af.x1 - 20];
    z0 = Math.max(za, -8); z1 = Math.min(zb, 40);
    if (z1 <= z0) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    for (var q = 0; q < 2; q++) {
      var hq = world.hC(thr[q]);
      var p0 = this.project(thr[q], hq, z0);
      if (!p0) continue;
      var x0b = p0[0], y0b = p0[1];
      var p1 = this.project(thr[q], hq, z1);
      if (!p1) continue;
      ctx.lineWidth = Math.max(1, 1.6 * p1[2]);
      ctx.beginPath();
      ctx.moveTo(x0b, y0b);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
    }
  };

  R.drawHangar = function (ctx, af, world) {
    var x = af.x0 + 70, z = 175;
    var h = world.h(x, z);
    var p = this.project(x, h, z);
    if (!p) return;
    var k = p[2];
    var w = 46 * k, hh = 13 * k;
    var sx = p[0], sy = p[1];
    if (sx + w < 0 || sx - w > this.W) return;
    // Halle
    ctx.fillStyle = '#c9ced4';
    ctx.fillRect(sx - w / 2, sy - hh, w, hh);
    ctx.fillStyle = '#9aa3ad';
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 - 1, sy - hh);
    ctx.quadraticCurveTo(sx, sy - hh * 1.75, sx + w / 2 + 1, sy - hh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6f7882';
    ctx.fillRect(sx - w * 0.38, sy - hh * 0.82, w * 0.76, hh * 0.82);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (var i = 1; i < 6; i++) {
      var lx = sx - w * 0.38 + w * 0.76 * i / 6;
      ctx.beginPath(); ctx.moveTo(lx, sy - hh * 0.82); ctx.lineTo(lx, sy); ctx.stroke();
    }
    // Vereinsheim
    var cxp = sx + w * 0.75;
    ctx.fillStyle = '#efe7d6';
    ctx.fillRect(cxp - 9 * k, sy - 6 * k, 18 * k, 6 * k);
    ctx.fillStyle = '#a84a32';
    ctx.beginPath(); ctx.moveTo(cxp - 10 * k, sy - 6 * k); ctx.lineTo(cxp, sy - 10 * k); ctx.lineTo(cxp + 10 * k, sy - 6 * k); ctx.closePath(); ctx.fill();
    // Name
    if (k > 0.5) {
      ctx.fillStyle = 'rgba(30,40,50,0.75)';
      ctx.font = '600 ' + Math.max(9, Math.min(15, 4 * k)) + 'px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(af.name, sx, sy - hh * 1.85);
    }
  };

  R.drawWindsock = function (ctx, x, z, world, t) {
    var h = world.h(x, z);
    var p = this.project(x, h, z);
    if (!p) return;
    var k = p[2];
    if (p[0] < -40 || p[0] > this.W + 40) return;
    var pole = 9 * k;
    var bx = p[0], by = p[1] - pole;
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = Math.max(1, 0.35 * k);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(bx, by); ctx.stroke();
    var w = world.windAt(0, t);
    var ext = clamp(Math.abs(w) / 7, 0.15, 1);
    var dir = w >= 0 ? 1 : -1;
    var len = 5.5 * k;
    var segs = 5;
    var droop = (1 - ext) * 0.9;
    for (var i = 0; i < segs; i++) {
      var a0 = i / segs, a1 = (i + 1) / segs;
      var fl = Math.sin(t * 7 + i * 1.3) * 0.04 * len * ext;
      var x0 = bx + dir * len * a0 * Math.cos(droop * a0 * 1.4);
      var y0 = by + len * Math.sin(droop * a0 * 1.4) * a0 + fl;
      var x1 = bx + dir * len * a1 * Math.cos(droop * a1 * 1.4);
      var y1 = by + len * Math.sin(droop * a1 * 1.4) * a1 + fl;
      var r0 = (0.75 - 0.35 * a0) * k, r1 = (0.75 - 0.35 * a1) * k;
      ctx.fillStyle = i % 2 ? '#ffffff' : '#ff6a1a';
      ctx.beginPath();
      ctx.moveTo(x0, y0 - r0); ctx.lineTo(x1, y1 - r1); ctx.lineTo(x1, y1 + r1); ctx.lineTo(x0, y0 + r0);
      ctx.closePath(); ctx.fill();
    }
  };

  R.drawWinch = function (ctx, x, z, world) {
    var h = world.h(x, z);
    var p = this.project(x, h, z);
    if (!p) return;
    var k = p[2];
    if (p[0] < -60 || p[0] > this.W + 60) return;
    var w = 9 * k, hh = 3.6 * k;
    ctx.fillStyle = '#4c6a3e';
    ctx.fillRect(p[0] - w / 2, p[1] - hh - 1 * k, w * 0.65, hh);
    ctx.fillStyle = '#d8b13a';
    ctx.fillRect(p[0] + w * 0.15, p[1] - hh * 1.2 - 1 * k, w * 0.35, hh * 1.2);
    ctx.fillStyle = '#7fa3c0';
    ctx.fillRect(p[0] + w * 0.22, p[1] - hh * 1.1 - 1 * k, w * 0.2, hh * 0.4);
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(p[0] - w * 0.3, p[1] - 0.6 * k, 0.8 * k, 0, 7); ctx.arc(p[0] + w * 0.3, p[1] - 0.6 * k, 0.8 * k, 0, 7); ctx.fill();
  };

  R.drawCable = function (ctx, g, world) {
    var L = g.launch;
    if (!L || L.released) return;
    var wx = L.winchX, wy = world.hC(wx) + 3;
    var nose = this.project(g.x + Math.cos(g.theta) * 2.5 * this.E, this.drawY(g, world) - 0.4 * this.E, g.z);
    if (!nose) return;
    var nx = nose[0], ny = nose[1];
    var w = this.project(wx, wy, 0);
    if (!w) return;
    var mx = (nx + w[0]) / 2, my = (ny + w[1]) / 2 + Math.abs(w[0] - nx) * 0.04 + 6;
    ctx.strokeStyle = 'rgba(40,40,40,0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.quadraticCurveTo(mx, my, w[0], w[1]);
    ctx.stroke();
  };

  R.drawParachute = function (ctx, pc) {
    var p = this.project(pc.x, pc.y, 0);
    if (!p) return;
    var k = p[2];
    var r = Math.max(3, 2.2 * k);
    ctx.fillStyle = '#ff5a3a';
    ctx.beginPath();
    ctx.arc(p[0], p[1] - r * 1.4, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,40,40,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p[0] - r, p[1] - r * 1.4); ctx.lineTo(p[0], p[1]); ctx.lineTo(p[0] + r, p[1] - r * 1.4);
    ctx.stroke();
    if (pc.cable) {
      var w = this.project(pc.wx, pc.wy, 0);
      if (w) {
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.quadraticCurveTo((p[0] + w[0]) / 2, Math.max(p[1], w[1]) + 10, w[0], w[1]);
        ctx.stroke();
      }
    }
  };

  // ------------------------------------------------------------
  // Segelflugzeug
  // ------------------------------------------------------------
  R.drawY = function (g, world) {
    var model = TF.getModel(g.type);
    var rest = world.hC(g.x) - model.bottom * this.E;
    var lift = smoothstep(0, 40, g.y - world.hC(g.x));
    var y = g.y;
    if (g.mode === 'ground' || (g.mode === 'launch' && g.launch.phase !== 'climb')) return rest;
    return Math.max(y, rest * (1 - lift) + y * lift);
  };

  R.drawShadow = function (ctx, g, world) {
    var gh = world.hC(g.x);
    var agl = g.y - gh;
    var a = 0.3 * (1 - smoothstep(10, 320, agl));
    if (a < 0.01) return;
    var p = this.project(g.x, gh, g.z);
    if (!p) return;
    var model = TF.getModel(g.type);
    var w = model.span * this.E * p[2] * 0.5 * (0.6 + 0.4 * Math.abs(Math.cos(g.psi)));
    var h = w * 0.18 * (0.5 + 0.5 * Math.abs(Math.sin(g.psi)) + 0.3);
    ctx.fillStyle = 'rgba(20,35,20,' + a.toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(p[0], p[1], w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  R.drawGlider = function (ctx, g, world, st) {
    var model = TF.getModel(g.type);
    var shake = g.buffet || 0;
    var t = st.t;
    var jit = shake > 0.05 ? (Math.sin(t * 61) * 0.5 + Math.sin(t * 43) * 0.5) * shake : 0;
    var pose = {
      x: g.x, y: this.drawY(g, world), z: g.z,
      psi: g.mode === 'ground' && g.gHeading !== undefined ? g.gHeading : g.psi,
      theta: g.theta + jit * 0.03,
      phi: g.phi + jit * 0.045,
      E: this.E,
      brake: g.brake || 0
    };
    if (g.crashed) {
      pose.theta = g.crashTheta || pose.theta;
      pose.phi = g.crashPhi || pose.phi;
    }
    TF.drawAircraft(ctx, model, pose, this.camObj);
  };

  // ------------------------------------------------------------
  // Partikel
  // ------------------------------------------------------------
  R.spawnDust = function (x, y, z, n, col, power) {
    for (var i = 0; i < n; i++) {
      this.dust.push({
        x: x, y: y, z: z,
        vx: (Math.random() - 0.5) * 14 * power, vy: Math.random() * 7 * power, vz: (Math.random() - 0.5) * 10 * power,
        life: 1.2 + Math.random() * 1.4, age: 0, r: 1 + Math.random() * 2.5, col: col
      });
    }
  };

  R.updateParticles = function (dt, world, t, glider) {
    for (var i = this.dust.length - 1; i >= 0; i--) {
      var d = this.dust[i];
      d.age += dt;
      if (d.age > d.life) { this.dust.splice(i, 1); continue; }
      d.vy -= 3 * dt;
      d.vx *= 1 - dt * 0.8; d.vz *= 1 - dt * 0.8;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      var gh = world.hC(d.x);
      if (d.y < gh) { d.y = gh; d.vy = 0; }
    }
    if (this.parachute) {
      var pc = this.parachute;
      pc.y -= 4.5 * dt;
      pc.x += (pc.wx - pc.x) * Math.min(1, dt * 0.18);
      if (pc.y < world.hC(pc.x) + 1) this.parachute = null;
    }
    // Windpartikel (Pollen) im Sichtfeld
    var c = this.cam;
    var wind = world.windAt(200, t);
    if (this.motes.length < 46) {
      for (var m = this.motes.length; m < 46; m++) this.motes.push(this.newMote(true));
    }
    for (i = 0; i < this.motes.length; i++) {
      var q = this.motes[i];
      q.x += (wind + Math.sin(t * 0.7 + q.ph) * 0.6) * dt;
      q.y += Math.sin(t * 0.9 + q.ph * 2) * 0.4 * dt;
      var p = this.project(q.x, q.y, q.z);
      if (!p || p[0] < -30 || p[0] > this.W + 30 || p[1] < -30 || p[1] > this.H + 30) {
        this.motes[i] = this.newMote(false);
      }
    }
  };

  R.newMote = function (anywhere) {
    var c = this.cam;
    var z = -150 + Math.random() * 450;
    var k = c.F / (z + D);
    var sx = Math.random() * this.W;
    var sy = Math.random() * this.H;
    if (!anywhere) {
      var r = Math.random();
      if (r < 0.5) sx = Math.random() < 0.5 ? -20 : this.W + 20;
      else sy = Math.random() < 0.5 ? -20 : this.H + 20;
    }
    return { x: c.x + (sx - this.W / 2) / k, y: c.eyeY - (sy - c.py) / k, z: z, ph: Math.random() * 10 };
  };

  R.drawMotes = function (ctx, st) {
    var c = this.cam;
    var g = st.glider;
    var vx = g ? g.vx || 0 : 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineCap = 'round';
    for (var i = 0; i < this.motes.length; i++) {
      var q = this.motes[i];
      var p = this.project(q.x, q.y, q.z);
      if (!p) continue;
      var k = p[2];
      var len = Math.min(18, Math.abs(vx) * 0.06 * k + 1);
      ctx.lineWidth = Math.max(0.8, 0.35 * k);
      ctx.globalAlpha = 0.35 + 0.3 * Math.min(1, k / 3);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[0] + (vx > 0 ? len : -len), p[1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  R.drawDust = function (ctx) {
    for (var i = 0; i < this.dust.length; i++) {
      var d = this.dust[i];
      var p = this.project(d.x, d.y, d.z);
      if (!p) continue;
      var a = 1 - d.age / d.life;
      ctx.fillStyle = TF.rgb(d.col, 0.6 * a);
      ctx.beginPath();
      ctx.arc(p[0], p[1], d.r * p[2] * (1 + d.age), 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // ------------------------------------------------------------
  // Vollbild-Effekte (Wolkendurchflug, Blitz)
  // ------------------------------------------------------------
  R.drawOverlayFx = function (ctx, st) {
    var W = this.W, H = this.H;
    if (st.cloudFog > 0.01) {
      ctx.fillStyle = 'rgba(236,241,247,' + (st.cloudFog * 0.85).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (st.flash > 0.01) {
      ctx.fillStyle = 'rgba(255,255,255,' + (st.flash * 0.7).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  };
})();
