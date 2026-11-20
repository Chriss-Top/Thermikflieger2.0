/* Thermikflieger 2.0 – Flugzeugtypen, 3D-Modelle und Darstellung */
(function () {
  'use strict';
  var DEG = TF.DEG;

  // --------------------------------------------------------------
  // Flugzeugtypen (Geschwindigkeiten in m/s)
  // --------------------------------------------------------------
  TF.AIRCRAFT_ORDER = ['k8', 'ask21', 'ls4', 'ls8'];
  TF.AIRCRAFT = {
    k8: {
      id: 'k8', name: 'K8b', maker: 'Schleicher Ka 8',
      desc: 'Der gutmütige Holzklassiker. Langsam und sehr wendig – kreist eng in schwachen Bärten, gleitet aber schlecht.',
      stats: { glide: 2, agility: 5, docile: 4, speed: 1 },
      vs: 16.0, vtrim: 20.5, vmd: 20.5, E: 25, vne: 52,
      rollRate: 58, rollTau: 0.22, elev: 0.66, stallTime: 2.4, wingDrop: 0.55, selfLevel: 0,
      span: 15.0,
      colors: { base: [238, 224, 182], accent: [198, 52, 40], accent2: [150, 110, 70] },
      fus: { L: 7.0, nose: 3.0, H: 0.46, W: 0.33, cs: 1.2, ce: 2.45, ch: 0.16, tailUp: 0.25, tandem: false },
      wing: { y: 0.42, rootLE: 0.95, rootC: 1.6, tipC: 0.85, tipLEdx: -0.15, dih: 2.5, breaks: [0, 0.55, 0.9, 1], winglet: 0 },
      tail: { T: false, finH: 1.05, stabSpan: 3.0, stabC: 0.7, round: true }
    },
    ask21: {
      id: 'ask21', name: 'ASK 21', maker: 'Schleicher Doppelsitzer',
      desc: 'Der Schulungs-Doppelsitzer. Sehr gutmütig, warnt früh vor dem Abriss und verzeiht Fehler – ideal für den Einstieg.',
      stats: { glide: 3, agility: 3, docile: 5, speed: 2 },
      vs: 17.5, vtrim: 23.5, vmd: 25.0, E: 32, vne: 70,
      rollRate: 44, rollTau: 0.26, elev: 0.6, stallTime: 3.0, wingDrop: 0.25, selfLevel: 0.12,
      span: 17.0,
      colors: { base: [244, 245, 248], accent: [214, 40, 40], accent2: [240, 140, 30] },
      fus: { L: 8.35, nose: 3.4, H: 0.5, W: 0.36, cs: 0.35, ce: 2.75, ch: 0.2, tailUp: 0.25, tandem: true },
      wing: { y: 0.02, rootLE: 0.75, rootC: 1.4, tipC: 0.52, tipLEdx: 0.22, dih: 4, breaks: [0, 0.5, 0.88, 1], winglet: 0 },
      tail: { T: true, finH: 1.3, stabSpan: 3.2, stabC: 0.62, round: false }
    },
    ls4: {
      id: 'ls4', name: 'LS4', maker: 'Rolladen-Schneider',
      desc: 'Das ausgewogene Allround-Flugzeug. Gute Leistung, angenehme Ruder, klare Rückmeldung – für alle Lagen.',
      stats: { glide: 4, agility: 4, docile: 3, speed: 4 },
      vs: 18.5, vtrim: 25.0, vmd: 26.5, E: 38, vne: 75,
      rollRate: 50, rollTau: 0.22, elev: 0.62, stallTime: 1.9, wingDrop: 0.8, selfLevel: 0,
      span: 15.0,
      colors: { base: [246, 247, 250], accent: [36, 92, 178], accent2: [36, 92, 178] },
      fus: { L: 6.7, nose: 2.95, H: 0.42, W: 0.31, cs: 0.95, ce: 2.35, ch: 0.18, tailUp: 0.2, tandem: false },
      wing: { y: 0.05, rootLE: 0.6, rootC: 1.02, tipC: 0.42, tipLEdx: -0.12, dih: 3.5, breaks: [0, 0.55, 0.88, 1], winglet: 0 },
      tail: { T: true, finH: 1.15, stabSpan: 2.7, stabC: 0.55, round: false }
    },
    ls8: {
      id: 'ls8', name: 'LS8-18', maker: 'Hochleistung, 18 m',
      desc: 'Hochleistung mit Winglets: beste Gleitzahl und schnell. Verlangt saubere Fahrt – der Abriss kommt zügig und kippt kräftig.',
      stats: { glide: 5, agility: 3, docile: 2, speed: 5 },
      vs: 19.5, vtrim: 26.5, vmd: 28.0, E: 43, vne: 78,
      rollRate: 40, rollTau: 0.28, elev: 0.7, stallTime: 1.2, wingDrop: 1.15, selfLevel: 0,
      span: 18.0,
      colors: { base: [247, 248, 250], accent: [24, 140, 118], accent2: [60, 66, 74] },
      fus: { L: 6.9, nose: 3.0, H: 0.41, W: 0.3, cs: 0.95, ce: 2.4, ch: 0.18, tailUp: 0.2, tandem: false },
      wing: { y: 0.05, rootLE: 0.58, rootC: 0.98, tipC: 0.36, tipLEdx: -0.1, dih: 3, breaks: [0, 0.5, 0.85, 1], winglet: 0.55 },
      tail: { T: true, finH: 1.2, stabSpan: 2.7, stabC: 0.52, round: false }
    }
  };

  // --------------------------------------------------------------
  // Modellaufbau
  // --------------------------------------------------------------
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  function face(pts, col, hint, opts) {
    var n;
    // Newell-Normal (robust für beliebige Polygone)
    var nx = 0, ny = 0, nz = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    n = norm([nx, ny, nz]);
    if (hint && dot(n, hint) < 0) n = [-n[0], -n[1], -n[2]];
    var c = [0, 0, 0];
    for (var j = 0; j < pts.length; j++) { c[0] += pts[j][0]; c[1] += pts[j][1]; c[2] += pts[j][2]; }
    c = [c[0] / pts.length, c[1] / pts.length, c[2] / pts.length];
    opts = opts || {};
    return { pts: pts, col: col, n: n, c: c, two: !!opts.two, glass: !!opts.glass, gloss: opts.gloss === undefined ? 1 : opts.gloss };
  }

  function buildModel(type) {
    var A = TF.AIRCRAFT[type];
    var F = A.fus, W = A.wing, T = A.tail, C = A.colors;
    var faces = [];
    var base = C.base, acc = C.accent, acc2 = C.accent2;
    var glassCol = [38, 52, 72];

    // ---- Rumpf ----
    var ts = [0, 0.025, 0.07, 0.13, 0.2, 0.27, 0.34, 0.42, 0.52, 0.64, 0.76, 0.88, 0.96, 1.0];
    var N = 10;
    var tailX = F.nose - F.L;
    var stations = [];
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i];
      var x = F.nose - t * F.L;
      var r;
      if (t < 0.28) r = Math.pow(Math.sin((t / 0.28) * Math.PI / 2), 0.62);
      else r = 1 - 0.84 * Math.pow(TF.smoothstep(0.28, 1.0, t), 0.75);
      if (t >= 1) r = 0.02;
      r = Math.max(r, 0.02);
      var hw = F.W * r, hl = F.H * r, hu = F.H * r * 0.92;
      var bulge = 0;
      if (x > F.cs && x < F.ce) {
        var ct = (x - F.cs) / (F.ce - F.cs);
        bulge = F.ch * Math.pow(Math.sin(Math.PI * ct), 0.55);
        if (F.tandem) bulge *= 0.85 + 0.15 * Math.abs(Math.sin(Math.PI * ct * 2));
      }
      var yc = F.tailUp * Math.pow(t, 2.2) - 0.04 * (1 - t);
      stations.push({ x: x, yc: yc, hw: hw, hl: hl, hu: hu + bulge, t: t });
    }
    function ringPt(s, k) {
      var a = (k / N) * Math.PI * 2;
      var sn = Math.sin(a), cs = Math.cos(a);
      return [s.x, s.yc + (sn >= 0 ? s.hu : s.hl) * sn, s.hw * cs];
    }
    for (i = 0; i < stations.length - 1; i++) {
      var s0 = stations[i], s1 = stations[i + 1];
      for (var k = 0; k < N; k++) {
        var p0 = ringPt(s0, k), p1 = ringPt(s0, k + 1), p2 = ringPt(s1, k + 1), p3 = ringPt(s1, k);
        var am = ((k + 0.5) / N) * Math.PI * 2;
        var hint = [0, Math.sin(am), Math.cos(am)];
        var xm = (s0.x + s1.x) / 2;
        var col = base, glass = false;
        var up = Math.sin(am);
        if (up > 0.2 && xm > F.cs + 0.05 && xm < F.ce - 0.05) { col = glassCol; glass = true; }
        else if (s0.t < 0.07) col = acc;
        else if (type === 'k8' && s0.t > 0.55 && s0.t < 0.64) col = acc;
        else if (type === 'ls8' && s0.t > 0.42 && s0.t < 0.52 && up < 0.3 && up > -0.6) col = acc;
        else if (type === 'ask21' && s0.t > 0.07 && s0.t < 0.13 && up < 0.2) col = acc;
        var pts = [p0, p1, p2, p3];
        if (s1.t >= 1) pts = [p0, p1, p2];
        faces.push(face(pts, col, hint, { glass: glass, gloss: glass ? 2.2 : 1 }));
      }
    }

    // ---- Tragflügel ----
    var half = A.span / 2;
    var dih = W.dih * DEG;
    var thick = 0.07;
    function chordAt(f) { return W.rootC + (W.tipC - W.rootC) * Math.pow(f, 1.15); }
    function leAt(f) { return W.rootLE + W.tipLEdx * f + (W.rootC - chordAt(f)) * 0.25; }
    function wingPt(f, te, side, top) {
      var z = side * (F.W * 0.5 + f * (half - F.W * 0.5));
      var x = leAt(f) - (te ? chordAt(f) : 0);
      var y = W.y + Math.abs(z) * Math.tan(dih) + (top ? thick : -thick) * (1 - 0.6 * f) * (te ? 0.3 : 1);
      return [x, y, z];
    }
    for (var side = -1; side <= 1; side += 2) {
      for (var b = 0; b < W.breaks.length - 1; b++) {
        var f0 = W.breaks[b], f1 = W.breaks[b + 1];
        var wcol = (b === W.breaks.length - 2) ? acc : base;
        if (type === 'k8' && b === W.breaks.length - 2) wcol = acc;
        // Oberseite
        faces.push(face([wingPt(f0, false, side, true), wingPt(f1, false, side, true), wingPt(f1, true, side, true), wingPt(f0, true, side, true)], wcol, [0, 1, 0]));
        // Unterseite (leicht graublau)
        var ucol = (wcol === base) ? TF.mix(base, [200, 210, 225], 0.25) : wcol;
        faces.push(face([wingPt(f0, false, side, false), wingPt(f1, false, side, false), wingPt(f1, true, side, false), wingPt(f0, true, side, false)], ucol, [0, -1, 0]));
        // Nasenkante
        faces.push(face([wingPt(f0, false, side, true), wingPt(f1, false, side, true), wingPt(f1, false, side, false), wingPt(f0, false, side, false)], wcol, [1, 0, 0]));
      }
      // Randbogen / Winglet
      if (W.winglet > 0) {
        var le = wingPt(1, false, side, true), te = wingPt(1, true, side, true);
        var wh = W.winglet;
        var lean = side * 0.12;
        var wl = [le, [le[0] - 0.12, le[1] + wh, le[2] + lean], [te[0] + 0.02, te[1] + wh, te[2] + lean], te];
        faces.push(face(wl, acc, [0, 0, side], { two: true }));
      }
    }

    // ---- Leitwerk ----
    var tailTopY = stations[stations.length - 2].yc;
    var finRootFront = tailX + 1.05, finRootBack = tailX + 0.02;
    var finTop = tailTopY + T.finH;
    var finPts;
    if (T.round) {
      finPts = [[finRootFront, tailTopY + 0.05, 0], [finRootBack, tailTopY, 0], [tailX - 0.05, tailTopY + T.finH * 0.55, 0],
        [tailX + 0.1, finTop, 0], [tailX + 0.45, finTop + 0.02, 0], [tailX + 0.75, finTop - 0.25, 0]];
    } else {
      finPts = [[finRootFront, tailTopY + 0.05, 0], [finRootBack, tailTopY, 0], [tailX + 0.06, finTop, 0], [tailX + 0.62, finTop, 0]];
    }
    faces.push(face(finPts, base, [0, 0, 1], { two: true }));
    // Seitenruder-Akzent
    if (type !== 'k8') {
      faces.push(face([[tailX + 0.26, finTop - T.finH * 0.35, 0.005], [tailX + 0.05, finTop - T.finH * 0.35, 0.005], [tailX + 0.06, finTop - 0.01, 0.005], [tailX + 0.3, finTop - 0.01, 0.005]], acc, [0, 0, 1], { two: true }));
    } else {
      faces.push(face([[tailX + 0.35, tailTopY + 0.1, 0.005], [tailX - 0.02, tailTopY + 0.1, 0.005], [tailX + 0.1, finTop - 0.02, 0.005], [tailX + 0.42, finTop - 0.02, 0.005]], acc, [0, 0, 1], { two: true }));
    }
    var stabY = T.T ? finTop + 0.02 : tailTopY + 0.08;
    var stabX = T.T ? tailX + 0.62 : tailX + 0.75;
    var sh = T.stabSpan / 2, sc = T.stabC;
    for (side = -1; side <= 1; side += 2) {
      var sp = [[stabX, stabY, side * 0.05], [stabX - 0.1, stabY, side * sh], [stabX - 0.1 - sc * 0.7, stabY, side * sh], [stabX - sc, stabY, side * 0.05]];
      faces.push(face(sp.map(function (p) { return [p[0], p[1] + 0.025, p[2]]; }), base, [0, 1, 0]));
      faces.push(face(sp.map(function (p) { return [p[0], p[1] - 0.025, p[2]]; }), TF.mix(base, [200, 210, 225], 0.25), [0, -1, 0]));
    }

    // ---- Rad ----
    var wheel = [];
    var wy = -F.H * 0.98 - 0.08, wx = 0.3;
    for (var q = 0; q < 8; q++) {
      var aa = q / 8 * Math.PI * 2;
      wheel.push([wx + Math.cos(aa) * 0.19, wy + Math.sin(aa) * 0.19, 0]);
    }
    faces.push(face(wheel, [40, 40, 44], [0, 0, 1], { two: true, gloss: 0.2 }));

    // Bremsklappen (Position merken)
    var brakeSpots = [];
    for (side = -1; side <= 1; side += 2) {
      var fa = 0.22, fb = 0.42;
      var pa = wingPt(fa, false, side, true), pb = wingPt(fb, false, side, true);
      var ca = chordAt(fa), cb = chordAt(fb);
      brakeSpots.push({ a: [pa[0] - ca * 0.52, pa[1], pa[2]], b: [pb[0] - cb * 0.52, pb[1], pb[2]] });
    }

    return { type: type, faces: faces, brakeSpots: brakeSpots, bottom: -F.H - 0.27, span: A.span };
  }

  var modelCache = {};
  TF.getModel = function (type) {
    if (!modelCache[type]) modelCache[type] = buildModel(type);
    return modelCache[type];
  };

  // --------------------------------------------------------------
  // Darstellung
  // --------------------------------------------------------------
  // Lichtrichtung (zur Sonne hin): oben links, leicht vorn
  var LIGHT = norm([-0.45, 0.78, -0.42]);
  var faceBuf = [];

  /**
   * pose: {x,y,z,psi,theta,phi,E,brake,alpha}
   * cam:  {project(x,y,z,out)->bool, pos:[x,y,z]}
   */
  TF.drawAircraft = function (ctx, model, pose, cam) {
    var cps = Math.cos(pose.psi), sps = Math.sin(pose.psi);
    var cth = Math.cos(pose.theta), sth = Math.sin(pose.theta);
    var cph = Math.cos(pose.phi), sph = Math.sin(pose.phi);
    var f = [cth * cps, sth, cth * sps];
    var r0 = [-sps, 0, cps];
    var u0 = [-sth * cps, cth, -sth * sps];
    var r = [r0[0] * cph - u0[0] * sph, r0[1] * cph - u0[1] * sph, r0[2] * cph - u0[2] * sph];
    var u = [u0[0] * cph + r0[0] * sph, u0[1] * cph + r0[1] * sph, u0[2] * cph + r0[2] * sph];
    var E = pose.E;
    var px = pose.x, py = pose.y, pz = pose.z;
    var cp = cam.pos;
    var tmp = [0, 0, 0];

    function toWorld(b, out) {
      out[0] = px + E * (b[0] * f[0] + b[1] * u[0] + b[2] * r[0]);
      out[1] = py + E * (b[0] * f[1] + b[1] * u[1] + b[2] * r[1]);
      out[2] = pz + E * (b[0] * f[2] + b[1] * u[2] + b[2] * r[2]);
      return out;
    }

    var list = model.faces;
    if (pose.brake > 0.03) list = list.concat(brakeFaces(model, pose.brake));
    var count = 0;
    var wp = [0, 0, 0];
    for (var i = 0; i < list.length; i++) {
      var F = list[i];
      var n = F.n;
      var nw = [n[0] * f[0] + n[1] * u[0] + n[2] * r[0], n[0] * f[1] + n[1] * u[1] + n[2] * r[1], n[0] * f[2] + n[1] * u[2] + n[2] * r[2]];
      toWorld(F.c, wp);
      var vx = wp[0] - cp[0], vy = wp[1] - cp[1], vz = wp[2] - cp[2];
      var vd = nw[0] * vx + nw[1] * vy + nw[2] * vz;
      if (vd > 0) {
        if (!F.two) continue;
        nw = [-nw[0], -nw[1], -nw[2]];
      }
      var pts = F.pts;
      var scr = [];
      var ok = true;
      for (var j = 0; j < pts.length; j++) {
        toWorld(pts[j], tmp);
        var s = cam.project(tmp[0], tmp[1], tmp[2]);
        if (!s) { ok = false; break; }
        scr.push(s[0], s[1]);
      }
      if (!ok) continue;
      // Beleuchtung
      var lam = nw[0] * LIGHT[0] + nw[1] * LIGHT[1] + nw[2] * LIGHT[2];
      var vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      var hx = LIGHT[0] - vx / vl, hy = LIGHT[1] - vy / vl, hz = LIGHT[2] - vz / vl;
      var hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
      var spec = Math.max(0, (nw[0] * hx + nw[1] * hy + nw[2] * hz) / hl);
      spec = Math.pow(spec, F.glass ? 40 : 18) * 0.42 * F.gloss;
      var amb = 0.5 + 0.12 * nw[1];
      var k = amb + 0.55 * Math.max(0, lam);
      var c = F.col;
      var col = [Math.min(255, c[0] * k + 255 * spec), Math.min(255, c[1] * k + 255 * spec), Math.min(255, c[2] * k + 255 * spec)];
      faceBuf[count++] = { scr: scr, col: col, d: vl };
    }
    faceBuf.length = count;
    faceBuf.sort(function (a, b) { return b.d - a.d; });
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.7;
    for (i = 0; i < count; i++) {
      var fb = faceBuf[i];
      var sc = fb.scr;
      ctx.beginPath();
      ctx.moveTo(sc[0], sc[1]);
      for (j = 2; j < sc.length; j += 2) ctx.lineTo(sc[j], sc[j + 1]);
      ctx.closePath();
      var cs = TF.rgb(fb.col);
      ctx.fillStyle = cs;
      ctx.strokeStyle = cs;
      ctx.fill();
      ctx.stroke();
    }
  };

  function brakeFaces(model, b) {
    var out = [];
    var h = 0.22 * b;
    for (var i = 0; i < model.brakeSpots.length; i++) {
      var s = model.brakeSpots[i];
      var pts = [s.a, s.b, [s.b[0], s.b[1] + h, s.b[2]], [s.a[0], s.a[1] + h, s.a[2]]];
      var c = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2 + h / 2, (s.a[2] + s.b[2]) / 2];
      out.push({ pts: pts, col: [225, 228, 232], n: [1, 0, 0], c: c, two: true, glass: false, gloss: 0.6 });
    }
    return out;
  }

  // Vorschau für die Auswahlkarten (eigene kleine Perspektivkamera)
  TF.drawAircraftPreview = function (ctx, type, w, h, time) {
    var model = TF.getModel(type);
    var D = 40;
    var span = model.span;
    var s = (w * 0.86) / span;
    var F = s * D;
    var camPos = [0, 7, -D];
    var horizon = h * 0.55 - (camPos[1] - 1.2) * s;
    var cam = {
      pos: camPos,
      project: function (x, y, z) {
        var d = z - camPos[2];
        if (d < 1) return null;
        var k = F / d;
        return [w / 2 + x * k, horizon + (camPos[1] - y) * k];
      }
    };
    var psi = -0.5 + Math.sin(time * 0.6) * 0.55;
    var phi = Math.sin(time * 0.8) * 0.35 + 0.15;
    TF.drawAircraft(ctx, model, { x: 0, y: 1.2, z: 0, psi: psi, theta: 0.04, phi: phi, E: 1, brake: 0 }, cam);
  };
})();
