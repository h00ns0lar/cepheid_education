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
  // env.crowd: 0(은하 바깥)~1(중심부). 붐비는 곳일수록 배경 별과 은하 빛이 많다.
  function makeStamp(rand, v, env) {
    const W = SIM.W, H = SIM.H;
    const crowd = env ? env.crowd : 0.4;
    const dist01 = env ? env.dist : 0.5; // 0(가까운 은하)~1(먼 은하): 별이 더 뭉쳐 보인다
    const stars = [], hidden = [], bg = [], pts = [];
    const T = v.meanMag;
    const free = (x, y, sep) => pts.every((p) => Math.hypot(p[0] - x, p[1] - y) >= sep);
    // 시야마다 별이 한쪽으로 더 몰려 있다 (밀도 기울기)
    const dAng = rand() * 2 * Math.PI, dAmt = rand.range(0.2, 0.9);
    const dens = (x, y) => 0.5 + dAmt * ((x - W / 2) * Math.cos(dAng) + (y - H / 2) * Math.sin(dAng)) / W;
    const place = (sep, margin) => {
      for (let k = 0; k < 300; k++) {
        const x = margin + rand() * (W - 2 * margin);
        const y = margin + rand() * (H - 2 * margin);
        if (rand() > dens(x, y) + 0.15) continue;
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

    // 붐비는 시야에서도 비교성을 찾을 수 있게, 앞의 둘은 본성보다 확실히 밝게
    for (let i = 0; i < 6; i++) add('good', i < 2 ? T + rand.range(-1.5, -0.6) : T + rand.range(-1.0, 1.0), 16, 14);
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
    const nOther = 5 + Math.floor(rand() * 6);
    for (let i = 0; i < nOther; i++) add('other', Math.max(17.5, T + rand.range(-2.5, 2.0)), 12, 10);

    // 배경 은하의 희미한 별들 (카탈로그에 없음) - 붐비는 시야일수록 많고 밝다
    const nBg = Math.round(25 + 95 * crowd + 30 * dist01 + 12 * rand());
    for (let i = 0; i < nBg; i++) {
      const x = rand() * W, y = rand() * H;
      if (rand() > dens(x, y) + 0.2) { i--; continue; }
      const near = Math.hypot(x - tx, y - ty) < 7;
      bg.push({ x, y, mag: near ? rand.range(27.0, 28.5) : rand.range(25.2 - 0.9 * crowd, 28.2) });
    }

    // 시야마다 다른 특징: 압축된 성단, 앞쪽 밝은 별(회절 가시), 배경 은하, 은하 빛 얼룩, 먼지띠, 뜨거운 화소
    const far = (x, y, sep) => Math.hypot(x - tx, y - ty) >= sep && free(x, y, sep * 0.55);
    const feats = [];
    if (rand() < 0.35) {
      for (let k = 0; k < 40; k++) {
        const cx = 15 + rand() * (W - 30), cy = 15 + rand() * (H - 30);
        if (!far(cx, cy, 24)) continue;
        const n = 7 + Math.floor(rand() * 6);
        for (let i = 0; i < n; i++) {
          bg.push({ x: cx + 4.5 * rand.gauss(), y: cy + 4.5 * rand.gauss(), mag: T + rand.range(2.6, 4.6) });
        }
        feats.push('cluster');
        break;
      }
    }
    if (rand() < 0.6) {
      for (let k = 0; k < 60; k++) {
        const x = 10 + rand() * (W - 20), y = 10 + rand() * (H - 20);
        // 밝은 별의 날개는 시상에 따라 변하므로, 비교성들과 멀리 떨어뜨린다
        if (!far(x, y, 30) || !free(x, y, 28)) continue;
        bg.push({ x, y, mag: rand.range(15.2, 17.4), spike: rand() * Math.PI / 2 });
        feats.push('fg');
        break;
      }
    }
    const haze = [], gals = [];
    const glowK = rand() < 0.3 ? 1.6 : 1; // 가끔은 은하 빛이 짙은 시야
    for (let i = 0, n = 1 + Math.floor(rand() * 3); i < n; i++) {
      haze.push({
        x: rand() * W, y: rand() * H, sa: rand.range(9, 24), sb: rand.range(6, 16), ang: rand() * Math.PI,
        amp: SIM.SKY0 * (0.2 + 0.5 * crowd) * rand.range(0.5, 2.2) * glowK * (1 + 0.5 * dist01)
      });
    }
    if (rand() < 0.4) {
      for (let k = 0; k < 40; k++) {
        const x = 12 + rand() * (W - 24), y = 12 + rand() * (H - 24);
        if (!far(x, y, 20)) continue;
        gals.push({ x, y, a: rand.range(4, 8), q: rand.range(0.3, 0.7), ang: rand() * Math.PI, amp: rand.range(14, 40) });
        feats.push('galaxy');
        break;
      }
    }
    let lane = null;
    if (rand() < 0.35) {
      const ang = rand() * Math.PI, nx = -Math.sin(ang), ny = Math.cos(ang);
      const off = (rand() < 0.5 ? -1 : 1) * rand.range(15, 32);
      lane = { ang, c: nx * (tx + nx * off) + ny * (ty + ny * off), nx, ny, w: rand.range(3, 6), depth: rand.range(0.35, 0.65) };
      feats.push('dust');
    }
    // 포화된 별은 세로로 빛이 번진다. 다른 별을 오염시키지 않을 때만.
    const satStar = stars.find((q) => q.role === 'sat');
    if (satStar) satStar.bleed = stars.concat(hidden).every((q) => q === satStar || Math.abs(q.x - satStar.x) >= 9 || Math.abs(q.y - satStar.y) >= 36);
    const hot = [];
    for (let i = 0, n = 4 + Math.floor(rand() * 5); i < n; i++) {
      const p = place(10, 4);
      if (p) hot.push({ x: Math.round(p[0]), y: Math.round(p[1]), amp: rand.range(40, 200) });
    }

    // 이름표: 별 A, B, C, ...
    let li = 0;
    stars.forEach((s) => {
      if (s.role === 'target') s.id = 'TGT';
      else s.id = String.fromCharCode(65 + li++);
    });
    return {
      W, H, stars, hidden, bg, haze, gals, lane, hot, feats,
      glow: SIM.SKY0 * (0.03 + 0.18 * crowd) * rand.range(0.6, 1.2) * (1 + 0.8 * dist01),
      ell: rand.range(0, 0.14), eang: rand() * Math.PI, // 별 모양이 살짝 길쭉한 정도(추적 오차)
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
    vars.forEach((v) => {
      const rho = Math.hypot(v.u - 0.5, v.v - 0.5) / (C.ARM_RMAX * 1.3);
      v.stamp = makeStamp(rand, v, { crowd: Math.exp(-2.2 * Math.min(1.2, rho)), dist: Math.max(0, Math.min(1, (galaxy.mu - 24.4) / 3.2)) });
    });

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

  function addStar(img, W, H, x, y, flux, fwhm, rad, ell, eang) {
    ell = ell || 0;
    const ce = Math.cos(eang || 0), se = Math.sin(eang || 0);
    const beta = 3;
    const alpha = fwhm / (2 * Math.sqrt(Math.pow(2, 1 / beta) - 1));
    const a2 = alpha * alpha;
    const norm = (flux * (beta - 1)) / (Math.PI * a2);
    const x0 = Math.max(0, Math.floor(x - rad)), x1 = Math.min(W - 1, Math.ceil(x + rad));
    const y0 = Math.max(0, Math.floor(y - rad)), y1 = Math.min(H - 1, Math.ceil(y + rad));
    for (let j = y0; j <= y1; j++) {
      for (let i = x0; i <= x1; i++) {
        const dx = i - x, dy = j - y;
        const pa = dx * ce + dy * se, pb = -dx * se + dy * ce;
        const r2 = pa * pa * (1 + ell) + (pb * pb) / (1 + ell);
        const u = 1 + r2 / a2;
        img[j * W + i] += norm / (u * u * u);
      }
    }
  }

  // 시간에 따라 변하지 않는 은하 빛(얼룩·배경 은하·먼지띠)을 한 번만 만들어 둔다
  function buildDiffuse(st) {
    const W = st.W, H = st.H, d = new Float32Array(W * H).fill(st.glow);
    st.haze.forEach((b) => {
      const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const dx = i - b.x, dy = j - b.y;
        const u = (dx * ca + dy * sa) / b.sa, w = (-dx * sa + dy * ca) / b.sb;
        d[j * W + i] += b.amp * Math.exp(-0.5 * (u * u + w * w));
      }
    });
    st.gals.forEach((b) => {
      const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const dx = i - b.x, dy = j - b.y;
        const u = (dx * ca + dy * sa) / b.a, w = (-dx * sa + dy * ca) / (b.a * b.q);
        d[j * W + i] += b.amp * Math.exp(-Math.sqrt(u * u + w * w));
      }
    });
    if (st.lane) {
      const L = st.lane;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const t = (L.nx * i + L.ny * j - L.c) / L.w;
        d[j * W + i] *= 1 - L.depth * Math.exp(-0.5 * t * t);
      }
    }
    return d;
  }

  // 밝은 별의 회절 가시(십자 모양 빛줄기)
  function addSpikes(img, W, H, x, y, flux, ang) {
    const f = 8e-5 * flux;
    for (let k = 0; k < 2; k++) {
      const a = ang + k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      const x0 = Math.max(0, Math.floor(x - 60)), x1 = Math.min(W - 1, Math.ceil(x + 60));
      const y0 = Math.max(0, Math.floor(y - 60)), y1 = Math.min(H - 1, Math.ceil(y + 60));
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
        const dx = i - x, dy = j - y;
        const along = Math.abs(dx * ca + dy * sa), perp = -dx * sa + dy * ca;
        if (along < 2 || Math.abs(perp) > 2.5) continue;
        img[j * W + i] += f * Math.exp(-0.5 * perp * perp / 0.5) / Math.pow(1 + along, 1.3);
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
      addStar(img, W, H, s.x + ep.jx, s.y + ep.jy, fl(starMag(s, ep.t, v)), ep.fwhm, R, st.ell, st.eang);
    });
    st.hidden.forEach((s) => addStar(img, W, H, s.x + ep.jx, s.y + ep.jy, fl(s.mag), ep.fwhm, R, st.ell, st.eang));
    st.bg.forEach((s) => {
      const f = fl(s.mag);
      addStar(img, W, H, s.x + ep.jx, s.y + ep.jy, f, ep.fwhm, s.spike === undefined ? Math.ceil(3 * ep.fwhm) : R, st.ell, st.eang);
      if (s.spike !== undefined) addSpikes(img, W, H, s.x + ep.jx, s.y + ep.jy, f, s.spike);
    });
    st.stars.forEach((s) => { if (s.role === 'sat') addSpikes(img, W, H, s.x + ep.jx, s.y + ep.jy, fl(s.mag), 0.4); });

    st.stars.forEach((q) => {
      if (!q.bleed) return;
      const bx = Math.round(q.x + ep.jx);
      for (let dy = -28; dy <= 28; dy++) {
        const j = Math.round(q.y + ep.jy) + dy;
        if (j < 0 || j >= H) continue;
        for (let di = -1; di <= 1; di++) {
          const i = bx + di;
          if (i >= 0 && i < W) img[j * W + i] += 2.5e4 * tr * Math.exp(-Math.abs(dy) / 14) * (di === 0 ? 1 : 0.35);
        }
      }
    });

    if (!st.diffuse) st.diffuse = buildDiffuse(st);
    const dif = st.diffuse;
    const hotAt = {};
    st.hot.forEach((p) => { hotAt[p.y * W + p.x] = p.amp; });

    const g0 = st.grad[0], g1 = st.grad[1];
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        const sky = ep.sky * (1 + g0 * (i / W - 0.5) + g1 * (j / H - 0.5)) + dif[k] * tr + (hotAt[k] || 0);
        const e = img[k] + sky;
        let val = e + Math.sqrt(e) * rand.gauss() + SIM.READ * rand.gauss();
        if (val > SIM.SAT) val = SIM.SAT;
        img[k] = val;
      }
    }
    // 우주선(cosmic ray): 프레임마다 다른 곳에 찍히는 짧은 밝은 줄. 별에서 멀리 떨어진 곳에만 둔다.
    for (let c = 0, nCr = Math.floor(rand() * 3.5); c < nCr; c++) {
      for (let tries = 0; tries < 12; tries++) {
        const x = 3 + rand() * (W - 6), y = 3 + rand() * (H - 6);
        if (st.stars.some((q) => Math.hypot(q.x + ep.jx - x, q.y + ep.jy - y) < 14)) continue;
        const a = rand() * 6.2832, len = 1 + rand() * 4, amp = 150 + rand() * 1500;
        for (let k = 0; k <= len; k++) {
          const i = Math.round(x + k * Math.cos(a)), j = Math.round(y + k * Math.sin(a));
          if (i >= 0 && i < W && j >= 0 && j < H) img[j * W + i] = Math.min(SIM.SAT, img[j * W + i] + amp * (1 - 0.4 * k / len));
        }
        break;
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
