/* Thermikflieger 2.0 – Welt: Gelände, Landnutzung, Flugplätze, Wind, Thermik, Hangaufwind */
(function () {
  'use strict';
  var clamp = TF.clamp, smoothstep = TF.smoothstep;

  var CH = 3000; // Chunkgröße für Geländemerkmale

  TF.LU = { MEADOW: 0, FIELD: 1, FOREST: 2, VILLAGE: 3, AIRFIELD: 4, RUNWAY: 5 };

  TF.World = function (seed) {
    this.seed = seed | 0;
    this.chunks = {};
    this.airfields = [];
    this.thermals = [];
    this.drift = 0;
    this.time = 0;
    this.thermalId = 0;
    this.rng = TF.RNG(seed * 3 + 17);
    // Startflugplatz: Piste von x=-250 bis 1150, Winde bei 1080
    var h0 = this.baseH(450);
    this.airfields.push({ x0: -250, x1: 1150, xc: 450, h: h0, start: true, idx: 0, name: 'Heimatplatz' });
    this.airfieldIdxR = 1;
    this.airfieldIdxL = -1;
    this.ensureAirfields(-15000, 30000);
    // Windphase so wählen, dass der Start mit Gegenwind beginnt
    this.windPhase = -TF.noise1(1.3, this.seed + 42) * 1.5;
    this.windSign = 1;
  };

  var P = TF.World.prototype;

  // ---------------- Gelände ----------------
  P.baseH = function (x) {
    return 70 + 55 * TF.fbm1(x / 2800 + 100, this.seed + 1, 3) + 14 * TF.noise1(x / 520 + 50, this.seed + 5);
  };

  var AF_NAMES = ['Wiesenfeld', 'Sonnenhang', 'Lerchenau', 'Birkenried', 'Hohe Wiese', 'Kranichfeld', 'Am Mühlbach',
    'Rotmilan', 'Talacker', 'Kiebitzwiese', 'Haselberg', 'Weidenau', 'Falkenhorst', 'Sommerfeld', 'Ginsterheide', 'Eichenhof'];

  P.ensureAirfields = function (xmin, xmax) {
    var A = this.airfields;
    while (A[A.length - 1].x1 < xmax) {
      var last = A[A.length - 1];
      var r = TF.RNG(this.seed * 13 + this.airfieldIdxR * 7919);
      var gap = 5200 + r() * 4300;
      var len = 620 + r() * 320;
      var xc = last.x1 + gap + len / 2;
      A.push({ x0: xc - len / 2, x1: xc + len / 2, xc: xc, h: this.baseH(xc), start: false, idx: this.airfieldIdxR,
        name: AF_NAMES[Math.abs(this.airfieldIdxR * 5 + this.seed) % AF_NAMES.length] });
      this.airfieldIdxR++;
    }
    while (A[0].x0 > xmin) {
      var first = A[0];
      var r2 = TF.RNG(this.seed * 17 + (-this.airfieldIdxL) * 104729);
      var gap2 = 5200 + r2() * 4300;
      var len2 = 620 + r2() * 320;
      var xc2 = first.x0 - gap2 - len2 / 2;
      A.unshift({ x0: xc2 - len2 / 2, x1: xc2 + len2 / 2, xc: xc2, h: this.baseH(xc2), start: false, idx: this.airfieldIdxL,
        name: AF_NAMES[Math.abs(this.airfieldIdxL * 3 + this.seed + 7) % AF_NAMES.length] });
      this.airfieldIdxL--;
    }
  };

  P.airfieldAtX = function (x, margin) {
    var A = this.airfields;
    for (var i = 0; i < A.length; i++) {
      var a = A[i];
      if (x > a.x0 - margin && x < a.x1 + margin) return a;
    }
    return null;
  };

  P.nextAirfield = function (x, dir) {
    var A = this.airfields, best = null, bd = 1e9;
    for (var i = 0; i < A.length; i++) {
      var a = A[i];
      var d = (a.xc - x) * dir;
      if (x >= a.x0 && x <= a.x1) return { af: a, dist: 0 };
      if (d > 0 && d < bd) { bd = d; best = a; }
    }
    return best ? { af: best, dist: Math.max(0, dir > 0 ? best.x0 - x : x - best.x1) } : null;
  };

  P.getChunk = function (i) {
    var c = this.chunks[i];
    if (c) return c;
    this.ensureAirfields(i * CH - 6000, (i + 1) * CH + 6000);
    var rng = TF.RNG(TF.hash2(i, this.seed) * 4294967296);
    var ridges = [];
    var n = rng() < 0.28 ? 0 : (rng() < 0.75 ? 1 : 2);
    for (var k = 0; k < n; k++) {
      var cx = i * CH + rng() * CH;
      var H = 90 + Math.pow(rng(), 1.3) * 310;
      H *= 0.45 + 0.55 * smoothstep(3500, 11000, Math.abs(cx));
      var wL = 300 + rng() * 520, wR = 300 + rng() * 520;
      var bad = (cx + wR > -1400 && cx - wL < 3000);
      for (var a = 0; a < this.airfields.length && !bad; a++) {
        var af = this.airfields[a];
        if (cx - wL - 450 < af.x1 && cx + wR + 450 > af.x0) bad = true;
      }
      if (!bad) ridges.push({ cx: cx, H: H, wL: wL, wR: wR, ph: rng() * 100 });
    }
    var villages = [];
    var nv = rng() < 0.35 ? 0 : (rng() < 0.7 ? 1 : 2);
    for (k = 0; k < nv; k++) {
      var vx = i * CH + rng() * CH;
      var near = rng() < 0.45;
      var vz = near ? -120 + rng() * 360 : 350 + rng() * 2600;
      var vr = 90 + rng() * 120;
      var onAf = false;
      for (a = 0; a < this.airfields.length; a++) {
        var af2 = this.airfields[a];
        if (vx + vr > af2.x0 - 200 && vx - vr < af2.x1 + 200 && vz < 600) onAf = true;
      }
      if (!onAf) villages.push({ x: vx, z: vz, r: vr, church: rng() < 0.5, seed: (rng() * 1e6) | 0 });
    }
    c = { ridges: ridges, villages: villages };
    this.chunks[i] = c;
    return c;
  };

  // Korridor-Höhenprofil (unabhängig von z)
  P.hC = function (x) {
    var h = this.baseH(x);
    var ci = Math.floor(x / CH);
    var add = 0;
    for (var j = ci - 1; j <= ci + 1; j++) {
      var R = this.getChunk(j).ridges;
      for (var k = 0; k < R.length; k++) {
        var r = R[k];
        var d = x - r.cx;
        var w = d < 0 ? r.wL : r.wR;
        var t = d / w;
        if (t <= -1 || t >= 1) continue;
        var q = 1 - t * t;
        var shape = q * q * (1 + 0.12 * Math.sin(t * 7 + r.ph) * q);
        add += r.H * shape;
      }
    }
    h += add;
    // Flugplätze einebnen
    var A = this.airfields;
    for (var i = 0; i < A.length; i++) {
      var af = A[i];
      if (x < af.x0 - 500 || x > af.x1 + 500) continue;
      var dd = x < af.x0 ? af.x0 - x : (x > af.x1 ? x - af.x1 : 0);
      var m = 1 - smoothstep(60, 480, dd);
      h = h + (af.h - h) * m;
    }
    return h;
  };

  P.hF = function (x, z) {
    var n = TF.fbm2(x / 1700, z / 1700, this.seed + 11, 4);
    var hills = 40 + 330 * Math.pow(n, 2.0);
    var mt = smoothstep(3800, 12000, z);
    if (mt > 0) hills += mt * 1300 * Math.pow(TF.fbm2(x / 4200, z / 4200, this.seed + 23, 4), 1.6);
    return hills;
  };

  P.h = function (x, z) {
    if (z <= 380) return this.hC(x);
    var t = smoothstep(380, 1800, z);
    var hc = t < 1 ? this.hC(x) : 0;
    return hc * (1 - t) + this.hF(x, z) * t;
  };

  P.slope = function (x) {
    return (this.hC(x + 4) - this.hC(x - 4)) / 8;
  };

  P.villageAt = function (x, z) {
    var ci = Math.floor(x / CH);
    for (var j = ci - 1; j <= ci + 1; j++) {
      var V = this.getChunk(j).villages;
      for (var k = 0; k < V.length; k++) {
        var v = V[k];
        var dx = x - v.x, dz = (z - v.z) * 0.8;
        if (dx * dx + dz * dz < v.r * v.r) return v;
      }
    }
    return null;
  };

  P.landuse = function (x, z, hgt) {
    var LU = TF.LU;
    var af = this.airfieldAtX(x, 110);
    if (af && z > -280 && z < 440) {
      if (z > -14 && z < 46 && x > af.x0 && x < af.x1) return LU.RUNWAY;
      return LU.AIRFIELD;
    }
    if (this.villageAt(x, z)) return LU.VILLAGE;
    if (hgt === undefined) hgt = this.h(x, z);
    var rel = clamp((hgt - this.baseH(x)) / 260, 0, 1);
    var fv = TF.fbm2(x / 820, z / 820, this.seed + 3, 3) + 0.32 * rel;
    if (fv > 0.6) return LU.FOREST;
    if (TF.fbm2(x / 640, z / 640, this.seed + 9, 2) > 0.53) return LU.MEADOW;
    return LU.FIELD;
  };

  // ---------------- Wind ----------------
  P.windBase = function (t) {
    var S = 1.8 + 6.2 * TF.noise1(t / 95 + 3.7, this.seed + 41);
    var a = TF.noise1(t / 230 + 1.3, this.seed + 42) * 1.5 + this.windPhase;
    return -S * Math.cos(Math.PI * a);
  };
  P.windAt = function (agl, t) {
    var W = this.windBase(t);
    var gust = (TF.noise1(t * 0.9, this.seed + 50) - 0.5) * 2 * (0.4 + 0.12 * Math.abs(W));
    return W * (0.55 + 0.45 * smoothstep(0, 450, agl)) + gust;
  };
  P.cloudBase = function (t) {
    return 900 + 150 * TF.noise1(t / 200 + 9, this.seed + 60);
  };

  // ---------------- Thermik ----------------
  function thermalEnv(th) {
    var p = th.age / th.life;
    if (p < 0.15) return smoothstep(0, 0.15, p);
    if (p < 0.75) return 1;
    return 1 - smoothstep(0.75, 1.0, p);
  }
  function cloudEnv(th) {
    var p = th.age / th.life;
    if (p < 0.32) return smoothstep(0.05, 0.32, p);
    if (p < 0.85) return 1;
    return 1 - smoothstep(0.85, 1.1, p);
  }
  TF.thermalEnv = thermalEnv;
  TF.cloudEnv = cloudEnv;

  P.thermalX = function (th) { return th.xm + this.drift; };

  P.spawnThermal = function (x, age, opts) {
    var r = this.rng;
    opts = opts || {};
    var z = -90 + 320 * (r() + r()) / 2;
    var q = 0.78 + 0.45 * TF.noise1(x / 9000 + 3, this.seed + 70);
    var W = (1.9 + Math.pow(r(), 0.85) * 3.0) * q;
    if (opts.minW) W = Math.max(W, opts.minW);
    var life = 260 + r() * 380;
    var th = {
      id: ++this.thermalId,
      xm: x - this.drift, z: opts.z !== undefined ? opts.z : z,
      R: 85 + r() * 80 + W * 6,
      W: W, age: 0, life: life,
      hasCloud: opts.cloud || r() > 0.18,
      variant: (r() * 1000) | 0,
      birds: r() < 0.3 ? 2 + ((r() * 3) | 0) : 0,
      cbOff: r() * 90 - 45,
      cloudScale: 0.85 + r() * 0.5
    };
    th.age = age !== undefined ? age * life : 0;
    this.thermals.push(th);
    return th;
  };

  P.thermalSiteWeight = function (x, z) {
    var h = this.hC(x);
    var lu = this.landuse(x, z, h);
    var w = 1;
    if (lu === TF.LU.FOREST) w = 0.35;
    else if (lu === TF.LU.VILLAGE) w = 1.6;
    else if (lu === TF.LU.FIELD) w = 1.25;
    var sl = this.slope(x);
    w *= 1 + clamp(-sl * 2.5, -0.5, 0.8); // sonnenzugewandte Hänge (Sonne links)
    return w;
  };

  P.initThermals = function (centerX) {
    this.thermals.length = 0;
    // ein verlässlicher Bart in Reichweite nach dem Ausklinken
    var th = this.spawnThermal(1900 + this.rng() * 700, 0.3, { minW: 2.4, cloud: true, z: 30 + this.rng() * 60 });
    th.R = Math.max(th.R, 130);
    for (var x = centerX - 4000; x < centerX + 9000; x += 950 + this.rng() * 500) {
      if (Math.abs(x - th.xm) < 700) continue;
      if (x > -600 && x < 1300) continue;
      this.spawnThermal(x, this.rng() * 0.85);
    }
  };

  P.update = function (dt, t, centerX) {
    this.time = t;
    this.drift += this.windAt(450, t) * 0.85 * dt;
    var T = this.thermals;
    for (var i = T.length - 1; i >= 0; i--) {
      var th = T[i];
      th.age += dt;
      var tx = th.xm + this.drift;
      if (th.age > th.life * 1.1 || tx < centerX - 7000 || tx > centerX + 13000) T.splice(i, 1);
    }
    var lo = centerX - 3500, hi = centerX + 8000;
    var active = 0;
    for (i = 0; i < T.length; i++) {
      var x = T[i].xm + this.drift;
      if (x > lo && x < hi && T[i].age < T[i].life * 0.8) active++;
    }
    var target = Math.round((hi - lo) / 1050);
    var tries = 0;
    while (active < target && tries < 12) {
      tries++;
      var cx = lo + this.rng() * (hi - lo);
      var cz = -90 + 320 * this.rng();
      // Mindestabstand
      var ok = true;
      for (i = 0; i < T.length; i++) {
        if (Math.abs(T[i].xm + this.drift - cx) < 480) { ok = false; break; }
      }
      if (!ok) continue;
      if (this.rng() * 1.8 > this.thermalSiteWeight(cx, cz)) continue;
      this.spawnThermal(cx, 0, { z: undefined });
      active++;
    }
  };

  // ---------------- Vertikalbewegung der Luft ----------------
  var liftOut = { total: 0, thermal: 0, ridge: 0, sink: 0, turb: 0, wind: 0 };
  P.thermalLiftAt = function (x, y, z, cb) {
    var T = this.thermals, w = 0, turb = 0;
    var g = this.hC(x);
    var agl = y - g;
    var low = smoothstep(-30, 170, agl);
    for (var i = 0; i < T.length; i++) {
      var th = T[i];
      var dx = x - (th.xm + this.drift);
      var R = th.R;
      if (dx > R * 2.6 || dx < -R * 2.6) continue;
      var dz = (z - th.z) * 0.85;
      var r2 = (dx * dx + dz * dz) / (R * R);
      if (r2 > 6.8) continue;
      var env = thermalEnv(th);
      if (env <= 0) continue;
      var top = cb + th.cbOff;
      var prof = low * (1 - smoothstep(top - 260, top - 15, y));
      if (prof <= 0) continue;
      var rr = Math.sqrt(r2);
      var core = Math.exp(-r2 * 1.2);
      var ring = -0.3 * Math.exp(-((rr - 1.5) * (rr - 1.5)) / 0.18);
      w += th.W * env * prof * (core + ring);
      turb += env * prof * th.W * 0.22 * Math.exp(-((rr - 1) * (rr - 1)) / 0.3);
    }
    liftOut.turb = turb;
    return w;
  };

  P.ridgeLiftAt = function (x, y, wind) {
    if (wind > -0.3 && wind < 0.3) return 0;
    var sg = wind > 0 ? 1 : -1;
    var xs = x + sg * 55;
    var g1 = (this.hC(xs + 50) - this.hC(xs - 50)) / 100;
    var g2 = (this.hC(xs + 160) - this.hC(xs - 160)) / 320;
    var grad = 0.4 * g1 + 0.6 * g2;
    var agl = y - this.hC(x);
    var relief = Math.max(35, this.hC(xs) - this.baseH(xs));
    var decay = Math.exp(-Math.max(0, agl) / (0.75 * relief + 70));
    var w = wind * grad * 1.75 * decay;
    if (w < 0) w *= 0.85;
    return w;
  };

  P.airAt = function (x, y, z, t) {
    var cb = this.cloudBase(t);
    var g = this.hC(x);
    var agl = y - g;
    var wind = this.windAt(agl, t);
    var th = this.thermalLiftAt(x, y, z, cb);
    var tturb = liftOut.turb;
    var ridge = this.ridgeLiftAt(x, y, wind);
    var sink = -(0.45 + 0.45 * TF.noise1(x / 2300 + 7, this.seed + 80)) * smoothstep(0, 120, agl);
    liftOut.thermal = th;
    liftOut.ridge = ridge;
    liftOut.sink = sink;
    liftOut.wind = wind;
    liftOut.turb = 0.18 + tturb + (ridge < 0 ? -ridge * 0.55 : ridge * 0.12) + Math.abs(wind) * 0.03;
    liftOut.total = th + ridge + sink;
    liftOut.agl = agl;
    liftOut.ground = g;
    liftOut.cb = cb;
    return liftOut;
  };
})();
