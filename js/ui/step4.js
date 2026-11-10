// 4단계: 시계열분석 — Lomb-Scargle 주기도, 위상 중첩, 푸리에 적합, 분류
// 첫 별(V1)은 학생이 직접: 주기를 먼저 어림하고, 주기와 종류를 스스로 정해야 "나머지 자동" 버튼이 열린다.
(function (g) {
  const C = g.CEPH;
  const h = C.h;

  C.steps[4] = {
    render(root) {
      const S = C.S, R = C.ensureFrames();
      const ids = S.picked, first = ids[0];
      let cur = first;
      let Pc = null;          // 슬라이더 중심 주기
      let chal = null;

      const chips = h('div', { class: 'chips' });
      const cvTime = h('canvas', { class: 'plot', style: { height: '200px' } });
      const cvLS = h('canvas', { class: 'plot' });
      const cvFold = h('canvas', { class: 'plot tall' });
      const slider = h('input', { type: 'range' });
      const pnum = h('input', { type: 'number', step: '0.01', style: { width: '90px' } });
      const kpi = h('div', { class: 'kpi' });
      const lsNote = h('div', { class: 'muted', style: { fontSize: '.88rem' } });
      const shapeBox = h('div');
      const classBox = h('div');
      const gateBox = h('div');
      const hintBox = h('div');
      const lockNote = h('div', { class: 'muted', style: { fontSize: '.85rem' } });
      const lockArea = h('div');
      const timePlot = new C.Plot(cvTime, { xlabel: '날짜 (일)', ylabel: '등급', invertY: true });
      const lsPlot = new C.Plot(cvLS, { xlabel: '주기 (일)', ylabel: '주기가 맞는 정도 (LS 파워)', xlog: true });
      const foldPlot = new C.Plot(cvFold, { xlabel: '위상 (0~1이 한 주기, 두 주기를 이어서 그림)', ylabel: '등급', invertY: true });

      const lcOf = () => C.getLC(cur);
      const autoOf = () => C.getAuto(cur);
      const typeOf = (id) => S.an[id] && S.an[id].type;
      const v1Done = () => !!(S.an[first] && S.an[first].P && S.an[first].type);
      const guessed = () => S.pred.p1 !== undefined;
      const gateOn = () => cur === first && !guessed() && !(S.an[first] && S.an[first].P);
      // V1은 학생이 고르기 전까지 자기 어림값(건너뛰면 5일)으로 겹쳐 놓는다. 다른 별은 컴퓨터가 찾은 값으로 시작.
      const curP = () => {
        if (S.an[cur] && S.an[cur].P) return S.an[cur].P;
        if (cur === first) return S.pred.p1 > 0 ? S.pred.p1 : 5;
        return autoOf().P;
      };

      function setP(P, keep) {
        const prev = S.an[cur] || {};
        S.an[cur] = Object.assign({}, prev, { P, howP: '직접' });
        S.plFit = false; S.revealed = false;
        if (!keep) Pc = P;
        C.save();
      }

      function drawChips() {
        chips.innerHTML = '';
        ids.forEach((id) => {
          const ty = typeOf(id);
          chips.append(h('div', { class: 'chip' + (id === cur ? ' cur' : ''), onclick: () => { cur = id; Pc = null; redraw(); if (chal) chal.reset(); } },
            id, h('span', { class: 's' }, ty === 'cepheid' ? '🟢세페이드' : ty === 'eb' ? '⚪식쌍성' : S.an[id] ? '…' : '')));
        });
      }

      // ---------- V1: 주기 어림 먼저 ----------
      function drawGate() {
        gateBox.innerHTML = '';
        if (cur !== first) return;
        if (gateOn()) {
          const nIn = h('input', { type: 'number', min: 1, step: 1, style: { width: '80px' } });
          const pIn = h('input', { type: 'number', min: 1, step: 0.1, style: { width: '90px' } });
          const msg = h('div');
          nIn.addEventListener('input', () => { const n = +nIn.value; if (n > 0) pIn.value = (C.SIM.NIGHTS / n).toFixed(1); });
          gateBox.append(h('div', { class: 'gate-card' },
            h('b', null, '🔎 먼저 어림해 보기'),
            h('p', null, '위 그래프에서 이 별(' + first + ')이 가장 밝아지는 때(점이 위로 몰린 곳)가 90일 동안 몇 번 있나요? 그 횟수로 90일을 나누면 주기를 어림할 수 있어요. 어림해야 아래 주기도와 위상 중첩이 열려요.'),
            h('div', { class: 'row' },
              h('label', { class: 'kv' }, h('span', { class: 'muted' }, '밝아진 횟수'), nIn, h('span', { class: 'muted' }, '번 →')),
              h('label', { class: 'kv' }, h('span', { class: 'muted' }, '어림한 주기'), pIn, h('span', { class: 'muted' }, '일')),
              h('button', { class: 'primary', onclick: () => {
                const v = +pIn.value;
                if (!(v >= 1 && v <= 90)) { msg.innerHTML = ''; msg.append(h('div', { class: 'callout warn' }, '1일에서 90일 사이로 넣어 주세요.')); return; }
                S.pred.p1 = v; C.save(); Pc = null; redraw();
              } }, '어림 제출'),
              h('button', { class: 'ghost', onclick: () => { S.pred.p1 = null; C.save(); Pc = null; redraw(); } }, '모르겠어요, 그냥 보기')),
            msg));
          return;
        }
        if (guessed() && !v1Done()) {
          const best = autoOf().P;
          gateBox.append(S.pred.p1 > 0
            ? h('div', { class: 'callout' }, h('b', null, '내 어림 ' + S.pred.p1.toFixed(1) + '일'), ' · 주기도의 가장 높은 봉우리 ', h('b', null, best.toFixed(1) + '일'), ' (차이 ' + Math.abs((S.pred.p1 / best - 1) * 100).toFixed(0) + '%). 아래 위상 중첩은 내 어림 주기로 겹쳐 놓았어요. 점들이 한 줄로 모이도록 주기를 정해 보세요.')
            : h('div', { class: 'callout' }, '어림을 건너뛰었어요. 아래 위상 중첩은 5일 주기로 겹쳐 놓았어요. 주기도의 봉우리를 눌러 주기를 바꿔 보세요.'));
        }
      }

      // ---------- V1: 힌트 사다리 ----------
      function drawHints() {
        hintBox.innerHTML = '';
        if (cur !== first || v1Done()) return;
        const n = Math.min(3, S.log.hints || 0);
        const P = autoOf().P;
        const hints = [
          '주기도에서 가장 높은 봉우리를 눌러 보세요.',
          '위상 중첩의 점들이 한 줄로 모이면 맞는 주기예요. 아래 "겹침 정도"가 0.12보다 작으면 잘 맞아요.',
          '주기는 대략 ' + Math.floor(P * 0.9) + '~' + Math.ceil(P * 1.1) + '일 사이예요.'
        ];
        hintBox.append(h('div', { class: 'hint-box' },
          hints.slice(0, n).map((t, i) => h('div', null, '💡 힌트 ' + (i + 1) + ': ' + t)),
          n < 3 ? h('button', { class: 'sm', onclick: () => { S.log.hints = n + 1; C.save(); drawHints(); } }, n ? '다음 힌트 보기 (' + (n + 1) + '/3)' : '💡 막히면 힌트 보기 (1/3)') : null));
      }

      // ---------- 자동 버튼 잠금 ----------
      function drawLocks() {
        const ok = v1Done();
        btnAll.disabled = !ok; btnSuggest.disabled = !ok;
        btnAll.textContent = (ok ? '' : '🔒 ') + '나머지 별 주기 자동으로 찾기';
        btnSuggest.textContent = (ok ? '' : '🔒 ') + '나머지 모양 보고 자동 분류';
        btnBest.style.display = cur === first && !ok ? 'none' : '';
        lockNote.textContent = ok ? '🔓 ' + first + '을 직접 끝냈어요. 이제 나머지는 컴퓨터에게 맡길 수 있어요.' : first + '의 주기와 종류를 직접 정하면 자동 버튼이 열려요.';
        lockArea.className = gateOn() ? 'locked-area' : '';
      }

      function redraw() {
        drawChips(); drawGate(); drawHints(); drawLocks();
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
        lsNote.innerHTML = '가장 높은 봉우리(피크)부터 1, 2, 3… 번호가 붙어 있어요. 주황 점선이 지금 쓰는 주기 <b>' + P.toFixed(2) + '일</b>이에요. 봉우리를 클릭하면 그 주기로 바뀝니다.';

        // 위상 중첩
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
          h('div', null, h('div', { class: 'v' }, P.toFixed(2) + ' 일'), h('div', { class: 'l' }, '주기 P (오차 ± ' + perr.toFixed(2) + ')')),
          h('div', null, h('div', { class: 'v' }, disp.toFixed(2)), h('div', { class: 'l' }, '겹침 정도 (작을수록 매끈, 위상 산포)')),
          h('div', null, h('div', { class: 'v' }, fit.amp.toFixed(2) + ' 등급'), h('div', { class: 'l' }, '밝기 변화 폭 (진폭)')),
          h('div', null, h('div', { class: 'v' }, fit.meanMag.toFixed(2)), h('div', { class: 'l' }, '평균 등급 ⟨m⟩')));
        kpi.append(h('div', null, h('span', { class: 'tag ' + good }, good === 'ok' ? '잘 겹쳐요' : good === 'warn' ? '조금 흩어져요' : '주기가 맞지 않아요')));

        // 모양 단서: V1은 종류를 직접 고른 뒤에 확인용으로 보여 준다
        const sm = C.shapeMetrics(fit), sug = C.suggestType(fit), ty = typeOf(cur);
        shapeBox.innerHTML = '';
        if (cur === first && !ty) {
          shapeBox.append(h('div', { class: 'callout' }, '🤔 위상 중첩 곡선의 모양을 보고 이 별이 세페이드인지 직접 골라 보세요. 고르면 컴퓨터의 판정과 비교해 드려요. (세페이드는 빨리 밝아지고 천천히 어두워지는 톱니 모양, 식쌍성은 좌우 대칭으로 뾰족하게 어두워져요)'));
        } else {
          shapeBox.append(h('div', { class: 'callout' },
            h('b', null, '모양 단서: '),
            sm.asym >= 0.1
              ? '곡선이 좌우 비대칭이에요 (급하게 밝아지고 천천히 어두워짐) → 세페이드의 톱니 모양에 가깝습니다.'
              : '곡선이 좌우 대칭이고 뾰족하게 어두워졌다 돌아와요 → 두 별이 서로를 가리는 식쌍성에 가까워요. (식쌍성은 한 바퀴 도는 동안 어두워지는 때가 두 번이라, P × 2 가 진짜 주기일 수 있어요)',
            h('small', { class: 'muted' }, ' (비대칭 정도 ' + sm.asym.toFixed(2) + ')')));
        }

        // 분류 버튼
        classBox.innerHTML = '';
        classBox.append(h('div', { class: 'row' },
          h('b', null, '이 별은?'),
          h('button', { class: ty === 'cepheid' ? 'on' : '', onclick: () => classify('cepheid') }, '🟢 세페이드 변광성'),
          h('button', { class: ty === 'eb' ? 'on' : '', onclick: () => classify('eb') }, '⚪ 세페이드가 아님 (식쌍성 등)')));
        if (ty && ty !== sug) classBox.append(h('div', { class: 'callout warn', style: { marginTop: '8px' } }, '곡선 모양이 다른 쪽에 가깝게 보여요. 위상 중첩 곡선을 다시 살펴보세요.'));
        else if (ty && cur === first) classBox.append(h('div', { class: 'callout good', style: { marginTop: '8px' } }, '👍 컴퓨터의 판정과 같아요! ' + (good === 'ok' ? '주기도 잘 맞아요.' : '그런데 점들이 아직 흩어져 있어요. 주기를 조금 더 다듬어 보세요.')));
      }

      function classify(type) {
        const prev = S.an[cur] || {};
        const P = curP();
        S.an[cur] = Object.assign({}, prev, { P, type, howType: '직접', howP: prev.howP || (cur === first ? '직접' : '자동') });
        S.plFit = false; S.revealed = false;
        C.save(); redraw(); C.refreshNav();
      }

      slider.addEventListener('input', () => { setP(+slider.value, true); redraw(); });
      pnum.addEventListener('change', () => { const v = +pnum.value; if (v > 0.5) { setP(v); redraw(); } });
      lsPlot.onClick((x) => {
        if (gateOn()) return;
        const lc = lcOf(), au = autoOf();
        let P = x;
        const near = au.pg.peaks.find((pk) => Math.abs(pk.period / x - 1) < 0.12);
        if (near) P = near.period;
        P = C.refinePeriod(lc.t, lc.m, P, 0.04);
        setP(P); redraw();
      });

      const btnBest = h('button', { onclick: () => { setP(autoOf().P); redraw(); } }, '가장 높은 봉우리로');
      const btnHalf = h('button', { onclick: () => { setP(curP() / 2); redraw(); } }, 'P ÷ 2');
      const btnDbl = h('button', { onclick: () => { setP(curP() * 2); redraw(); } }, 'P × 2');
      // 자동 버튼: V1을 직접 끝낸 뒤에만, 직접 정한 값은 건드리지 않는다
      const btnAll = h('button', { class: 'primary', onclick: () => {
        ids.forEach((id) => {
          const prev = S.an[id] || {};
          if (prev.howP === '직접') return;
          S.an[id] = Object.assign({}, prev, { P: C.getAuto(id).P, howP: '자동' });
        });
        S.log.autoP = true; S.plFit = false; C.save(); redraw();
      } }, '나머지 별 주기 자동으로 찾기');
      const btnSuggest = h('button', { onclick: () => {
        ids.forEach((id) => {
          const prev = S.an[id] || {};
          if (prev.type) return;
          const lc = C.getLC(id), P = prev.P || C.getAuto(id).P;
          S.an[id] = Object.assign({}, prev, { P, howP: prev.howP || '자동', type: C.suggestType(C.fourierFit(lc.t, lc.m, P, 3)), howType: '자동' });
        });
        S.log.autoType = true; S.plFit = false; C.save(); redraw(); C.refreshNav();
      } }, '나머지 모양 보고 자동 분류');

      chal = C.chal4({ id: () => cur, lc: lcOf, P: curP });

      lockArea.append(
        h('div', { class: 'grid cols-2' },
          h('div', { class: 'panel' },
            h('h3', null, '② 주기도 (Lomb–Scargle): 어떤 주기가 잘 맞을까?'), cvLS, lsNote),
          h('div', { class: 'panel' },
            h('h3', null, '③ 위상 중첩: 한 주기로 겹쳐 보기'), cvFold,
            h('div', { class: 'row', style: { margin: '8px 0' } }, h('span', { class: 'muted' }, '주기를 조금씩 바꾸기'), slider, pnum, h('span', { class: 'muted' }, '일')),
            h('div', { class: 'row' }, btnBest, btnHalf, btnDbl),
            hintBox)),
        h('div', { class: 'panel', style: { marginTop: '20px' } }, kpi, shapeBox, classBox));

      root.append(
        h('h2', null, '4단계 · 시간에 따른 밝기 분석(시계열분석): 주기 찾기'),
        h('p', { class: 'lead' }, '3단계에서 얻은 "시간에 따른 밝기 그래프"(광도곡선)에서 밝기가 되풀이되는 주기를 찾아요. 첫 별 ' + first + '은 직접 풀어 보고, 끝내면 나머지는 컴퓨터에게 맡길 수 있어요.'),
        h('div', { class: 'row', style: { marginBottom: '6px' } }, chips, h('span', { class: 'spacer' }), btnAll, btnSuggest),
        h('div', { style: { textAlign: 'right', marginBottom: '12px' } }, lockNote),
        h('div', { class: 'panel', style: { marginBottom: '20px' } },
          h('h3', null, '① 광도곡선 (시간에 따른 밝기)'), cvTime, gateBox),
        lockArea,
        h('details', null, h('summary', null, '주기도·위상 중첩 읽는 법'),
          h('p', null, h('b', null, '주기도'), ': 가로축은 시험해 본 주기, 세로축은 그 주기로 되풀이되는 물결(사인파)이 자료와 얼마나 잘 맞는지예요. 가장 높은 봉우리가 후보 주기입니다. 밝기 곡선이 톱니 모양이면 진짜 주기의 1/2, 1/3 자리에도 작은 가짜 봉우리가 생겨요.'),
          h('p', null, h('b', null, '위상 중첩'), ': 모든 관측 시각을 "한 주기 중 어디쯤인가(0~1, 위상)"로 바꿔서 한 주기 안에 겹쳐 그려요. 주기가 맞으면 점들이 하나의 매끈한 곡선 위에 모이고, 틀리면 흩어져요. 슬라이더로 주기를 조금씩 바꿔서 점들이 가장 매끈하게 모이는 값을 찾아보세요.'),
          h('p', null, h('b', null, '곡선 맞추기(푸리에 적합)'), ': 주황 곡선은 물결(사인파) 3개를 더해 점들에 맞춘 곡선이에요. 이 곡선에서 평균 등급 ⟨m⟩과 밝기 변화 폭(진폭)을 구해요. 이 ⟨m⟩이 다음 단계에서 쓸 "겉보기등급"입니다.'),
          h('p', null, h('b', null, '세페이드 vs 식쌍성'), ': 세페이드는 톱니 모양(빨리 밝아지고 천천히 어두워짐), 식쌍성은 평평하다가 뾰족하게 어두워지는 좌우 대칭 곡선이에요.')),
        chal.zone);

      redraw();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
