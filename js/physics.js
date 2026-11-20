/* Thermikflieger 2.0 – Flugphysik: Energiemodell, Strömungsabriss, Windenstart, Bodenrollen */
(function () {
  'use strict';
  var DEG = TF.DEG, G = TF.G, clamp = TF.clamp, smoothstep = TF.smoothstep;

  TF.GEAR_H = 1.0; // Schwerpunkt über Grund beim Rollen

  TF.Glider = function (typeId) {
    this.type = typeId;
    this.A = TF.AIRCRAFT[typeId];
    var A = this.A;
    this.C1 = 1 / (2 * A.E * A.vmd * A.vmd);
    this.C2 = (A.vmd * A.vmd) / (2 * A.E);
    this.cTrim = (A.vs / A.vtrim) * (A.vs / A.vtrim);
    this.events = [];
    this.reset();
  };

  var P = TF.Glider.prototype;

  P.reset = function () {
    this.mode = 'launch';
    this.x = 0; this.y = 0; this.z = 0;
    this.V = 0; this.gamma = 0; this.psi = 0; this.phi = 0; this.p = 0;
    this.theta = 0; this.c = this.cTrim; this.cCmd = this.cTrim; this.e = 0; this.brake = 0;
    this.n = 1; this.gammaDot = 0;
    this.stallT = 0; this.stalled = false; this.recT = 0; this.stallDur = 0;
    this.warn = 0; this.buffet = 0; this.overspeed = 0;
    this.te = 0; this.vy = 0; this.vx = 0; this.vz = 0;
    this.air = null; this.wind = 0;
    this.vsEff = this.A.vs;
    this.groundSpeed = 0;
    this.launch = null;
    this.thermalCue = 0;
  };

  // ------------------------------------------------------------
  // Windenstart
  // ------------------------------------------------------------
  P.startLaunch = function (world, af) {
    this.reset();
    this.x = af.x0 + 360;
    this.z = 0;
    this.y = world.hC(this.x) + TF.GEAR_H;
    this.mode = 'launch';
    this.launch = {
      phase: 'ready', t: 0, tc: 0, winchX: af.x1 - 70, winchY: world.hC(af.x1 - 70),
      band: 0, quality: 0, qT: 0, totalT: 0, slowT: 0, released: false, reason: '', elev: 0,
      gustP: 0, gustR: 0
    };
  };

  P.stepLaunch = function (dt, inp, world, t) {
    var L = this.launch, A = this.A;
    var g = world.hC(this.x);
    var agl = this.y - g;
    var wind = world.windAt(agl, t);
    this.wind = wind;
    L.t += dt;
    this.e = TF.approach(this.e, inp.pitch, inp.pitch !== 0 ? 3 : 5, dt);

    if (L.phase === 'ready') {
      this.V = 0;
      if (L.t > 1.6) { L.phase = 'roll'; this.events.push('roll'); }
      this.theta = 0;
      return;
    }
    if (L.phase === 'roll') {
      this.V += 7.2 * dt;
      var gs = Math.max(0, this.V + wind);
      this.x += gs * dt;
      this.y = g + TF.GEAR_H;
      this.groundSpeed = gs;
      this.theta = TF.approach(this.theta, this.V > A.vs * 0.9 ? 4 * DEG : 0, 3, dt);
      this.phi = TF.approach(this.phi, 0, 3, dt);
      if (this.V > A.vs * 1.12) { L.phase = 'climb'; L.tc = 0; this.events.push('liftoff'); }
      this.vy = 0;
      return;
    }
    // ---- Steigflug am Seil ----
    L.tc += dt;
    var elev = Math.atan2(this.y - L.winchY, Math.max(1, L.winchX - this.x));
    L.elev = elev;
    var endFade = smoothstep(38 * DEG, 58 * DEG, elev);
    var bc = (8 + 32 * smoothstep(0.3, 5.5, L.tc)) * DEG;
    bc = bc - endFade * 16 * DEG;
    L.band = bc;
    var bw = 7 * DEG;
    // Böen
    L.gustP += ((TF.noise1(t * 0.8, 301) - 0.5) * 2 * 9 * DEG - L.gustP) * Math.min(1, dt * 2);
    L.gustR += ((TF.noise1(t * 0.7, 302) - 0.5) * 2 * 14 * DEG - L.gustR) * Math.min(1, dt * 2);
    // Nicklage: Spieler steuert, Seilzug drückt sanft Richtung "etwas zu flach"
    var autoT = bc - 11 * DEG;
    var thetaRate = this.e * 30 * DEG + (autoT - this.theta) * 0.35 + L.gustP * 0.35;
    this.theta += thetaRate * dt;
    this.theta = clamp(this.theta, -5 * DEG, 70 * DEG);
    // Querlage
    var pT = inp.roll * A.rollRate * DEG * 0.8;
    this.p += (pT - this.p) * Math.min(1, dt / A.rollTau);
    this.p += L.gustR * 0.6 * dt;
    this.phi += this.p * dt - this.phi * 0.05 * dt;
    this.phi = clamp(this.phi, -40 * DEG, 40 * DEG);
    // Fahrt
    var tooSteep = Math.max(0, this.theta - (bc + bw));
    var Vt = 32 - tooSteep / DEG * 0.75 - Math.abs(this.phi) / DEG * 0.08;
    this.V += (Vt - this.V) * Math.min(1, dt * 0.9);
    this.gamma = this.theta - 5 * DEG;
    var f = clamp(1 - Math.pow(elev / (70 * DEG), 2), 0.08, 1);
    var inBand = Math.abs(this.theta - bc) < bw && Math.abs(this.phi) < 12 * DEG;
    L.totalT += dt;
    if (inBand) L.qT += dt;
    L.quality = L.totalT > 0 ? L.qT / L.totalT : 0;
    var eff = 0.72 + 0.28 * (inBand ? 1 : clamp(1 - (Math.abs(this.theta - bc) - bw) / (15 * DEG), 0, 1));
    var vy = 0.62 * this.V * Math.sin(Math.max(0, this.gamma)) * f * eff * Math.cos(this.phi);
    var vx = Math.max(5, this.V * Math.cos(this.gamma) * (0.7 + 0.3 * f) + wind * 0.2);
    this.x += vx * dt;
    this.y += vy * dt;
    this.vy = vy; this.vx = vx;
    this.groundSpeed = vx;
    this.c = this.cTrim;
    // Warnung bei zu wenig Fahrt -> Sollbruchstelle
    this.warn = smoothstep(A.vs * 1.3, A.vs * 1.08, this.V);
    this.buffet = this.warn;
    if (this.V < A.vs * 1.12) L.slowT += dt; else L.slowT = Math.max(0, L.slowT - dt);
    if (L.slowT > 2.6) { this.release(world, 'weaklink'); return; }
    if (inp.release && L.tc > 1.5) { this.release(world, 'manual'); return; }
    if (elev > 58 * DEG || this.x > L.winchX - 45) this.release(world, 'auto');
  };

  P.release = function (world, reason) {
    var L = this.launch;
    L.released = true;
    L.reason = reason;
    L.releaseY = this.y;
    L.releaseX = this.x;
    this.mode = 'air';
    this.gamma = clamp(this.theta * 0.25 - 2 * DEG, -4 * DEG, 8 * DEG);
    this.V = Math.max(this.V, this.A.vs * 1.4);
    this.c = this.cTrim;
    this.e = 0;
    this.stallT = 0;
    this.events.push('release:' + reason);
  };

  // ------------------------------------------------------------
  // Freier Flug
  // ------------------------------------------------------------
  P.stepAir = function (dt, inp, world, t) {
    var A = this.A;
    var air = world.airAt(this.x, this.y, this.z, t);
    this.air = air;
    var wind = air.wind;
    this.wind = wind;

    // Steuer
    this.e = TF.approach(this.e, inp.pitch, inp.pitch !== 0 ? 2.6 : 4.5, dt);
    this.brake = TF.approach(this.brake, inp.brake ? 1 : 0, 2.2, dt);

    // Rollen
    var auth = this.stalled ? 0.22 : 1;
    var pmax = A.rollRate * DEG * (0.55 + 0.45 * clamp(this.V / A.vtrim, 0.4, 1.25));
    var pT = inp.roll * pmax * auth;
    if (inp.roll === 0 && A.selfLevel && Math.abs(this.phi) < 25 * DEG) pT -= this.phi * A.selfLevel * 2;
    this.p += (pT - this.p) * Math.min(1, dt / A.rollTau);
    // Thermik hebt den Flügel im stärkeren Aufwind
    var sx = -Math.sin(this.psi), sz = Math.cos(this.psi), off = 22;
    var wR = world.thermalLiftAt(this.x + sx * off, this.y, this.z + sz * off, air.cb);
    var wL = world.thermalLiftAt(this.x - sx * off, this.y, this.z - sz * off, air.cb);
    this.thermalCue = wL - wR;
    this.p += (wL - wR) * 0.3 * dt;
    // Turbulenz
    this.p += (TF.noise1(t * 2.3, 77) - 0.5) * 2 * air.turb * 1.1 * dt;
    this.phi += this.p * dt;
    var maxPhi = 68 * DEG;
    if (this.phi > maxPhi) { this.phi = maxPhi; this.p = Math.min(this.p, 0); }
    if (this.phi < -maxPhi) { this.phi = -maxPhi; this.p = Math.max(this.p, 0); }

    // Auftrieb
    var vs = A.vs * (1 + 0.05 * this.brake);
    var cphi = Math.max(0.35, Math.cos(this.phi));
    var bankComp = 1 + 0.8 * (1 / cphi - 1);
    var cBase = Math.min(this.cTrim * bankComp, Math.max(this.cTrim, 0.84));
    var cCmd = this.e >= 0 ? cBase + this.e * A.elev : cBase + this.e * (cBase + 0.35);
    cCmd -= (0.4 * this.gammaDot + 0.8 * (this.gamma + 0.035)) * (1 - 0.5 * Math.max(0, this.e));
    var q = (this.V / vs) * (this.V / vs);
    cCmd = Math.min(cCmd, 3.2 / q, 1.06);
    this.cCmd = cCmd;
    var cT = cCmd;
    if (this.stalled) cT = Math.min(cCmd, 0.4 + 0.1 * Math.sin(t * 17) + 0.05 * Math.sin(t * 29));
    this.c += (cT - this.c) * Math.min(1, dt * 6);
    var n = q * this.c;
    this.n = n;

    // Abrisslogik
    this.vsEff = vs * Math.sqrt(Math.max(0.3, Math.cos(this.gamma) / cphi));
    this.warn = this.stalled ? 1 : smoothstep(0.84, 0.955, this.c);
    if (!this.stalled) {
      if (this.c > 0.955 && cCmd > 0.955) this.stallT += dt;
      else this.stallT = Math.max(0, this.stallT - dt * 1.3);
      if (this.stallT > A.stallTime) this.enterStall();
      this.buffet = smoothstep(0.88, 1.0, this.c) * 0.8 + (this.stallT / A.stallTime) * 0.4;
    } else {
      this.stallDur += dt;
      this.buffet = 1;
      var ok = cCmd < 0.75 && this.V > vs * 1.12 && this.stallDur > 0.8;
      this.recT = ok ? this.recT + dt : Math.max(0, this.recT - dt);
      if (this.recT > 0.35) {
        this.stalled = false; this.stallT = 0; this.recT = 0;
        this.events.push('recovered');
      }
    }

    // Widerstand
    var V = this.V;
    var DW = this.C1 * V * V + this.C2 * n * n / (V * V) + this.brake * 1.35e-4 * V * V +
      (this.stalled ? 0.07 : 0) + Math.max(0, this.c - 0.92) * 0.25;
    if (V > A.vne) DW += (V - A.vne) * 0.004;
    var Vdot = -G * Math.sin(this.gamma) - G * DW;
    var gammaDot = (G / V) * (n * Math.cos(this.phi) - Math.cos(this.gamma));
    var psiDot = G * n * Math.sin(this.phi) / (V * Math.max(0.2, Math.cos(this.gamma)));
    this.gammaDot = gammaDot;
    this.V = Math.max(7, V + Vdot * dt);
    this.gamma = clamp(this.gamma + gammaDot * dt, -85 * DEG, 80 * DEG);
    this.psi = TF.wrapAngle(this.psi + psiDot * dt);
    this.overspeed = smoothstep(A.vne * 0.97, A.vne * 1.1, this.V);

    // Kinematik
    var turbW = (TF.noise1(t * 1.7, 91) - 0.5) * 2 * air.turb;
    var cg = Math.cos(this.gamma);
    this.vx = this.V * cg * Math.cos(this.psi) + wind;
    this.vz = this.V * cg * Math.sin(this.psi);
    this.vy = this.V * Math.sin(this.gamma) + air.total + turbW;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    // weicher Flugkorridor in der Tiefe
    if (this.z > 330) this.z -= (this.z - 330) * Math.min(1, 0.8 * dt);
    if (this.z < -140) this.z -= (this.z + 140) * Math.min(1, 0.8 * dt);
    this.groundSpeed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);

    // Optik: Nase über Bahn je nach Anstellwinkel
    var alphaVis = (1.0 + 8.5 * clamp(this.c, -0.4, 1.1)) * DEG;
    if (this.stalled) alphaVis = (12 + 3 * Math.sin(t * 9)) * DEG;
    this.theta = this.gamma + alphaVis;

    // Variometer (Total-Energie-kompensiert)
    var teRaw = this.vy + this.V * Vdot / G;
    this.te += (teRaw - this.te) * Math.min(1, dt * 1.3);
  };

  P.enterStall = function () {
    var A = this.A;
    this.stalled = true;
    this.stallT = 0; this.recT = 0; this.stallDur = 0;
    var dir = Math.abs(this.phi) > 6 * DEG ? TF.sign(this.phi) : (Math.random() < 0.5 ? -1 : 1);
    this.p += dir * A.wingDrop * (0.65 + 0.35 * Math.random());
    this.events.push('stall');
  };

  // ------------------------------------------------------------
  // Rollen am Boden nach der Landung
  // ------------------------------------------------------------
  P.startGround = function (world) {
    this.mode = 'ground';
    var gs = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
    this.groundSpeed = gs;
    this.gHeading = Math.atan2(this.vz, this.vx);
    this.stopT = 0;
  };

  P.stepGround = function (dt, inp, world, t, decel) {
    this.brake = TF.approach(this.brake, inp.brake ? 1 : 0, 2.2, dt);
    var d = decel + this.brake * 1.5;
    this.groundSpeed = Math.max(0, this.groundSpeed - d * dt);
    this.x += Math.cos(this.gHeading) * this.groundSpeed * dt;
    this.z += Math.sin(this.gHeading) * this.groundSpeed * dt;
    this.y = world.hC(this.x) + TF.GEAR_H;
    this.gamma = 0;
    this.V = this.groundSpeed;
    this.vy = 0;
    var stop = this.groundSpeed < 0.5;
    this.theta = TF.approach(this.theta, stop ? -1 * DEG : 2 * DEG, 3, dt);
    var targetPhi = stop ? (this.A.id === 'ask21' ? -4 : 5) * DEG : 0;
    this.phi = TF.approach(this.phi, targetPhi, stop ? 1.5 : 4, dt);
    this.te += (0 - this.te) * Math.min(1, dt * 2);
    this.warn = 0; this.buffet = 0;
    if (stop) this.stopT += dt;
  };
})();
