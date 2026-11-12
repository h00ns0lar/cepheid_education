// 1단계: 은하 뽑기 → 은하 그림 위의 변광성 하이라이트 → 관측 대상 선택
(function (g) {
  const C = g.CEPH;
  const h = C.h;
  const CW = 800, CH = 600;
  const cache = {};

  function sx(u) { return CW / 2 + (u - 0.5) * CH; }
  function sy(v) { return v * CH; }

  // 은하를 "그림"으로 - 사진이 아니라 대략적인 모습(원반·나선팔·먼지띠·중심부)을 그린 일러스트.
  // 부드러운 빛 덩어리(스프라이트)를 가산 합성으로 겹쳐 그린다. 팔의 위치는 변광성이 놓이는 곳과 같은 수식을 쓴다.
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  function sprite(col, size) {
    const s = document.createElement('canvas');
    s.width = s.height = size;
    const c = s.getContext('2d'), r = size / 2;
    const gr = c.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.2, rgba(col, 0.6));
    gr.addColorStop(0.5, rgba(col, 0.2)); gr.addColorStop(1, rgba(col, 0));
    c.fillStyle = gr; c.fillRect(0, 0, size, size);
    return s;
  }

  function illustration(gal, seed) {
    const key = gal.id + seed;
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas');
    cv.width = CW; cv.height = CH;
    const ctx = cv.getContext('2d');
    const rand = C.rng(C.hashStr('ill' + key));
    const look = Object.assign({ bulge: 0.6, dust: 0.5, hii: 0.5, glow: 1, spikes: 6, armW: 1, ridge: 1, armA: 1, diskA: 1, hot: 1, warmCol: [255, 215, 160] }, gal.look || {});

    // 배경: 깊은 남색 + 은은한 성운 얼룩 + 색을 띤 배경 별
    const bg = ctx.createRadialGradient(CW / 2, CH / 2, 40, CW / 2, CH / 2, CW * 0.62);
    bg.addColorStop(0, '#0b1233'); bg.addColorStop(1, '#03050d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
    ctx.globalCompositeOperation = 'lighter';
    const haze = [sprite([70, 60, 150], 128), sprite([40, 90, 150], 128)];
    for (let i = 0; i < 5; i++) {
      const rad = 160 + 140 * rand();
      ctx.globalAlpha = 0.05 + 0.04 * rand();
      ctx.drawImage(haze[i % 2], rand() * CW - rad, rand() * CH - rad, rad * 2, rad * 2);
    }
    ctx.globalAlpha = 1;
    // 사진처럼 촘촘한 배경 별 (흰색·푸른색·주황색)
    const tint = [[255, 255, 255], [185, 210, 255], [255, 205, 150], [255, 170, 120]];
    for (let i = 0; i < 900; i++) {
      const c = tint[(rand() * tint.length) | 0], rr = 0.35 + 0.9 * rand() * rand() * rand() * 2;
      ctx.fillStyle = rgba(c, 0.25 + 0.65 * rand());
      ctx.beginPath(); ctx.arc(rand() * CW, rand() * CH, rr, 0, 6.2832); ctx.fill();
    }
    // 우리 은하 안의 밝은 앞쪽 별: 십자 모양 빛줄기
    const glint = sprite([255, 255, 255], 48), glintB = sprite([200, 220, 255], 48);
    for (let i = 0; i < look.spikes; i++) {
      const x = rand() * CW, y = rand() * (CH - 90), big = rand() < 0.4, L = big ? 16 + 14 * rand() : 8 + 6 * rand();
      ctx.globalAlpha = big ? 0.75 : 0.5; ctx.drawImage(rand() < 0.5 ? glint : glintB, x - L * 0.7, y - L * 0.7, L * 1.4, L * 1.4);
      const lg = (x0, y0, x1, y1) => { const gr = ctx.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(220,235,255,0)'); gr.addColorStop(0.5, 'rgba(235,245,255,.9)'); gr.addColorStop(1, 'rgba(220,235,255,0)'); return gr; };
      ctx.globalAlpha = big ? 0.6 : 0.4;
      ctx.fillStyle = lg(x - L, y, x + L, y); ctx.fillRect(x - L, y - 0.6, 2 * L, 1.2);
      ctx.fillStyle = lg(x, y - L, x, y + L); ctx.fillRect(x - 0.6, y - L, 1.2, 2 * L);
    }
    ctx.globalAlpha = 1;

    if (gal.kind === 'irregular') drawIrregular(ctx, rand, gal, look);
    else drawSpiral(ctx, rand, gal, look);

    // 이름표 (아래쪽 어두운 띠 위에)
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const band = ctx.createLinearGradient(0, CH - 110, 0, CH);
    band.addColorStop(0, 'rgba(3,5,15,0)'); band.addColorStop(1, 'rgba(3,5,15,0.85)');
    ctx.fillStyle = band; ctx.fillRect(0, CH - 110, CW, 110);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px sans-serif'; ctx.fillText(gal.name, 24, CH - 48);
    ctx.fillStyle = '#9fb0e0'; ctx.font = '18px sans-serif'; ctx.fillText(gal.where + ' · 그림은 대략적인 모습입니다', 24, CH - 22);
    cache[key] = cv;
    return cv;
  }

  // 빛 덩어리 하나: (ang)만큼 돌리고 (flat)만큼 납작하게
  function blobAt(ctx, spr, x, y, rad, alpha, ang, flat) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1, flat);
    ctx.globalAlpha = alpha;
    ctx.drawImage(spr, -rad, -rad, rad * 2, rad * 2);
    ctx.restore();
  }

  // ---------- 나선은하 (M31, M33, NGC 300) ----------
  function drawSpiral(ctx, rand, gal, look) {
    const px = (p) => [sx(p.u), sy(p.v)];
    const pa = (gal.pa * Math.PI) / 180, sq = Math.max(0.24, Math.cos((gal.inc * Math.PI) / 180));
    const AR = C.ARM_RMAX, R0 = 0.03;
    const blob = (spr, x, y, rad, alpha, flat) => blobAt(ctx, spr, x, y, rad, alpha, pa, flat === undefined ? sq : flat);
    const onArm = (r, arm, dth) => px(C.spiralProject(gal, r, C.armTheta(gal, r, arm) + dth));
    const disk = (r, th) => px(C.spiralProject(gal, r, th));

    // 원반 전체의 바탕빛 (바깥으로 갈수록 은은하게 사라짐)
    const Rd = AR * 1.3 * CH * 1.12;
    ctx.save();
    ctx.translate(CW / 2, CH / 2); ctx.rotate(pa); ctx.scale(1, sq);
    const gd = ctx.createRadialGradient(0, 0, 0, 0, 0, Rd);
    gd.addColorStop(0, rgba(mix(gal.arm, gal.core, 0.5), 0.34 * look.glow * look.diskA));
    gd.addColorStop(0.35, rgba(gal.arm, 0.2 * look.glow * look.diskA));
    gd.addColorStop(0.75, rgba(gal.arm, 0.07 * look.glow * look.diskA));
    gd.addColorStop(1, rgba(gal.arm, 0));
    ctx.fillStyle = gd; ctx.beginPath(); ctx.arc(0, 0, Rd, 0, 6.2832); ctx.fill();
    // 안쪽 원반이 넓게 노르스름한 은하 (안드로메다)
    if (look.warm) {
      const gw = ctx.createRadialGradient(0, 0, 0, 0, 0, Rd * 0.62);
      gw.addColorStop(0, rgba(look.warmCol, Math.min(0.8, 0.42 * look.warm)));
      gw.addColorStop(0.5, rgba(mix(look.warmCol, [200, 150, 120], 0.3), 0.2 * look.warm));
      gw.addColorStop(1, rgba([200, 160, 130], 0));
      ctx.fillStyle = gw; ctx.beginPath(); ctx.arc(0, 0, Rd * 0.62, 0, 6.2832); ctx.fill();
    }
    ctx.restore();

    // 나선팔: 안쪽은 노랗고 바깥은 푸르게. 넓고 흐릿한 띠 + 좁고 밝은 능선
    const armSpr = [];
    for (let k = 0; k < 6; k++) armSpr.push(sprite(mix(mix(gal.core, [255, 255, 255], 0.2), gal.arm, k / 5), 64));
    const ridge = sprite(mix(gal.arm, [255, 255, 255], 0.65), 64);
    const floc = look.floc || 0;
    [0, 1].forEach((arm) => {
      const N = 230;
      for (let i = 0; i < N; i++) {
        const t = i / N, r = R0 + t * (AR - R0);
        const fade = Math.min(1, t * 7) * (1 - 0.72 * t * t);
        const spr = armSpr[Math.min(5, Math.floor((r / (AR * 0.55)) * 5))];
        for (let k = 0; k < 3; k++) {
          const p = onArm(r * (1 + 0.03 * look.armW * rand.gauss()), arm, rand.gauss() * 0.11 * look.armW);
          blob(spr, p[0], p[1], (10 + 36 * t) * (0.6 + 0.4 * look.armW), 0.085 * fade * look.glow * look.armA);
        }
        if (i % 2 === 0 && rand() > 0.45 * floc) {
          const p = onArm(r, arm, rand.gauss() * 0.04);
          blob(ridge, p[0], p[1], 5 + 9 * t, 0.2 * fade * look.ridge * (1 - 0.95 * t * t));
        }
      }
    });
    // 솜털처럼 조각난 팔 (삼각형자리 은하): 원반 곳곳에 짧은 팔 조각
    if (floc) {
      const piece = sprite(mix(gal.arm, [255, 255, 255], 0.5), 64);
      for (let s = 0; s < 70; s++) {
        const r = R0 + (0.15 + 0.8 * rand()) * (AR - R0), th = rand() * 6.2832, len = 0.25 + 0.35 * rand();
        for (let k = 0; k < 10; k++) {
          const rr = r * (1 + 0.15 * (k / 10)), tt = th + len * (k / 10);
          const p = disk(rr, tt);
          blob(piece, p[0], p[1], 6 + 8 * rand(), 0.07 + 0.05 * rand());
        }
      }
    }

    // 먼지띠: 팔 안쪽 가장자리를 따라 어두운 줄무늬 (일반 합성)
    ctx.globalCompositeOperation = 'source-over';
    const dust = sprite([12, 6, 4], 64);
    [0, 1].forEach((arm) => {
      const N = 170;
      for (let i = 0; i < N; i++) {
        if (floc && rand() < 0.55) continue;
        const t = 0.1 + 0.85 * (i / N), r = R0 + t * (AR - R0);
        const p = onArm(r * (1 + 0.02 * rand.gauss()), arm, -0.17 + rand.gauss() * 0.04);
        blob(dust, p[0], p[1], 5 + 15 * t, 0.2 * look.dust * (1 - 0.5 * t), sq);
      }
    });
    if (floc) {
      for (let i = 0; i < 160; i++) {
        const p = disk(R0 + (0.05 + 0.75 * rand()) * (AR - R0), rand() * 6.2832);
        blob(dust, p[0], p[1], 3 + 5 * rand(), 0.25 * look.dust);
      }
    }
    // 중심부를 둘러싼 어두운 먼지 고리 (조각가자리 NGC 300)
    if (look.ring) {
      const rr = 0.085;
      for (let i = 0; i < 90; i++) {
        const p = disk(rr * (1 + 0.18 * rand.gauss()), rand() * 6.2832);
        blob(dust, p[0], p[1], 14 + 12 * rand(), 0.18 * look.ring);
      }
    }
    ctx.globalCompositeOperation = 'lighter';

    // 팔을 따라 흩어진 별들 (하나하나는 작은 점)
    for (let i = 0; i < 3400; i++) {
      const r = R0 - gal.hr * 0.9 * Math.log(1 - rand() * 0.97);
      if (r > AR * (0.9 + 0.2 * rand())) continue;
      const inArm = rand() < 0.72 - 0.3 * floc;
      const th = inArm ? C.armTheta(gal, r, rand() < 0.5 ? 0 : 1) + rand.gauss() * 0.2 : rand() * 6.2832;
      const p = disk(r, th);
      const warm = Math.max(0, 1 - r / (look.warm ? 0.18 : 0.12));
      const c = mix([200, 225, 255], [255, 215, 160], warm);
      ctx.fillStyle = rgba(c, 0.25 + 0.65 * rand());
      const s = 0.5 + 1.1 * rand() * rand();
      ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
    }

    // 젊은 별무리와 분홍빛 수소 구름(HII 영역)
    const pink = sprite([255, 90, 150], 64), blue = sprite([170, 205, 255], 64);
    const nHii = Math.round(46 * look.hii);
    for (let i = 0; i < nHii; i++) {
      const t = 0.18 + 0.8 * rand(), r = R0 + t * (AR - R0);
      const p = floc && rand() < 0.4 ? disk(r, rand() * 6.2832) : onArm(r, rand() < 0.5 ? 0 : 1, rand.gauss() * 0.1);
      const rad = 3 + 7 * rand() * rand();
      blob(pink, p[0], p[1], rad * 1.6, 0.35 + 0.35 * rand(), 1);
      blob(blue, p[0], p[1], rad * 0.8, 0.4 + 0.3 * rand(), 1);
    }
    // 아주 큰 수소 구름 하나 (삼각형자리 은하의 NGC 604)
    if (look.big) {
      const p = onArm(R0 + look.big.r * (AR - R0), look.big.arm, look.big.d);
      blob(pink, p[0], p[1], 34, 0.7, 1); blob(pink, p[0], p[1], 18, 0.8, 1);
      blob(sprite([255, 220, 235], 64), p[0], p[1], 8, 0.9, 1);
    }

    // 중심부(팽대부): 따뜻한 빛의 타원 + 밝은 핵
    const bR = CH * 0.17 * look.bulge + CH * 0.035, bq = 0.55 + 0.45 * sq;
    const warmSpr = sprite(mix(gal.core, [255, 190, 110], 0.4), 128), hotSpr = sprite(mix(gal.core, [255, 255, 255], 0.65), 128);
    blob(warmSpr, CW / 2, CH / 2, bR * 1.5, 0.85, bq);
    blob(warmSpr, CW / 2, CH / 2, bR * 0.9, 0.9, bq);
    blob(hotSpr, CW / 2, CH / 2, bR * 0.5, 0.95 * look.hot, bq);
    blob(hotSpr, CW / 2, CH / 2, bR * 0.2, look.hot, 1);

    // 위성 은하 (안드로메다 곁의 M32·M110): 작고 둥근 노르스름한 빛
    (look.sats || []).forEach((s) => {
      const x = sx(0.5 + s.du), y = sy(0.5 + s.dv), R = s.r * CH;
      const sp = sprite([255, 228, 195], 128);
      blobAt(ctx, sp, x, y, R * 2.2, 0.55, s.ang || 0, s.q);
      blobAt(ctx, sp, x, y, R, 0.8, s.ang || 0, s.q);
      blobAt(ctx, sprite([255, 245, 230], 64), x, y, R * 0.35, 0.9, 0, 1);
    });
  }

  // ---------- 막대가 있는 불규칙은하 (대마젤란 은하) ----------
  function drawIrregular(ctx, rand, gal, look) {
    const L = C.LMC, cs = Math.cos(L.bar.ang), sn = Math.sin(L.bar.ang);
    const P = (u, v) => [sx(u), sy(v)];
    const blob = (spr, x, y, rad, alpha, ang, flat) => blobAt(ctx, spr, x, y, rad, alpha, ang || 0, flat || 1);

    // 둥글고 흐릿한 원반 (가장자리는 푸르스름, 안쪽은 엷은 황갈색)
    const c0 = P(L.disk.u, L.disk.v), Rd = L.disk.R * CH * 1.15;
    const gd = ctx.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], Rd);
    gd.addColorStop(0, rgba([215, 190, 160], 0.26)); gd.addColorStop(0.55, rgba([150, 150, 190], 0.14));
    gd.addColorStop(1, rgba([90, 110, 170], 0));
    ctx.fillStyle = gd; ctx.beginPath(); ctx.arc(c0[0], c0[1], Rd, 0, 6.2832); ctx.fill();

    // 위쪽 활 모양의 푸른 별 생성 지역 (조각조각 뭉친 푸른 빛)
    const blueA = sprite([110, 150, 255], 64), blueB = sprite([170, 200, 255], 64);
    for (let i = 0; i < 520; i++) {
      const a = L.arc.a0 + rand() * (L.arc.a1 - L.arc.a0), R = L.arc.R * (1 + 0.16 * rand.gauss());
      const p = P(L.arc.u + R * Math.cos(a), L.arc.v + R * Math.sin(a) * 0.95);
      blob(rand() < 0.6 ? blueA : blueB, p[0], p[1], 6 + 16 * rand() * rand(), 0.07 + 0.08 * rand());
    }
    // 원반 여기저기 흩어진 푸른 조각
    for (let i = 0; i < 140; i++) {
      const a = rand() * 6.2832, R = L.disk.R * Math.sqrt(rand());
      const p = P(L.disk.u + R * Math.cos(a), L.disk.v + R * Math.sin(a));
      blob(blueA, p[0], p[1], 5 + 10 * rand(), 0.05 + 0.05 * rand());
    }

    // 밝은 막대: 크림색 빛이 길게 뭉친 띠
    const barSpr = sprite([250, 220, 180], 128), barHot = sprite([255, 238, 210], 128);
    const bx = sx(L.bar.u), by = sy(L.bar.v), BL = L.bar.L * CH, BW = L.bar.W * CH;
    blob(sprite([225, 195, 160], 128), bx, by + BW * 0.6, BL * 1.8, 0.55, L.bar.ang, 0.8);
    blob(barSpr, bx, by, BL * 1.35, 0.55, L.bar.ang, 0.45);
    for (let i = 0; i < 260; i++) {
      const t = (rand() * 2 - 1), w = rand.gauss() * 0.7;
      const x = bx + t * BL * cs - w * BW * sn, y = by + t * BL * sn + w * BW * cs;
      blob(rand() < 0.3 ? barHot : barSpr, x, y, 10 + 22 * rand(), 0.05 + 0.06 * (1 - Math.abs(t)), L.bar.ang, 0.7);
    }
    blob(barHot, bx, by, BL * 0.75, 0.18, L.bar.ang, 0.35);

    // 먼지: 막대 위쪽과 타란툴라 성운 둘레의 갈색 그늘
    ctx.globalCompositeOperation = 'source-over';
    const dust = sprite([30, 16, 8], 64);
    for (let i = 0; i < 110; i++) {
      const t = rand() * 2 - 1;
      const x = bx + t * BL * cs + BW * 1.1 * sn * (0.6 + 0.6 * rand()), y = by + t * BL * sn - BW * 1.1 * cs * (0.6 + 0.6 * rand());
      if (t > 0.3 && rand() < 0.7) continue;
      blob(dust, x, y, 4 + 8 * rand(), 0.16 + 0.12 * rand());
    }
    ctx.globalCompositeOperation = 'lighter';

    // 별 하나하나 (막대에 많이, 원반에 고루)
    for (let i = 0; i < 4200; i++) {
      const p = C.irrSample(rand), q = P(p.u + 0.01 * rand.gauss(), p.v + 0.01 * rand.gauss());
      const inBar = Math.abs((p.v - L.bar.v) * cs - (p.u - L.bar.u) * sn) < L.bar.W * 1.2;
      const c = inBar ? mix([255, 235, 200], [255, 255, 255], rand() * 0.5) : mix([190, 215, 255], [255, 255, 255], rand() * 0.5);
      ctx.fillStyle = rgba(c, 0.25 + 0.6 * rand());
      const s = 0.5 + 1.2 * rand() * rand();
      ctx.fillRect(q[0] - s / 2, q[1] - s / 2, s, s);
    }

    // 분홍빛 수소 구름: 활 모양 지역과 막대 끝 둘레
    const pink = sprite([255, 80, 150], 64), white = sprite([255, 235, 245], 64);
    const nH = Math.round(40 * look.hii);
    for (let i = 0; i < nH; i++) {
      let p;
      if (rand() < 0.6) {
        const a = L.arc.a0 + rand() * (L.arc.a1 - L.arc.a0), R = L.arc.R * (1 + 0.12 * rand.gauss());
        p = P(L.arc.u + R * Math.cos(a), L.arc.v + R * Math.sin(a) * 0.95);
      } else {
        const a = rand() * 6.2832, R = L.disk.R * (0.3 + 0.6 * rand());
        p = P(L.disk.u + R * Math.cos(a), L.disk.v + R * Math.sin(a));
      }
      const rad = 3 + 8 * rand() * rand();
      blob(pink, p[0], p[1], rad * 1.7, 0.4 + 0.35 * rand());
      blob(white, p[0], p[1], rad * 0.5, 0.35);
    }
    // 타란툴라 성운 (30 Doradus): 막대 왼쪽 위의 큰 분홍 덩어리
    const tp = P(L.tar.u, L.tar.v);
    for (let i = 0; i < 26; i++) blob(pink, tp[0] + 22 * rand.gauss(), tp[1] + 16 * rand.gauss(), 8 + 16 * rand(), 0.25 + 0.25 * rand());
    blob(pink, tp[0], tp[1], 42, 0.55); blob(blueB, tp[0], tp[1], 22, 0.5); blob(white, tp[0], tp[1], 9, 0.9);
  }

  C.illustration = illustration;

  function resetDownstream() {
    const S = C.S;
    S.picked = []; S.observed = false; S.comps = {}; S.batchDone = false; S.an = {}; S.incl = {};
    S.calib = false; S.plFit = false; S.ext = false; S.revealed = false;
    S.pred = {}; S.log = {};
  }

  C.steps[1] = {
    render(root) {
      const S = C.S;
      if (!S.galaxyId) return renderRoulette(root);
      return renderField(root);
    }
  };

  // 뽑기 전 화면: 어떤 은하인지 알 수 없는 밤하늘
  function mystery(cv) {
    const ctx = cv.getContext('2d');
    const rand = C.rng(C.hashStr('mystery'));
    const bg = ctx.createRadialGradient(CW / 2, CH / 2, 40, CW / 2, CH / 2, CW * 0.62);
    bg.addColorStop(0, '#101a45'); bg.addColorStop(1, '#03050f');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.6 * rand()) + ')';
      ctx.beginPath(); ctx.arc(rand() * CW, rand() * CH, 0.5 + 1.2 * rand(), 0, 6.2832); ctx.fill();
    }
  }

  function renderRoulette(root) {
    const cv = h('canvas', { id: 'sil', width: CW, height: CH, 'data-cap': '' });
    const btn = h('button', { class: 'primary big' }, '은하 뽑기');
    const mask = h('div', { class: 'roulette-mask' }, h('div', null,
      h('div', { class: 'lead', style: { color: '#e8ebf7' } }, '오늘 탐사할 은하를 뽑아 봅시다.'),
      h('small', null, '버튼을 누르면 은하가 하나 정해져요. 그 은하까지의 거리는 마지막에 공개됩니다.'),
      h('div', { style: { marginTop: '14px' } }, btn)));
    root.append(
      h('h2', null, '1단계 · 변광성 찾기'),
      h('p', { class: 'lead' }, '세페이드 변광성은 밝기가 규칙적으로 변하는 별이에요. 은하 속에서 변광성을 찾아 그 밝기 변화를 재면, 그 은하까지의 거리를 알 수 있습니다.'),
      h('div', { class: 'sil-wrap' }, cv, mask));
    mystery(cv);

    btn.onclick = () => {
      const pick = C.GALAXIES[Math.floor(Math.random() * C.GALAXIES.length)];
      resetDownstream();
      C.S.galaxyId = pick.id;
      C.S.seed = 1 + Math.floor(Math.random() * 900000);
      C.save();
      C.go(1);
    };
  }

  function renderField(root) {
    const S = C.S, R = C.world(), gal = R.field.galaxy;
    const vars = R.field.vars;
    const cv = h('canvas', { id: 'sil', width: CW, height: CH, 'data-cap': '은하의 대략적인 모습과 밝기가 변하는 별의 위치 (그림은 실제 사진이 아니에요)' });
    const list = h('div', { class: 'varlist' });
    const count = h('span', { class: 'tag gold' });

    function toggle(id) {
      const k = S.picked.indexOf(id);
      if (k >= 0) S.picked.splice(k, 1); else S.picked.push(id);
      S.picked.sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
      S.observed = false; S.comps = {}; S.batchDone = false; S.an = {};
      S.calib = false; S.plFit = false; S.revealed = false;
      R.frames = {}; R.phot = {}; R.lc = {}; R.an = {};
      C.save(); refreshList(); C.refreshNav();
    }
    function refreshList() {
      list.innerHTML = '';
      vars.forEach((v) => {
        const sel = S.picked.indexOf(v.id) >= 0;
        list.appendChild(h('div', { class: 'varitem' + (sel ? ' sel' : ''), onclick: () => toggle(v.id) },
          h('span', { class: 'dot' }), h('b', null, v.id), h('span', { class: 'muted' }, '밝기가 변하는 별'), h('span', { class: 'spacer' }), sel ? h('span', { class: 'tag gold' }, '관측 대상') : h('span', { class: 'tag' }, '선택')));
      });
      count.textContent = '선택 ' + S.picked.length + ' / ' + vars.length;
    }
    refreshList();

    const selAll = h('button', { onclick: () => { vars.forEach((v) => { if (S.picked.indexOf(v.id) < 0) S.picked.push(v.id); }); S.picked.sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10)); S.observed = false; S.comps = {}; S.batchDone = false; S.an = {}; R.frames = {}; R.phot = {}; R.lc = {}; R.an = {}; C.save(); refreshList(); C.refreshNav(); } }, '모두 선택');
    // 먼저 예상해 보기: 이 은하까지 몇 광년쯤일까? (마지막에 실제 거리와 비교)
    const guessIn = h('input', { type: 'range', min: 4, max: 9, step: 0.05, value: S.pred.dist0 ? Math.log10(S.pred.dist0) : 6.5 });
    const guessLbl = h('b', { style: { fontSize: '1.3rem' } });
    const guessTag = h('span', { class: 'tag' });
    function showGuess() {
      guessLbl.textContent = '약 ' + C.distFmt(Math.pow(10, +guessIn.value) / 3.26156);
      guessTag.className = 'tag' + (S.pred.dist0 ? ' ok' : '');
      guessTag.textContent = S.pred.dist0 ? '내 예상 저장됨' : '슬라이더를 움직여 골라 보세요';
    }
    guessIn.addEventListener('input', () => { S.pred.dist0 = Math.pow(10, +guessIn.value); C.save(); showGuess(); });
    showGuess();
    const predictCard = h('div', { class: 'panel predict', style: { marginTop: '16px' } },
      h('h3', null, '먼저 예상해 보기'),
      h('p', null, '이 은하까지 몇 광년쯤일까요? 감으로 골라 보세요. 마지막 단계에서 내가 잰 거리, 실제 거리와 나란히 비교해 드려요.'),
      h('div', { class: 'row' }, guessLbl, h('span', { class: 'spacer' }), guessTag),
      guessIn,
      h('div', { class: 'row muted', style: { fontSize: '.78rem', justifyContent: 'space-between' } }, ['1만', '10만', '100만', '1000만', '1억', '10억'].map((t) => h('span', null, t))),
      h('small', { class: 'muted' }, '참고: 우리 은하의 지름은 약 10만 광년이에요.'));

    const redo = h('button', { class: 'ghost', onclick: () => C.ask('다른 은하를 다시 뽑을까요? 진행이 초기화됩니다.', () => { resetDownstream(); C.S.galaxyId = null; C.save(); C.go(1); }, '다시 뽑기') }, '다시 뽑기');

    root.append(
      h('h2', null, '1단계 · 변광성 찾기'),
      h('div', { class: 'grid cols-2' },
        h('div', null,
          h('div', { class: 'sil-wrap' }, cv),
          h('p', { class: 'muted', style: { marginTop: '6px' } }, '깜빡이는 고리가 밝기가 변하는 별(변광성)이에요. 클릭해서 관측 대상으로 고르세요.')),
        h('div', null,
          h('div', { class: 'panel' },
            h('h3', null, gal.name),
            h('p', null, gal.where + '. 이 은하까지의 거리는 아직 비밀이에요 — 마지막에 공개됩니다. 그림은 은하의 대략적인 모습이고, 그 위에 ', h('b', null, '밝기가 변하는 별'), '만 골라 표시했습니다.'),
            h('div', { class: 'callout' }, '모든 변광성은 같은 은하 안에 있으니 ', h('b', null, '거의 같은 거리'), '에 있다고 볼 수 있어요. 이게 뒤에서 주기-광도 관계를 찾아내는 열쇠예요.'),
            h('div', { class: 'row' }, count, h('span', { class: 'spacer' }), selAll, redo),
            h('div', { style: { marginTop: '10px' } }, list)),
          predictCard,
          h('details', null, h('summary', null, '왜 변광성이 필요한가요?'),
            h('p', null, '세페이드는 ', h('b', null, '변하는 주기가 길수록 실제로 더 밝다'), '는 규칙(주기-광도 관계)을 따릅니다. 주기는 시간만 재면 알 수 있고, 그러면 진짜 밝기를 알 수 있어요. 진짜 밝기와 하늘에서 보이는 밝기를 비교하면 거리가 나옵니다 — 전구의 와트 수를 알면 불빛이 얼마나 어두워 보이는지로 거리를 아는 것과 같아요.'),
            h('p', null, '이 중에는 세페이드가 아닌 변광성(예: 두 별이 서로를 가리며 밝기가 변하는 식쌍성)도 섞여 있어요. 어느 것이 진짜 세페이드인지는 4단계에서 밝기 그래프(광도곡선)의 모양으로 가려내요.')))));

    // 하이라이트 애니메이션
    const ctx = cv.getContext('2d');
    const base = illustration(gal, S.seed);
    let raf = 0, t0 = performance.now(), hover = null;
    function frame(now) {
      const t = (now - t0) / 1000;
      ctx.drawImage(base, 0, 0);
      vars.forEach((v, i) => {
        const x = sx(v.u), y = sy(v.v);
        const sel = S.picked.indexOf(v.id) >= 0;
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
        const col = sel ? '255,203,71' : '90,209,255';
        const gl = ctx.createRadialGradient(x, y, 0, x, y, 26 + 6 * pulse);
        gl.addColorStop(0, 'rgba(' + col + ',0.9)'); gl.addColorStop(0.25, 'rgba(' + col + ',0.35)'); gl.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, 32, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(' + col + ',' + (0.55 + 0.4 * pulse) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 12 + 4 * pulse, 0, 6.2832); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.2832); ctx.fill();
        ctx.font = (hover === v.id ? 'bold ' : '') + '16px sans-serif'; ctx.textAlign = 'left';
        ctx.fillStyle = sel ? '#ffcb47' : '#cfe9ff';
        ctx.fillText(v.id + (sel ? ' ✓' : ''), x + 18, y - 12);
      });
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    C.onLeave(() => cancelAnimationFrame(raf));

    function hit(e) {
      const r = cv.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * CW, py = ((e.clientY - r.top) / r.height) * CH;
      let best = null, bd = 28;
      vars.forEach((v) => { const d = Math.hypot(sx(v.u) - px, sy(v.v) - py); if (d < bd) { bd = d; best = v.id; } });
      return best;
    }
    cv.addEventListener('click', (e) => { const id = hit(e); if (id) toggle(id); });
    cv.addEventListener('mousemove', (e) => { hover = hit(e); cv.style.cursor = hover ? 'pointer' : 'default'; });
  }
})(typeof window !== 'undefined' ? window : globalThis);
