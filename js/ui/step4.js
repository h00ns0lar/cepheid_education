// 4단계: 시계열분석 — Lomb-Scargle 주기도, 위상 접기, 푸리에 적합, 분류
(function (g) {
  const C = g.CEPH;
  const h = C.h;

  C.steps[4] = {
    render(root) {
      const S = C.S, R = C.ensureFrames();
      const ids = S.picked;
      let cur = ids[0];
      let Pc = null;          // 슬라이더 중심 주기

      const chips = h('div', { class: 'chips' });
      const cvTime = h('canvas', { class: 'plot', style: { height: '190px' } });
      const cvLS = h('canvas', { class: 'plot' });
      const cvFold = h('canvas', { class: 'plot tall' });
      const slider = h('input', { type: 'range' });
      const pnum = h('input', { type: 'number', step: '0.01', style: { width: '90px' } });
      const kpi = h('div', { class: 'kpi' });
      const lsNote = h('div', { class: 'muted', style: { fontSize: '.88rem' } });
      const shapeBox = h('div');
      const classBox = h('div');
      const timePlot = new C.Plot(cvTime, { xlabel: '날짜 (일)', ylabel: '등급 (mag)', invertY: true });
      const lsPlot = new C.Plot(cvLS, { xlabel: '주기 (일)', ylabel: 'LS 파워', xlog: true });
      const foldPlot = new C.Plot(cvFold, { xlabel: '위상 (0~1이 한 주기, 두 주기 겹쳐 그림)', ylabel: '등급 (mag)', invertY: true });

      const lcOf = () => C.getLC(cur);
      const autoOf = () => C.getAuto(cur);
      const curP = () => (S.an[cur] && S.an[cur].P) || autoOf().P;
      const typeOf = (id) => S.an[id] && S.an[id].type;

      function setP(P, keep) {
        const prev = S.an[cur] || {};
        S.an[cur] = Object.assign({}, prev, { P });
        S.plFit = false; S.revealed = false;
        if (!keep) Pc = P;
        C.save();
      }

      function drawChips() {
        chips.innerHTML = '';
        ids.forEach((id) => {
          const ty = typeOf(id);
          chips.append(h('div', { class: 'chip' + (id === cur ? ' cur' : ''), onclick: () => { cur = id; Pc = null; redraw(); } },
            id, h('span', { class: 's' }, ty === 'cepheid' ? '🟢세페이드' : ty === 'eb' ? '⚪식쌍성' : S.an[id] ? '…' : '')));
        });
      }

      function redraw() {
        drawChips();
        const lc = lcOf(), au = autoOf(), P = curP();
        if (Pc == null) Pc = P;
        // 슬라이더 범위 갱신
        slider.min = (Pc * 0.9).toFixed(4); slider.max = (Pc * 1.1).toFixed(4); slider.step = (Pc * 0.0005).toFixed(5);
        slider.value = P; pnum.value = P.toFixed(3);

        const fit = C.fourierFit(lc.t, lc.m, P, 3);
        const disp = C.phaseDispersion(lc.t, lc.m, P, 10);
        const perr = C.periodError(lc.t, fit);

        // 시계열
        const yr = C.padRange(lc.m, 0.15);
        timePlot.begin(0, C.SIM.NIGHTS + 1, yr[0], yr[1]);
        timePlot.scatter(lc.t, lc.m, { color: '#12a36a', err: lc.err });

        // LS
        const pg = au.pg;
        lsPlot.begin(1.5, 60, 0, Math.min(1, Math.max.apply(null, pg.power) * 1.15));
        lsPlot.line(pg.periods, pg.power, { color: '#2563eb', w: 1.4 });
        pg.peaks.slice(0, 5).forEach((pk, i) => {
          const x = lsPlot.X(pk.period), y = lsPlot.Y(pk.power);
          lsPlot.ctx.fillStyle = '#2563eb'; lsPlot.ctx.beginPath(); lsPlot.ctx.arc(x, y, 4, 0, 6.2832); lsPlot.ctx.fill();
          lsPlot.ctx.fillStyle = '#172445'; lsPlot.ctx.font = 'bold 12px sans-serif'; lsPlot.ctx.textAlign = 'center';
          lsPlot.ctx.fillText(String(i + 1), x, y - 8);
        });
        lsPlot.vline(P, { color: '#e8890c', dash: [5, 4], w: 1.5 });
        lsNote.innerHTML = '높은 피크 순서로 번호가 붙어 있어요. 주황 점선이 지금 쓰는 주기 <b>' + P.toFixed(2) + '일</b>. 피크를 클릭하면 그 주기로 바뀝니다.';

        // 위상 접기
        const ph = lc.t.map((t) => { let p = t / P - fit.phase0; p -= Math.floor(p); return p; });
        const xs = [], ys = [], es = [];
        for (let k = 0; k < 2; k++) lc.t.forEach((t, i) => { xs.push(ph[i] + k); ys.push(lc.m[i]); es.push(lc.err[i]); });
        const cx = [], cy = [];
        for (let i = 0; i <= 200; i++) { const x = i / 100; cx.push(x); cy.push(fit.model((x + fit.phase0) * P)); }
        const fr = C.padRange(lc.m.concat(cy), 0.1);
        foldPlot.begin(0, 2, fr[0], fr[1]);
        foldPlot.scatter(xs, ys, { color: '#12a36a', err: es, r: 3 });
        foldPlot.line(cx, cy, { color: '#e8890c', w: 2 });

        const good = disp < 0.12 ? 'ok' : disp < 0.35 ? 'warn' : 'bad';
        kpi.innerHTML = '';
        kpi.append(
          h('div', null, h('div', { class: 'v' }, P.toFixed(2) + ' 일'), h('div', { class: 'l' }, '주기 P ± ' + perr.toFixed(2))),
          h('div', null, h('div', { class: 'v' }, disp.toFixed(2)), h('div', { class: 'l' }, '위상 산포 (작을수록 매끈)')),
          h('div', null, h('div', { class: 'v' }, fit.amp.toFixed(2) + ' mag'), h('div', { class: 'l' }, '진폭 (최대−최소)')),
          h('div', null, h('div', { class: 'v' }, fit.meanMag.toFixed(2)), h('div', { class: 'l' }, '평균 등급 ⟨m⟩')));
        kpi.append(h('div', null, h('span', { class: 'tag ' + good }, good === 'ok' ? '잘 겹쳐요' : good === 'warn' ? '조금 흩어져요' : '주기가 맞지 않아요')));

        // 모양 판정 도움말
        const sm = C.shapeMetrics(fit), sug = C.suggestType(fit);
        shapeBox.innerHTML = '';
        shapeBox.append(h('div', { class: 'callout' },
          h('b', null, '모양 단서: '),
          sm.asym >= 0.1
            ? '곡선이 좌우 비대칭이에요 (급하게 밝아지고 천천히 어두워짐) → 세페이드의 톱니 모양에 가깝습니다.'
            : '곡선이 좌우 대칭이고 날카롭게 어두워졌다 돌아와요 → 별이 서로를 가리는 식쌍성에 가깝습니다. (식쌍성은 한 주기에 어두워짐이 두 번 있어 ×2 주기가 진짜 공전주기일 수 있어요)',
          h('small', { class: 'muted' }, ' (비대칭 지표 ' + sm.asym.toFixed(2) + ')')));

        // 분류 버튼
        const ty = typeOf(cur);
        classBox.innerHTML = '';
        classBox.append(h('div', { class: 'row' },
          h('b', null, '이 별은?'),
          h('button', { class: ty === 'cepheid' ? 'on' : '', onclick: () => classify('cepheid') }, '🟢 세페이드 변광성'),
          h('button', { class: ty === 'eb' ? 'on' : '', onclick: () => classify('eb') }, '⚪ 세페이드가 아님 (식쌍성 등)')));
        if (ty && ty !== sug) classBox.append(h('div', { class: 'callout warn', style: { marginTop: '8px' } }, '곡선 모양이 다른 쪽에 가깝게 보여요. 위상 접기 곡선을 다시 살펴보세요.'));
      }

      function classify(type) {
        const prev = S.an[cur] || {};
        S.an[cur] = Object.assign({}, prev, { P: curP(), type });
        S.plFit = false; S.revealed = false;
        C.save(); redraw(); C.refreshNav();
      }

      slider.addEventListener('input', () => { setP(+slider.value, true); redraw(); });
      pnum.addEventListener('change', () => { const v = +pnum.value; if (v > 0.5) { setP(v); redraw(); } });
      lsPlot.onClick((x) => {
        const lc = lcOf(), au = autoOf();
        let P = x;
        const near = au.pg.peaks.find((pk) => Math.abs(pk.period / x - 1) < 0.12);
        if (near) P = near.period;
        P = C.refinePeriod(lc.t, lc.m, P, 0.04);
        setP(P); redraw();
      });

      const btnBest = h('button', { onclick: () => { setP(autoOf().P); redraw(); } }, 'LS 최고 피크로');
      const btnHalf = h('button', { onclick: () => { setP(curP() / 2); redraw(); } }, 'P ÷ 2');
      const btnDbl = h('button', { onclick: () => { setP(curP() * 2); redraw(); } }, 'P × 2');
      const btnAll = h('button', { class: 'primary', onclick: () => {
        ids.forEach((id) => { const au = C.getAuto(id); const prev = S.an[id] || {}; S.an[id] = Object.assign({}, prev, { P: au.P }); });
        S.plFit = false; C.save(); redraw();
      } }, '전체 별 주기 자동 분석');
      const btnSuggest = h('button', { onclick: () => {
        ids.forEach((id) => {
          const lc = C.getLC(id), P = (S.an[id] && S.an[id].P) || C.getAuto(id).P;
          S.an[id] = Object.assign({}, S.an[id] || {}, { P, type: C.suggestType(C.fourierFit(lc.t, lc.m, P, 3)) });
        });
        S.plFit = false; C.save(); redraw(); C.refreshNav();
      } }, '모양 단서대로 나머지 분류 채우기');

      root.append(
        h('h2', null, '4단계 · 시계열분석: 주기 찾기'),
        h('p', { class: 'lead' }, '차등측광으로 얻은 밝기-시간 그래프에서 반복되는 주기를 찾아요. 관측 간격이 불규칙하기 때문에 Lomb–Scargle 주기도를 씁니다. 그다음 그 주기로 자료를 "접어서" 매끈한 곡선이 되는지 확인해요.'),
        h('div', { class: 'row', style: { marginBottom: '10px' } }, chips, h('span', { class: 'spacer' }), btnAll, btnSuggest),
        h('div', { class: 'grid cols-2' },
          h('div', { class: 'panel' },
            h('h3', null, '① 광도곡선 (차등측광 결과)'), cvTime,
            h('h3', { style: { marginTop: '12px' } }, '② Lomb–Scargle 주기도'), cvLS, lsNote),
          h('div', { class: 'panel' },
            h('h3', null, '③ 위상 접기'), cvFold,
            h('div', { class: 'row', style: { margin: '8px 0' } }, h('span', { class: 'muted' }, '주기 미세조정'), slider, pnum, h('span', { class: 'muted' }, '일')),
            h('div', { class: 'row' }, btnBest, btnHalf, btnDbl))),
        h('div', { class: 'panel', style: { marginTop: '16px' } }, kpi, shapeBox, classBox),
        h('details', null, h('summary', null, '주기도·위상 접기 읽는 법'),
          h('p', null, h('b', null, '주기도'), ': 가로축은 시험해 본 주기, 세로축은 그 주기의 사인파가 자료와 얼마나 잘 맞는지예요. 가장 높은 피크가 후보 주기입니다. 곡선이 사인파가 아닌 톱니 모양이면 주기의 1/2, 1/3 자리에도 작은 피크(조화 피크)가 생겨요.'),
          h('p', null, h('b', null, '위상 접기'), ': 각 관측 시각을 t / P의 소수 부분(위상)으로 바꿔 한 주기 안에 겹쳐 그려요. 주기가 맞으면 점들이 하나의 매끈한 곡선 위에 모이고, 틀리면 흩어집니다. 미세조정 슬라이더로 위상 산포가 최소가 되는 값을 찾아보세요.'),
          h('p', null, h('b', null, '푸리에 적합'), ': 주황 곡선은 사인 3개를 합친 모델로, 곡선의 평균 등급 ⟨m⟩과 진폭을 구하는 데 써요. 이 ⟨m⟩이 다음 단계에서 쓸 "겉보기등급"입니다.'),
          h('p', null, h('b', null, '세페이드 vs 식쌍성'), ': 세페이드는 톱니(급상승·완만 하강), 식쌍성은 대부분 평평하다가 날카롭게 어두워지는 대칭 곡선이에요.')));

      redraw();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
