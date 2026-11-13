// 6단계: 포그슨 방정식으로 거리 구하기 + 정답 공개
(function (g) {
  const C = g.CEPH;
  const h = C.h;

  C.steps[6] = {
    render(root) {
      const S = C.S, R = C.world(), gal = R.field.galaxy;
      const rows = C.cepheidRows().filter((r) => r.incl);
      const rel = C.litRelation();
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

      // 별마다 포그슨 방정식으로 거리를 직접 구한다. 첫 별(V1)을 풀면 나머지는 컴퓨터에게 맡길 수 있다.
      // S.log.pog[id] = '직접' | '풀이' | '자동'  (예전 저장분의 S.log.pogson 은 첫 별 기록으로 옮긴다)
      const pog = () => (S.log.pog = S.log.pog || {});
      const peek = () => (S.log.peek = S.log.peek || {}); // 정답과 풀이를 열어 본 별
      const calcDone = () => rows.every((r) => pog()[r.id]);
      if (!calcDone()) S.revealed = false;   // 모든 별을 풀기 전에는 정답을 공개하지 않는다
      const HOW = { '직접': '직접 ✓', '풀이': '풀이 봄', '자동': '자동' };
      let calcCur = null;
      function drawCalc() {
        const P = pog(), firstId = rows[0].id;
        if (!calcCur) calcCur = (rows.find((r) => !P[r.id]) || rows[0]).id;
        const f = rows.find((r) => r.id === calcCur);
        const m = +f.m.toFixed(2), M = +(rel.a * (f.logP - 1) + rel.b).toFixed(2);
        const mu = m - M, dK = C.distFromMu(mu) / 1000;
        const nLeft = rows.filter((r) => !P[r.id]).length, firstDone = !!P[firstId];
        const next = () => { const n = rows.find((r) => !P[r.id]); if (n) calcCur = n.id; };
        const refresh = () => { C.save(); drawCalc(); drawResult(); };
        calcBox.innerHTML = '';

        let body;
        if (P[f.id]) {
          body = h('div', null,
            h('div', { class: 'callout ' + (P[f.id] === '직접' ? 'good' : '') },
              f.id + ': μ = ' + mu.toFixed(2) + ', d = ' + dK.toFixed(1) + ' kpc (' + C.lyKo(dK * 1000 * 3.26156) + ')  ·  ' + (P[f.id] === '직접' ? '직접 풀었어요' : P[f.id] === '풀이' ? '풀이를 보고 넘어갔어요' : '컴퓨터가 계산했어요')),
            P[f.id] !== '직접' ? h('button', { class: 'sm', onclick: () => { delete P[f.id]; refresh(); } }, '직접 다시 풀어 보기') : null);
        } else {
          body = C.quiz([
            { label: '거리 모듈러스 μ = m − M', ans: mu, tol: 0.02, hint: 'm에서 M을 빼요 (M이 음수면 부호에 주의!)', show: mu.toFixed(2) + '  (' + m.toFixed(2) + ' − (' + M.toFixed(2) + '))' },
            { label: '거리 d = 10^((μ + 5) ÷ 5)', unit: 'kpc', ans: dK, tolRel: 0.015, hint: '(μ+5)÷5 를 구해 10의 거듭제곱을 하면 pc 단위 거리가 나와요. 1000으로 나누면 kpc예요', show: dK.toFixed(1) + ' kpc  (= ' + Math.round(dK * 1000).toLocaleString('ko-KR') + ' pc)' }
          ], {
            onGrade: (right, total) => { if (right === total) { P[f.id] = peek()['6:' + f.id] ? '풀이' : '직접'; next(); setTimeout(refresh, 700); } },
            onPeek: () => { peek()['6:' + f.id] = true; C.save(); },
            extra: [h('button', { class: 'ghost', onclick: () => { P[f.id] = '풀이'; refresh(); } }, '모르겠어요, 풀이 보고 넘어가기')],
            solution: [h('p', null, '① μ = ' + m.toFixed(2) + ' − (' + M.toFixed(2) + ') = ' + mu.toFixed(2)),
              h('p', null, '② (μ + 5) ÷ 5 = ' + ((mu + 5) / 5).toFixed(3) + ' → d = 10^' + ((mu + 5) / 5).toFixed(3) + ' = ' + Math.round(dK * 1000).toLocaleString('ko-KR') + ' pc = ' + dK.toFixed(1) + ' kpc')]
          });
        }

        // 4·5단계에서 구한 값 (누르면 그 별을 계산)
        const valTable = h('table', null,
          h('tr', null, h('th', null, '별'), h('th', null, 'm (4단계)'), h('th', null, 'M (5단계)'), h('th', null, '상태')),
          rows.map((r) => h('tr', { class: 'clickable' + (r.id === calcCur ? ' sel' : ''), onclick: () => { calcCur = r.id; drawCalc(); } },
            h('td', null, h('b', null, r.id)), h('td', { class: 'mono' }, r.m.toFixed(2)), h('td', { class: 'mono' }, (rel.a * (r.logP - 1) + rel.b).toFixed(2)),
            h('td', null, HOW[P[r.id]] || '풀기 전'))));

        calcBox.append(
          h('div', { class: 'formula' }, 'm − M = 5 log', h('sub', null, '10'), '(d / 10 pc)', h('br'), h('small', { class: 'muted' }, '⇔  d = 10', h('sup', null, '(m − M + 5)/5'), ' pc')),
          h('p', null, '세페이드마다 m과 M으로 거리를 직접 구해 보세요. 계산기를 써도 좋아요. ', h('b', null, firstId + '을 풀면'), ' 나머지는 컴퓨터에게 맡길 수 있어요. (먼지 보정은 아래에서 따로 해요)'),
          h('div', { class: 'grid cols-2' },
            h('div', null, h('div', { class: 'muted', style: { fontSize: '.85rem', marginBottom: '4px' } }, '앞 단계에서 구한 값 (누르면 그 별을 계산해요)'), valTable),
            h('div', null,
              h('div', { class: 'formula', style: { fontSize: '1.1rem' } }, h('b', null, f.id), ':  μ = ', h('span', { class: 'hl' }, m.toFixed(2)), ' − (', h('span', { class: 'hl' }, M.toFixed(2)), ')'),
              body)),
          h('div', { class: 'auto-row' },
            h('span', { class: 'muted' }, '자동 계산:'),
            h('button', { class: 'sm', disabled: !firstDone || !nLeft, onclick: () => { rows.forEach((r) => { if (!P[r.id]) P[r.id] = '자동'; }); refresh(); } }, '나머지 별 자동으로 계산하기'),
            h('small', { class: 'muted' }, !firstDone ? firstId + '을 직접 풀면 열려요.'
              : nLeft ? '남은 ' + nLeft + '개 별은 직접 풀어도 되고, 컴퓨터에게 맡겨도 돼요.' : '모든 별의 거리를 구했어요.')));
      }

      function drawResult() {
        const r = compute();
        box.innerHTML = '';
        if (!calcDone()) {
          const done = rows.filter((x) => pog()[x.id]).length;
          box.append(h('div', { class: 'panel locked-note' }, '모든 세페이드의 거리를 구하면(직접 또는 자동) 평균 거리를 계산해 줘요. (' + done + ' / ' + rows.length + ' 완료)'));
          chal.refresh();
          return;
        }
        const cv = h('canvas', { class: 'plot' });
        const pl = new C.Plot(cv, { xlabel: 'log P', ylabel: '거리 모듈러스 μ = m − M', invertY: false });
        const tbl = h('table', null,
          h('tr', null, h('th', null, '별'), h('th', null, 'P (일)'), h('th', null, 'm'), h('th', null, 'M'), h('th', null, 'μ = m − M' + (S.ext ? ' − A_V' : '')), h('th', null, '거리 d')),
          r.list.map((x) => h('tr', null, h('td', null, x.id), h('td', { class: 'mono' }, x.P.toFixed(2)), h('td', { class: 'mono' }, x.m.toFixed(2)), h('td', { class: 'mono' }, x.M.toFixed(2)), h('td', { class: 'mono' }, x.mu.toFixed(2)), h('td', { class: 'mono' }, C.distFmt(x.d)))));
        const extChk = h('input', { type: 'checkbox', checked: S.ext, disabled: S.pred.ext === undefined, onchange: (e) => { S.ext = e.target.checked; S.revealed = false; C.save(); drawResult(); C.refreshNav(); } });
        // 먼지 보정을 하면 거리는 어떻게 될까? 먼저 예상한 뒤에 체크할 수 있다
        const muNo = rows.reduce((a, x) => a + x.m - (rel.a * (x.logP - 1) + rel.b), 0) / rows.length;
        const change = (C.distFromMu(muNo - gal.Av) / C.distFromMu(muNo) - 1) * 100;
        const EXT = { far: '멀어진다', near: '가까워진다', same: '그대로' };
        const extPred = S.pred.ext === undefined
          ? h('div', { class: 'predict-box', style: { marginTop: '12px' } },
            h('b', null, '먼저 예상해 보기: 먼지 보정을 하면 거리는 어떻게 될까요?'),
            h('div', { class: 'chips', style: { marginTop: '8px' } },
              Object.keys(EXT).map((k) => h('div', { class: 'chip', onclick: () => { S.pred.ext = k; C.save(); drawResult(); } }, EXT[k]))),
            h('small', { class: 'muted' }, '예상을 고르면 아래 체크박스가 열려요.'))
          : S.ext
            ? h('div', { class: 'callout ' + (S.pred.ext === 'near' ? 'good' : 'warn') },
              (S.pred.ext === 'near' ? '맞아요! ' : '내 예상은 "' + EXT[S.pred.ext] + '"였지만, ') + '먼지 보정을 하니 거리가 ' + Math.abs(change).toFixed(1) + '% 가까워졌어요. 먼지에 가려 어둡게 보이던 만큼(m이 커진 만큼)을 빼 주니, 별이 원래 밝기로 돌아와 더 가깝게 계산된 거예요.')
            : h('div', { class: 'callout' }, '내 예상: "' + EXT[S.pred.ext] + '". 이제 체크박스를 켜서 확인해 보세요.');
        box.append(
          h('div', { class: 'panel' },
            h('h3', null, '별마다 거리 구하기'), tbl,
            h('div', { style: { marginTop: '10px' }, class: 'row' },
              h('label', { class: 'chk' }, extChk, h('span', null, '우주 먼지로 어두워진 만큼(성간소광 A_V = ' + gal.Av.toFixed(2) + ' 등급) 보정하기')),
              h('small', { class: 'muted' }, '실제 연구에서는 별의 색을 이용해 먼지의 영향을 따로 재서 빼 줍니다.')),
            extPred),
          h('div', { class: 'grid cols-2', style: { marginTop: '16px' } },
            h('div', { class: 'panel' }, h('h3', null, '세페이드마다 μ 값이 비슷하게 나오나요?'), cv),
            h('div', { class: 'panel' },
              h('h3', null, '이 은하까지의 거리'),
              h('div', { class: 'kpi' },
                h('div', null, h('div', { class: 'v' }, r.mean.toFixed(2) + ' ± ' + r.sem.toFixed(2)), h('div', { class: 'l' }, '평균 거리 모듈러스 μ')),
                h('div', null, h('div', { class: 'v' }, r.sd.toFixed(2)), h('div', { class: 'l' }, '별마다 값이 흩어진 정도 (등급)'))),
              h('div', { style: { margin: '14px 0' } },
                h('div', { class: 'result-big' }, C.lyKo(r.d * 3.26156)),
                h('div', { class: 'muted' }, '(' + C.pcFmt(r.d) + ') · ± ' + C.distFmt(r.dErr) + ' 계산 오차 범위')),
              S.revealed ? null : h('button', { class: 'primary big', onclick: () => { S.revealed = true; freeze(r); C.save(); drawResult(); C.refreshNav(); } }, '정답 확인하기'))));
        // 차트
        const xr = [0.3, 1.7], yr = C.padRange(r.list.map((x) => x.mu).concat([r.mean - 0.5, r.mean + 0.5]), 0.1);
        pl.begin(xr[0], xr[1], yr[0], yr[1]);
        pl.line(xr, [r.mean, r.mean], { color: '#e07800', dash: [6, 4] });
        pl.scatter(r.list.map((x) => x.logP), r.list.map((x) => x.mu), { color: '#0083c4', r: 4.5 });
        r.list.forEach((x) => pl.text(x.logP, x.mu, x.id, { dx: 7, dy: -6, color: '#2b3445', font: '11px sans-serif' }));

        if (S.revealed) drawReveal(r);
        C.figurize(root);
        chal.refresh();
      }

      // 처음 정답을 확인한 순간의 결과로 등급을 매기고 고정한다 (그 뒤에 값을 바꿔도 등급은 그대로)
      function freeze(r) {
        if (S.result) return;
        const dTrue = C.distFromMu(gal.mu);
        S.result = C.gradeResult({ rows, err: (r.d / dTrue - 1) * 100, dTrue });
      }

      function drawReveal(r) {
        if (!S.result) { freeze(r); C.save(); }
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
          h('h2', null, '정답 공개: ' + gal.short + '까지의 거리'),
          h('div', { class: 'grid cols-3' },
            h('div', { class: 'kpi' }, h('div', null, h('div', { class: 'v' }, C.distFmt(dTrue)), h('div', { class: 'l' }, '실제 거리 (교육용 기준값)'))),
            h('div', { class: 'kpi' }, h('div', null, h('div', { class: 'v' }, C.distFmt(r.d)), h('div', { class: 'l' }, '내가 잰 거리 (' + (S.ext ? '먼지 보정함' : '먼지 보정 안 함') + ')'))),
            h('div', { class: 'kpi' }, h('div', null, h('div', { class: 'v', style: { color: good ? 'var(--green)' : 'var(--accent)' } }, (err >= 0 ? '+' : '') + err.toFixed(1) + '%'), h('div', { class: 'l' }, '오차')))),
          h('p', { style: { marginTop: '10px' } }, good ? '훌륭해요! 오차 10% 안쪽입니다.' : '오차가 조금 커요. 먼지 보정(성간소광)을 켜고 끄며 비교해 보고, 5단계에서 이상한 별을 빼 보세요.',
            ' ' + (S.ext ? '먼지 보정을 끄면' : '먼지 보정을 켜면') + ' 거리는 ' + C.distFmt(other) + ', 오차 ' + (errOther >= 0 ? '+' : '') + errOther.toFixed(1) + '% 가 돼요.'),
          h('div', { class: 'callout' },
            h('b', null, '내 분석 요약 · '), '세페이드 ' + truthC + '개 중 ' + found + '개를 찾았고 · 식쌍성을 세페이드로 잘못 넣은 것 ' + wrong + '개 · 주기를 4% 안으로 맞힌 별 ' + periodOK + '개'),
          h('h3', { style: { marginTop: '16px' } }, '내 등급'),
          C.gradeCard(S.result),
          myRecord(r, dTrue),
          h('p', { class: 'muted' }, gal.fact),
          h('div', { class: 'row' },
            h('button', { onclick: () => window.print() }, '결과 인쇄 / PDF 저장'),
            h('button', { class: 'primary', onclick: () => C.ask('새로운 은하를 뽑아 처음부터 다시 도전할까요?', () => { C.S.galaxyId = null; C.S.picked = []; C.S.observed = false; C.S.comps = {}; C.S.batchDone = false; C.S.an = {}; C.S.incl = {}; C.S.calib = false; C.S.plFit = false; C.S.ext = false; C.S.revealed = false; C.S.pred = {}; C.S.log = {}; C.S.result = null; C.S.time = null; C.save(); C.go(1); }, '도전') }, '다른 은하에 도전'))));
      }

      // 내 기록: 처음 예상과 결과, 직접 한 것 / 컴퓨터에게 맡긴 것
      function myRecord(r, dTrue) {
        const LY = 3.26156, first = S.picked[0], P = S.pred;
        const an = S.picked.map((id) => S.an[id] || {});
        const cnt = (k, v) => an.filter((a) => a[k] === v).length;
        const inc = C.cepheidRows().filter((x) => x.incl);
        const bright = inc.length ? inc.reduce((a, x) => (x.P > a.P ? x : a)).id : null;
        const ox = (ok) => (ok ? ' ✔' : ' ✘');
        const rowsR = [
          ['처음 예상한 거리', P.dist0 ? C.distFmt(P.dist0 / LY) : '예상하지 않았어요'],
          ['내가 잰 거리', C.distFmt(r.d)],
          ['실제 거리', C.distFmt(dTrue)],
          [first + ' 주기: 내 어림 → 최종', (P.p1 > 0 ? P.p1.toFixed(1) + '일' : P.p1 === null ? '건너뜀' : '—') + ' → ' + (S.an[first] && S.an[first].P ? S.an[first].P.toFixed(2) + '일' : '—')],
          ['가장 밝은 별 예상', P.bright ? P.bright + (bright ? ox(P.bright === bright) : '') : P.bright === null ? '건너뜀' : '—'],
          ['먼지 보정 방향 예상', P.ext ? { far: '멀어진다', near: '가까워진다', same: '그대로' }[P.ext] + ox(P.ext === 'near') : '—'],
          ['직접 한 것', first + ' 비교성 고르기 · 주기 ' + cnt('howP', '직접') + '개 · 분류 ' + cnt('howType', '직접') + '개'],
          ['컴퓨터에게 맡긴 것', '나머지 비교성 일괄 처리 · 주기 ' + cnt('howP', '자동') + '개 · 분류 ' + cnt('howType', '자동') + '개'],
          ['포그슨 방정식 계산', (function () { const v = Object.values(pog()); const c = (k) => v.filter((x) => x === k).length; return '직접 ' + c('직접') + '개 · 풀이 ' + c('풀이') + '개 · 자동 ' + c('자동') + '개'; })()],
          ['힌트 사용', (S.log.hints || 0) + '번']
        ];
        return h('div', { class: 'record' },
          h('h3', null, '내 기록'),
          h('table', null, rowsR.map(([k, v]) => h('tr', null, h('td', null, k), h('td', null, v)))),
          h('small', { class: 'muted' }, '다른 은하에 도전할 때는 더 많은 별을 직접 풀어 보세요.'));
      }

      const chal = C.chal6({ list: rows.map((r) => Object.assign({}, r, { M: rel.a * (r.logP - 1) + rel.b })), rel, gal, revealed: () => S.revealed });

      root.append(
        h('h2', null, '6단계 · 포그슨 방정식으로 거리 구하기'),
        h('p', { class: 'lead' }, '이제 마지막입니다. 주기로 구한 진짜 밝기(절대등급 M)와 하늘에서 보이는 밝기(겉보기등급 m)를 비교해, 은하까지의 거리를 계산해요.'),
        h('div', { class: 'panel' }, h('h3', null, '포그슨 방정식으로 직접 계산하기'), calcBox),
        h('div', { style: { height: '16px' } }), box, chal.zone);
      drawCalc(); drawResult();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
