// 도전 과제(+난이도): 4~6단계 아래에 놓이는 선택 과제.
// 새로운 걸 시키는 게 아니라, 위에서 컴퓨터가 자동으로 해 준 계산을 학생이 계산식으로 직접 해 보고 스스로 채점한다.
// 건너뛰어도 다음 단계로 갈 수 있다.
(function (g) {
  const C = g.CEPH;
  const h = C.h;

  const frac = (x) => x - Math.floor(x);
  const note = (kind, text) => h('div', { class: 'callout ' + kind }, text);
  const pick = (arr, n) => {
    const a = arr.slice(), out = [];
    while (out.length < n && a.length) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
    return out;
  };

  // 접히는 도전 과제 하나. 펼칠 때(또는 refresh 때) 내용을 새로 만든다.
  C.chal = function (title, build) {
    const body = h('div', { class: 'chal-body' });
    const d = h('details', { class: 'chal' }, h('summary', null, title), body);
    const fill = () => { body.innerHTML = ''; build(body); };
    d.addEventListener('toggle', () => { if (d.open) fill(); });
    d.refresh = () => { if (d.open) fill(); else body.innerHTML = ''; };
    return d;
  };
  C.chalZone = (items) => h('section', { class: 'chal-zone' },
    h('h3', null, '⭐ 도전 과제 (+난이도)'),
    h('p', { class: 'muted' }, '위에서 컴퓨터가 자동으로 해 준 계산을, 이번엔 직접 계산식을 써서 해 보고 스스로 채점해 보는 선택 과제예요. 건너뛰어도 다음 단계로 갈 수 있어요.'),
    items);

  // 채점표. rows: [{label, unit, ans, tol|tolRel, circ, options, hint, show}]
  // opts: {solution: [노드...], extra: [버튼...]}
  C.quiz = function (rows, opts) {
    opts = opts || {};
    const inputs = rows.map((r) => (r.options
      ? h('select', null, h('option', { value: '' }, '선택'), r.options.map(([v, t]) => h('option', { value: v }, t)))
      : h('input', { type: 'number', step: 'any', style: { width: '110px' } })));
    const marks = rows.map(() => h('td', { class: 'qmark' }));
    const summary = h('div', { style: { marginTop: '8px' } });
    const table = h('table', { class: 'quiz' }, rows.map((r, i) => h('tr', null,
      h('td', null, r.label), h('td', null, inputs[i], r.unit ? h('span', { class: 'muted' }, ' ' + r.unit) : null), marks[i])));
    const sol = h('details', null, h('summary', null, '정답과 풀이 보기'),
      h('ul', null, rows.map((r) => h('li', null, r.label + ' → ', h('b', null, r.show)))),
      opts.solution || null);
    const grade = h('button', { class: 'primary', onclick: () => {
      let right = 0, filled = 0;
      rows.forEach((r, i) => {
        const raw = inputs[i].value;
        marks[i].className = 'qmark';
        if (raw === '') { marks[i].textContent = '입력해 주세요'; marks[i].classList.add('warn'); return; }
        filled++;
        let ok;
        if (r.options) ok = raw === r.ans;
        else {
          let d = Math.abs(+raw - r.ans);
          if (r.circ) { d = d % 1; d = Math.min(d, 1 - d); }
          ok = d <= (r.tolRel != null ? Math.abs(r.ans) * r.tolRel : r.tol);
        }
        if (ok) right++;
        marks[i].classList.add(ok ? 'ok' : 'bad');
        marks[i].textContent = ok ? '✔ 맞아요' : '✘ ' + (r.hint || '다시 계산해 보세요');
      });
      summary.innerHTML = '';
      if (filled < rows.length) summary.append(note('warn', '아직 입력하지 않은 칸이 있어요.'));
      else summary.append(note(right === rows.length ? 'good' : 'warn', right + ' / ' + rows.length + ' 맞았어요. ' + (right === rows.length ? '컴퓨터와 같은 결과를 직접 계산해 냈어요!' : '틀린 칸을 다시 계산해 보고, 막히면 "정답과 풀이 보기"를 열어 보세요.')));
    } }, '채점하기');
    return h('div', null, table, h('div', { class: 'row', style: { marginTop: '8px' } }, grade, opts.extra || null), summary, sol);
  };

  const fx = (v, d) => v.toFixed(d == null ? 2 : d);

  // ---------------------------------------------------------------- 4단계
  // ctx: id() → 지금 보는 별, lc() → 광도곡선, P() → 지금 쓰는 주기
  C.chal4 = function (ctx) {
    function curve() {
      const lc = ctx.lc(), P = ctx.P();
      const fit = C.fourierFit(lc.t, lc.m, P, 3);
      return { lc, P, fit, at: (x) => fit.model((frac(x) + fit.phase0) * P) };
    }

    // ① 위상 손계산
    const d1 = C.chal('① 위상 직접 계산하기: 컴퓨터가 시각을 위상으로 바꾼 방법', function build(body) {
      const { lc, P } = curve();
      const P2 = Math.round(P * 100) / 100;
      const ts = pick(lc.t, 5).map((t) => Math.round(t * 10) / 10).sort((a, b) => a - b);
      const rows = ts.map((t) => ({
        label: '촬영 시각 t = ' + t + '일 → 위상', ans: frac(t / P2), tol: 0.02, circ: true,
        hint: 't ÷ P = ' + fx(t / P2, 3) + ' 에서 정수 부분을 빼 보세요', show: fx(frac(t / P2), 3) + '  (' + t + ' ÷ ' + P2 + ' = ' + fx(t / P2, 3) + ')'
      }));
      body.append(
        h('p', null, '③ 위상 접기에서 컴퓨터는 모든 촬영 시각을 한 주기 안의 위치(위상)로 바꿨어요. 별 ', h('b', null, ctx.id()), '의 주기를 ', h('b', null, P2 + '일'), '로 놓고, 아래 5장의 위상을 계산기로 직접 구해 보세요.'),
        h('div', { class: 'formula', style: { fontSize: '1.05rem' } }, '위상 = (t ÷ P)의 소수 부분', h('br'), h('small', { class: 'muted' }, '예: t ÷ P = 3.27 이면 위상 0.27 (0과 1은 같은 위치로 봐요)')),
        C.quiz(rows, { extra: [h('button', { onclick: () => { body.innerHTML = ''; build(body); } }, '새 문제')] }));
    });

    // ② 곡선 읽고 진폭·평균 구하기
    const d2 = C.chal('② 곡선에서 진폭과 평균 등급 구하기: 푸리에 적합 결과를 손으로 어림해 보기', function (body) {
      const { fit } = curve();
      const mmin = Math.min.apply(null, fit.val), mmax = Math.max.apply(null, fit.val);
      const mid = (mmin + mmax) / 2;
      const rows = [
        { label: '가장 밝을 때의 등급 (③ 그래프에서 주황 곡선의 가장 위쪽 값)', ans: mmin, tol: 0.08, hint: '곡선이 가장 위로 올라간 곳의 세로축 값을 읽어 보세요', show: fx(mmin) },
        { label: '가장 어두울 때의 등급 (주황 곡선의 가장 아래쪽 값)', ans: mmax, tol: 0.08, hint: '곡선이 가장 아래로 내려간 곳의 세로축 값을 읽어 보세요', show: fx(mmax) },
        { label: '진폭 = 어두울 때 − 밝을 때', unit: '등급', ans: mmax - mmin, tol: 0.12, hint: '큰 값에서 작은 값을 빼요', show: fx(mmax - mmin) },
        { label: '평균 등급 ≈ (밝을 때 + 어두울 때) ÷ 2', ans: mid, tol: 0.08, hint: '두 값을 더해서 2로 나눠요', show: fx(mid) }
      ];
      body.append(
        h('p', null, '컴퓨터는 점들에 곡선(푸리에 적합)을 맞춘 뒤 그 곡선에서 진폭과 평균 등급 ⟨m⟩을 구했어요. 이번엔 ③ 그래프의 세로축(등급)을 눈으로 읽어서 같은 걸 어림해 보세요. 별 ', h('b', null, ctx.id()), ' 기준이에요.'),
        h('div', { class: 'callout' }, '등급은 숫자가 작을수록 밝아서, 그래프에서는 위쪽이 밝은 쪽이에요.'),
        C.quiz(rows, { solution: [
          h('p', null, '컴퓨터가 구한 평균 등급 ⟨m⟩ = ', h('b', null, fx(fit.meanMag)), ' 이고, 위의 간단한 평균(가장 밝을 때와 어두울 때의 가운데)은 ', h('b', null, fx(mid)), ' 이라서 ', fx(Math.abs(fit.meanMag - mid)), ' 등급 차이가 나요.'),
          h('p', null, '세페이드는 톱니 모양이라 한 주기 동안 대부분의 시간을 어두운 쪽에서 보내요. 그래서 한 주기 전체를 평균 낸 ⟨m⟩(컴퓨터)이 단순한 가운데 값과 달라요. 다음 단계에서 쓰는 겉보기등급은 컴퓨터가 구한 ⟨m⟩이에요.')
        ] }));
    });

    // ③ 모양 판정
    const d3 = C.chal('③ 세페이드인지 식쌍성인지: 모양 판정을 직접 계산하기', function (body) {
      const { fit, at } = curve();
      const amp = fit.amp;
      let xf = 0, best = -1e9;
      for (let i = 0; i < 400; i++) { const v = at(i / 400); if (v > best) { best = v; xf = i / 400; } }
      const mL = at(xf - 0.15), mR = at(xf + 0.15), asym = Math.abs(mR - mL) / amp, sug = C.suggestType(fit);
      const rows = [
        { label: '가장 어두운 때의 위상 (③ 그래프에서 곡선이 가장 아래인 곳, 0~1)', ans: xf, tol: 0.06, circ: true, hint: '곡선의 가장 아래 지점의 가로축 값을 읽어 보세요', show: fx(xf) },
        { label: '그 위상보다 0.15 앞(−0.15)에서의 등급', ans: mL, tol: 0.1, circ: false, hint: '가로축에서 0.15 왼쪽의 곡선 높이를 읽어 보세요', show: fx(mL) },
        { label: '그 위상보다 0.15 뒤(+0.15)에서의 등급', ans: mR, tol: 0.1, hint: '가로축에서 0.15 오른쪽의 곡선 높이를 읽어 보세요', show: fx(mR) },
        { label: '비대칭 = |뒤 − 앞| ÷ 진폭', ans: asym, tol: 0.1, hint: '두 등급의 차이를 진폭(' + fx(amp) + ')으로 나눠요', show: fx(asym) + '  (진폭 ' + fx(amp) + ')' },
        { label: '판정', options: [['cepheid', '세페이드 (비대칭이 커요)'], ['eb', '식쌍성 (좌우가 대칭이에요)']], ans: sug, hint: '비대칭이 0.1보다 큰지 작은지 보세요', show: sug === 'cepheid' ? '세페이드' : '식쌍성' }
      ];
      body.append(
        h('p', null, '컴퓨터는 가장 어두운 때를 기준으로 곡선의 왼쪽과 오른쪽이 얼마나 다른지(비대칭)를 계산해서 별의 종류를 가려냈어요. 세페이드는 비대칭이 크고(톱니), 식쌍성은 거의 0이에요(좌우 대칭). 컴퓨터는 모든 위치를 평균 내지만, 여기서는 한 쌍(±0.15)만 비교해 볼게요. 별 ', h('b', null, ctx.id()), ' 기준이에요.'),
        C.quiz(rows, { solution: [h('p', null, '비대칭 값이 0.1 정도보다 크면 세페이드, 작으면 식쌍성이라고 컴퓨터는 판정해요. 지금 곡선의 컴퓨터 판정은 "' + (sug === 'cepheid' ? '세페이드' : '식쌍성') + '"예요. (한 쌍만 비교해서 경계에서는 컴퓨터와 다를 수 있어요.)')] }));
    });

    return { zone: C.chalZone([d1, d2, d3]), reset: () => { [d1, d2, d3].forEach((d) => d.refresh()); } };
  };

  // ---------------------------------------------------------------- 5단계
  // 위쪽에서는 문헌의 식을 그대로 쓰고, 여기서는 그 식이 어떻게 만들어졌는지 직접 해 본다.
  // ctx: rows() → 쓰는 세페이드들
  C.chal5 = function (ctx) {
    const lit = C.litRelation();
    const kpi = (items) => h('div', { class: 'kpi' }, items.map(([v, l]) => h('div', null, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l))));

    // ① 이 은하의 세페이드로 직선 구하기 (리비트의 발견 따라 하기)
    const d1 = C.chal('① 이 은하의 세페이드로 주기-밝기 직선 그려 보기: 리비트의 발견 따라 하기', function (body) {
      const use = ctx.rows();
      if (use.length < 3) { body.append(note('warn', '쓸 수 있는 세페이드가 3개 미만이에요.')); return; }
      const xs = use.map((r) => r.logP), ys = use.map((r) => r.m);
      const lr = C.linreg(xs, ys);
      const cv = h('canvas', { class: 'plot tall' });
      body.append(
        h('p', null, '위에서는 문헌의 식을 그대로 썼어요. 그런데 이 은하의 세페이드만 봐도 "주기가 길수록 더 밝다"는 관계가 보일까요? 같은 은하의 별은 거의 같은 거리에 있으니, 겉보기등급 ⟨m⟩을 주기(log P)에 맞춰 그리면 돼요.'),
        cv);
      const plot = new C.Plot(cv, { xlabel: 'log P (P: 일)', ylabel: '겉보기등급 ⟨m⟩', invertY: true });
      const yr = C.padRange(ys, 0.15);
      plot.begin(0.3, 1.7, yr[0], yr[1]);
      plot.line([0.3, 1.7], [lr.intercept + lr.slope * 0.3, lr.intercept + lr.slope * 1.7], { color: '#e8890c', dash: [6, 4] });
      plot.scatter(xs, ys, { color: '#12a36a', r: 4.5 });
      use.forEach((r) => plot.text(r.logP, r.m, r.id, { dx: 7, dy: -6, color: '#33456f', font: '11px sans-serif' }));
      const close = Math.abs(lr.slope - lit.a) < 0.7;
      body.append(
        kpi([[fx(lr.slope) + ' ± ' + fx(lr.sigSlope), '이 은하에서 구한 기울기 (log P가 1 늘 때 등급 변화)'], [fx(lr.rms), '직선에서 흩어진 정도 (등급)'], [String(use.length), '쓰는 세페이드 수']]),
        note(close ? 'good' : 'warn', '문헌 식의 기울기는 ' + fx(lit.a) + ' 이에요. ' + (close ? '거의 같네요! 주기-광도 관계는 어느 은하에서나 똑같이 통하는 법칙이에요.' : '꽤 달라요. 분류나 주기가 잘못된 별이 없는지 확인해 보세요.')),
        h('p', { class: 'muted' }, '점들의 높이(⟨m⟩)는 은하까지의 거리에 따라 위아래로 옮겨져요. 그래서 이 그림만으로는 "진짜 밝기"를 알 수 없고, 기울기만 알 수 있어요. 진짜 밝기의 기준값은 ③에서 만들어 봐요.'));
    });

    // ② 최소제곱 손계산
    const d2 = C.chal('② 직선의 기울기 직접 구하기: 컴퓨터가 맞춘 직선을 손으로 계산해 보기', function (body) {
      const rows0 = ctx.rows().slice(0, 4);
      if (rows0.length < 3) { body.append(note('warn', '쓸 수 있는 세페이드가 3개 미만이에요.')); return; }
      const xs = rows0.map((r) => r.logP), ys = rows0.map((r) => r.m), n = xs.length;
      const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
      const lr = C.linreg(xs, ys);
      const at1 = lr.intercept + lr.slope;
      const rows = [
        { label: 'log P의 평균 x̄', ans: mx, tol: 0.005, hint: '네 값을 더해서 ' + n + '으로 나눠요', show: fx(mx, 3) },
        { label: 'm의 평균 ȳ', ans: my, tol: 0.01, hint: '네 값을 더해서 ' + n + '으로 나눠요', show: fx(my, 3) },
        { label: '기울기 a = Σ(x−x̄)(y−ȳ) ÷ Σ(x−x̄)²', ans: lr.slope, tol: 0.05 * Math.abs(lr.slope) + 0.03, hint: '분자와 분모를 각각 합해서 나눠요', show: fx(lr.slope) },
        { label: 'log P = 1 일 때 직선이 지나는 m = ȳ + a(1 − x̄)', ans: at1, tol: 0.08, hint: 'ȳ에 a × (1 − x̄)를 더해요', show: fx(at1) }
      ];
      body.append(
        h('p', null, '①에서 컴퓨터는 점들에 가장 잘 맞는 직선을 구했어요(최소제곱법). 쓰는 세페이드 중 앞의 ' + n + '개로 같은 계산을 직접 해 보세요.'),
        h('table', { style: { maxWidth: '340px' } }, h('tr', null, h('th', null, '별'), h('th', null, 'x = log P'), h('th', null, 'y = m')),
          rows0.map((r) => h('tr', null, h('td', null, r.id), h('td', { class: 'mono' }, fx(r.logP, 3)), h('td', { class: 'mono' }, fx(r.m))))),
        C.quiz(rows, { solution: [h('p', null, '기울기는 "log P가 1 늘 때 겉보기등급이 얼마나 변하는가"예요. 음수라는 건 주기가 길수록 숫자가 작다, 즉 더 밝다는 뜻이에요.')] }));
    });

    // ③ 거리를 아는 세페이드로 관계식 만들기
    const d3 = C.chal('③ 문헌의 식은 어떻게 만들었을까? 거리를 아는 세페이드로 직접 만들어 보기', function build(body) {
      const cr = C.calibRows(), r = pick(cr, 1)[0];
      const rows = [
        { label: '거리 d = 1000 ÷ 시차 p', unit: 'pc', ans: r.d, tolRel: 0.01, hint: '시차 ' + r.parallax + '로 1000을 나눠요', show: fx(r.d, 0) + ' pc  (1000 ÷ ' + r.parallax + ')' },
        { label: '절대등급 M = m − 5 log₁₀(d ÷ 10)', ans: r.M, tol: 0.05, hint: '5 × log₁₀(d÷10) 를 m에서 빼요', show: fx(r.M) + '  (' + fx(r.mV) + ' − 5 × log₁₀(' + fx(r.d, 0) + ' ÷ 10))' }
      ];
      const out = h('div');
      body.append(
        h('p', null, '위에서 쓴 식은 가까운 세페이드들로 만들어졌어요. 이 별들은 가까워서 ', h('b', null, '시차'), '(지구가 태양 둘레를 돌며 생기는 별 위치의 작은 어긋남)로 거리를 정확히 알 수 있고, 거리를 알면 진짜 밝기(절대등급)를 계산할 수 있어요. 별 하나를 직접 계산해 보세요.'),
        h('div', { class: 'callout' }, '※ 아래 별들(MW-1~7)은 실제 별이 아니라, 교육용으로 위 식에 약간의 흩어짐을 더해 만든 가상의 세페이드예요.'),
        h('div', { class: 'kpi' },
          h('div', null, h('div', { class: 'v' }, r.name), h('div', { class: 'l' }, '주기 ' + fx(r.P, 1) + '일')),
          h('div', null, h('div', { class: 'v' }, fx(r.parallax, 3)), h('div', { class: 'l' }, '시차 p (밀리각초)')),
          h('div', null, h('div', { class: 'v' }, fx(r.mV)), h('div', { class: 'l' }, '겉보기등급 m'))),
        C.quiz(rows, { extra: [
          h('button', { onclick: () => { body.innerHTML = ''; build(body); } }, '다른 별로'),
          h('button', { onclick: () => {
            out.innerHTML = '';
            const rel = C.calibRelation(), cvA = h('canvas', { class: 'plot tall' });
            out.append(
              h('h4', { style: { margin: '14px 0 6px' } }, '7개 별을 모두 계산하고 그래프로 그리면'),
              h('table', null,
                h('tr', null, h('th', null, '별'), h('th', null, 'P (일)'), h('th', null, '시차 p (밀리각초)'), h('th', null, '거리 d = 1000/p (pc)'), h('th', null, '겉보기 m_V'), h('th', null, 'M = m − 5 log(d/10)')),
                cr.map((c) => h('tr', null, h('td', null, c.name), h('td', { class: 'mono' }, fx(c.P, 1)), h('td', { class: 'mono' }, fx(c.parallax, 3)), h('td', { class: 'mono' }, fx(c.d, 0)), h('td', { class: 'mono' }, fx(c.mV)), h('td', { class: 'mono' }, fx(c.M))))),
              cvA);
            const pl = new C.Plot(cvA, { xlabel: 'log P', ylabel: '절대등급 M_V', invertY: true });
            pl.begin(0.3, 1.7, -7.2, -2);
            pl.line([0.3, 1.7], [rel.a * (0.3 - 1) + rel.b, rel.a * (1.7 - 1) + rel.b], { color: '#e8890c', w: 2 });
            pl.scatter(cr.map((c) => c.logP), cr.map((c) => c.M), { color: '#d6469a', r: 4.5 });
            out.append(
              h('div', { class: 'formula' }, '내가 만든 식: M', h('sub', null, 'V'), ' = ', h('span', { class: 'hl' }, fx(rel.a)), ' (log P − 1) ', rel.b < 0 ? '− ' : '+ ', h('span', { class: 'hl' }, fx(Math.abs(rel.b)))),
              note('good', '문헌의 식(' + fx(lit.a) + ', ' + fx(lit.b) + ')과 거의 같아요! 거리를 아는 세페이드들로 이렇게 기준값을 만들고, 그 식을 먼 은하의 세페이드에 적용하는 거예요. 별이 많을수록 식이 더 믿을 만해져요.'));
          } }, '7개 전체 결과와 그래프 보기')
        ] }),
        out);
    });

    // ④ 광도 손계산
    const d4 = C.chal('④ 주기에서 광도까지 직접 계산하기: 식을 적용한 방법', function build(body) {
      const use = ctx.rows();
      if (!use.length) { body.append(note('warn', '쓸 수 있는 세페이드가 없어요.')); return; }
      const r = pick(use, 1)[0];
      const lp = Math.log10(r.P), M = lit.a * (lp - 1) + lit.b, L = C.lumSun(M);
      const rows = [
        { label: 'log P = log₁₀(P)', ans: lp, tol: 0.004, hint: '계산기의 log 키로 ' + fx(r.P) + '의 상용로그를 구해요', show: fx(lp, 3) },
        { label: '절대등급 M = a(log P − 1) + b', ans: M, tol: 0.03, hint: 'a와 b는 위 식의 값을 쓰세요', show: fx(M) + '  (' + fx(lit.a) + ' × (' + fx(lp, 3) + ' − 1) + (' + fx(lit.b) + '))' },
        { label: '광도 L = 10^(0.4 × (4.83 − M))', unit: '태양의 몇 배', ans: L, tolRel: 0.04, hint: '4.83 − M 에 0.4를 곱해서 10의 거듭제곱을 해요', show: Math.round(L).toLocaleString('ko-KR') + ' 배' }
      ];
      body.append(
        h('p', null, '위 ②에서 컴퓨터는 주기만으로 각 세페이드의 진짜 밝기를 구했어요. 별 ', h('b', null, r.id), '(주기 ', h('b', null, fx(r.P) + '일'), ')를 직접 계산해 보세요.'),
        h('div', { class: 'formula', style: { fontSize: '1.05rem' } }, '식: M = ', h('span', { class: 'hl' }, fx(lit.a)), ' × (log P − 1) + (', h('span', { class: 'hl' }, fx(lit.b)), ')', h('br'), h('small', { class: 'muted' }, '태양의 절대등급은 4.83이에요.')),
        C.quiz(rows, { extra: [h('button', { onclick: () => { body.innerHTML = ''; build(body); } }, '다른 별로')] }));
    });

    return { zone: C.chalZone([d1, d2, d3, d4]), refresh: () => { d1.refresh(); d2.refresh(); d4.refresh(); } };
  };

  // ---------------------------------------------------------------- 6단계
  // ctx: list → {id, m, logP, M}[] (쓰는 세페이드, 먼지 보정 없이), gal
  C.chal6 = function (ctx) {
    const list = ctx.list, n = list.length;
    const mus = list.map((r) => r.m - r.M);
    const mean = mus.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(mus.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1));
    const sem = sd / Math.sqrt(n);
    const dK = (mu) => C.distFromMu(mu) / 1000;   // kpc
    const dMean = dK(mean), dErr = dMean * Math.LN10 / 5 * sem;
    const A = ctx.gal.Av;
    const note0 = h('div', { class: 'callout' }, '이 과제의 계산은 ', h('b', null, '먼지 보정 없이'), ' 해요. (표와 비교하려면 위의 "먼지 보정" 체크를 끄고 보세요. 먼지 보정은 ④에서 따로 해 봐요.)');

    const d1 = C.chal('① 별 하나의 거리 직접 계산하기: 포그슨 방정식 적용', function build(body) {
      const r = pick(list, 1)[0], mu = r.m - r.M;
      const rows = [
        { label: '거리 모듈러스 μ = m − M', ans: mu, tol: 0.02, hint: 'm에서 M을 빼요 (M이 음수면 부호에 주의!)', show: fx(mu) },
        { label: '거리 d = 10^((μ + 5) ÷ 5)', unit: 'kpc', ans: dK(mu), tolRel: 0.015, hint: '(μ+5)÷5 를 구해 10의 거듭제곱을 한 뒤 1000으로 나눠 kpc로 바꿔요', show: fx(dK(mu), 1) + ' kpc  (= ' + fx(C.distFromMu(mu), 0) + ' pc)' }
      ];
      body.append(
        h('p', null, '위 표에서 컴퓨터가 별마다 계산한 값을 직접 구해 보세요. 별 ', h('b', null, r.id), ' 이에요.'),
        h('div', { class: 'kpi' },
          h('div', null, h('div', { class: 'v' }, fx(r.m)), h('div', { class: 'l' }, '겉보기등급 m')),
          h('div', null, h('div', { class: 'v' }, fx(r.M)), h('div', { class: 'l' }, '절대등급 M'))),
        note0,
        C.quiz(rows, { extra: [h('button', { onclick: () => { body.innerHTML = ''; build(body); } }, '다른 별로')] }));
    });

    const d2 = C.chal('② 평균과 오차 직접 계산하기: 별들의 μ를 종합하는 방법', function (body) {
      const rows = [
        { label: '평균 μ = (μ₁ + μ₂ + … ) ÷ ' + n, ans: mean, tol: 0.01, hint: '모든 μ를 더해 ' + n + '으로 나눠요', show: fx(mean) },
        { label: '표준편차 s = √[ Σ(μ − 평균)² ÷ (' + n + ' − 1) ]', ans: sd, tol: 0.015, hint: '편차의 제곱을 모두 더해 ' + (n - 1) + '로 나눈 뒤 제곱근을 구해요', show: fx(sd, 3) },
        { label: '표준오차 = s ÷ √' + n, ans: sem, tol: 0.006, hint: 's를 √' + n + '(≈' + fx(Math.sqrt(n), 2) + ')으로 나눠요', show: fx(sem, 3) }
      ];
      body.append(
        h('p', null, '컴퓨터는 별마다 구한 μ를 평균 내고, 별들 사이의 흩어진 정도로 오차를 구했어요. 아래 ' + n + '개 값으로 같은 계산을 해 보세요.'),
        h('table', { style: { maxWidth: '280px' } }, h('tr', null, h('th', null, '별'), h('th', null, 'μ = m − M')),
          list.map((r, i) => h('tr', null, h('td', null, r.id), h('td', { class: 'mono' }, fx(mus[i]))))),
        note0,
        C.quiz(rows, { solution: [h('p', null, '표준오차는 "별이 많을수록 평균이 믿을 만해진다"는 걸 숫자로 보여줘요. 별이 4배 많아지면 오차는 절반이 돼요.')] }));
    });

    const d3 = C.chal('③ 최종 거리와 오차 직접 계산하기', function (body) {
      const rows = [
        { label: '평균 μ로 구한 거리 d = 10^((μ + 5) ÷ 5)', unit: 'kpc', ans: dMean, tolRel: 0.015, hint: '평균 μ = ' + fx(mean) + ' 를 포그슨 식에 넣어요', show: fx(dMean, 1) + ' kpc' },
        { label: '거리 오차 δd = d × (ln 10 ÷ 5) × 표준오차', unit: 'kpc', ans: dErr, tolRel: 0.15, hint: 'ln 10 ÷ 5 ≈ 0.46 이에요. d에 0.46과 표준오차 ' + fx(sem, 3) + ' 를 곱해요', show: fx(dErr, 1) + ' kpc  (' + fx(dMean, 1) + ' × 0.4605 × ' + fx(sem, 3) + ')' }
      ];
      body.append(
        h('p', null, '평균 μ = ', h('b', null, fx(mean)), ', 표준오차 = ', h('b', null, fx(sem, 3)), ' 일 때 최종 거리와 거리 오차를 구해 보세요. (위 \"이 은하까지의 거리\" 칸에서 컴퓨터가 낸 값과 비교해 보세요.)'),
        note0,
        C.quiz(rows, { solution: [h('p', null, 'μ가 0.1등급 달라지면 거리는 약 4.6% 달라져요. 그래서 밝기를 정확히 재는 일이 중요해요.')] }));
    });

    const d4 = C.chal('④ 먼지 보정 직접 해 보기: 성간소광 A_V 빼기', function (body) {
      const muC = mean - A, dC = dK(muC);
      const rows = [
        { label: "보정한 μ' = 평균 μ − A_V", ans: muC, tol: 0.01, hint: '평균 μ에서 ' + fx(A) + ' 를 빼요', show: fx(muC) },
        { label: "보정한 거리 d' = 10^((μ' + 5) ÷ 5)", unit: 'kpc', ans: dC, tolRel: 0.015, hint: "μ' 를 포그슨 식에 넣어요", show: fx(dC, 1) + ' kpc' }
      ];
      body.append(
        h('p', null, '먼지가 별빛을 가리면 별이 더 어둡게 보여서 거리가 실제보다 멀게 계산돼요. 이 은하 방향의 먼지 때문에 어두워진 정도는 ', h('b', null, 'A_V = ' + fx(A) + ' 등급'), ' 이에요. 평균 μ = ' + fx(mean) + ' 에서 보정해 보세요.'),
        C.quiz(rows, { solution: [h('p', null, '위의 "먼지 보정" 체크를 켜면 컴퓨터가 구한 보정 값과 같은 결과가 나와요. 보정 전과 거리가 ' + fx((dMean / dC - 1) * 100, 1) + '% 달라지는 걸 확인해 보세요.')] }));
    });

    return { zone: C.chalZone([d1, d2, d3, d4]), refresh: () => {} };
  };
})(typeof window !== 'undefined' ? window : globalThis);
