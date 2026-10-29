// 도전 과제(+난이도): 각 단계 아래에 놓이는 선택 과제. 자동으로 해 주는 부분을 학생이 직접 계산해 보는 계산기들.
// 건너뛰어도 다음 단계로 갈 수 있다.
(function (g) {
  const C = g.CEPH;
  const h = C.h;

  const num = (value, step, w) => h('input', { type: 'number', step: String(step || 'any'), value: String(value), style: { width: (w || 90) + 'px' } });
  const field = (label, el, unit) => h('label', { class: 'kv' }, h('span', { class: 'muted' }, label), el, unit ? h('span', { class: 'muted' }, unit) : null);
  const frac = (x) => x - Math.floor(x);
  const kpi = (items) => h('div', { class: 'kpi' }, items.map(([v, l]) => h('div', null, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l))));
  const note = (kind, text) => h('div', { class: 'callout ' + kind }, text);

  // 접히는 도전 과제 하나. 캔버스가 있는 과제는 펼칠 때 그린다(닫힌 상태에서는 크기를 알 수 없다).
  C.chal = function (title, body, onOpen) {
    const d = h('details', { class: 'chal' }, h('summary', null, title), h('div', { class: 'chal-body' }, body));
    if (onOpen) d.addEventListener('toggle', () => { if (d.open) onOpen(); });
    return d;
  };
  C.chalZone = (items) => h('section', { class: 'chal-zone' },
    h('h3', null, '⭐ 도전 과제 (+난이도)'),
    h('p', { class: 'muted' }, '위에서 자동으로 해 준 일을 이번엔 직접 해 보는 선택 과제예요. 건너뛰어도 다음 단계로 갈 수 있어요.'),
    items);

  // ---------------------------------------------------------------- 2단계
  C.chal2 = function (sched) {
    const T = C.SIM.NIGHTS, ts = sched.epochs.map((e) => e.t), n = ts.length;
    const pIn = num(12, 0.1);
    const cv = h('canvas', { style: { width: '100%', height: '70px', display: 'block', background: '#f6f9ff', border: '1px solid var(--line)', borderRadius: '8px' } });
    const out = h('div');
    const reveal = h('details', null, h('summary', null, '정답 보기'),
      h('p', null, '촬영이 밤마다 한 번씩만 이루어지기 때문이에요. 주기가 정확히 1일(또는 2일, 3일…)이면 매번 주기의 같은 지점에서만 사진을 찍게 되어, 밝기 변화의 나머지 부분을 영영 못 봐요. 이렇게 촬영 간격 때문에 진짜 모습을 못 보거나 다른 주기로 착각하는 현상을 ', h('b', null, '앨리어싱'), '이라고 해요. 그래서 이 사이트는 촬영 간격을 일부러 불규칙하게 했어요.'));

    function drawStrip(ph) {
      const w = cv.clientWidth || 600, hh = 70, dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
      const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const x0 = 16, x1 = w - 16;
      c.strokeStyle = '#9db0d6'; c.fillStyle = '#6b7da8'; c.font = '11px sans-serif'; c.textAlign = 'center';
      c.beginPath(); c.moveTo(x0, 30); c.lineTo(x1, 30); c.stroke();
      [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
        const x = x0 + v * (x1 - x0);
        c.beginPath(); c.moveTo(x, 26); c.lineTo(x, 34); c.stroke();
        c.fillText(String(v), x, 52);
      });
      c.fillText('위상 (한 주기를 0~1로 나타낸 값)', (x0 + x1) / 2, 66);
      c.fillStyle = 'rgba(37,99,235,.55)';
      ph.forEach((p) => { c.beginPath(); c.arc(x0 + p * (x1 - x0), 30, 5, 0, 6.2832); c.fill(); });
    }

    function upd() {
      const P = +pIn.value;
      out.innerHTML = '';
      if (!(P >= 0.3)) { out.append(note('warn', '주기는 0.3일 이상으로 넣어 주세요.')); return; }
      const ph = ts.map((t) => frac(t / P));
      const s = ph.slice().sort((a, b) => a - b);
      let gap = s[0] + 1 - s[n - 1];
      for (let i = 1; i < n; i++) gap = Math.max(gap, s[i] - s[i - 1]);
      const cycles = T / P;
      drawStrip(ph);
      out.append(
        kpi([[cycles.toFixed(1) + ' 번', '90일 동안 주기가 반복되는 횟수'], [(n / cycles).toFixed(1) + ' 장', '한 주기당 사진 수'], [(T / n).toFixed(1) + ' 일', '평균 촬영 간격'], [(gap * 100).toFixed(0) + ' %', '위상에서 가장 큰 빈 구간']]),
        cycles < 2 ? note('bad', '주기가 두 번도 반복되지 않아요. 이 정도 기간으로는 주기를 알 수 없어요. 더 오래 관측해야 해요.')
          : gap > 0.3 ? note('warn', '위상이 크게 비어 있어요. 곡선의 일부를 못 본 셈이라 주기를 잘못 잡을 수 있어요.')
            : note('good', '위상이 고르게 채워져요. 이 주기라면 밝기 변화 전체를 볼 수 있어요.'));
    }
    pIn.addEventListener('input', upd);

    return C.chal('① 촬영 계획 계산기: 이 주기를 알아낼 수 있을까?', [
      h('p', null, '실제 관측은 기간과 사진 수가 정해져 있어요. 별의 주기가 P일 때, 지금 찍은 사진들이 한 주기의 어느 지점(위상)들을 덮는지 확인해 봐요.'),
      h('div', { class: 'row' }, field('가정한 주기 P', pIn, '일')),
      cv, out,
      h('div', { class: 'callout' }, h('b', null, '생각해 보기: '), 'P를 정확히 1.0일, 2.0일로 바꿔 보세요. 점들이 한곳에 몰려요. 왜 그럴까요?'),
      reveal
    ], upd);
  };

  // ---------------------------------------------------------------- 3단계
  // ctx: state() → {cur, fi, ph, chosen}, readout() → {flux, sky, npix}
  C.chal3 = function (ctx) {
    // ① 차등측광 손계산
    const handBox = h('div');
    function hand() {
      const st = ctx.state();
      handBox.innerHTML = '';
      if (!st.chosen.length) { handBox.append(note('warn', '먼저 위에서 비교성을 하나 이상 골라 주세요. 그러면 그날 사진의 값으로 문제가 만들어져요.')); return; }
      const m = st.ph.meas, i = st.fi;
      const tInst = m.TGT.inst[i];
      const comps = st.chosen.map((id) => ({ id, inst: m[id].inst[i], cat: st.ph.diag[id].cat }));
      const offs = comps.map((c) => c.inst - c.cat);
      const mean = offs.reduce((a, b) => a + b, 0) / offs.length;
      const answer = tInst - mean;
      const guess = num('', 0.001, 110);
      const result = h('div');
      const sol = h('details', null, h('summary', null, '풀이 보기'),
        h('p', null, '① 비교성마다 (측정 등급 − 알려진 등급)을 구해요: ' + comps.map((c, k) => c.id + ' = ' + offs[k].toFixed(3)).join(', ')),
        h('p', null, '② 평균을 내요: ' + mean.toFixed(3) + '  (이게 그날 구름·대기 때문에 생긴 어긋남이에요)'),
        h('p', null, '③ 목표 별의 측정 등급에서 그 값을 빼요: ' + tInst.toFixed(3) + ' − (' + mean.toFixed(3) + ') = ' + answer.toFixed(3)));
      handBox.append(
        h('p', null, h('b', null, 'Day ' + st.eps[i].day + ' 사진'), '(위 슬라이더로 날짜를 바꾸면 문제도 바뀌어요). 목표 별 ' + st.cur + '의 등급 m을 직접 구해 보세요.'),
        h('table', null,
          h('tr', null, h('th', null, '별'), h('th', null, '측정 등급'), h('th', null, '알려진 등급(카탈로그)')),
          h('tr', null, h('td', null, '목표 ' + st.cur), h('td', { class: 'mono' }, tInst.toFixed(3)), h('td', null, '?')),
          comps.map((c) => h('tr', null, h('td', null, '비교 ' + c.id), h('td', { class: 'mono' }, c.inst.toFixed(3)), h('td', { class: 'mono' }, c.cat.toFixed(3))))),
        h('div', { class: 'row', style: { marginTop: '8px' } }, field('내 답 m =', guess),
          h('button', { class: 'primary', onclick: () => {
            result.innerHTML = '';
            const g1 = +guess.value;
            if (guess.value === '' || !isFinite(g1)) { result.append(note('warn', '숫자를 입력해 주세요.')); return; }
            const d = Math.abs(g1 - answer);
            result.append(d < 0.02 ? note('good', '정답이에요! (오차 ' + d.toFixed(3) + ' 등급) 자동 계산과 같은 방법이에요.')
              : note('bad', '조금 달라요 (차이 ' + d.toFixed(3) + ' 등급). 부호에 주의하며 다시 해 보거나 풀이를 보세요.'));
          } }, '확인')),
        result, sol);
    }

    // ② S/N 계산기
    const rd = ctx.readout() || { flux: 20000, sky: 20, npix: 60 };
    const fIn = num(Math.round(rd.flux), 100, 110), sIn = num(rd.sky.toFixed(1), 0.1), nIn = num(Math.round(rd.npix), 1, 70), rIn = num(3, 0.5, 70), tgt = num(20, 1, 70);
    const snrOut = h('div');
    function snr() {
      const F = +fIn.value, sky = +sIn.value, np = +nIn.value, rn = +rIn.value, want = +tgt.value;
      snrOut.innerHTML = '';
      if (!(F > 0 && np > 0 && sky >= 0 && rn >= 0 && want > 0)) { snrOut.append(note('warn', '모든 칸에 0보다 큰 값을 넣어 주세요.')); return; }
      const B = np * (sky + rn * rn);
      const S = F / Math.sqrt(F + B);
      const sig = 1.0857 / S;
      // 노출을 t배 하면 별빛·하늘빛은 t배, 읽기 잡음은 그대로: (tF)² = want²(tA + n·rn²), A = F + n·sky
      const A = F + np * sky;
      const tNeed = (want * want * A + Math.sqrt(Math.pow(want * want * A, 2) + 4 * F * F * want * want * np * rn * rn)) / (2 * F * F);
      snrOut.append(
        kpi([[S.toFixed(1), 'S/N (신호 대 잡음비)'], [sig.toFixed(3) + ' 등급', '측정 오차 (1.0857 / S/N)'], [(tNeed < 0.1 ? tNeed.toFixed(3) : tNeed.toFixed(1)) + ' 배','S/N ' + want + '을 얻는 데 필요한 노출 시간']]),
        h('small', { class: 'muted' }, '노출 시간 ' + (tNeed * 600).toFixed(0) + '초 (지금은 600초). 별빛과 하늘빛은 노출에 비례해 늘지만 읽기 잡음은 그대로예요.'));
    }
    [fIn, sIn, nIn, rIn, tgt].forEach((e) => e.addEventListener('input', snr));
    const loadBtn = h('button', { onclick: () => {
      const r = ctx.readout();
      if (!r) return;
      fIn.value = Math.round(r.flux); sIn.value = r.sky.toFixed(1); nIn.value = Math.round(r.npix); snr();
    } }, '지금 사진 값 불러오기');

    const d1 = C.chal('① 차등측광 손계산: 목표 별의 등급 직접 구하기', [handBox], hand);
    const d2 = C.chal('② S/N 계산기: 측정 오차는 어디서 올까?', [
      h('p', null, h('b', null, 'S/N = 별의 빛 ÷ √(별의 빛 + 하늘빛 + 읽기 잡음)'), ' 이에요. 별이 어두울수록 S/N이 낮아져서 측정 오차가 커져요. 값을 바꿔 보며 어떤 것이 오차에 가장 큰 영향을 주는지 찾아보세요.'),
      h('div', { class: 'row' },
        field('별의 빛 F', fIn, '전자'), field('하늘빛', sIn, '전자/픽셀'), field('원 안 픽셀 수', nIn), field('읽기 잡음', rIn, '전자/픽셀'), loadBtn),
      h('div', { class: 'row', style: { margin: '8px 0' } }, field('목표 S/N', tgt)),
      snrOut,
      h('div', { class: 'callout' }, h('b', null, '생각해 보기: '), '별의 빛 F를 10분의 1로 줄여 보세요. 오차는 몇 배가 될까요? 하늘이 훨씬 밝은 보름달 밤이라면(하늘빛을 5배로) 어떨까요?')
    ], snr);
    snr();
    return { zone: C.chalZone([d1, d2]), refresh: hand };
  };

  // ---------------------------------------------------------------- 4단계
  // ctx: id() → 지금 보는 별, lc() → 광도곡선, P() → 지금 쓰는 주기
  C.chal4 = function (ctx) {
    // ① 위상 계산 퀴즈
    const qBox = h('div');
    let q = null;
    function newQ() {
      const lc = ctx.lc(), P = Math.round(ctx.P() * 100) / 100;
      const t = lc.t[Math.floor(Math.random() * lc.t.length)];
      q = { t: Math.round(t * 10) / 10, P };
      drawQ();
    }
    function drawQ() {
      qBox.innerHTML = '';
      if (!q) { newQ(); return; }
      const ans = frac(q.t / q.P);
      const inp = num('', 0.01, 100), res = h('div');
      qBox.append(
        h('p', null, '별 ', h('b', null, ctx.id()), '의 주기를 ', h('b', null, q.P + '일'), '이라고 해요. ', h('b', null, 't = ' + q.t + '일'), '에 찍은 사진은 한 주기 중 어디쯤(위상)일까요?'),
        h('p', { class: 'muted' }, '위상 = (t ÷ P)의 소수 부분. 예: t ÷ P = 3.27 이면 위상은 0.27이에요.'),
        h('div', { class: 'row' }, field('내 답 (0~1)', inp),
          h('button', { class: 'primary', onclick: () => {
            res.innerHTML = '';
            const v = +inp.value;
            if (inp.value === '' || !isFinite(v)) { res.append(note('warn', '숫자를 입력해 주세요.')); return; }
            const d = Math.min(Math.abs(v - ans), 1 - Math.abs(v - ans));
            res.append(d < 0.02 ? note('good', '정답이에요! ' + q.t + ' ÷ ' + q.P + ' = ' + (q.t / q.P).toFixed(3) + ' → 위상 ' + ans.toFixed(3))
              : note('bad', '다시 해 보세요. t ÷ P = ' + (q.t / q.P).toFixed(3) + ' 에서 정수 부분을 빼면 돼요.'));
          } }, '확인'),
          h('button', { onclick: newQ }, '새 문제')),
        res);
    }

    // ② 데이터를 줄이면 주기는 얼마나 부정확해질까
    const cv = h('canvas', { class: 'plot', style: { height: '220px' } });
    const plot = new C.Plot(cv, { xlabel: '사용한 사진 수', ylabel: '주기 오차 (%)' });
    const modeSel = h('select', null, h('option', { value: 'first' }, '앞에서부터 n개 (관측 기간이 짧아져요)'), h('option', { value: 'even' }, 'n개를 골고루 뽑기 (기간은 그대로, 점만 줄어요)'));
    const info = h('div');
    function run() {
      const lc = ctx.lc(), Pfull = ctx.P(), N = lc.t.length, mode = modeSel.value;
      const xs = [], ys = [];
      for (let n = 8; n <= N; n += 2) {
        let t, m;
        if (mode === 'first') { t = lc.t.slice(0, n); m = lc.m.slice(0, n); }
        else { const idx = []; for (let k = 0; k < n; k++) idx.push(Math.round((k * (N - 1)) / (n - 1))); t = idx.map((i) => lc.t[i]); m = idx.map((i) => lc.m[i]); }
        try {
          const pg = C.periodogram(t, m, 1.5, 60);
          const P = C.refinePeriod(t, m, pg.peaks[0].period);
          xs.push(n); ys.push((P / Pfull - 1) * 100);
        } catch (e) { /* 점이 너무 적으면 건너뜀 */ }
      }
      const bound = Math.max(5, Math.min(60, Math.max.apply(null, ys.map(Math.abs)) * 1.15));
      plot.begin(6, N + 2, -bound, bound);
      plot.line([6, N + 2], [0, 0], { color: '#9db0d6', w: 1 });
      plot.line([6, N + 2], [4, 4], { color: '#e8890c', w: 1, dash: [5, 4] });
      plot.line([6, N + 2], [-4, -4], { color: '#e8890c', w: 1, dash: [5, 4] });
      plot.scatter(xs, ys, { color: '#2563eb', r: 4 });
      // 그 이후로는 계속 ±4% 안에 머무는 가장 작은 사진 수
      let stable = null;
      for (let i = xs.length - 1; i >= 0 && Math.abs(ys[i]) < 4; i--) stable = xs[i];
      info.innerHTML = '';
      info.append(h('small', { class: 'muted' }, '주황 점선은 ±4% (이 사이트에서 "주기를 맞혔다"고 보는 기준)예요. ' + (stable ? '사진 ' + stable + '장 이상부터는 계속 ±4% 안에 들어와요.' : '이 조건에서는 ±4% 안에 안정적으로 머물지 못했어요.')));
    }
    modeSel.addEventListener('change', run);

    const d1 = C.chal('① 위상 계산 퀴즈: 주기도 없이 손으로 위상 구하기', [qBox], drawQ);
    const d2 = C.chal('② 사진이 적었다면? 데이터 양과 주기 정확도', [
      h('p', null, '실제 관측은 사진 수가 한정되어 있어요. 지금 별 데이터에서 일부만 쓰면 주기를 얼마나 틀리게 구할까요? n장만 써서 주기도를 다시 구하고, 전체 데이터로 구한 주기와 비교해요.'),
      h('div', { class: 'row' }, modeSel, h('button', { class: 'primary', onclick: run }, '실험 시작')),
      cv, info,
      h('div', { class: 'callout' }, h('b', null, '생각해 보기: '), '두 방식 중 어느 쪽이 더 빨리 정확해질까요? 주기가 긴 별(예: 25일)과 짧은 별(예: 4일)은 어떻게 다를까요? 다른 변광성을 골라 다시 해 보세요.')
    ], null);
    return { zone: C.chalZone([d1, d2]), reset: () => { q = null; qBox.innerHTML = ''; if (d1.open) drawQ(); } };
  };

  // ---------------------------------------------------------------- 5단계
  // ctx: rows() → 사용 중인 세페이드들, calibDone() → 보정 관계를 만들었는지
  C.chal5 = function (ctx) {
    // ① 손으로 직선 맞추기
    const cv = h('canvas', { class: 'plot tall' });
    const plot = new C.Plot(cv, { xlabel: 'log P', ylabel: '겉보기등급 ⟨m⟩', invertY: true });
    const sA = h('input', { type: 'range', min: -5, max: 0, step: 0.01, value: -2 });
    const sB = h('input', { type: 'range', min: 15, max: 30, step: 0.01, value: 21 });
    const lblA = h('b'), lblB = h('b'), fitOut = h('div');
    let showBest = false;
    function fit() {
      const rows = ctx.rows();
      fitOut.innerHTML = '';
      if (rows.length < 3) { fitOut.append(note('warn', '쓸 수 있는 세페이드가 3개 미만이에요.')); return; }
      const xs = rows.map((r) => r.logP), ys = rows.map((r) => r.m);
      const a = +sA.value, b = +sB.value;
      lblA.textContent = a.toFixed(2); lblB.textContent = b.toFixed(2);
      const lr = C.linreg(xs, ys);
      const mine = Math.sqrt(rows.reduce((s, r) => s + Math.pow(r.m - (a * (r.logP - 1) + b), 2), 0) / rows.length);
      const yr = C.padRange(ys.concat([a * -0.3 + b, a * 0.7 + b].map((v) => Math.max(15, Math.min(30, v)))), 0.15);
      plot.begin(0.3, 1.7, yr[0], yr[1]);
      plot.scatter(xs, ys, { color: '#12a36a', r: 4.5 });
      plot.line([0.3, 1.7], [a * (0.3 - 1) + b, a * (1.7 - 1) + b], { color: '#2563eb', w: 2 });
      if (showBest) plot.line([0.3, 1.7], [lr.intercept + lr.slope * 0.3, lr.intercept + lr.slope * 1.7], { color: '#e8890c', w: 2, dash: [6, 4] });
      fitOut.append(kpi([[mine.toFixed(3), '내 직선의 어긋남 (rms, 등급)'], [showBest ? lr.rms.toFixed(3) : '?', '컴퓨터가 구한 최적 직선의 rms'], [showBest ? lr.slope.toFixed(2) : '?', '최적 기울기']]));
      if (showBest) fitOut.append(note(mine < lr.rms * 1.3 ? 'good' : 'warn', mine < lr.rms * 1.3 ? '거의 최적이에요! 눈으로도 이렇게 맞출 수 있어요. 컴퓨터는 이걸 "최소제곱법"으로 정확히 계산해 줘요.' : '최적 직선보다 어긋남이 커요. 기울기와 높이를 다시 조절해 보세요.'));
    }
    [sA, sB].forEach((e) => e.addEventListener('input', fit));
    const d1 = C.chal('① 손으로 직선 맞추기: 컴퓨터보다 잘할 수 있을까?', [
      h('p', null, '점들이 가장 잘 모이는 직선을 직접 찾아보세요. 직선은 m = a × (log P − 1) + b 예요. 기울기 a와 높이 b를 슬라이더로 바꿔요.'),
      h('div', { class: 'row' }, h('span', null, '기울기 a ', lblA), sA),
      h('div', { class: 'row' }, h('span', null, '높이 b ', lblB), sB),
      cv, fitOut,
      h('button', { onclick: () => { showBest = !showBest; fit(); } }, '최적 직선 보기/숨기기')
    ], fit);

    // ② 한 별 끝까지 계산해 보기
    const rows0 = ctx.rows();
    const pIn = num(rows0.length ? rows0[0].P.toFixed(2) : 10, 0.1), mIn = num(rows0.length ? rows0[0].m.toFixed(2) : 21, 0.01);
    const calcOut = h('div');
    function calc() {
      calcOut.innerHTML = '';
      if (!ctx.calibDone()) { calcOut.append(note('warn', '위 ②에서 "시차 → 거리 → 절대등급 계산하기" 버튼을 먼저 눌러 주세요. 그러면 계산에 쓸 주기-광도 관계가 만들어져요.')); return; }
      const P = +pIn.value, m = +mIn.value;
      if (!(P > 0 && isFinite(m))) { calcOut.append(note('warn', '주기와 겉보기등급을 넣어 주세요.')); return; }
      const rel = C.calibRelation();
      const lp = Math.log10(P), M = rel.a * (lp - 1) + rel.b, mu = m - M, d = C.distFromMu(mu);
      calcOut.append(
        h('div', { class: 'formula' }, 'log P = ' + lp.toFixed(3), h('br'), 'M = ' + rel.a.toFixed(2) + ' × (' + lp.toFixed(3) + ' − 1) + (' + rel.b.toFixed(2) + ') = ', h('span', { class: 'hl' }, M.toFixed(2))),
        kpi([[Math.round(C.lumSun(M)).toLocaleString('ko-KR') + ' L☉', '광도 (태양 = 1)'], [mu.toFixed(2), '거리 모듈러스 μ = m − M'], [C.pcFmt(d), '이 별만으로 구한 거리']]),
        h('small', { class: 'muted' }, '광도 L = 10^(0.4 × (4.83 − M))  (태양의 절대등급은 4.83)'));
    }
    [pIn, mIn].forEach((e) => e.addEventListener('input', calc));
    const d2 = C.chal('② 별 하나를 끝까지: 주기 → 절대등급 → 광도 → 거리', [
      h('p', null, '주기 P와 겉보기등급 m만 알면 한 번에 계산할 수 있어요. 다른 값을 넣어 보세요. 주기가 두 배가 되면 광도는 몇 배가 될까요?'),
      h('div', { class: 'row' }, field('주기 P', pIn, '일'), field('겉보기등급 m', mIn)), calcOut
    ], calc);

    // ③ 보정 별을 빼 보기
    const cr = C.calibRows();
    const on = cr.map(() => true);
    const sumOut = h('div');
    function calib() {
      const use = cr.filter((r, i) => on[i]), rows = ctx.rows();
      sumOut.innerHTML = '';
      if (use.length < 3) { sumOut.append(note('warn', '보정 별을 3개 이상 남겨 주세요.')); return; }
      if (rows.length < 3) { sumOut.append(note('warn', '쓸 수 있는 세페이드가 3개 미만이에요.')); return; }
      const full = C.calibRelation();
      const lr = C.linreg(use.map((r) => r.logP - 1), use.map((r) => r.M));
      const dist = (a, b) => C.distFromMu(rows.reduce((s, r) => s + r.m - (a * (r.logP - 1) + b), 0) / rows.length);
      const d0 = dist(full.a, full.b), d1 = dist(lr.slope, lr.intercept);
      sumOut.append(
        kpi([[lr.slope.toFixed(2), '기울기 (전부 쓴 값 ' + full.a.toFixed(2) + ')'], [lr.intercept.toFixed(2), '기준값 b (전부 쓴 값 ' + full.b.toFixed(2) + ')'], [C.pcFmt(d1), '그때의 거리 (전부 쓰면 ' + C.pcFmt(d0) + ')'], [((d1 / d0 - 1) * 100).toFixed(1) + ' %', '거리 변화']]),
        h('small', { class: 'muted' }, '(성간소광 보정은 빼고 비교한 값이에요.)'));
    }
    const boxes = h('div', { class: 'row' }, cr.map((r, i) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { on[i] = e.target.checked; calib(); } }), h('span', null, r.name + ' (P=' + r.P.toFixed(1) + '일)'))));
    const d3 = C.chal('③ 보정 별을 빼 보면? 기준값은 얼마나 흔들릴까', [
      h('p', null, '주기-광도 관계의 기준값은 거리를 아는 7개 별로 정했어요. 별을 하나씩 빼 보며 기울기와 최종 거리가 얼마나 바뀌는지 확인해 보세요. 별이 많을수록 왜 믿을 만해질까요?'),
      boxes, sumOut
    ], calib);
    return { zone: C.chalZone([d1, d2, d3]), refresh: () => { calc(); fit(); } };
  };

  // ---------------------------------------------------------------- 6단계
  // ctx: list → {m, logP}[], rel, gal, revealed()
  C.chal6 = function (ctx) {
    // ① 오차 전파
    const dm = num(0.05, 0.01, 70), dM = num(ctx.rel.rms.toFixed(2), 0.01, 70), errOut = h('div');
    function err() {
      const a = +dm.value, b = +dM.value;
      errOut.innerHTML = '';
      if (!(a >= 0 && b >= 0)) { errOut.append(note('warn', '0 이상의 값을 넣어 주세요.')); return; }
      const dmu = Math.sqrt(a * a + b * b), pct = dmu * Math.LN10 / 5 * 100, n = ctx.list.length;
      errOut.append(
        kpi([[dmu.toFixed(3) + ' 등급', '거리 모듈러스 오차 √(δm² + δM²)'], [pct.toFixed(1) + ' %', '별 하나의 거리 오차'], [(pct / Math.sqrt(n)).toFixed(1) + ' %', '별 ' + n + '개를 평균하면']]),
        h('small', { class: 'muted' }, '거리 d = 10^((μ+5)/5) 이므로 δd/d = (ln10 / 5) × δμ ≈ 0.46 × δμ. 거리 오차를 5% 안으로 하려면 δμ가 약 0.11 등급 이하여야 해요.'));
    }
    [dm, dM].forEach((e) => e.addEventListener('input', err));
    const d1 = C.chal('① 오차 전파 계산기: 밝기 오차는 거리 오차를 얼마나 만들까', [
      h('p', null, '밝기를 0.1등급만 잘못 재면 거리는 몇 % 틀릴까요? 겉보기등급 오차 δm과 절대등급 오차 δM을 넣어 보세요.'),
      h('div', { class: 'row' }, field('δm', dm, '등급'), field('δM', dM, '등급 (기본값 = 5단계 관계식의 흩어진 정도)')), errOut
    ], err);

    // ② 먼지 보정 슬라이더
    const aS = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: 0 });
    const aLbl = h('b'), aOut = h('div');
    function ext() {
      const A = +aS.value, n = ctx.list.length;
      aLbl.textContent = A.toFixed(2);
      aOut.innerHTML = '';
      const mu = ctx.list.reduce((s, r) => s + r.m - A - r.M, 0) / n, d = C.distFromMu(mu);
      const base = C.distFromMu(ctx.list.reduce((s, r) => s + r.m - r.M, 0) / n);
      aOut.append(kpi([[mu.toFixed(2), '평균 거리 모듈러스 μ'], [C.pcFmt(d), '거리'], [((d / base - 1) * 100).toFixed(1) + ' %', '보정 안 했을 때와 비교']]));
      if (ctx.revealed()) {
        const truth = C.distFromMu(ctx.gal.mu);
        aOut.append(h('small', { class: 'muted' }, '실제 거리(' + C.pcFmt(truth) + ')와의 오차: ' + ((d / truth - 1) * 100).toFixed(1) + ' %. 오차가 가장 작아지는 값을 찾아보세요!'));
      } else aOut.append(h('small', { class: 'muted' }, '위에서 "정답 확인하기"를 누르면 이 값이 실제 거리와 얼마나 가까운지도 볼 수 있어요.'));
    }
    aS.addEventListener('input', ext);
    const d2 = C.chal('② 먼지 보정 값을 직접 정해 보기', [
      h('p', null, '실제 연구에서는 먼지로 어두워진 정도(A_V)를 직접 재야 해요. A_V를 0에서 1등급까지 바꿔 보며 거리가 얼마나 달라지는지 보세요.'),
      h('div', { class: 'row' }, h('span', null, 'A_V = ', aLbl, ' 등급'), aS), aOut
    ], ext);

    // ③ 변환기
    const muIn = num(24.6, 0.01, 90), dIn = num(850, 1, 100), convOut = h('div');
    function conv() {
      convOut.innerHTML = '';
      const mu = +muIn.value, dk = +dIn.value;
      const rows = [];
      if (isFinite(mu)) { const d = C.distFromMu(mu); rows.push(['μ = ' + mu.toFixed(2) + ' → d = ' + C.pcFmt(d) + ' = ' + C.lyFmt(d), '이 빛은 약 ' + (d * 3.26156 / 1e4).toFixed(0) + '만 년 전에 별을 떠난 거예요.']); }
      if (dk > 0) rows.push(['d = ' + dk + ' kpc → μ = ' + C.muFromDist(dk * 1000).toFixed(2), '5 log₁₀(' + (dk * 100).toFixed(0) + ') = ' + C.muFromDist(dk * 1000).toFixed(2)]);
      rows.forEach((r) => convOut.append(h('div', { class: 'formula', style: { fontSize: '1.05rem' } }, r[0], h('br'), h('small', { class: 'muted' }, r[1]))));
    }
    [muIn, dIn].forEach((e) => e.addEventListener('input', conv));
    const d3 = C.chal('③ 거리 모듈러스 ↔ 거리 변환기', [
      h('p', null, '두 칸 중 아는 쪽에 값을 넣어 보세요. 거리 모듈러스가 5 커지면 거리는 몇 배가 될까요?'),
      h('div', { class: 'row' }, field('거리 모듈러스 μ', muIn), field('거리 d', dIn, 'kpc')), convOut
    ], conv);
    return { zone: C.chalZone([d1, d2, d3]), refresh: ext };
  };
})(typeof window !== 'undefined' ? window : globalThis);
