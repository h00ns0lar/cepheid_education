// 시뮬레이터: 은하 시야, 변광성 광도곡선, 관측 일정, 합성 CCD 프레임.
(function (g) {
  const C = g.CEPH = g.CEPH || {};

  const SIM = C.SIM = {
    W: 100, H: 100,      // 한 변광성 주변 시야(픽셀)
    ZP: 32.7,            // 1 e- 에 해당하는 계기 등급(영점)
    READ: 3,             // 읽기 잡음 (e-)
    SAT: 65000,          // 포화 수준 (e-/픽셀)
    NIGHTS: 90,          // 관측 기간 (일)
    SKY0: 18             // 평균 하늘 밝기 (e-/픽셀)
  };

  // 주기-광도 관계 (교육용 단순화): M_V = slope*(logP-1) + zp
  C.PL = { slope: -2.43, zp: -4.05, scatter: 0.15 };
  C.absMag = (logP) => C.PL.slope * (logP - 1) + C.PL.zp;

  // ---------- 광도곡선 ----------
  function makeLut(rand) {
    const N = 512;
    const w = [1, 0.92, 0.75, 0.55, 0.35, 0.2].map((x) => x * (1 + 0.08 * rand.gauss()));
    const dph = w.map(() => 0.25 * rand.gauss());
    const lut = new Float32Array(N);
    let mean = 0, mn = 1e9, mx = -1e9;
    for (let i = 0; i < N; i++) {
      const ph = i / N;
      let s = 0;
      for (let k = 1; k <= w.length; k++) s -= (w[k - 1] * Math.sin(2 * Math.PI * k * ph + dph[k - 1])) / k;
      lut[i] = s; mean += s;
      if (s < mn) mn = s;
      if (s > mx) mx = s;
    }
    mean /= N;
    for (let i = 0; i < N; i++) lut[i] = (lut[i] - mean) / (mx - mn);
    return lut;
  }

  function lutAt(lut, ph) {
    ph -= Math.floor(ph);
    const x = ph * lut.length;
    const i = Math.floor(x), f = x - i;
    return lut[i] * (1 - f) + lut[(i + 1) % lut.length] * f;
  }

  function wrap(x) { return x - Math.round(x); }

  // 변광성 v 의 시각 t(일)에서의 등급
  C.varMagAt = function (v, t) {
    const ph = (t - v.t0) / v.P;
    if (v.type === 'cepheid') return v.meanMag + v.amp * lutAt(v.lut, ph);
    const d1 = v.d1 * Math.exp(-0.5 * Math.pow(wrap(ph) / v.w, 2));
    const d2 = v.d2 * Math.exp(-0.5 * Math.pow(wrap(ph - 0.5) / v.w, 2));
    return v.meanMag + d1 + d2;
  };

  // ---------- 시야(스탬프) ----------
  function makeStamp(rand, v) {
    const W = SIM.W, H = SIM.H;
    const stars = [], hidden = [], bg = [], pts = [];
    const T = v.meanMag;
    const free = (x, y, sep) => pts.every((p) => Math.hypot(p[0] - x, p[1] - y) >= sep);
    const place = (sep, margin) => {
      for (let k = 0; k < 300; k++) {
        const x = margin + rand() * (W - 2 * margin);
        const y = margin + rand() * (H - 2 * margin);
        if (free(x, y, sep)) { pts.push([x, y]); return [x, y]; }
      }
      return null;
    };
    const add = (role, mag, sep, margin, extra) => {
      const p = place(sep, margin);
      if (!p) return null;
      const s = Object.assign({
        role, x: p[0], y: p[1], mag,
        cat: mag + 0.02 * rand.gauss()
      }, extra || {});
      stars.push(s);
      return s;
    };

    const tx = W / 2 + rand.range(-5, 5), ty = H / 2 + rand.range(-5, 5);
    pts.push([tx, ty]);
    stars.push({ role: 'target', x: tx, y: ty, mag: T, cat: null });

    for (let i = 0; i < 6; i++) add('good', T + rand.range(-1.0, 1.0), 16, 14);
    add('sat', 16.6 + rand.range(-0.3, 0.3), 16, 14);
    for (let i = 0; i < 2; i++) add('faint', T + rand.range(2.6, 3.2), 14, 12);
    // 혼입(블렌드): 가까운 이웃이 같이 구경에 들어온다
    const b = add('blend', T + rand.range(-0.5, 0.5), 18, 16);
    if (b) {
      const ang = rand() * 2 * Math.PI, d = rand.range(3.0, 4.0);
      hidden.push({ x: b.x + d * Math.cos(ang), y: b.y + d * Math.sin(ang), mag: b.mag + rand.range(0.0, 0.8) });
    }
    // 변광하는 함정 별
    add('var', T + rand.range(-0.8, 0.8), 16, 14, { amp: rand.range(0.25, 0.4), P: rand.range(3, 9), t0: rand.range(0, 9) });
    // 가장자리 별
    const ex = 3.5, ey = rand.range(25, H - 25);
    pts.push([ex, ey]);
    stars.push({ role: 'edge', x: ex, y: ey, mag: T + rand.range(-0.5, 0.5), cat: 0 });
    stars[stars.length - 1].cat = stars[stars.length - 1].mag + 0.02 * rand.gauss();
    for (let i = 0; i < 8; i++) add('other', Math.max(17.5, T + rand.range(-2.5, 2.0)), 12, 10);

    // 배경 은하의 희미한 별들 (카탈로그에 없음)
    for (let i = 0; i < 45; i++) {
      const x = rand() * W, y = rand() * H;
      const near = Math.hypot(x - tx, y - ty) < 7;
      bg.push({ x, y, mag: near ? rand.range(27.0, 28.5) : rand.range(25.6, 28.2) });
    }

    // 이름표: 별 A, B, C, ...
    let li = 0;
    stars.forEach((s) => {
      if (s.role === 'target') s.id = 'TGT';
      else s.id = String.fromCharCode(65 + li++);
    });
    return {
      W, H, stars, hidden, bg,
      grad: [rand.range(-0.12, 0.12), rand.range(-0.12, 0.12)]
    };
  }

  // ---------- 은하 전체 ----------
  C.buildField = function (galaxy, seed) {
    const rand = C.rng(C.hashStr(galaxy.id + '#' + seed));
    const nC = 8;
    const base = galaxy.mu + galaxy.Av;

    const logPs = [];
    for (let i = 0; i < nC; i++) logPs.push(0.55 + (0.95 * (i + 0.1 + 0.8 * rand())) / nC);

    const vars = [];
    logPs.forEach((lp) => {
      const P = Math.pow(10, lp);
      const meanMag = C.absMag(lp) + base + C.PL.scatter * rand.gauss();
      const amp = 0.55 + 0.55 * (lp - 0.5) + 0.1 * rand.gauss();
      vars.push({
        type: 'cepheid', P, logP: lp, meanMag, amp: Math.max(0.4, amp),
        t0: rand.range(0, P), lut: makeLut(rand),
        Mabs: meanMag - base
      });
    });
    for (let i = 0; i < 2; i++) {
      const P = rand.range(3.5, 9);
      vars.push({
        type: 'eb', P, logP: Math.log10(P),
        meanMag: base + rand.range(-5.0, -3.0),
        d1: rand.range(0.6, 0.9), d2: rand.range(0.4, 0.7), w: rand.range(0.045, 0.07),
        t0: rand.range(0, P)
      });
    }

    // V1: 주기 12일에 가장 가까운 세페이드 (처음 손으로 해볼 별)
    let bi = 0, bd = 1e9;
    vars.forEach((v, i) => {
      if (v.type === 'cepheid' && Math.abs(v.logP - Math.log10(12)) < bd) { bd = Math.abs(v.logP - Math.log10(12)); bi = i; }
    });
    const first = vars.splice(bi, 1)[0];
    rand.shuffle(vars);
    vars.unshift(first);

    // 은하 그림 위 위치 (서로 겹치지 않게)
    const placed = [];
    vars.forEach((v, i) => {
      v.id = 'V' + (i + 1);
      for (let k = 0; k < 400; k++) {
        const p = C.spiralSample(rand, galaxy);
        if (p.u < 0.08 || p.u > 0.92 || p.v < 0.08 || p.v > 0.92) continue;
        if (placed.every((q) => Math.hypot(q.u - p.u, q.v - p.v) > 0.075)) { v.u = p.u; v.v = p.v; placed.push(p); break; }
      }
      if (v.u === undefined) { v.u = 0.3 + 0.04 * i; v.v = 0.5; }
    });
    vars.forEach((v) => { v.stamp = makeStamp(rand, v); });

    return { galaxy, seed, vars };
  };

  // ---------- 관측 일정 ----------
  // 밤마다: off(망원경 시간 없음) / cloud(구름) / ok(관측)
  C.makeSchedule = function (seed) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const rand = C.rng(C.hashStr('sched#' + seed + '#' + attempt));
      const nights = [];
      let cloudy = false;
      for (let d = 1; d <= SIM.NIGHTS; d++) {
        const scheduled = rand() < 0.62;
        cloudy = cloudy ? rand() < 0.5 : rand() < 0.2;
        nights.push({ day: d, status: !scheduled ? 'off' : cloudy ? 'cloud' : 'ok' });
      }
      const n = nights.filter((x) => x.status === 'ok').length;
      if (n < 34 || n > 48) continue;

      const epochs = [];
      nights.forEach((nt) => {
        if (nt.status !== 'ok') return;
        const thin = rand() < 0.25;
        epochs.push({
          n: epochs.length, day: nt.day,
          t: nt.day + rand.range(-0.2, 0.2),
          fwhm: Math.min(4.0, Math.max(1.8, 2.5 * Math.exp(0.22 * rand.gauss()))),
          transp: thin ? rand.range(0.15, 0.5) : 0.05 * rand.gauss(),
          sky: SIM.SKY0 * Math.exp(0.35 * rand.gauss()),
          jx: 0.35 * rand.gauss(), jy: 0.35 * rand.gauss()
        });
      });
      return { nights, epochs };
    }
    throw new Error('schedule failed');
  };

  // ---------- 프레임 렌더 ----------
  function starMag(s, t, v) {
    if (s.role === 'target') return C.varMagAt(v, t);
    if (s.role === 'var') return s.mag + s.amp * Math.sin((2 * Math.PI * (t - s.t0)) / s.P);
    return s.mag;
  }

  function addStar(img, W, H, x, y, flux, fwhm, rad) {
    const beta = 3;
    const alpha = fwhm / (2 * Math.sqrt(Math.pow(2, 1 / beta) - 1));
    const a2 = alpha * alpha;
    const norm = (flux * (beta - 1)) / (Math.PI * a2);
    const x0 = Math.max(0, Math.floor(x - rad)), x1 = Math.min(W - 1, Math.ceil(x + rad));
    const y0 = Math.max(0, Math.floor(y - rad)), y1 = Math.min(H - 1, Math.ceil(y + rad));
    for (let j = y0; j <= y1; j++) {
      for (let i = x0; i <= x1; i++) {
        const r2 = (i - x) * (i - x) + (j - y) * (j - y);
        const u = 1 + r2 / a2;
        img[j * W + i] += norm / (u * u * u);
      }
    }
  }

  // 한 변광성의 한 에포크 프레임
  C.renderFrame = function (v, ep, rand) {
    const st = v.stamp, W = st.W, H = st.H;
    const img = new Float32Array(W * H);
    const tr = Math.pow(10, -0.4 * ep.transp);
    const fl = (m) => Math.pow(10, 0.4 * (SIM.ZP - m)) * tr;
    const R = Math.ceil(4.5 * ep.fwhm);

    st.stars.forEach((s) => {
      addStar(img, W, H, s.x + ep.jx, s.y + ep.jy, fl(starMag(s, ep.t, v)), ep.fwhm, R);
    });
    st.hidden.forEach((s) => addStar(img, W, H, s.x + ep.jx, s.y + ep.jy, fl(s.mag), ep.fwhm, R));
    st.bg.forEach((s) => addStar(img, W, H, s.x + ep.jx, s.y + ep.jy, fl(s.mag), ep.fwhm, Math.ceil(3 * ep.fwhm)));

    const g0 = st.grad[0], g1 = st.grad[1];
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        const sky = ep.sky * (1 + g0 * (i / W - 0.5) + g1 * (j / H - 0.5));
        const e = img[k] + sky;
        let val = e + Math.sqrt(e) * rand.gauss() + SIM.READ * rand.gauss();
        if (val > SIM.SAT) val = SIM.SAT;
        img[k] = val;
      }
    }
    return img;
  };

  // 전 변광성의 한 에포크 프레임을 만든다 (결정적: 순서와 무관)
  C.renderEpoch = function (field, ep, ids) {
    const out = {};
    field.vars.forEach((v) => {
      if (ids && ids.indexOf(v.id) < 0) return;
      const rand = C.rng(C.hashStr(field.seed + '|' + v.id + '|' + ep.n));
      out[v.id] = C.renderFrame(v, ep, rand);
    });
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
