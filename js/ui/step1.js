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
    const look = gal.look || { bulge: 0.6, dust: 0.5, hii: 0.5, glow: 1 };
    const px = (p) => [sx(p.u), sy(p.v)];
    const pa = (gal.pa * Math.PI) / 180, sq = Math.max(0.28, Math.cos((gal.inc * Math.PI) / 180));
    const AR = C.ARM_RMAX, R0 = 0.03;

    // 빛 덩어리 하나: 은하 평면의 기울기를 따라 납작하게
    function blob(spr, x, y, rad, alpha, flat) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(pa); ctx.scale(1, flat === undefined ? sq : flat);
      ctx.globalAlpha = alpha;
      ctx.drawImage(spr, -rad, -rad, rad * 2, rad * 2);
      ctx.restore();
    }
    // 나선팔 위의 한 점 (r, 팔 번호, 팔 폭 방향 오프셋 dth)
    function onArm(r, arm, dth) { return px(C.spiralProject(gal, r, C.armTheta(gal, r, arm) + dth)); }

    // 배경: 깊은 남색 + 은은한 성운 얼룩 + 색을 띤 배경 별
    const bg = ctx.createRadialGradient(CW / 2, CH / 2, 40, CW / 2, CH / 2, CW * 0.62);
    bg.addColorStop(0, '#0e1740'); bg.addColorStop(1, '#03050f');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
    ctx.globalCompositeOperation = 'lighter';
    const haze = [sprite([70, 60, 150], 128), sprite([40, 90, 150], 128)];
    for (let i = 0; i < 5; i++) {
      const rad = 160 + 140 * rand();
      ctx.globalAlpha = 0.07 + 0.05 * rand();
      ctx.drawImage(haze[i % 2], rand() * CW - rad, rand() * CH - rad, rad * 2, rad * 2);
    }
    ctx.globalAlpha = 1;
    const tint = [[255, 255, 255], [190, 210, 255], [255, 225, 190], [255, 200, 200]];
    for (let i = 0; i < 160; i++) {
      const c = tint[(rand() * tint.length) | 0], rr = 0.5 + 1.1 * rand() * rand() * 2;
      ctx.fillStyle = rgba(c, 0.2 + 0.6 * rand());
      ctx.beginPath(); ctx.arc(rand() * CW, rand() * CH, rr, 0, 6.2832); ctx.fill();
    }
    const glint = sprite([255, 255, 255], 48);
    for (let i = 0; i < 6; i++) {
      const x = rand() * CW, y = rand() * CH;
      ctx.globalAlpha = 0.5; ctx.drawImage(glint, x - 12, y - 12, 24, 24);
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff';
      ctx.fillRect(x - 11, y - 0.5, 22, 1); ctx.fillRect(x - 0.5, y - 11, 1, 22);
    }
    ctx.globalAlpha = 1;

    // 원반 전체의 바탕빛 (바깥으로 갈수록 은은하게 사라짐)
    const Rd = AR * 1.3 * CH * 1.12;
    ctx.save();
    ctx.translate(CW / 2, CH / 2); ctx.rotate(pa); ctx.scale(1, sq);
    const gd = ctx.createRadialGradient(0, 0, 0, 0, 0, Rd);
    gd.addColorStop(0, rgba(mix(gal.arm, gal.core, 0.5), 0.34 * look.glow));
    gd.addColorStop(0.35, rgba(gal.arm, 0.2 * look.glow));
    gd.addColorStop(0.75, rgba(gal.arm, 0.07 * look.glow));
    gd.addColorStop(1, rgba(gal.arm, 0));
    ctx.fillStyle = gd; ctx.beginPath(); ctx.arc(0, 0, Rd, 0, 6.2832); ctx.fill();
    ctx.restore();

    // 나선팔: 안쪽은 노랗고 바깥은 푸르게. 넓고 흐릿한 띠 + 좁고 밝은 능선
    const armSpr = [];
    for (let k = 0; k < 6; k++) armSpr.push(sprite(mix(mix(gal.core, [255, 255, 255], 0.2), gal.arm, k / 5), 64));
    const ridge = sprite(mix(gal.arm, [255, 255, 255], 0.65), 64);
    [0, 1].forEach((arm) => {
      const N = 230;
      for (let i = 0; i < N; i++) {
        const t = i / N, r = R0 + t * (AR - R0);
        const fade = Math.min(1, t * 7) * (1 - 0.72 * t * t);
        const spr = armSpr[Math.min(5, Math.floor((r / (AR * 0.55)) * 5))];
        for (let k = 0; k < 3; k++) {
          const p = onArm(r * (1 + 0.03 * rand.gauss()), arm, rand.gauss() * 0.11);
          blob(spr, p[0], p[1], 10 + 36 * t, 0.085 * fade * look.glow);
        }
        if (i % 2 === 0) {
          const p = onArm(r, arm, rand.gauss() * 0.04);
          blob(ridge, p[0], p[1], 5 + 9 * t, 0.2 * fade);
        }
      }
    });

    // 먼지띠: 팔 안쪽 가장자리를 따라 어두운 줄무늬 (일반 합성)
    ctx.globalCompositeOperation = 'source-over';
    const dust = sprite([3, 5, 14], 64);
    [0, 1].forEach((arm) => {
      const N = 170;
      for (let i = 0; i < N; i++) {
        const t = 0.1 + 0.85 * (i / N), r = R0 + t * (AR - R0);
        const p = onArm(r * (1 + 0.02 * rand.gauss()), arm, -0.17 + rand.gauss() * 0.04);
        blob(dust, p[0], p[1], 5 + 15 * t, 0.2 * look.dust * (1 - 0.5 * t), sq);
      }
    });
    ctx.globalCompositeOperation = 'lighter';

    // 팔을 따라 흩어진 별들 (하나하나는 작은 점)
    for (let i = 0; i < 2600; i++) {
      const r = Math.min(AR, R0 - gal.hr * 0.9 * Math.log(1 - rand() * 0.97));
      const inArm = rand() < 0.72;
      const th = inArm ? C.armTheta(gal, r, rand() < 0.5 ? 0 : 1) + rand.gauss() * 0.2 : rand() * 6.2832;
      const p = px(C.spiralProject(gal, r, th));
      const warm = Math.max(0, 1 - r / 0.12);
      const c = mix([200, 225, 255], [255, 215, 160], warm);
      ctx.fillStyle = rgba(c, 0.25 + 0.65 * rand());
      const s = 0.5 + 1.1 * rand() * rand();
      ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
    }

    // 젊은 별무리와 분홍빛 수소 구름(HII 영역)
    const pink = sprite([255, 120, 175], 64), blue = sprite([170, 205, 255], 64);
    const nHii = Math.round(46 * look.hii);
    for (let i = 0; i < nHii; i++) {
      const t = 0.18 + 0.8 * rand(), r = R0 + t * (AR - R0), arm = rand() < 0.5 ? 0 : 1;
      const p = onArm(r, arm, rand.gauss() * 0.1);
      const rad = 5 + 10 * rand();
      blob(pink, p[0], p[1], rad * 1.6, 0.35 + 0.35 * rand());
      blob(blue, p[0], p[1], rad * 0.8, 0.5 + 0.3 * rand());
    }

    // 중심부(팽대부): 따뜻한 빛의 타원 + 밝은 핵
    const bR = CH * 0.17 * look.bulge + CH * 0.035, bq = 0.55 + 0.45 * sq;
    const warmSpr = sprite(mix(gal.core, [255, 190, 110], 0.4), 128), hotSpr = sprite(mix(gal.core, [255, 255, 255], 0.65), 128);
    blob(warmSpr, CW / 2, CH / 2, bR * 1.5, 0.85, bq);
    blob(warmSpr, CW / 2, CH / 2, bR * 0.9, 0.9, bq);
    blob(hotSpr, CW / 2, CH / 2, bR * 0.5, 0.95, bq);
    blob(hotSpr, CW / 2, CH / 2, bR * 0.2, 1, 1);

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

  function resetDownstream() {
    const S = C.S;
    S.picked = []; S.observed = false; S.comps = {}; S.batchDone = false; S.an = {}; S.incl = {};
    S.calib = false; S.plFit = false; S.ext = false; S.revealed = false;
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
    const cv = h('canvas', { id: 'sil', width: CW, height: CH });
    const btn = h('button', { class: 'primary big' }, '🎲 은하 뽑기');
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
    const cv = h('canvas', { id: 'sil', width: CW, height: CH });
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
    const redo = h('button', { class: 'ghost', onclick: () => C.ask('다른 은하를 다시 뽑을까요? 진행이 초기화됩니다.', () => { resetDownstream(); C.S.galaxyId = null; C.save(); C.go(1); }, '다시 뽑기') }, '🎲 다시 뽑기');

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
