// 5단계: 주기-광도 관계 — 문헌의 식을 이 은하의 세페이드에 적용. (식을 만드는 과정은 아래 도전 과제)
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
  // 문헌에서 알려진 주기-광도 관계 (교육용 단순화): M_V = a (log P − 1) + b
  C.litRelation = () => ({ a: C.PL.slope, b: C.PL.zp });

  // 도전 과제용: 거리를 아는 가상의 세페이드로 관계를 직접 만들어 본다
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
      const rel = C.litRelation();
      const tblBox = h('div'), applyBox = h('div');

      if (rows.length < 3) {
        root.append(h('h2', null, '5단계 · 주기-광도 관계'),
          h('div', { class: 'callout bad' }, '세페이드로 분류된 별이 3개 미만이에요. 4단계로 돌아가 분류를 다시 확인해 주세요.'));
        return;
      }

      function drawTable() {
        tblBox.innerHTML = '';
        tblBox.append(h('table', null,
          h('tr', null, h('th', null, '별'), h('th', null, '주기 P (일)'), h('th', null, 'log P'), h('th', null, '겉보기등급 ⟨m⟩'), h('th', null, '절대등급 M'), h('th', null, '광도 L (태양=1)'), h('th', null, '사용')),
          rows.map((r) => {
            const M = rel.a * (r.logP - 1) + rel.b;
            return h('tr', null, h('td', null, r.id), h('td', { class: 'mono' }, r.P.toFixed(2)), h('td', { class: 'mono' }, r.logP.toFixed(3)), h('td', { class: 'mono' }, r.m.toFixed(2)),
              h('td', { class: 'mono' }, S.plFit ? M.toFixed(2) : '?'),
              h('td', { class: 'mono' }, S.plFit ? Math.round(C.lumSun(M)).toLocaleString('ko-KR') + ' L☉' : '?'),
              h('td', null, h('input', { type: 'checkbox', checked: r.incl, onchange: (e) => { r.incl = e.target.checked; S.incl[r.id] = r.incl; S.revealed = false; C.save(); chal.refresh(); C.refreshNav(); } })));
          })));
      }

      function drawApply() {
        applyBox.innerHTML = '';
        applyBox.append(
          h('p', { class: 'muted', style: { marginTop: '8px' } }, '주기가 긴 세페이드일수록 훨씬 밝아요 — 태양의 수천~수만 배. 그래서 멀리서도 보입니다. 표의 "사용" 칸에서 이상해 보이는 별은 뺄 수 있어요.'),
          S.plFit ? h('div', { class: 'callout good' }, '✔ 각 세페이드의 진짜 밝기(절대등급과 광도)를 구했어요. 이제 마지막 6단계에서 거리를 계산합니다.')
            : h('button', { class: 'primary', onclick: () => { S.plFit = true; S.revealed = false; C.save(); drawTable(); drawApply(); chal.refresh(); C.refreshNav(); } }, '이 식을 적용해서 절대등급과 광도 구하기'));
      }

      const chal = C.chal5({ rows: inc });

      root.append(
        h('h2', null, '5단계 · 주기-광도 관계'),
        h('p', { class: 'lead' }, '1912년 리비트는 소마젤란은하(우리 은하 옆의 작은 은하)의 세페이드들을 살펴보다가, ', h('b', null, '주기가 길수록 더 밝다'), '는 걸 발견했어요. 같은 은하의 별들은 지구에서 거의 같은 거리에 있으니, 밝게 보이는 별이 진짜로 더 밝은 별이기 때문이에요. 이 관계는 지금 식으로 정리되어 있어요.'),
        h('div', { class: 'panel' },
          h('h3', null, '① 주기-광도 관계 식 (문헌에서 알려진 값)'),
          h('div', { class: 'formula' }, 'M', h('sub', null, 'V'), ' = ', h('span', { class: 'hl' }, rel.a.toFixed(2)), ' (log P − 1) ', rel.b < 0 ? '− ' : '+ ', h('span', { class: 'hl' }, Math.abs(rel.b).toFixed(2))),
          h('p', null, '주기가 10일(log P = 1)인 세페이드의 절대등급은 약 ' + rel.b.toFixed(2) + '등급(태양의 약 ' + (Math.round(C.lumSun(rel.b) / 100) * 100).toLocaleString('ko-KR') + '배)이고, 주기가 10배 길어질 때마다 약 ' + Math.abs(rel.a).toFixed(2) + '등급(약 ' + Math.pow(10, 0.4 * Math.abs(rel.a)).toFixed(0) + '배) 더 밝아져요. 주기만 알면 진짜 밝기를 알 수 있다는 뜻이에요.'),
          h('div', { class: 'callout' }, '※ 허블 우주망원경 등의 시차 관측으로 정한 값을 교육용으로 단순화한 식이에요. 이 식이 어떻게 만들어졌는지는 맨 아래 도전 과제에서 직접 확인해 볼 수 있어요.')),
        h('div', { class: 'panel', style: { marginTop: '16px' } },
          h('h3', null, '② 이 은하의 세페이드에 식 적용하기'),
          h('p', null, '4단계에서 구한 주기 P를 식에 넣으면 절대등급 M이 나와요. 겉보기등급 ⟨m⟩은 하늘에서 보이는 밝기라서 거리에 따라 달라지지만, 절대등급은 별 자체의 진짜 밝기예요.'),
          tblBox, applyBox),
        h('details', null, h('summary', null, '왜 절대등급이 필요한가요?'),
          h('p', null, '같은 전구도 멀리 있으면 어둡게 보이죠. 별의 진짜 밝기(절대등급 M)와 하늘에서 보이는 밝기(겉보기등급 m)를 비교하면 얼마나 멀리 있는지 알 수 있어요. 세페이드는 주기만 재면 M을 알 수 있어서, 먼 은하까지의 거리를 재는 "표준 촛불"로 쓰여요. 이게 "우주 거리 사다리"의 한 계단이에요.')),
        chal.zone);

      drawTable(); drawApply();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
