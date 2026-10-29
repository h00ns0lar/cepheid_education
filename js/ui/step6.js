// 6단계: 포그슨 방정식으로 거리 구하기 + 정답 공개
(function (g) {
  const C = g.CEPH;
  const h = C.h;

  C.steps[6] = {
    render(root) {
      const S = C.S, R = C.world(), gal = R.field.galaxy;
      const rows = C.cepheidRows().filter((r) => r.incl);
      const rel = C.calibRelation();
      if (rows.length < 3) {
        root.append(h('h2', null, '6단계 · 거리 계산'), h('div', { class: 'callout bad' }, '사용할 세페이드가 3개 미만이에요. 5단계에서 확인해 주세요.'));
        return;
      }
      const box = h('div');
      const calcBox = h('div');

      function compute() {
        const A = S.ext ? gal.Av : 0;
        const list = rows.map((r) => {
          const M = rel.a * (r.logP - 1) + rel.b;
          const mu = r.m - A - M;
          return Object.assign({}, r, { M, mu, d: C.distFromMu(mu) });
        });
        const n = list.length;
        const mean = list.reduce((a, r) => a + r.mu, 0) / n;
        const sd = Math.sqrt(list.reduce((a, r) => a + Math.pow(r.mu - mean, 2), 0) / (n - 1));
        const sem = sd / Math.sqrt(n);
        const d = C.distFromMu(mean);
        return { list, mean, sd, sem, d, dErr: d * Math.LN10 / 5 * sem, A };
      }

      function drawCalc() {
        const f = rows[0];
        const M0 = rel.a * (f.logP - 1) + rel.b;
        const mIn = h('input', { type: 'number', step: '0.01', value: f.m.toFixed(2), style: { width: '90px' } });
        const MIn = h('input', { type: 'number', step: '0.01', value: M0.toFixed(2), style: { width: '90px' } });
        const out = h('div', { class: 'formula' });
        function upd() {
          const mu = +mIn.value - +MIn.value, d = C.distFromMu(mu);
          out.innerHTML = '';
          out.append('μ = m − M = ' + (+mIn.value).toFixed(2) + ' − (' + (+MIn.value).toFixed(2) + ') = ', h('span', { class: 'hl' }, mu.toFixed(2)), h('br'),
            'd = 10', h('sup', null, '(μ+5)/5'), ' pc = ', h('span', { class: 'hl' }, C.pcFmt(d)), ' ≈ ' + C.lyFmt(d));
        }
        mIn.oninput = upd; MIn.oninput = upd;
        calcBox.innerHTML = '';
        calcBox.append(
          h('div', { class: 'formula' }, 'm − M = 5 log', h('sub', null, '10'), '(d / 10 pc)', h('br'), h('small', { class: 'muted' }, '⇔  d = 10', h('sup', null, '(m − M + 5)/5'), ' pc')),
          h('div', { class: 'row' }, h('span', null, '겉보기등급 m'), mIn, h('span', null, '절대등급 M'), MIn, h('small', { class: 'muted' }, '(' + f.id + ' 의 값이 채워져 있어요. 바꿔 보세요!)')), out);
        upd();
      }

      function drawResult() {
        const r = compute();
        box.innerHTML = '';
        const cv = h('canvas', { class: 'plot' });
        const pl = new C.Plot(cv, { xlabel: 'log P', ylabel: '거리 모듈러스 μ = m − M', invertY: false });
        const tbl = h('table', null,
          h('tr', null, h('th', null, '별'), h('th', null, 'P (일)'), h('th', null, 'm'), h('th', null, 'M'), h('th', null, 'μ = m − M' + (S.ext ? ' − A_V' : '')), h('th', null, '거리 d')),
          r.list.map((x) => h('tr', null, h('td', null, x.id), h('td', { class: 'mono' }, x.P.toFixed(2)), h('td', { class: 'mono' }, x.m.toFixed(2)), h('td', { class: 'mono' }, x.M.toFixed(2)), h('td', { class: 'mono' }, x.mu.toFixed(2)), h('td', { class: 'mono' }, C.pcFmt(x.d)))));
        const extChk = h('input', { type: 'checkbox', checked: S.ext, onchange: (e) => { S.ext = e.target.checked; S.revealed = false; C.save(); drawResult(); C.refreshNav(); } });
        box.append(
          h('div', { class: 'panel' },
            h('h3', null, '별마다 거리 구하기'), tbl,
            h('div', { style: { marginTop: '10px' }, class: 'row' },
              h('label', { class: 'chk' }, extChk, h('span', null, '우주 먼지로 어두워진 만큼(성간소광 A_V = ' + gal.Av.toFixed(2) + ' 등급) 보정하기')),
              h('small', { class: 'muted' }, '먼지가 별빛을 가리면 별이 더 어둡게 보여서(m이 커져서) 실제보다 멀게 계산돼요. 실제 연구에서는 별의 색을 이용해 먼지의 영향을 따로 재서 빼 줍니다.'))),
          h('div', { class: 'grid cols-2', style: { marginTop: '16px' } },
            h('div', { class: 'panel' }, h('h3', null, '세페이드마다 μ 값이 비슷하게 나오나요?'), cv),
            h('div', { class: 'panel' },
              h('h3', null, '이 은하까지의 거리'),
              h('div', { class: 'kpi' },
                h('div', null, h('div', { class: 'v' }, r.mean.toFixed(2) + ' ± ' + r.sem.toFixed(2)), h('div', { class: 'l' }, '평균 거리 모듈러스 μ')),
                h('div', null, h('div', { class: 'v' }, r.sd.toFixed(2)), h('div', { class: 'l' }, '별마다 값이 흩어진 정도 (등급)'))),
              h('div', { style: { margin: '14px 0' } },
                h('div', { class: 'result-big' }, C.pcFmt(r.d)),
                h('div', { class: 'muted' }, '± ' + C.pcFmt(r.dErr) + ' (계산 오차 범위) · 약 ' + C.lyFmt(r.d))),
              S.revealed ? null : h('button', { class: 'primary big', onclick: () => { S.revealed = true; C.save(); drawResult(); C.refreshNav(); } }, '🎯 정답 확인하기'))));
        // 차트
        const xr = [0.3, 1.7], yr = C.padRange(r.list.map((x) => x.mu).concat([r.mean - 0.5, r.mean + 0.5]), 0.1);
        pl.begin(xr[0], xr[1], yr[0], yr[1]);
        pl.line(xr, [r.mean, r.mean], { color: '#e8890c', dash: [6, 4] });
        pl.scatter(r.list.map((x) => x.logP), r.list.map((x) => x.mu), { color: '#12a36a', r: 4.5 });
        r.list.forEach((x) => pl.text(x.logP, x.mu, x.id, { dx: 7, dy: -6, color: '#33456f', font: '11px sans-serif' }));

        if (S.revealed) drawReveal(r);
      }

      function drawReveal(r) {
        const dTrue = C.distFromMu(gal.mu);
        const other = (function () {
          const A = S.ext ? 0 : gal.Av;
          const mus = r.list.map((x) => x.m - A - x.M);
          const m = mus.reduce((a, b) => a + b, 0) / mus.length;
          return C.distFromMu(m);
        })();
        const err = (r.d / dTrue - 1) * 100, errOther = (other / dTrue - 1) * 100;
        const field = R.field;
        const truthC = field.vars.filter((v) => v.type === 'cepheid').length;
        const found = S.picked.filter((id) => S.an[id] && S.an[id].type === 'cepheid' && C.varById(id).type === 'cepheid').length;
        const wrong = S.picked.filter((id) => S.an[id] && S.an[id].type === 'cepheid' && C.varById(id).type !== 'cepheid').length;
        const periodOK = C.cepheidRows().filter((x) => Math.abs(x.P / C.varById(x.id).P - 1) < 0.04).length;
        const good = Math.abs(err) < 10;
        box.append(h('div', { class: 'panel', style: { marginTop: '16px', borderColor: good ? 'var(--green)' : 'var(--accent)' } },
          h('h2', null, '🎉 정답 공개: ' + gal.short + '까지의 거리'),
          h('div', { class: 'grid cols-3' },
            h('div', { class: 'kpi' }, h('div', null, h('div', { class: 'v' }, C.pcFmt(dTrue)), h('div', { class: 'l' }, '실제 거리 (교육용 기준값)'))),
            h('div', { class: 'kpi' }, h('div', null, h('div', { class: 'v' }, C.pcFmt(r.d)), h('div', { class: 'l' }, '내가 잰 거리 (' + (S.ext ? '먼지 보정함' : '먼지 보정 안 함') + ')'))),
            h('div', { class: 'kpi' }, h('div', null, h('div', { class: 'v', style: { color: good ? 'var(--green)' : 'var(--accent)' } }, (err >= 0 ? '+' : '') + err.toFixed(1) + '%'), h('div', { class: 'l' }, '오차')))),
          h('p', { style: { marginTop: '10px' } }, good ? '훌륭해요! 오차 10% 안쪽입니다.' : '오차가 조금 커요. 먼지 보정(성간소광)을 켜고 끄며 비교해 보고, 5단계에서 이상한 별을 빼 보세요.',
            ' ' + (S.ext ? '먼지 보정을 끄면' : '먼지 보정을 켜면') + ' 거리는 ' + C.pcFmt(other) + ' (오차 ' + (errOther >= 0 ? '+' : '') + errOther.toFixed(1) + '%) 가 돼요.'),
          h('div', { class: 'callout' },
            h('b', null, '내 분석 성적표 · '), '세페이드 ' + truthC + '개 중 ' + found + '개를 찾았고 · 식쌍성을 세페이드로 잘못 넣은 것 ' + wrong + '개 · 주기를 4% 안으로 맞힌 별 ' + periodOK + '개'),
          h('p', { class: 'muted' }, gal.fact),
          h('div', { class: 'row' },
            h('button', { onclick: () => window.print() }, '🖨 결과 인쇄 / PDF 저장'),
            h('button', { class: 'primary', onclick: () => C.ask('새로운 은하를 뽑아 처음부터 다시 도전할까요?', () => { C.S.galaxyId = null; C.S.picked = []; C.S.observed = false; C.S.comps = {}; C.S.batchDone = false; C.S.an = {}; C.S.incl = {}; C.S.calib = false; C.S.plFit = false; C.S.ext = false; C.S.revealed = false; C.save(); C.go(1); }, '도전') }, '🎲 다른 은하에 도전'))));
      }

      root.append(
        h('h2', null, '6단계 · 포그슨 방정식으로 거리 구하기'),
        h('p', { class: 'lead' }, '이제 마지막입니다. 주기로 구한 진짜 밝기(절대등급 M)와 하늘에서 보이는 밝기(겉보기등급 m)를 비교해, 은하까지의 거리를 계산해요.'),
        h('div', { class: 'panel' }, h('h3', null, '포그슨 방정식 계산기'), calcBox),
        h('div', { style: { height: '16px' } }), box);
      drawCalc(); drawResult();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
