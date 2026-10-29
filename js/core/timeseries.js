// 시계열 분석: Lomb-Scargle 주기도, 위상 접기, 푸리에 적합.
(function (g) {
  const C = g.CEPH = g.CEPH || {};

  C.lombScargle = function (t, y, freqs) {
    const n = t.length;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += y[i];
    mean /= n;
    const yy = new Float64Array(n);
    let v = 0;
    for (let i = 0; i < n; i++) { yy[i] = y[i] - mean; v += yy[i] * yy[i]; }
    v /= n - 1;
    const P = new Float64Array(freqs.length);
    for (let k = 0; k < freqs.length; k++) {
      const w = 2 * Math.PI * freqs[k];
      let s2 = 0, c2 = 0;
      for (let i = 0; i < n; i++) { s2 += Math.sin(2 * w * t[i]); c2 += Math.cos(2 * w * t[i]); }
      const tau = Math.atan2(s2, c2) / (2 * w);
      let yc = 0, ys = 0, cc = 0, ss = 0;
      for (let i = 0; i < n; i++) {
        const a = w * (t[i] - tau), c = Math.cos(a), s = Math.sin(a);
        yc += yy[i] * c; ys += yy[i] * s; cc += c * c; ss += s * s;
      }
      P[k] = (yc * yc / cc + ys * ys / ss) / (v * (n - 1));   // 0~1: 사인파가 설명하는 분산 비율
    }
    return P;
  };

  // 주기도 + 피크 목록. 주기 범위 [pmin, pmax] 일.
  C.periodogram = function (t, y, pmin, pmax) {
    pmin = pmin || 1.5; pmax = pmax || 60;
    const T = Math.max.apply(null, t) - Math.min.apply(null, t);
    const df = 1 / (15 * T);
    const f0 = 1 / pmax, f1 = 1 / pmin;
    const nf = Math.ceil((f1 - f0) / df);
    const freqs = new Float64Array(nf);
    for (let i = 0; i < nf; i++) freqs[i] = f0 + i * df;
    const power = C.lombScargle(t, y, freqs);
    const periods = Array.from(freqs, (f) => 1 / f);
    const peaks = [];
    for (let i = 1; i < nf - 1; i++) {
      if (power[i] > power[i - 1] && power[i] >= power[i + 1]) peaks.push({ i, period: periods[i], power: power[i] });
    }
    peaks.sort((a, b) => b.power - a.power);
    return { periods, power: Array.from(power), peaks: peaks.slice(0, 8), df, T };
  };

  // 피크 근처를 더 촘촘히 훑어 주기를 다듬는다.
  C.refinePeriod = function (t, y, period, rel) {
    rel = rel || 0.03;
    const f0 = 1 / period;
    const fs = [];
    for (let k = -100; k <= 100; k++) fs.push(f0 * (1 + (rel * k) / 100));
    const p = C.lombScargle(t, y, fs);
    let bi = 0;
    for (let i = 1; i < p.length; i++) if (p[i] > p[bi]) bi = i;
    return 1 / fs[bi];
  };

  // 위상 산포(PDM 비슷): 작을수록 곡선이 매끈하게 겹친다. 0~1.
  C.phaseDispersion = function (t, y, P, nb) {
    nb = nb || 10;
    const bins = Array.from({ length: nb }, () => []);
    y.forEach((v, i) => {
      let ph = (t[i] / P) % 1; if (ph < 0) ph += 1;
      bins[Math.min(nb - 1, Math.floor(ph * nb))].push(v);
    });
    const mean = y.reduce((a, b) => a + b, 0) / y.length;
    const tot = y.reduce((a, b) => a + (b - mean) * (b - mean), 0);
    let within = 0;
    bins.forEach((b) => {
      if (!b.length) return;
      const m = b.reduce((a, c) => a + c, 0) / b.length;
      b.forEach((v) => { within += (v - m) * (v - m); });
    });
    return tot > 0 ? within / tot : 1;
  };

  function solve(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
      x[i] = s / A[i][i];
    }
    return x;
  }

  // 푸리에 급수 적합: y ≈ a0 + Σ [a_k cos + b_k sin]
  C.fourierFit = function (t, y, P, order) {
    order = order || 3;
    const m = 1 + 2 * order, n = t.length;
    const row = (tt) => {
      const r = [1];
      for (let k = 1; k <= order; k++) {
        const a = 2 * Math.PI * k * tt / P;
        r.push(Math.cos(a), Math.sin(a));
      }
      return r;
    };
    const A = Array.from({ length: m }, () => new Array(m).fill(0));
    const b = new Array(m).fill(0);
    for (let i = 0; i < n; i++) {
      const r = row(t[i]);
      for (let p = 0; p < m; p++) { b[p] += r[p] * y[i]; for (let q = 0; q < m; q++) A[p][q] += r[p] * r[q]; }
    }
    const co = solve(A, b);
    const model = (tt) => row(tt).reduce((s, v, i) => s + v * co[i], 0);
    let ss = 0;
    for (let i = 0; i < n; i++) ss += Math.pow(y[i] - model(t[i]), 2);
    const rms = Math.sqrt(ss / Math.max(1, n - m));
    // 한 주기를 200점으로
    const ph = [], val = [];
    for (let i = 0; i < 200; i++) { ph.push(i / 200); val.push(model((i / 200) * P)); }
    const mn = Math.min.apply(null, val), mx = Math.max.apply(null, val);
    const meanMag = val.reduce((a, b2) => a + b2, 0) / val.length;
    const iBright = val.indexOf(mn);
    const amp1 = Math.hypot(co[1], co[2]);
    return { P, co, rms, ph, val, amp: mx - mn, meanMag, phase0: ph[iBright], amp1, model };
  };

  // 주기 불확도 (Montgomery & O'Donoghue 1999)
  C.periodError = function (t, fit) {
    const T = Math.max.apply(null, t) - Math.min.apply(null, t);
    const sf = (Math.sqrt(6) / Math.PI / T) * (fit.rms / (fit.amp1 * Math.sqrt(t.length)));
    return fit.P * fit.P * sf;
  };

  // 모양 판정 도움: 세페이드는 톱니(완만한 하강+급상승), 식쌍성은 대부분 평평하고 날카로운 감광.
  C.shapeMetrics = function (fit) {
    const v = fit.val, n = v.length;
    const m = v.reduce((a, b) => a + b, 0) / n;
    const s = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / n);
    const skew = v.reduce((a, b) => a + Math.pow((b - m) / s, 3), 0) / n;
    const mn = Math.min.apply(null, v), mx = Math.max.apply(null, v);
    const flat = v.filter((x) => x < mn + 0.25 * (mx - mn)).length / n; // 가장 밝은 쪽에 머무는 비율
    // 비대칭: 가장 어두운 위상을 중심으로 좌우를 비교 (세페이드는 크고, 식쌍성은 거의 0)
    const i0 = v.indexOf(mx);
    let asym = 0;
    for (let k = 1; k < n / 2; k++) asym += Math.abs(v[(i0 + k) % n] - v[(i0 - k + n) % n]);
    asym /= (n / 2 - 1) * (mx - mn);
    return { skew, flat, asym };
  };

  C.suggestType = function (fit) {
    const sm = C.shapeMetrics(fit);
    return sm.asym < 0.1 ? 'eb' : 'cepheid';
  };
})(typeof window !== 'undefined' ? window : globalThis);
