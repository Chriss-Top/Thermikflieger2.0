/* Thermikflieger 2.0 – Spielablauf, Eingabe, Menüs, Landungsbewertung */
(function () {
  'use strict';
  var DEG = TF.DEG, clamp = TF.clamp, smoothstep = TF.smoothstep;

  var Game = TF.Game = {
    state: 'menu',
    paused: false,
    selected: 'ask21',
    keys: {},
    options: { invert: false },
    t: 0
  };

  var $ = function (id) { return document.getElementById(id); };

  // ------------------------------------------------------------
  // Initialisierung
  // ------------------------------------------------------------
  Game.init = function () {
    TF.Sprites.init();
    this.canvas = $('game');
    this.renderer = new TF.Renderer(this.canvas);
    this.hud = new TF.HUD();
    this.scores = TF.store.get('tf2_scores', {});
    var opts = TF.store.get('tf2_options', null);
    if (opts) {
      this.options.invert = !!opts.invert;
      if (opts.muted) TF.Audio.muted = true;
      if (opts.selected && TF.AIRCRAFT[opts.selected]) this.selected = opts.selected;
    }
    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
    document.addEventListener('fullscreenchange', this.resize.bind(this));
    this.bindInput();
    this.buildMenu();
    this.startAttract();
    this.last = performance.now();
    this.fpsAcc = 0; this.fpsN = 0; this.fps = 60;
    requestAnimationFrame(this.frame.bind(this));
  };

  Game.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr || 1.75);
    this.renderer.resize(window.innerWidth, window.innerHeight, dpr);
  };

  Game.saveOptions = function () {
    TF.store.set('tf2_options', { invert: this.options.invert, muted: TF.Audio.muted, selected: this.selected });
  };

  // ------------------------------------------------------------
  // Eingabe
  // ------------------------------------------------------------
  Game.bindInput = function () {
    var self = this;
    var block = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, ' ': 1, Spacebar: 1 };
    window.addEventListener('keydown', function (e) {
      TF.Audio.init();
      var k = e.key;
      if (block[k] || k === ' ') e.preventDefault();
      if (e.repeat) { self.keys[k.toLowerCase()] = true; return; }
      self.keys[k.toLowerCase()] = true;
      self.onKey(k, e);
    });
    window.addEventListener('keyup', function (e) {
      self.keys[e.key.toLowerCase()] = false;
    });
    window.addEventListener('blur', function () {
      self.keys = {};
      if (self.state === 'play' && !self.paused) self.setPaused(true);
    });
    window.addEventListener('pointerdown', function () { TF.Audio.init(); });
  };

  Game.input = function () {
    var k = this.keys;
    var roll = (k.arrowright || k.d ? 1 : 0) - (k.arrowleft || k.a ? 1 : 0);
    var push = (k.arrowup || k.w) ? 1 : 0;
    var pull = (k.arrowdown || k.s) ? 1 : 0;
    var pitch = pull - push;
    if (this.options.invert) pitch = -pitch;
    var space = !!(k[' '] || k.spacebar);
    return { roll: roll, pitch: pitch, brake: space, release: space };
  };

  Game.onKey = function (k, e) {
    var kl = k.toLowerCase();
    if (kl === 'm') {
      TF.Audio.setMuted(!TF.Audio.muted);
      this.saveOptions();
      this.syncMenuOptions();
      return;
    }
    if (kl === 'f') { this.toggleFullscreen(); return; }
    if (this.state === 'menu') {
      if (k === 'ArrowLeft' || kl === 'a') this.selectRel(-1);
      else if (k === 'ArrowRight' || kl === 'd') this.selectRel(1);
      else if (k === 'Enter') this.startFlight();
      return;
    }
    if (this.state === 'play') {
      if (kl === 'p' || k === 'Escape') { this.setPaused(!this.paused); return; }
      if (this.paused && k === 'Enter') { this.setPaused(false); return; }
      if (this.paused && kl === 'r') { this.startFlight(); return; }
      if (this.paused && kl === 'q') { this.toMenu(); return; }
      return;
    }
    if (this.state === 'result') {
      if (k === 'Enter') this.startFlight();
      else if (k === 'Escape') this.toMenu();
    }
  };

  Game.toggleFullscreen = function () {
    try {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    } catch (e) { /* ignore */ }
  };

  // ------------------------------------------------------------
  // Menü
  // ------------------------------------------------------------
  Game.buildMenu = function () {
    var self = this;
    var wrap = $('cards');
    wrap.innerHTML = '';
    this.previews = [];
    TF.AIRCRAFT_ORDER.forEach(function (id) {
      var A = TF.AIRCRAFT[id];
      var card = document.createElement('button');
      card.className = 'card';
      card.setAttribute('data-id', id);
      var bars = function (label, v) {
        var s = '<div class="stat"><span>' + label + '</span><i>';
        for (var i = 1; i <= 5; i++) s += '<b class="' + (i <= v ? 'on' : '') + '"></b>';
        return s + '</i></div>';
      };
      card.innerHTML =
        '<canvas class="prev" width="440" height="200"></canvas>' +
        '<div class="cname">' + A.name + '</div>' +
        '<div class="cmaker">' + A.maker + '</div>' +
        '<p class="cdesc">' + A.desc + '</p>' +
        bars('Gleiten', A.stats.glide) + bars('Wendigkeit', A.stats.agility) +
        bars('Gutmütigkeit', A.stats.docile) + bars('Tempo', A.stats.speed) +
        '<div class="cbest" data-best="' + id + '"></div>';
      card.addEventListener('click', function () {
        TF.Audio.init();
        if (self.selected === id) self.startFlight();
        else self.select(id);
      });
      wrap.appendChild(card);
      self.previews.push({ id: id, canvas: card.querySelector('canvas') });
    });
    $('btnStart').addEventListener('click', function () { TF.Audio.init(); self.startFlight(); });
    $('optSound').addEventListener('change', function (e) { TF.Audio.init(); TF.Audio.setMuted(!e.target.checked); self.saveOptions(); });
    $('optInvert').addEventListener('change', function (e) { self.options.invert = e.target.checked; self.saveOptions(); });
    $('btnResume').addEventListener('click', function () { self.setPaused(false); });
    $('btnRestart').addEventListener('click', function () { self.startFlight(); });
    $('btnMenu').addEventListener('click', function () { self.toMenu(); });
    $('btnAgain').addEventListener('click', function () { self.startFlight(); });
    $('btnChange').addEventListener('click', function () { self.toMenu(); });
    $('btnFull').addEventListener('click', function () { self.toggleFullscreen(); });
    this.select(this.selected);
    this.syncMenuOptions();
    this.updateBest();
  };

  Game.syncMenuOptions = function () {
    $('optSound').checked = !TF.Audio.muted;
    $('optInvert').checked = this.options.invert;
  };

  Game.updateBest = function () {
    var self = this;
    TF.AIRCRAFT_ORDER.forEach(function (id) {
      var el = document.querySelector('[data-best="' + id + '"]');
      var s = self.scores[id];
      el.textContent = s ? 'Bestwert ' + TF.fmtNum(s.score) + ' Pkt · ' + TF.fmtTime(s.time) : 'noch kein Flug';
    });
  };

  Game.select = function (id) {
    this.selected = id;
    var cards = document.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) cards[i].classList.toggle('sel', cards[i].getAttribute('data-id') === id);
    $('btnStart').textContent = 'Start mit ' + TF.AIRCRAFT[id].name + '  ⏎';
    this.saveOptions();
    if (this.attract && this.attract.g && this.attract.g.type !== id) this.startAttract();
  };

  Game.selectRel = function (d) {
    var o = TF.AIRCRAFT_ORDER;
    var i = o.indexOf(this.selected);
    this.select(o[(i + d + o.length) % o.length]);
    TF.Audio.blip(700, 0.06, 0.05);
  };

  Game.showScreen = function (id) {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    ['menu', 'pause', 'result'].forEach(function (s) { $(s).classList.toggle('show', s === id); });
  };

  Game.toMenu = function () {
    this.state = 'menu';
    this.paused = false;
    this.showScreen('menu');
    this.updateBest();
    this.startAttract();
  };

  Game.setPaused = function (p) {
    if (this.state !== 'play') return;
    this.paused = p;
    this.showScreen(p ? 'pause' : null);
  };

  // Hintergrund im Menü: Segelflugzeug kreist über der Landschaft
  Game.startAttract = function () {
    var w = new TF.World((Math.random() * 1e9) | 0);
    w.initThermals(0);
    for (var i = 0; i < 40; i++) w.update(1, i, 2000);
    var g = new TF.Glider(this.selected);
    g.mode = 'air';
    g.x = 2400; g.z = 60;
    g.y = w.hC(g.x) + 420;
    g.V = g.A.vtrim * 1.1;
    g.psi = 0;
    this.world = w;
    this.glider = g;
    this.t = 40;
    this.attract = { g: g, baseY: g.y, cx: g.x };
    this.renderer.dust.length = 0;
    this.renderer.parachute = null;
    this.renderer.updateCamera(0.016, g, w, { Vm: 720, snap: true, look: 0 });
  };

  // ------------------------------------------------------------
  // Flug starten
  // ------------------------------------------------------------
  Game.startFlight = function () {
    this.showScreen(null);
    this.state = 'play';
    this.paused = false;
    var seed = (Math.random() * 1e9) | 0;
    var w = this.world = new TF.World(seed);
    w.initThermals(500);
    var g = this.glider = new TF.Glider(this.selected);
    var af = w.airfields[0];
    for (var i = 0; i < w.airfields.length; i++) if (w.airfields[i].start) af = w.airfields[i];
    g.startLaunch(w, af);
    this.attract = null;
    this.t = 0;
    this.flightTime = 0;
    this.airborne = false;
    this.startX = g.x;
    this.distance = 0;
    this.maxAlt = g.y;
    this.avgClimb = 0;
    this.result = null;
    this.endTimer = 0;
    this.flash = 0;
    this.cloudFog = 0;
    this.flags = { thermal: 0, ridge: false, afShown: {}, low: false, windSign: Math.sign(w.windBase(0)), tipsShown: false, thermals: {} };
    this.thermalTimer = 0;
    this.hud.msgs.length = 0;
    this.renderer.dust.length = 0;
    this.renderer.parachute = null;
    this.renderer.updateCamera(0.016, g, w, { snap: true });
    TF.Audio.init();
    TF.Audio.blip(520, 0.12, 0.08);
  };

  // ------------------------------------------------------------
  // Hauptschleife
  // ------------------------------------------------------------
  Game.frame = function (now) {
    var dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) {
      this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0;
      this.adaptQuality();
    }
    try {
      if (this.state === 'menu') this.updateAttract(dt);
      else if (this.state === 'play' && !this.paused) this.updatePlay(dt);
      else if (this.state === 'result') this.updateResultBg(dt);
      this.render(dt);
    } catch (err) {
      if (window.console) console.error(err);
    }
    requestAnimationFrame(this.frame.bind(this));
  };

  // Automatische Qualitätsanpassung bei dauerhaft niedriger Bildrate
  Game.adaptQuality = function () {
    if (document.hidden) return;
    this.slowCount = this.fps < 45 ? (this.slowCount || 0) + 1 : 0;
    if (this.slowCount < 6) return;
    this.slowCount = 0;
    var r = this.renderer;
    if ((this.maxDpr || 1.75) > 1 && r.dpr > 1) {
      this.maxDpr = 1;
      this.resize();
    } else if (r.quality > 0.5) {
      r.quality = Math.max(0.5, r.quality - 0.25);
    }
  };

  Game.updateAttract = function (dt) {
    var g = this.glider, w = this.world;
    var steps = Math.ceil(dt / (1 / 60));
    var h = dt / steps;
    for (var i = 0; i < steps; i++) {
      var phiT = 32 * DEG;
      var inp = { roll: clamp((phiT - g.phi) / (6 * DEG), -1, 1), pitch: 0, brake: false };
      g.stepAir(h, inp, w, this.t);
      g.y = this.attract.baseY;
      g.stalled = false;
      g.x += 6 * h; // langsames Driften
      this.t += h;
      w.update(h, this.t, g.x);
    }
    this.renderer.updateCamera(dt, g, w, { Vm: 720, look: 0 });
    this.renderer.updateParticles(dt, w, this.t, g);
    // Vorschauen
    for (var j = 0; j < this.previews.length; j++) {
      var pv = this.previews[j];
      var ctx = pv.canvas.getContext('2d');
      ctx.clearRect(0, 0, pv.canvas.width, pv.canvas.height);
      TF.drawAircraftPreview(ctx, pv.id, pv.canvas.width, pv.canvas.height, this.t * 0.8 + j * 1.7);
    }
    TF.Audio.update(dt, { active: false });
  };

  Game.updateResultBg = function (dt) {
    var w = this.world;
    this.t += dt;
    w.update(dt, this.t, this.glider.x);
    this.renderer.updateParticles(dt, w, this.t, this.glider);
    this.renderer.updateCamera(dt, this.glider, w, { look: 0 });
    TF.Audio.update(dt, { active: false });
  };

  Game.updatePlay = function (dt) {
    var g = this.glider, w = this.world;
    var inp = this.input();
    var steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    var h = dt / steps;
    for (var i = 0; i < steps; i++) {
      if (g.mode === 'launch') {
        g.stepLaunch(h, inp, w, this.t);
      } else if (g.mode === 'air') {
        g.stepAir(h, inp, w, this.t);
        this.checkContact();
      } else if (g.mode === 'ground') {
        g.stepGround(h, inp, w, this.t, this.groundDecel);
        this.checkRollout();
      } else if (g.mode === 'crash') {
        this.stepCrash(h);
      }
      w.update(h, this.t, g.x);
      this.t += h;
      if (this.state !== 'play') break;
    }
    if (this.state !== 'play') return;
    this.handleEvents();

    if (this.airborne && (g.mode === 'air' || g.mode === 'launch')) this.flightTime += dt;
    this.distance = Math.max(this.distance, Math.abs(g.x - this.startX));
    this.maxAlt = Math.max(this.maxAlt, g.y);
    if (g.mode === 'air') this.avgClimb += (g.te - this.avgClimb) * Math.min(1, dt / 15);

    this.updateHints(dt);
    this.cloudFog = this.computeCloudFog();
    this.flash = Math.max(0, this.flash - dt * 1.8);

    var r = this.renderer;
    if (g.mode === 'air' && g.buffet > 0.3) r.cam.shake = Math.max(r.cam.shake, 0.18 * g.buffet);
    r.updateCamera(dt, g, w);
    r.updateParticles(dt, w, this.t, g);

    if (g.mode === 'ground' && g.stopT > 1.6 && !this.result) this.finish();
    if (g.mode === 'crash') {
      this.endTimer += dt;
      if (this.endTimer > 2.4 && !this.result) this.finish();
    }

    var L = g.launch;
    TF.Audio.update(dt, {
      active: true, te: g.mode === 'air' ? g.te : 0, V: g.mode === 'crash' ? 0 : g.V,
      warn: g.mode === 'air' ? g.warn : (g.mode === 'launch' ? g.warn : 0),
      stalled: g.mode === 'air' && g.stalled, buffet: g.mode === 'air' ? g.buffet * 0.7 : 0,
      winch: g.mode === 'launch' && L ? (L.phase === 'ready' ? 0.3 : 1) : 0
    });
  };

  // ------------------------------------------------------------
  // Ereignisse & Hinweise
  // ------------------------------------------------------------
  Game.handleEvents = function () {
    var g = this.glider, hud = this.hud, w = this.world;
    for (var i = 0; i < g.events.length; i++) {
      var e = g.events[i];
      if (e === 'roll') { hud.toast('Seil straff – los geht’s!', '', { dur: 1.8 }); TF.Audio.blip(440, 0.1, 0.06); }
      else if (e === 'liftoff') { this.airborne = true; hud.toast('Abgehoben!', 'Ziehen (↓ / S) und die Nase in den grünen Bereich bringen', { dur: 3 }); }
      else if (e.indexOf('release:') === 0) {
        var reason = e.split(':')[1];
        var agl = Math.round(g.y - w.hC(g.x));
        var L = g.launch;
        this.airborne = true;
        if (reason === 'weaklink') {
          hud.toast('Sollbruchstelle gerissen!', 'Zu steil gezogen – Nase runter, Fahrt aufnehmen', { color: '#ffb02e', dur: 4.5 });
        } else {
          hud.toast('Ausgeklinkt in ' + agl + ' m', 'Startqualität ' + Math.round(L.quality * 100) + '% · suche Thermik unter den Cumuluswolken', { big: true, dur: 4.5, color: '#bff5ff' });
        }
        TF.Audio.release();
        this.renderer.parachute = { x: g.x, y: g.y - 3, wx: L.winchX, wy: w.hC(L.winchX) + 2, cable: true };
        var self = this;
        setTimeout(function () {
          if (self.state === 'play' && self.glider === g) {
            self.hud.toast('Kreisen: Querlage mit ← → einleiten', 'Vario piept = Steigen · ↓ ziehen, ↑ drücken · Leertaste = Bremsklappen', { dur: 6 });
          }
        }, 5200);
      }
      else if (e === 'stall') {
        hud.toast('Strömungsabriss!', 'Nachdrücken (↑ / W), Fahrt aufholen, dann sanft abfangen', { color: '#ff6b5b', dur: 3.5 });
        this.renderer.cam.shake = 0.9;
      }
      else if (e === 'recovered') { hud.toast('Abgefangen', '', { color: '#9cf5b5', dur: 1.8 }); }
    }
    g.events.length = 0;
  };

  Game.updateHints = function (dt) {
    var g = this.glider, w = this.world, hud = this.hud, F = this.flags;
    if (g.mode !== 'air') return;
    var air = g.air;
    if (!air) return;
    // Thermik gefunden
    if (air.thermal > 1.0 && g.te > 0.6) {
      this.thermalTimer += dt;
      if (this.thermalTimer > 1.6) {
        var th = this.nearestThermal();
        if (th && !F.thermals[th.id]) {
          F.thermals[th.id] = true;
          F.thermal++;
          hud.toast('Thermik! ' + (g.te >= 0 ? '+' : '') + g.te.toFixed(1) + ' m/s', F.thermal === 1 ? 'Kreisen und den Kern zentrieren – dort steigt es am besten' : '', { color: '#9cf5b5', dur: 3 });
          TF.Audio.chime();
        }
      }
    } else this.thermalTimer = 0;
    // Hangaufwind
    if (!F.ridge && air.ridge > 0.9) {
      F.ridge = true;
      hud.toast('Hangaufwind!', 'Auf der Luvseite am Hang entlang fliegen – Abstand halten', { color: '#9cf5b5', dur: 4 });
    }
    // Flugplatz in Reichweite
    var dir = Math.cos(g.psi) >= 0 ? 1 : -1;
    var nf = w.nextAirfield(g.x, dir);
    var agl = g.y - w.hC(g.x);
    if (nf && nf.dist < 1800 && agl < 500 && !F.afShown[nf.af.idx] && !(nf.af.start && this.flightTime < 120)) {
      F.afShown[nf.af.idx] = true;
      var wind = w.windAt(0, this.t);
      var ldir = Math.abs(wind) < 1 ? 'Wind schwach' : 'Gegenwind-Landung Richtung ' + (wind < 0 ? '→' : '←');
      hud.toast('Flugplatz ' + nf.af.name + (nf.dist > 1 ? ' voraus' : ''), 'Landen mit ~' + Math.round(g.A.vs * 1.45 * 3.6) + ' km/h · Leertaste = Bremsklappen · ' + ldir, { dur: 5 });
    }
    // Tief
    if (agl < 160 && !F.low && !w.airfieldAtX(g.x, 600)) {
      F.low = true;
      hud.toast('Tief! Landefeld suchen', 'Ebene Wiese oder Feld ohne Bäume – flach und langsam aufsetzen', { color: '#ffcf8a', dur: 4 });
    }
    if (agl > 300) F.low = false;
    // Winddrehung
    var ws = Math.sign(w.windBase(this.t));
    if (ws !== F.windSign && Math.abs(w.windBase(this.t)) > 2.5) {
      F.windSign = ws;
      hud.toast('Winddrehung', 'Der Wind weht jetzt ' + (ws > 0 ? 'von links nach rechts →' : 'von rechts nach links ←'), { dur: 3.5 });
    }
  };

  Game.nearestThermal = function () {
    var g = this.glider, w = this.world, best = null, bd = 1e9;
    for (var i = 0; i < w.thermals.length; i++) {
      var th = w.thermals[i];
      var dx = g.x - w.thermalX(th), dz = g.z - th.z;
      var d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = th; }
    }
    return best;
  };

  Game.computeCloudFog = function () {
    var g = this.glider, w = this.world;
    var cb = w.cloudBase(this.t);
    var fog = 0;
    for (var i = 0; i < w.thermals.length; i++) {
      var th = w.thermals[i];
      if (!th.hasCloud) continue;
      var ce = TF.cloudEnv(th);
      if (ce < 0.1) continue;
      var top = cb + th.cbOff;
      if (g.y < top - 40) continue;
      var dx = Math.abs(g.x - w.thermalX(th));
      var wdt = (th.R * 3 + 260) * th.cloudScale * (0.35 + 0.65 * Math.sqrt(ce));
      if (dx > wdt * 0.4 || Math.abs(g.z - th.z) > 140) continue;
      fog = Math.max(fog, ce * smoothstep(top - 40, top + 15, g.y) * (1 - smoothstep(wdt * 0.25, wdt * 0.4, dx)));
    }
    return fog;
  };

  // ------------------------------------------------------------
  // Landung & Aufschlag
  // ------------------------------------------------------------
  Game.checkContact = function () {
    var g = this.glider, w = this.world;
    var gh = w.hC(g.x);
    if (g.y - gh > TF.GEAR_H) {
      // Flügelspitze am Hang?
      return;
    }
    g.y = gh + TF.GEAR_H;
    var slope = w.slope(g.x);
    var vs = -g.vy;
    var vxAlong = g.vx;
    var vn = (vs + vxAlong * slope) / Math.sqrt(1 + slope * slope);
    var gs = Math.sqrt(g.vx * g.vx + g.vz * g.vz);
    var A = g.A;
    var bank = Math.abs(g.phi) / DEG;
    var lu = w.landuse(g.x, g.z, gh);
    var af = w.airfieldAtX(g.x, 40);
    var onField = af && g.z > -260 && g.z < 420;
    var info = { vn: vn, gs: gs, V: g.V, bank: bank, slope: slope, lu: lu, af: onField ? af : null };
    this.touch = info;

    var crash = null;
    if (Math.abs(slope) > 0.22 && vn > 2.2) crash = { title: 'Kollision mit dem Hang', text: 'Zu tief am Hang – mehr Abstand zum Gelände halten.' };
    else if (vn > 5.2) crash = { title: 'Aufschlag im Gelände', text: 'Viel zu hohe Sinkrate beim Aufsetzen.' };
    else if (bank > 28) crash = { title: 'Flügel am Boden', text: 'Mit Querlage aufgesetzt – vor dem Aufsetzen die Flügel gerade machen.' };
    else if (g.stalled && vn > 3) crash = { title: 'Durchgesackt', text: 'Strömungsabriss in Bodennähe – genug Fahrt im Landeanflug halten.' };
    else if (lu === TF.LU.FOREST) crash = { title: 'Baumlandung', text: 'Im Wald gelandet – Felder und Wiesen sind die besseren Landeplätze.' };
    else if (lu === TF.LU.VILLAGE) crash = { title: 'Landung im Dorf', text: 'Häuser und Gärten sind kein Landeplatz.' };
    else if (Math.abs(slope) > 0.2) crash = { title: 'Bruch am Steilhang', text: 'Der Hang war zu steil zum Landen.' };

    if (crash) { this.crash(crash, vn); return; }

    // Weiche Landung -> Ausrollen
    var grade, title, text, bonus;
    var tooFast = g.V > A.vs * 1.75 || gs > A.vs * 1.8;
    if (onField) {
      if (vn < 1.0) { grade = 4; title = 'Butterweiche Landung!'; }
      else if (vn < 1.9) { grade = 3; title = 'Saubere Landung'; }
      else if (vn < 3.2) { grade = 2; title = 'Harte Landung'; }
      else { grade = 1; title = 'Sehr harte Landung'; }
      if (tooFast && grade > 1) { grade--; title += ' (zu schnell)'; }
      text = 'Gelandet auf dem Flugplatz ' + af.name + '.';
    } else {
      if (vn < 1.9) { grade = 2; title = 'Gelungene Außenlandung'; }
      else if (vn < 3.2) { grade = 1; title = 'Holprige Außenlandung'; }
      else { grade = 0; title = 'Außenlandung mit Schaden'; }
      if (tooFast && grade > 0) grade--;
      text = 'Auf einem ' + (lu === TF.LU.MEADOW ? 'Wiesenstück' : 'Feld') + ' gelandet – der Rückholtrupp ist unterwegs.';
    }
    this.landing = { grade: grade, title: title, text: text, onField: !!onField, af: onField ? af : null, vn: vn, gs: gs, overrun: false, rough: !onField };
    g.startGround(w);
    this.groundDecel = onField ? 1.8 : 3.6;
    TF.Audio.thump(Math.min(1, vn / 4));
    this.renderer.spawnDust(g.x, gh, g.z, 10 + Math.round(vn * 5), onField ? [190, 200, 150] : [170, 150, 110], 0.5 + vn * 0.2);
    this.renderer.cam.shake = Math.min(0.8, 0.15 + vn * 0.12);
    var gcol = grade >= 3 ? '#9cf5b5' : (grade >= 2 ? '#ffffff' : '#ffcf8a');
    this.hud.toast(title, 'Sinkrate ' + vn.toFixed(1) + ' m/s · ' + Math.round(gs * 3.6) + ' km/h über Grund', { color: gcol, dur: 3.5, big: true });
  };

  Game.checkRollout = function () {
    var g = this.glider, w = this.world, L = this.landing;
    if (!L) return;
    if (L.onField && !L.overrun && L.af) {
      if (g.x > L.af.x1 + 30 || g.x < L.af.x0 - 30) {
        L.overrun = true;
        this.hud.toast('Über das Platzende hinaus!', 'Mit Gegenwind und Bremsklappen wird die Landestrecke kürzer', { color: '#ffcf8a', dur: 3 });
      }
    }
    var lu = w.landuse(g.x, g.z);
    if (g.groundSpeed > 4 && (lu === TF.LU.FOREST || lu === TF.LU.VILLAGE)) {
      this.crash({ title: lu === TF.LU.FOREST ? 'In die Bäume gerollt' : 'Ins Dorf gerollt', text: 'Beim Ausrollen ein Hindernis getroffen.' }, 3);
    }
    if (Math.abs(w.slope(g.x)) > 0.25 && g.groundSpeed > 6) {
      this.crash({ title: 'Gegen den Hang gerollt', text: 'Beim Ausrollen in steiles Gelände geraten.' }, 3);
    }
  };

  Game.crash = function (info, power) {
    var g = this.glider;
    g.mode = 'crash';
    g.crashed = true;
    g.crashTheta = g.theta - 8 * DEG;
    g.crashPhi = g.phi + (Math.random() - 0.5) * 30 * DEG;
    this.crashInfo = info;
    this.crashSpeed = Math.sqrt(g.vx * g.vx + g.vz * g.vz);
    this.crashDir = Math.atan2(g.vz, g.vx);
    this.endTimer = 0;
    this.flash = 1;
    this.renderer.cam.shake = 1.4;
    this.renderer.spawnDust(g.x, this.world.hC(g.x), g.z, 60, [150, 130, 100], 1.4);
    this.renderer.spawnDust(g.x, this.world.hC(g.x) + 2, g.z, 18, [240, 240, 240], 1.0);
    TF.Audio.thump(1);
    this.hud.toast(info.title, info.text, { color: '#ff7a6b', big: true, dur: 3 });
  };

  Game.stepCrash = function (h) {
    var g = this.glider, w = this.world;
    this.crashSpeed = Math.max(0, this.crashSpeed - 28 * h);
    g.x += Math.cos(this.crashDir) * this.crashSpeed * h;
    g.z += Math.sin(this.crashDir) * this.crashSpeed * h;
    g.y = w.hC(g.x) + TF.GEAR_H * 0.6;
    g.V = 0; g.vx = 0; g.vy = 0; g.vz = 0; g.te = 0;
  };

  // ------------------------------------------------------------
  // Ergebnis
  // ------------------------------------------------------------
  Game.finish = function () {
    var g = this.glider;
    var time = this.flightTime;
    var dist = this.distance;
    var startY = this.world.hC(this.startX);
    var gain = Math.max(0, this.maxAlt - startY);
    var res = { lines: [] };
    var landingPts = 0, factor = 1;
    if (g.mode === 'crash') {
      var ci = this.crashInfo;
      res.title = ci.title;
      res.text = ci.text;
      res.icon = '💥';
      res.cls = 'bad';
      factor = 0.5;
    } else {
      var L = this.landing;
      var pts = L.onField ? [40, 80, 160, 280, 420] : [10, 40, 120, 160, 160];
      landingPts = pts[clamp(L.grade, 0, 4)];
      if (L.overrun) { landingPts = Math.round(landingPts * 0.5); L.title += ' – über das Platzende'; }
      res.title = L.title;
      res.text = L.text;
      res.icon = L.onField ? (L.grade >= 3 ? '🏆' : '🛬') : '🌾';
      res.cls = L.grade >= 3 ? 'good' : (L.grade >= 2 ? 'ok' : 'meh');
      if (L.onField && !L.af.start) { landingPts += 150; res.lines.push(['Landung auf fremdem Platz', '+150']); }
    }
    var timePts = Math.round(time * 1.0);
    var distPts = Math.round(dist / 1000 * 60);
    var altPts = Math.round(gain * 0.15);
    var score = Math.round((timePts + distPts + altPts + landingPts) * factor);
    res.lines.unshift(
      ['Flugzeit ' + TF.fmtTime(time), '+' + timePts],
      ['Strecke ' + TF.fmtNum(dist / 1000, 1) + ' km', '+' + distPts],
      ['Max. Höhe ' + TF.fmtNum(Math.round(this.maxAlt)) + ' m', '+' + altPts]
    );
    if (g.mode !== 'crash') res.lines.push(['Landung', '+' + landingPts]);
    else res.lines.push(['Bruch: Punkte halbiert', '×0,5']);
    res.score = score;
    var prev = this.scores[g.type];
    res.record = score > 0 && (!prev || score > prev.score);
    if (res.record) {
      this.scores[g.type] = { score: score, time: Math.round(time), dist: Math.round(dist) };
      TF.store.set('tf2_scores', this.scores);
    }
    res.best = this.scores[g.type] || { score: 0 };
    this.result = res;
    this.state = 'result';
    this.showResult(res, g);
    if (res.record) TF.Audio.chime();
  };

  Game.showResult = function (res, g) {
    $('resIcon').textContent = res.icon;
    $('resTitle').textContent = res.title;
    $('resTitle').className = res.cls;
    $('resText').textContent = res.text;
    $('resPlane').textContent = g.A.name;
    var tb = '';
    for (var i = 0; i < res.lines.length; i++) tb += '<tr><td>' + res.lines[i][0] + '</td><td>' + res.lines[i][1] + '</td></tr>';
    $('resTable').innerHTML = tb;
    $('resScore').textContent = TF.fmtNum(res.score);
    $('resRecord').textContent = res.record ? '★ Neuer Bestwert mit der ' + g.A.name + '!' : 'Bestwert ' + g.A.name + ': ' + TF.fmtNum(res.best.score) + ' Punkte';
    $('resRecord').className = res.record ? 'rec' : '';
    this.showScreen('result');
  };

  // ------------------------------------------------------------
  // Zeichnen
  // ------------------------------------------------------------
  Game.render = function (dt) {
    var r = this.renderer;
    var st = {
      world: this.world, glider: this.glider, t: this.t,
      cloudFog: this.state === 'play' ? this.cloudFog : 0,
      flash: this.state === 'play' ? this.flash : 0
    };
    r.draw(st);
    var ctx = r.ctx;
    if (this.state === 'play') {
      if (!this.paused) this.hud.update(dt);
      this.hud.draw(ctx, r.W, r.H, {
        glider: this.glider, world: this.world, t: this.t, dpr: r.dpr,
        flightTime: this.flightTime, distance: this.distance, avgClimb: this.avgClimb,
        muted: TF.Audio.muted
      });
      if (this.keys['`'] || this.showFps) {
        ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
        ctx.fillText(Math.round(this.fps) + ' fps', 10, r.H - 4);
      }
    }
  };

  window.addEventListener('load', function () { Game.init(); });
})();
