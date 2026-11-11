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
      const tblBox = h('div'), calcBox = h('div'), predBox = h('div'), doneBox = h('div');

      if (rows.length < 3) {
        root.append(h('h2', null, '5단계 · 주기-광도 관계'),
          h('div', { class: 'callout bad' }, '세페이드로 분류된 별이 3개 미만이에요. 4단계로 돌아가 분류를 다시 확인해 주세요.'));
        return;
      }

      // 별마다 식에 주기를 대입해 절대등급과 광도를 직접 구한다. 첫 별을 풀면 나머지는 컴퓨터에게 맡길 수 있다.
      // S.log.pl[id] = '직접' | '풀이' | '자동'
      const HOW = { '직접': '직접 ✓', '풀이': '풀이 봄', '자동': '자동' };
      const pl = () => (S.log.pl = S.log.pl || {});
      const sync = () => { S.plFit = inc().length > 0 && inc().every((r) => pl()[r.id]); if (!S.plFit) S.revealed = false; C.save(); C.refreshNav(); };
      const vals = (r) => {
        const P2 = +r.P.toFixed(2), lp = Math.log10(P2), M = rel.a * (lp - 1) + rel.b;
        return { P2, lp, M, L: C.lumSun(M) };
      };
      const fmtL = (L) => Math.round(L).toLocaleString('ko-KR');
      let cur = null;

      function drawTable() {
        const P = pl();
        tblBox.innerHTML = '';
        tblBox.append(
          h('h4', { style: { margin: '18px 0 6px' } }, '계산 결과'),
          h('table', null,
            h('tr', null, h('th', null, '별'), h('th', null, '주기 P (일)'), h('th', null, 'log P'), h('th', null, '겉보기등급 ⟨m⟩'), h('th', null, '절대등급 M'), h('th', null, '광도 L (태양=1)'), h('th', null, '사용')),
            rows.map((r) => {
              const v = vals(r), ok = !!P[r.id];
              return h('tr', null, h('td', null, r.id), h('td', { class: 'mono' }, v.P2.toFixed(2)), h('td', { class: 'mono' }, ok ? v.lp.toFixed(3) : '?'), h('td', { class: 'mono' }, r.m.toFixed(2)),
                h('td', { class: 'mono' }, ok ? v.M.toFixed(2) : '?'),
                h('td', { class: 'mono' }, ok ? fmtL(v.L) + ' L☉' : '?'),
                h('td', null, h('input', { type: 'checkbox', checked: r.incl, onchange: (e) => { r.incl = e.target.checked; S.incl[r.id] = r.incl; refresh(); } })));
            })),
          h('p', { class: 'muted', style: { marginTop: '8px' } }, '주기가 긴 세페이드일수록 훨씬 밝아요 — 태양의 수천~수만 배. 그래서 멀리서도 보입니다. "사용" 칸에서 이상해 보이는 별은 뺄 수 있어요.'));
      }

      // 먼저 예상해 보기: 이 중 진짜로 가장 밝은 별은?
      const brightest = () => inc().reduce((a, r) => (r.P > a.P ? r : a));
      function drawPredict() {
        predBox.innerHTML = '';
        const use = inc();
        if (!use.length) return;
        const pick = S.pred.bright;
        if (!S.plFit) {
          if (pick !== undefined) return;
          predBox.append(h('div', { class: 'predict-box' },
            h('b', null, '먼저 예상해 보기: 이 중 진짜로 가장 밝은 별은 어느 것일까요?'),
            h('p', { class: 'muted', style: { margin: '4px 0 8px' } }, '하늘에서 밝게 보이는 별(⟨m⟩이 작은 별)이 진짜로도 밝을까요? 위의 식을 보고 골라 보세요. 고르면 아래에서 직접 계산할 수 있어요.'),
            h('div', { class: 'chips' },
              use.map((r) => h('div', { class: 'chip', onclick: () => { S.pred.bright = r.id; C.save(); drawPredict(); drawCalc(); } }, r.id)),
              h('div', { class: 'chip', style: { opacity: .7 }, onclick: () => { S.pred.bright = null; C.save(); drawPredict(); drawCalc(); } }, '건너뛰기'))));
          return;
        }
        if (pick === undefined) return;
        const b = brightest(), L = fmtL(vals(b).L);
        predBox.append(pick === null
          ? h('div', { class: 'callout' }, '가장 밝은 별은 주기가 가장 긴 ' + b.id + '예요 (태양의 ' + L + '배).')
          : h('div', { class: 'callout ' + (pick === b.id ? 'good' : 'warn') },
            pick === b.id ? '맞아요! 주기가 가장 긴 ' + b.id + '가 태양의 ' + L + '배로 가장 밝아요.'
              : '내가 고른 별은 ' + pick + '. 하지만 가장 밝은 별은 주기가 가장 긴 ' + b.id + '예요 (태양의 ' + L + '배). 주기가 길수록 진짜로 더 밝아요!'));
      }

      function drawCalc() {
        calcBox.innerHTML = '';
        const use = inc();
        if (!use.length) return;
        const P = pl(), firstId = use[0].id;
        if (!cur || !use.find((r) => r.id === cur)) cur = (use.find((r) => !P[r.id]) || use[0]).id;
        const f = use.find((r) => r.id === cur), v = vals(f);
        // 자동 계산 버튼은 맨 아래(drawDone)에 있다
        const next = () => { const n = use.find((r) => !P[r.id]); if (n) cur = n.id; };
        const a = rel.a.toFixed(2), b = rel.b.toFixed(2);

        // 4단계에서 구한 값 (누르면 그 별을 계산)
        const valTable = h('table', null,
          h('tr', null, h('th', null, '별'), h('th', null, '주기 P (4단계)'), h('th', null, '상태')),
          use.map((r) => h('tr', { class: 'clickable' + (r.id === cur ? ' sel' : ''), onclick: () => { cur = r.id; drawCalc(); } },
            h('td', null, h('b', null, r.id)), h('td', { class: 'mono' }, vals(r).P2.toFixed(2) + ' 일'), h('td', null, HOW[P[r.id]] || '풀기 전'))));

        let body;
        if (P[f.id]) {
          body = h('div', null,
            h('div', { class: 'callout ' + (P[f.id] === '직접' ? 'good' : '') },
              f.id + ': log P = ' + v.lp.toFixed(3) + ', M = ' + v.M.toFixed(2) + ', L = 태양의 ' + fmtL(v.L) + '배  ·  ' + (P[f.id] === '직접' ? '직접 풀었어요' : P[f.id] === '풀이' ? '풀이를 보고 넘어갔어요' : '컴퓨터가 계산했어요')),
            P[f.id] !== '직접' ? h('button', { class: 'sm', onclick: () => { delete P[f.id]; refresh(); } }, '직접 다시 풀어 보기') : null);
        } else {
          body = C.quiz([
            { label: 'log P = log₁₀(' + v.P2.toFixed(2) + ')', ans: v.lp, tol: 0.004, hint: '계산기의 log 키로 상용로그를 구해요', show: v.lp.toFixed(3) },
            { label: 'M = ' + a + ' × (log P − 1) + (' + b + ')', ans: v.M, tol: 0.03, hint: '구한 log P에서 1을 빼고 ' + a + '를 곱한 뒤 ' + b + '를 더해요', show: v.M.toFixed(2) },
            { label: '광도 L = 10^(0.4 × (4.83 − M))', unit: '태양의 몇 배', ans: v.L, tolRel: 0.04, hint: '4.83 − M 에 0.4를 곱해서 10의 거듭제곱을 해요 (태양의 절대등급은 4.83)', show: fmtL(v.L) + ' 배' }
          ], {
            onGrade: (right, total) => { if (right === total) { P[f.id] = '직접'; next(); setTimeout(refresh, 700); } },
            extra: [h('button', { class: 'ghost', onclick: () => { P[f.id] = '풀이'; refresh(); } }, '모르겠어요, 풀이 보고 넘어가기')],
            solution: [h('p', null, '① log P = log₁₀(' + v.P2.toFixed(2) + ') = ' + v.lp.toFixed(3)),
              h('p', null, '② M = ' + a + ' × (' + v.lp.toFixed(3) + ' − 1) + (' + b + ') = ' + v.M.toFixed(2)),
              h('p', null, '③ L = 10^(0.4 × (4.83 − (' + v.M.toFixed(2) + '))) = 10^' + (0.4 * (4.83 - v.M)).toFixed(3) + ' ≈ ' + fmtL(v.L) + '배')]
          });
        }

        calcBox.append(h('div', { class: S.pred.bright === undefined ? 'locked-area' : '' },
          h('p', null, '4단계에서 구한 주기를 식에 대입해 절대등급 M과 광도 L을 직접 구해 보세요. 계산기를 써도 좋아요. ', h('b', null, firstId + '을 풀면'), ' 나머지는 컴퓨터에게 맡길 수 있어요.'),
          h('div', { class: 'grid cols-2' },
            h('div', null, h('div', { class: 'muted', style: { fontSize: '.85rem', marginBottom: '4px' } }, '앞 단계에서 구한 값 (누르면 그 별을 계산해요)'), valTable),
            h('div', null,
              h('div', { class: 'formula', style: { fontSize: '1.1rem' } }, h('b', null, f.id), ':  M = ', a, ' × (log ', h('span', { class: 'hl' }, v.P2.toFixed(2)), ' − 1) ', rel.b < 0 ? '− ' : '+ ', Math.abs(rel.b).toFixed(2)),
              body)),
          ));
      }

      function drawDone() {
        doneBox.innerHTML = '';
        const use = inc(), P = pl(), n = use.filter((r) => P[r.id]).length;
        const firstId = use.length ? use[0].id : '', firstDone = !!P[firstId], nLeft = use.length - n;
        doneBox.append(h('div', { class: 'auto-row' },
          h('span', { class: 'muted' }, '자동 계산:'),
          h('button', { class: 'sm', disabled: !firstDone || !nLeft, onclick: () => { use.forEach((r) => { if (!P[r.id]) P[r.id] = '자동'; }); refresh(); } }, '나머지 별 자동으로 계산하기'),
          h('small', { class: 'muted' }, !firstDone ? firstId + '을 직접 풀면 열려요.'
            : nLeft ? '남은 ' + nLeft + '개 별은 직접 풀어도 되고, 컴퓨터에게 맡겨도 돼요.' : '모든 별을 구했어요.')));
        doneBox.append(S.plFit
          ? h('div', { class: 'callout good' }, '✔ 각 세페이드의 진짜 밝기(절대등급과 광도)를 구했어요. 이제 마지막 6단계에서 거리를 계산합니다.')
          : h('div', { class: 'muted', style: { marginTop: '8px' } }, '진행: ' + n + ' / ' + use.length + ' 별 완료'));
      }

      function refresh() { sync(); drawPredict(); drawCalc(); drawTable(); drawDone(); chal.refresh(); }

      const chal = C.chal5({ rows: inc });

      root.append(
        h('h2', null, '5단계 · 주기-광도 관계'),
        h('p', { class: 'lead' }, '1912년 리비트는 소마젤란은하(우리 은하 옆의 작은 은하)의 세페이드들을 살펴보다가, ', h('b', null, '주기가 길수록 더 밝다'), '는 걸 발견했어요. 같은 은하의 별들은 지구에서 거의 같은 거리에 있으니, 밝게 보이는 별이 진짜로 더 밝은 별이기 때문이에요. 이 관계는 지금 식으로 정리되어 있어요.'),
        h('div', { class: 'panel' },
          h('h3', null, '① 주기-광도 관계 식 (문헌에서 알려진 값)'),
          h('div', { class: 'formula' }, 'M', h('sub', null, 'V'), ' = ', h('span', { class: 'hl' }, rel.a.toFixed(2)), ' (log P − 1) ', rel.b < 0 ? '− ' : '+ ', h('span', { class: 'hl' }, Math.abs(rel.b).toFixed(2)), h('br'), h('small', { class: 'muted' }, '광도 L = 10^(0.4 × (4.83 − M))  (태양 = 1, 태양의 절대등급 4.83)')),
          h('p', null, '주기가 10일(log P = 1)인 세페이드의 절대등급은 약 ' + rel.b.toFixed(2) + '등급(태양의 약 ' + (Math.round(C.lumSun(rel.b) / 100) * 100).toLocaleString('ko-KR') + '배)이고, 주기가 10배 길어질 때마다 약 ' + Math.abs(rel.a).toFixed(2) + '등급(약 ' + Math.pow(10, 0.4 * Math.abs(rel.a)).toFixed(0) + '배) 더 밝아져요. 주기만 알면 진짜 밝기를 알 수 있다는 뜻이에요.'),
          h('div', { class: 'callout' }, '※ 허블 우주망원경 등의 시차 관측으로 정한 값을 교육용으로 단순화한 식이에요. 이 식이 어떻게 만들어졌는지는 맨 아래 도전 과제에서 직접 확인해 볼 수 있어요.')),
        h('div', { class: 'panel', style: { marginTop: '16px' } },
          h('h3', null, '② 이 은하의 세페이드에 식 대입하기'),
          predBox, calcBox, tblBox, doneBox),
        h('details', null, h('summary', null, '왜 절대등급이 필요한가요?'),
          h('p', null, '같은 전구도 멀리 있으면 어둡게 보이죠. 별의 진짜 밝기(절대등급 M)와 하늘에서 보이는 밝기(겉보기등급 m)를 비교하면 얼마나 멀리 있는지 알 수 있어요. 세페이드는 주기만 재면 M을 알 수 있어서, 먼 은하까지의 거리를 재는 "표준 촛불"로 쓰여요. 이게 "우주 거리 사다리"의 한 계단이에요.')),
        chal.zone);

      sync(); drawPredict(); drawCalc(); drawTable(); drawDone();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
