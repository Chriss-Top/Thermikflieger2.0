/* Thermikflieger 2.0 – vorgerenderte Grafiken: Wolken, Bäume, Häuser */
(function () {
  'use strict';

  TF.Sprites = {
    clouds: [], farClouds: [], trees: [], pines: [], houses: [], church: null, ready: false
  };
  var S = TF.Sprites;

  function makeCloud(seed, w, h, flat) {
    var rng = TF.RNG(seed);
    var c = TF.makeCanvas(w, h);
    var g = c.getContext('2d');
    var baseY = h * 0.84;
    var puffs = [];
    var n = 7 + ((rng() * 5) | 0);
    var i;
    for (i = 0; i < n; i++) {
      var t = (i + 0.5) / n;
      var px = w * (0.12 + 0.76 * t + (rng() - 0.5) * 0.06);
      var mid = 1 - Math.abs(t - 0.5) * 2;
      var r = w * (0.07 + 0.06 * rng() + 0.05 * mid);
      puffs.push({ x: px, y: baseY - r * 0.55, r: r });
    }
    var tow = flat ? 2 : 4 + ((rng() * 4) | 0);
    for (i = 0; i < tow; i++) {
      var tt = 0.25 + 0.5 * rng();
      var rr = w * (0.08 + 0.07 * rng()) * (flat ? 0.8 : 1);
      var lift = (flat ? 0.15 : 0.35 + 0.45 * rng()) * (1 - Math.abs(tt - 0.5) * 1.6);
      puffs.push({ x: w * tt, y: baseY - rr * 0.6 - h * lift, r: rr });
    }
    puffs.sort(function (a, b) { return a.y - b.y; });
    g.save();
    g.beginPath();
    g.rect(0, 0, w, baseY);
    g.clip();
    // Schattenkörper
    for (i = 0; i < puffs.length; i++) {
      var p = puffs[i];
      g.fillStyle = 'rgb(176,188,210)';
      g.beginPath();
      g.arc(p.x + p.r * 0.1, p.y + p.r * 0.14, p.r, 0, Math.PI * 2);
      g.fill();
    }
    // helle Kuppen
    for (i = 0; i < puffs.length; i++) {
      p = puffs[i];
      var gr = g.createRadialGradient(p.x - p.r * 0.38, p.y - p.r * 0.45, p.r * 0.1, p.x, p.y, p.r * 1.02);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.55, 'rgba(250,252,255,0.96)');
      gr.addColorStop(1, 'rgba(214,224,238,0.0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(p.x, p.y, p.r * 0.98, 0, Math.PI * 2);
      g.fill();
    }
    // Wolkenbasis abdunkeln
    g.globalCompositeOperation = 'source-atop';
    var lg = g.createLinearGradient(0, baseY - h * 0.32, 0, baseY);
    lg.addColorStop(0, 'rgba(120,135,165,0)');
    lg.addColorStop(1, 'rgba(120,135,165,0.55)');
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    g.restore();
    // weiche Basiskante
    var bl = g.createLinearGradient(0, baseY - 3, 0, baseY + 4);
    g.globalCompositeOperation = 'destination-out';
    bl.addColorStop(0, 'rgba(0,0,0,0)');
    bl.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = bl;
    g.fillRect(0, baseY - 3, w, 10);
    g.globalCompositeOperation = 'source-over';
    return { canvas: c, w: w, h: h, baseFrac: baseY / h };
  }

  function makeTree(seed, conifer) {
    var rng = TF.RNG(seed);
    var w = 48, h = 72;
    var c = TF.makeCanvas(w, h);
    var g = c.getContext('2d');
    var cx = w / 2;
    g.fillStyle = '#5a4030';
    g.fillRect(cx - 2, h - 16, 4, 16);
    if (conifer) {
      var layers = 4;
      for (var i = 0; i < layers; i++) {
        var t = i / layers;
        var y0 = h - 10 - t * (h - 16);
        var hw = (1 - t) * 18 + 4;
        g.fillStyle = i % 2 ? '#2f5c3a' : '#346643';
        g.beginPath();
        g.moveTo(cx - hw, y0);
        g.lineTo(cx + hw, y0);
        g.lineTo(cx, y0 - 26);
        g.closePath();
        g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.beginPath(); g.moveTo(cx, 4); g.lineTo(cx - 12, h - 18); g.lineTo(cx - 4, h - 18); g.closePath(); g.fill();
    } else {
      var base = [[64, 112, 52], [74, 124, 56], [58, 102, 50], [86, 130, 60]][(rng() * 4) | 0];
      var blobs = 6;
      for (var b = 0; b < blobs; b++) {
        var bx = cx + (rng() - 0.5) * 20;
        var by = h - 34 - rng() * 22;
        var br = 9 + rng() * 7;
        var gr = g.createRadialGradient(bx - br * 0.4, by - br * 0.5, 1, bx, by, br);
        gr.addColorStop(0, TF.rgb(TF.scale(base, 1.35)));
        gr.addColorStop(1, TF.rgb(TF.scale(base, 0.75)));
        g.fillStyle = gr;
        g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
      }
    }
    return { canvas: c, w: w, h: h };
  }

  function makeHouse(seed) {
    var rng = TF.RNG(seed);
    var w = 64, h = 52;
    var c = TF.makeCanvas(w, h);
    var g = c.getContext('2d');
    var bw = 34 + rng() * 14, bh = 16 + rng() * 6;
    var x0 = (w - bw) / 2, y0 = h - bh;
    var wall = ['#f3eee2', '#efe5cf', '#f6f2ea', '#e8dcc4'][(rng() * 4) | 0];
    var roof = ['#b8452f', '#a63c2c', '#8e4a34', '#c55a3a', '#5d5450'][(rng() * 5) | 0];
    g.fillStyle = wall;
    g.fillRect(x0, y0, bw, bh);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(x0 + bw * 0.62, y0, bw * 0.38, bh);
    // Dach
    var rh = 14 + rng() * 8;
    g.fillStyle = roof;
    g.beginPath();
    g.moveTo(x0 - 3, y0 + 1);
    g.lineTo(x0 + bw * 0.35, y0 - rh);
    g.lineTo(x0 + bw * 0.65, y0 - rh);
    g.lineTo(x0 + bw + 3, y0 + 1);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.beginPath();
    g.moveTo(x0 - 3, y0 + 1); g.lineTo(x0 + bw * 0.35, y0 - rh); g.lineTo(x0 + bw * 0.5, y0 - rh); g.lineTo(x0 + bw * 0.3, y0 + 1);
    g.closePath(); g.fill();
    // Fenster
    g.fillStyle = '#4a5866';
    var nw = 2 + ((rng() * 2) | 0);
    for (var i = 0; i < nw; i++) {
      g.fillRect(x0 + 5 + i * (bw - 12) / Math.max(1, nw - 1) - 2, y0 + 5, 4, 5);
    }
    // Schornstein
    g.fillStyle = '#7a4a3a';
    g.fillRect(x0 + bw * 0.62, y0 - rh * 0.9, 4, 8);
    return { canvas: c, w: w, h: h, chimneyX: (x0 + bw * 0.62 + 2) / w, chimneyY: (h - (y0 - rh * 0.9)) / h };
  }

  function makeChurch() {
    var w = 64, h = 96;
    var c = TF.makeCanvas(w, h);
    var g = c.getContext('2d');
    g.fillStyle = '#f2ede2';
    g.fillRect(22, h - 26, 38, 26);
    g.fillStyle = '#a8402c';
    g.beginPath(); g.moveTo(20, h - 25); g.lineTo(41, h - 42); g.lineTo(62, h - 25); g.closePath(); g.fill();
    g.fillStyle = '#ece6d8';
    g.fillRect(8, h - 62, 16, 62);
    g.fillStyle = 'rgba(0,0,0,0.1)';
    g.fillRect(17, h - 62, 7, 62);
    g.fillStyle = '#3f5d50';
    g.beginPath(); g.moveTo(6, h - 61); g.lineTo(16, h - 92); g.lineTo(26, h - 61); g.closePath(); g.fill();
    g.fillStyle = '#4a5866';
    g.fillRect(13, h - 52, 6, 8);
    g.fillStyle = '#e7c35a';
    g.beginPath(); g.arc(16, h - 36, 3, 0, Math.PI * 2); g.fill();
    return { canvas: c, w: w, h: h };
  }

  S.init = function () {
    if (S.ready) return;
    var i;
    for (i = 0; i < 10; i++) S.clouds.push(makeCloud(1000 + i * 77, 420, 280, false));
    for (i = 0; i < 6; i++) S.farClouds.push(makeCloud(5000 + i * 31, 420, 200, true));
    for (i = 0; i < 4; i++) S.trees.push(makeTree(200 + i, false));
    for (i = 0; i < 2; i++) S.pines.push(makeTree(300 + i, true));
    for (i = 0; i < 5; i++) S.houses.push(makeHouse(400 + i * 13));
    S.church = makeChurch();
    S.ready = true;
  };
})();
