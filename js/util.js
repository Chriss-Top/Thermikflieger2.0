/* Thermikflieger 2.0 – Hilfsfunktionen: Mathe, Zufall, Rauschen, Farben */
var TF = window.TF || {};
window.TF = TF;

(function () {
  'use strict';

  var DEG = Math.PI / 180;
  TF.DEG = DEG;
  TF.G = 9.81;

  TF.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  TF.lerp = function (a, b, t) { return a + (b - a) * t; };
  TF.smoothstep = function (a, b, x) {
    var t = (x - a) / (b - a);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3 - 2 * t);
  };
  TF.approach = function (v, target, rate, dt) {
    return v + (target - v) * Math.min(1, rate * dt);
  };
  TF.sign = function (v) { return v < 0 ? -1 : 1; };
  TF.wrapAngle = function (a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  };

  // ---------- Hashing & Zufall ----------
  function hashInt(x) {
    x = x | 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
  TF.hashInt = hashInt;
  TF.hash2 = function (a, b) {
    return hashInt(Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + 0x9e3779b9);
  };
  TF.hash3 = function (a, b, c) {
    return hashInt(Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177));
  };

  // Seeded RNG (mulberry32)
  TF.RNG = function (seed) {
    var s = seed >>> 0;
    var f = function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = function (a, b) { return a + (b - a) * f(); };
    f.int = function (a, b) { return a + Math.floor(f() * (b - a + 1)); };
    return f;
  };

  // ---------- Value Noise ----------
  TF.noise1 = function (x, seed) {
    var i = Math.floor(x), f = x - i;
    var u = f * f * (3 - 2 * f);
    var a = TF.hash2(i, seed), b = TF.hash2(i + 1, seed);
    return a + (b - a) * u;
  };
  TF.noise2 = function (x, y, seed) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = TF.hash3(ix, iy, seed), b = TF.hash3(ix + 1, iy, seed);
    var c = TF.hash3(ix, iy + 1, seed), d = TF.hash3(ix + 1, iy + 1, seed);
    var ab = a + (b - a) * ux, cd = c + (d - c) * ux;
    return ab + (cd - ab) * uy;
  };
  TF.fbm1 = function (x, seed, oct) {
    var sum = 0, amp = 0.5, norm = 0, f = 1;
    oct = oct || 4;
    for (var i = 0; i < oct; i++) {
      sum += TF.noise1(x * f, seed + i * 31) * amp;
      norm += amp; amp *= 0.5; f *= 2.03;
    }
    return sum / norm;
  };
  TF.fbm2 = function (x, y, seed, oct) {
    var sum = 0, amp = 0.5, norm = 0, f = 1;
    oct = oct || 4;
    for (var i = 0; i < oct; i++) {
      sum += TF.noise2(x * f, y * f, seed + i * 57) * amp;
      norm += amp; amp *= 0.5; f *= 2.01;
    }
    return sum / norm;
  };

  // ---------- Farben ----------
  TF.rgb = function (c, a) {
    if (a === undefined || a >= 1) {
      return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
    }
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';
  };
  TF.mix = function (a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };
  TF.scale = function (c, k) { return [c[0] * k, c[1] * k, c[2] * k]; };

  TF.makeCanvas = function (w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };

  TF.fmtTime = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };
  TF.fmtNum = function (v, digits) {
    var s = v.toFixed(digits || 0);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
  };

  // Persistenz (robust gegen gesperrten Speicher)
  TF.store = {
    get: function (key, def) {
      try {
        var v = window.localStorage.getItem(key);
        return v ? JSON.parse(v) : def;
      } catch (e) { return def; }
    },
    set: function (key, val) {
      try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
    }
  };
})();
