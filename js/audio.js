/* Thermikflieger 2.0 – Ton per WebAudio: Variometer, Fahrtwind, Überziehwarnung, Winde, Effekte */
(function () {
  'use strict';
  var A = TF.Audio = {
    ctx: null, ready: false, muted: false, varioOn: true,
    beepPhase: 0
  };

  A.init = function () {
    if (A.ready) { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      var ctx = A.ctx = new AC();
      A.master = ctx.createGain();
      A.master.gain.value = A.muted ? 0 : 0.8;
      A.master.connect(ctx.destination);

      // Variometer
      A.vOsc = ctx.createOscillator();
      A.vOsc.type = 'triangle';
      A.vOsc.frequency.value = 600;
      A.vGain = ctx.createGain();
      A.vGain.gain.value = 0;
      A.vOsc.connect(A.vGain).connect(A.master);
      A.vOsc.start();

      // Rauschquelle
      var len = ctx.sampleRate * 2;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      var last = 0;
      for (var i = 0; i < len; i++) {
        var w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5 + w * 0.15;
      }
      A.noiseBuf = buf;
      A.wind = ctx.createBufferSource();
      A.wind.buffer = buf; A.wind.loop = true;
      A.wFilter = ctx.createBiquadFilter();
      A.wFilter.type = 'bandpass'; A.wFilter.frequency.value = 500; A.wFilter.Q.value = 0.6;
      A.wGain = ctx.createGain(); A.wGain.gain.value = 0;
      A.wind.connect(A.wFilter).connect(A.wGain).connect(A.master);
      A.wind.start();

      // Buffeting (tiefes Rumpeln)
      A.buf = ctx.createBufferSource();
      A.buf.buffer = buf; A.buf.loop = true; A.buf.playbackRate.value = 0.6;
      A.bFilter = ctx.createBiquadFilter();
      A.bFilter.type = 'lowpass'; A.bFilter.frequency.value = 140;
      A.bGain = ctx.createGain(); A.bGain.gain.value = 0;
      A.buf.connect(A.bFilter).connect(A.bGain).connect(A.master);
      A.buf.start();

      // Überziehwarnung (Hupe)
      A.hOsc = ctx.createOscillator();
      A.hOsc.type = 'square'; A.hOsc.frequency.value = 520;
      A.hFilter = ctx.createBiquadFilter();
      A.hFilter.type = 'lowpass'; A.hFilter.frequency.value = 1600;
      A.hGain = ctx.createGain(); A.hGain.gain.value = 0;
      A.hOsc.connect(A.hFilter).connect(A.hGain).connect(A.master);
      A.hOsc.start();

      // Windenmotor
      A.mOsc = ctx.createOscillator();
      A.mOsc.type = 'sawtooth'; A.mOsc.frequency.value = 70;
      A.mFilter = ctx.createBiquadFilter();
      A.mFilter.type = 'lowpass'; A.mFilter.frequency.value = 300;
      A.mGain = ctx.createGain(); A.mGain.gain.value = 0;
      A.mOsc.connect(A.mFilter).connect(A.mGain).connect(A.master);
      A.mOsc.start();

      A.ready = true;
    } catch (e) {
      A.ready = false;
    }
  };

  A.setMuted = function (m) {
    A.muted = m;
    if (A.ready) A.master.gain.setTargetAtTime(m ? 0 : 0.8, A.ctx.currentTime, 0.05);
  };

  function set(param, v, tc) {
    param.setTargetAtTime(v, A.ctx.currentTime, tc || 0.05);
  }

  /**
   * s: {active, te, V, warn, stalled, buffet, winch (0..1), launchPhase}
   */
  A.update = function (dt, s) {
    if (!A.ready) return;
    var t = A.ctx.currentTime;
    if (!s.active) {
      set(A.vGain.gain, 0); set(A.wGain.gain, 0); set(A.bGain.gain, 0); set(A.hGain.gain, 0); set(A.mGain.gain, 0, 0.3);
      return;
    }
    // Variometer: Piepen beim Steigen, leiser Dauerton bei starkem Sinken
    var te = s.te;
    if (A.varioOn && te > 0.15) {
      var f = 560 + Math.min(te, 6) * 120;
      var rate = 1.6 + Math.min(te, 6) * 1.05;
      A.beepPhase = (A.beepPhase + dt * rate) % 1;
      var on = A.beepPhase < 0.55 ? 1 : 0;
      set(A.vOsc.frequency, f, 0.03);
      set(A.vGain.gain, on * 0.16, 0.012);
    } else if (A.varioOn && te < -2.2) {
      set(A.vOsc.frequency, 330 + Math.max(te, -6) * 18, 0.1);
      set(A.vGain.gain, 0.045, 0.1);
      A.beepPhase = 0;
    } else {
      set(A.vGain.gain, 0, 0.03);
      A.beepPhase = 0;
    }
    // Fahrtwind
    var v = Math.max(0, s.V);
    set(A.wGain.gain, Math.min(0.5, Math.pow(v / 45, 2) * 0.32), 0.15);
    set(A.wFilter.frequency, 250 + v * 18, 0.15);
    // Buffeting
    set(A.bGain.gain, Math.min(1, s.buffet) * 0.9, 0.08);
    // Hupe
    var horn = s.stalled ? 1 : (s.warn > 0.35 ? 1 : 0);
    var pulse = (Math.sin(t * Math.PI * 2 * 3.2) > 0) ? 1 : 0;
    set(A.hGain.gain, horn * pulse * 0.07, 0.01);
    // Winde
    set(A.mGain.gain, (s.winch || 0) * 0.12, 0.3);
    set(A.mOsc.frequency, 60 + (s.winch || 0) * 50, 0.3);
  };

  A.blip = function (freq, dur, vol, type) {
    if (!A.ready) return;
    var ctx = A.ctx, t = ctx.currentTime;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.15));
    o.connect(g).connect(A.master);
    o.start(t); o.stop(t + (dur || 0.15) + 0.05);
  };

  A.chime = function () {
    A.blip(660, 0.25, 0.1); setTimeout(function () { A.blip(880, 0.35, 0.1); }, 130);
  };

  A.thump = function (power) {
    if (!A.ready) return;
    var ctx = A.ctx, t = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 200 + power * 600;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.min(1.2, 0.3 + power * 0.8), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25 + power * 0.9);
    src.connect(f).connect(g).connect(A.master);
    src.start(t, Math.random()); src.stop(t + 1.5);
  };

  A.release = function () {
    if (!A.ready) return;
    A.blip(180, 0.08, 0.25, 'square');
    setTimeout(function () { A.blip(1200, 0.05, 0.06); }, 40);
  };
})();
