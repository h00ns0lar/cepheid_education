// 5단계: 주기-광도 관계 — 같은 은하의 기울기 + 은하수 보정 세페이드의 영점
(function (g) {
  const C = g.CEPH;
  const h = C.h;

  // 세페이드로 분류한 별들의 (P, 평균 겉보기등급)
  C.cepheidRows = function () {
    const S = C.S;
    return S.picked.filter((id) => S.an[id] && S.an[id].type === 'cepheid').map((id) => {
      const lc = C.getLC(id), P = S.an[id].P;
      const fit = C.fourierFit(lc.t, lc.m, P, 3);
      return { id, P, logP: Math.log10(P), m: fit.meanMag, amp: fit.amp, incl: S.incl[id] !== false };
    });
  };
  C.calibRows = () => C.MW_CALIB.map((c) => {
    const d = 1000 / c.parallax;
    return Object.assign({}, c, { d, M: c.mV - C.muFromDist(d) });
  });
  C.calibRelation = function () {
    const rows = C.calibRows();
    const lr = C.linreg(rows.map((r) => r.logP - 1), rows.map((r) => r.M));
    return { a: lr.slope, b: lr.intercept, rms: lr.rms, sigA: lr.sigSlope };
  };

  C.steps[5] = {
    render(root) {
      const S = C.S;
      C.ensureFrames();
      const rows = C.cepheidRows();
      const inc = () => rows.filter((r) => r.incl);

      const cvApp = h('canvas', { class: 'plot tall' });
      const cvAbs = h('canvas', { class: 'plot tall' });
      const appPlot = new C.Plot(cvApp, { xlabel: 'log P (P: 일)', ylabel: '겉보기등급 ⟨m⟩', invertY: true });
      const absPlot = new C.Plot(cvAbs, { xlabel: 'log P', ylabel: '절대등급 M_V', invertY: true });
      const secA = h('div'), secB = h('div'), secC = h('div');

      if (rows.length < 3) {
        root.append(h('h2', null, '5단계 · 주기-광도 관계'),
          h('div', { class: 'callout bad' }, '세페이드로 분류된 별이 3개 미만이에요. 4단계로 돌아가 분류를 다시 확인해 주세요.'));
        return;
      }

      // ---------- A: 같은 은하의 세페이드 ----------
      function drawA() {
        const use = inc();
        const lr = use.length >= 2 ? C.linreg(use.map((r) => r.logP), use.map((r) => r.m)) : null;
        const yr = C.padRange(rows.map((r) => r.m), 0.15);
        appPlot.begin(0.3, 1.7, yr[0], yr[1]);
        if (lr) appPlot.line([0.3, 1.7], [lr.intercept + lr.slope * 0.3, lr.intercept + lr.slope * 1.7], { color: '#e8890c', dash: [6, 4] });
        appPlot.scatter(rows.map((r) => r.logP), rows.map((r) => r.m), { colors: rows.map((r) => (r.incl ? '#12a36a' : '#9aa8c8')), r: 4.5 });
        rows.forEach((r) => appPlot.text(r.logP, r.m, r.id, { dx: 7, dy: -6, color: '#33456f', font: '11px sans-serif' }));
        secA.innerHTML = '';
        secA.append(
          lr ? h('div', { class: 'kpi' },
            h('div', null, h('div', { class: 'v' }, lr.slope.toFixed(2) + ' ± ' + lr.sigSlope.toFixed(2)), h('div', { class: 'l' }, '기울기 (log P가 1 늘 때 등급 변화)')),
            h('div', null, h('div', { class: 'v' }, lr.rms.toFixed(2)), h('div', { class: 'l' }, '직선에서 흩어진 정도 (등급)')),
            h('div', null, h('div', { class: 'v' }, String(use.length)), h('div', { class: 'l' }, '쓰는 세페이드 수'))) : null,
          h('table', { style: { marginTop: '10px' } },
            h('tr', null, h('th', null, '별'), h('th', null, '주기 P (일)'), h('th', null, 'log P'), h('th', null, '⟨m⟩'), h('th', null, '변화 폭'), h('th', null, '사용')),
            rows.map((r) => h('tr', null, h('td', null, r.id), h('td', { class: 'mono' }, r.P.toFixed(2)), h('td', { class: 'mono' }, r.logP.toFixed(3)), h('td', { class: 'mono' }, r.m.toFixed(2)), h('td', { class: 'mono' }, r.amp.toFixed(2)),
              h('td', null, h('input', { type: 'checkbox', checked: r.incl, onchange: (e) => { r.incl = e.target.checked; S.incl[r.id] = r.incl; S.plFit = false; S.revealed = false; C.save(); drawA(); drawC(); C.refreshNav(); } }))))),
          lr && lr.rms > 0.35 ? h('div', { class: 'callout warn' }, '직선에서 크게 벗어난 점이 있어요. 식쌍성을 세페이드로 잘못 분류했거나 주기를 잘못 잡았을 수 있어요. 표에서 빼 보거나 4단계로 돌아가 확인해 보세요.') : null);
      }

      // ---------- B: 은하수 보정 세페이드 ----------
      function drawB() {
        secB.innerHTML = '';
        if (!S.calib) {
          secB.append(h('p', null, '우리 은하 안의 세페이드는 가까워서, ', h('b', null, '시차'), '(지구가 태양 둘레를 돌며 생기는 별 위치의 작은 어긋남)로 거리를 정확히 알 수 있어요. 거리를 알면 진짜 밝기(절대등급)를 계산할 수 있고, 이 별들이 주기-광도 관계의 "눈금자"가 됩니다.'),
            h('div', { class: 'callout' }, '※ 교육용으로 만든 가상의 자료예요. 실제 세페이드 관측(가이아·허블 우주망원경의 시차 측정)에서 알려진 관계식에 약간의 흩어짐을 더해 만들었어요.'),
            h('button', { class: 'primary', onclick: () => { S.calib = true; C.save(); drawB(); drawC(); } }, '① 시차 → 거리 → 절대등급 계산하기'));
          absPlot.begin(0.3, 1.7, -2, -7);
          absPlot.text(1.0, -4.5, '계산하면 여기에 그려져요', { align: 'center', color: '#6b7da8' });
          return;
        }
        const cr = C.calibRows(), rel = C.calibRelation();
        absPlot.begin(0.3, 1.7, -2, -7.2);
        absPlot.line([0.3, 1.7], [rel.a * (0.3 - 1) + rel.b, rel.a * (1.7 - 1) + rel.b], { color: '#e8890c', w: 2 });
        absPlot.scatter(cr.map((r) => r.logP), cr.map((r) => r.M), { color: '#d6469a', r: 4.5 });
        secB.append(
          h('table', null,
            h('tr', null, h('th', null, '별'), h('th', null, 'P (일)'), h('th', null, '시차 p (밀리각초)'), h('th', null, '거리 d = 1000/p (pc)'), h('th', null, '겉보기 m_V'), h('th', null, 'M = m − 5 log(d/10)')),
            cr.map((r) => h('tr', null, h('td', null, r.name), h('td', { class: 'mono' }, r.P.toFixed(1)), h('td', { class: 'mono' }, r.parallax.toFixed(3)), h('td', { class: 'mono' }, r.d.toFixed(0)), h('td', { class: 'mono' }, r.mV.toFixed(2)), h('td', { class: 'mono' }, r.M.toFixed(2))))),
          h('div', { class: 'formula' }, 'M', h('sub', null, 'V'), ' = ', h('span', { class: 'hl' }, rel.a.toFixed(2)), ' (log P − 1) ', rel.b < 0 ? '− ' : '+ ', h('span', { class: 'hl' }, Math.abs(rel.b).toFixed(2))),
          h('div', { class: 'muted' }, '흩어진 정도 ' + rel.rms.toFixed(2) + ' 등급 · 이것이 주기-광도(P–L) 관계예요. 주기를 알면 절대등급을 알 수 있어요.'));
      }

      // ---------- C: 적용 ----------
      function drawC() {
        secC.innerHTML = '';
        if (!S.calib) { secC.append(h('div', { class: 'muted' }, '먼저 위의 ① 단계를 마치세요.')); return; }
        const rel = C.calibRelation(), use = inc();
        const lrApp = use.length >= 2 ? C.linreg(use.map((r) => r.logP), use.map((r) => r.m)) : null;
        const tbl = h('table', null,
          h('tr', null, h('th', null, '별'), h('th', null, 'P (일)'), h('th', null, '절대등급 M'), h('th', null, '광도 L (태양=1)')),
          use.map((r) => {
            const M = rel.a * (r.logP - 1) + rel.b;
            return h('tr', null, h('td', null, r.id), h('td', { class: 'mono' }, r.P.toFixed(2)), h('td', { class: 'mono' }, M.toFixed(2)), h('td', { class: 'mono' }, Math.round(C.lumSun(M)).toLocaleString('ko-KR') + ' L☉'));
          }));
        secC.append(
          lrApp ? h('div', { class: 'callout ' + (Math.abs(lrApp.slope - rel.a) < 0.7 ? 'good' : 'warn') },
            '이 은하의 기울기 ', h('b', null, lrApp.slope.toFixed(2)), ' vs 우리 은하 자료의 기울기 ', h('b', null, rel.a.toFixed(2)), ' — ',
            Math.abs(lrApp.slope - rel.a) < 0.7 ? '거의 같네요! 주기-광도 관계는 어느 은하에서나 똑같이 통하는 법칙이에요.' : '꽤 다릅니다. 분류나 주기가 잘못된 별이 없는지 확인해 보세요.') : null,
          tbl,
          h('p', { class: 'muted', style: { marginTop: '8px' } }, '주기가 긴 세페이드일수록 훨씬 밝아요 — 태양의 수천~수만 배. 그래서 멀리서도 보입니다.'),
          S.plFit ? h('div', { class: 'callout good' }, '✔ 각 세페이드의 진짜 밝기(광도)를 구했어요. 이제 마지막 6단계에서 거리를 계산합니다.')
            : h('button', { class: 'primary', onclick: () => { S.plFit = true; S.revealed = false; C.save(); drawC(); C.refreshNav(); } }, '② 이 관계를 이 은하의 세페이드에 적용하기'));
      }

      root.append(
        h('h2', null, '5단계 · 주기-광도 관계'),
        h('p', { class: 'lead' }, '1912년 리비트는 소마젤란은하(우리 은하 옆의 작은 은하)의 세페이드들을 살펴보다가, ', h('b', null, '주기가 길수록 더 밝게 보인다'), '는 걸 발견했어요. 같은 은하의 별들은 지구에서 거의 같은 거리에 있으니, 밝게 보이는 별이 진짜로 더 밝은 별이기 때문이에요.'),
        h('div', { class: 'grid cols-2' },
          h('div', { class: 'panel' }, h('h3', null, '① 이 은하의 세페이드: 주기 vs 밝기'), cvApp, secA),
          h('div', { class: 'panel' }, h('h3', null, '② 거리를 아는 세페이드로 "눈금" 만들기'), cvAbs, secB)),
        h('div', { class: 'panel', style: { marginTop: '16px' } }, h('h3', null, '③ 눈금자를 이 은하의 세페이드에 대 보기'), secC),
        h('details', null, h('summary', null, '왜 이렇게 두 단계가 필요한가요?'),
          h('p', null, '이 은하의 세페이드만으로는 "주기가 긴 별이 더 밝다"는 ', h('b', null, '기울기'), '만 알 수 있어요. 거리를 모르니 진짜 밝기가 정확히 얼마인지(', h('b', null, '기준값'), ')는 몰라요. 그래서 거리를 이미 아는 가까운 세페이드로 기준값을 맞춰야 해요. 이게 "우주 거리 사다리"의 첫 번째 계단입니다.')));

      drawA(); drawB(); drawC();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
