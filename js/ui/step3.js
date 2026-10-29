// 3단계: 구경측광 → 비교성 고르기 → 차등측광
(function (g) {
  const C = g.CEPH;
  const h = C.h;
  const SCALE = 5;
  const COLORS = ['#5be3a0', '#5ad1ff', '#ff9de2', '#ffa94d', '#c3a6ff', '#e6ff7a'];

  C.steps[3] = {
    render(root) {
      const S = C.S, R = C.ensureFrames();
      const eps = R.schedule.epochs, N = eps.length;
      const ids = S.picked, first = ids[0];
      if (!S.comps[first]) S.comps[first] = [];
      let cur = first, fi = Math.floor(N / 2), hover = null, timer = null;

      const view = h('canvas', { class: 'view', style: { width: '100%', maxWidth: '500px', aspectRatio: '1' } });
      const slider = h('input', { type: 'range', min: 0, max: N - 1, value: fi });
      const info = h('div', { class: 'muted', style: { fontSize: '.88rem' } });
      const readout = h('div');
      const playBtn = h('button', { class: 'sm' }, '▶ 재생');
      const hoverLine = h('div', { class: 'muted', style: { minHeight: '1.5em', fontSize: '.9rem' } });
      const chips = h('div', { class: 'chips' });
      const compBox = h('div');
      const cvRaw = h('canvas', { class: 'plot' });
      const cvRes = h('canvas', { class: 'plot', style: { height: '170px' } });
      const cvDiff = h('canvas', { class: 'plot tall' });
      const diffNote = h('div', { class: 'muted', style: { fontSize: '.88rem' } });
      const batchBox = h('div');
      const rawPlot = new C.Plot(cvRaw, { xlabel: '날짜 (일)', ylabel: '측정 등급 (계기등급)', invertY: true });
      const resPlot = new C.Plot(cvRes, { xlabel: '날짜 (일)', ylabel: '비교성 밝기 변화 (등급)', invertY: true });
      const diffPlot = new C.Plot(cvDiff, { xlabel: '날짜 (일)', ylabel: '차등측광 등급', invertY: true });

      const sel = () => (S.comps[cur] && S.comps[cur].length ? S.comps[cur] : (cur === first ? [] : C.compsFor(cur)));
      const manual = () => !!(S.comps[cur] && S.comps[cur].length);

      // ---------- 이미지 뷰 ----------
      function drawView() {
        const v = C.varById(cur), st = v.stamp, e = eps[fi];
        const ctx = C.drawFrame(view, R.frames[cur][fi], st.W, st.H, SCALE);
        const ap = C.autoAperture(e.fwhm);
        const tap = man.on ? man : ap;
        const P = (s) => [(s.x + e.jx + 0.5) * SCALE, (s.y + e.jy + 0.5) * SCALE];
        const chosen = sel();
        st.stars.forEach((s) => {
          const [x, y] = P(s);
          if (s.role === 'target') {
            if (man.on && man.showAuto) {
              ctx.strokeStyle = 'rgba(255,203,71,.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
              [ap.rAp, ap.rIn, ap.rOut].forEach((r) => { ctx.beginPath(); ctx.arc(x, y, r * SCALE, 0, 6.2832); ctx.stroke(); });
              ctx.setLineDash([]);
            }
            const col = man.on ? '#5ad1ff' : '#ffcb47', colA = man.on ? 'rgba(90,209,255,.85)' : 'rgba(255,203,71,.8)';
            ctx.strokeStyle = col; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y, tap.rAp * SCALE, 0, 6.2832); ctx.stroke();
            ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; ctx.strokeStyle = colA;
            ctx.beginPath(); ctx.arc(x, y, tap.rIn * SCALE, 0, 6.2832); ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y, tap.rOut * SCALE, 0, 6.2832); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = col; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
            ctx.fillText((man.on ? '내 설정 · ' : '') + '목표 별 ' + cur, Math.min(x + tap.rOut * SCALE * 0.72 + 2, view.width - 120), Math.max(16, y - tap.rOut * SCALE * 0.72));
            return;
          }
          const k = chosen.indexOf(s.id);
          if (k >= 0) {
            ctx.strokeStyle = COLORS[k % COLORS.length]; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y, ap.rAp * SCALE, 0, 6.2832); ctx.stroke();
            ctx.fillStyle = COLORS[k % COLORS.length]; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
            ctx.fillText('비교 ' + s.id, x + ap.rAp * SCALE + 3, y - 4);
          } else {
            ctx.strokeStyle = hover === s.id ? '#fff' : 'rgba(180,200,255,.45)'; ctx.lineWidth = hover === s.id ? 2 : 1;
            ctx.beginPath(); ctx.arc(x, y, 11, 0, 6.2832); ctx.stroke();
            ctx.fillStyle = hover === s.id ? '#fff' : 'rgba(200,215,255,.8)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
            ctx.fillText(s.id, x + 13, y - 9);
          }
        });
        info.textContent = 'Day ' + e.day + ' · 대기 흔들림(시상) ' + e.fwhm.toFixed(1) + ' 픽셀 · 하늘빛 ' + e.sky.toFixed(0) + ' 전자/픽셀 · 구름으로 어두워진 정도 ' + (e.transp > 0 ? '+' : '') + e.transp.toFixed(2) + ' 등급';
        // 이 사진에서의 구경측광 값
        const c = C.centroid(R.frames[cur][fi], st.W, st.H, st.stars[0].x + e.jx, st.stars[0].y + e.jy, 1.2 * e.fwhm);
        const a = C.aperture(R.frames[cur][fi], st.W, st.H, c.x, c.y, tap.rAp, tap.rIn, tap.rOut);
        const f = Math.max(a.flux, 1);
        readout.innerHTML = '';
        readout.append(h('table', null,
          h('tr', null, h('td', null, '원(구경) 안의 빛 전부'), h('td', { class: 'mono' }, (a.flux + a.sky * a.npix).toFixed(0))),
          h('tr', null, h('td', null, '하늘빛 (픽셀당) × 픽셀 수'), h('td', { class: 'mono' }, a.sky.toFixed(1) + ' × ' + a.npix.toFixed(0))),
          h('tr', null, h('td', null, h('b', null, '별의 빛 = 전부 − 하늘빛')), h('td', { class: 'mono' }, a.flux.toFixed(0) + ' 전자')),
          h('tr', null, h('td', null, h('b', null, '측정 등급 (−2.5 log 빛의 양)')), h('td', { class: 'mono' }, (-2.5 * Math.log10(f)).toFixed(3)))));
      }


      // ---------- + 도전: 구경과 하늘 고리를 직접 정해 보기 ----------
      // 연습용이에요. 아래 그래프는 항상 자동 설정으로 계산하고, 여기서는 내가 정한 값이 적당한지 점검해 줘요.
      const man = { on: false, rAp: 2, rIn: 3, rOut: 5, showAuto: false };
      const sAp = h('input', { type: 'range', min: 0.8, max: 10, step: 0.1, value: man.rAp });
      const sIn = h('input', { type: 'range', min: 1, max: 14, step: 0.1, value: man.rIn });
      const sOut = h('input', { type: 'range', min: 2, max: 20, step: 0.1, value: man.rOut });
      const lAp = h('b'), lIn = h('b'), lOut = h('b');
      const autoLine = h('div', { class: 'muted', style: { fontSize: '.88rem' } });
      const manChecks = h('div');
      const manBody = h('div', { style: { display: 'none' } });
      const manToggle = h('input', { type: 'checkbox', onchange: (e) => { man.on = e.target.checked; manBody.style.display = man.on ? '' : 'none'; drawView(); updateMan(); } });
      const showAutoChk = h('input', { type: 'checkbox', onchange: (e) => { man.showAuto = e.target.checked; drawView(); } });
      const gapRow = (label, lbl, sl, unit) => h('div', { class: 'row', style: { gap: '8px' } }, h('span', { style: { minWidth: '9.5em' } }, label + ' '), lbl, h('span', { class: 'muted' }, unit), sl);
      function setMan(rAp, rIn, rOut) {
        man.rAp = rAp; man.rIn = rIn; man.rOut = rOut;
        sAp.value = rAp; sIn.value = rIn; sOut.value = rOut;
        drawView(); updateMan();
      }
      [[sAp, 'rAp'], [sIn, 'rIn'], [sOut, 'rOut']].forEach(([el, k]) => el.addEventListener('input', () => { man[k] = +el.value; drawView(); updateMan(); }));
      manBody.append(
        h('p', { class: 'muted' }, '노란 원(구경)을 얼마나 크게 그릴지, 하늘 값을 잴 고리를 어디에 둘지 직접 정해 보세요. 사진 속 하늘색 원이 내가 정한 값이고, 아래에 적당한지 바로 점검해 줘요. 위의 날짜 슬라이더를 움직여 시상이 다른 날에도 확인해 보세요.'),
        gapRow('구경 반지름', lAp, sAp, '픽셀'),
        gapRow('하늘 고리 안쪽', lIn, sIn, '픽셀'),
        gapRow('하늘 고리 바깥쪽', lOut, sOut, '픽셀'),
        h('div', { class: 'row', style: { margin: '6px 0' } },
          h('button', { class: 'sm', onclick: () => { const a = C.autoAperture(eps[fi].fwhm); setMan(+a.rAp.toFixed(1), +a.rIn.toFixed(1), +a.rOut.toFixed(1)); } }, '자동 값으로 맞추기'),
          h('label', { class: 'chk' }, showAutoChk, h('span', { class: 'muted' }, '자동 설정 원 겹쳐 보기'))),
        manChecks);
      const manPanel = h('div', { class: 'manual' },
        h('label', { class: 'chk', style: { fontWeight: 700 } }, manToggle, h('span', null, '🎯 직접 정해 보기 (+난이도)')),
        autoLine, manBody);

      function updateMan() {
        const e = eps[fi], auto = C.autoAperture(e.fwhm);
        autoLine.textContent = '자동 설정: 구경 반지름 ' + auto.rAp.toFixed(1) + ' 픽셀(시상의 1.6배), 하늘 고리 ' + auto.rIn.toFixed(1) + ' ~ ' + auto.rOut.toFixed(1) + ' 픽셀. 컴퓨터는 매일의 시상에 맞춰 이 값을 정해요.';
        lAp.textContent = man.rAp.toFixed(1); lIn.textContent = man.rIn.toFixed(1); lOut.textContent = man.rOut.toFixed(1);
        manChecks.innerHTML = '';
        if (!man.on) return;
        const v = C.varById(cur), st = v.stamp, img = R.frames[cur][fi];
        const c = C.centroid(img, st.W, st.H, st.stars[0].x + e.jx, st.stars[0].y + e.jy, 1.2 * e.fwhm);
        const rows = [];
        const add = (kind, title, text) => rows.push({ kind, title, text });
        if (man.rOut - man.rIn < 1) {
          manChecks.append(h('div', { class: 'callout bad' }, '하늘 고리의 바깥쪽 반지름이 안쪽보다 1픽셀 이상 커야 해요.'));
          return;
        }
        const aS = C.aperture(img, st.W, st.H, c.x, c.y, man.rAp, man.rIn, man.rOut);
        const aA = C.aperture(img, st.W, st.H, c.x, c.y, auto.rAp, auto.rIn, auto.rOut);
        const aRef = C.aperture(img, st.W, st.H, c.x, c.y, man.rAp, man.rAp + 2.5, man.rAp + 7);

        // 1) 구경 크기: 별빛을 얼마나 담는가 (Moffat β=3 별 모양)
        const alpha = e.fwhm / (2 * Math.sqrt(Math.pow(2, 1 / 3) - 1));
        const enc = 1 - Math.pow(1 + (man.rAp * man.rAp) / (alpha * alpha), -2);
        const ratio = man.rAp / e.fwhm;
        if (enc < 0.8) add('bad', '구경이 너무 작아요', '별빛의 ' + (enc * 100).toFixed(0) + '%만 담겨요. 나머지는 원 밖으로 새고, 시상이 바뀌면 새는 양도 바뀌어서 밝기가 들쭉날쭉해져요.');
        else if (enc < 0.9) add('warn', '구경이 조금 작아요', '별빛의 ' + (enc * 100).toFixed(0) + '%를 담아요. 90% 이상이면 더 안정적이에요.');
        else if (ratio > 2.8) add('warn', '구경이 너무 커요', '별빛은 ' + (enc * 100).toFixed(0) + '% 담지만 하늘 잡음까지 많이 들어와요 (시상의 ' + ratio.toFixed(1) + '배).');
        else add('ok', '구경 크기가 알맞아요', '별빛의 ' + (enc * 100).toFixed(0) + '%를 담아요 (시상의 ' + ratio.toFixed(1) + '배).');

        // 2) S/N: 자동 설정과 비교
        const snrS = aS.flux / aS.err, snrA = aA.flux / aA.err, sr = snrS / snrA;
        if (sr >= 0.95) add('ok', 'S/N이 좋아요', '내 설정의 S/N ' + snrS.toFixed(0) + ' (자동 설정의 ' + (sr * 100).toFixed(0) + '%).');
        else if (sr >= 0.85) add('warn', 'S/N이 조금 낮아요', '내 설정의 S/N ' + snrS.toFixed(0) + ' (자동 설정 ' + snrA.toFixed(0) + '의 ' + (sr * 100).toFixed(0) + '%).');
        else add('bad', 'S/N이 많이 낮아요', '내 설정의 S/N ' + snrS.toFixed(0) + ' (자동 설정 ' + snrA.toFixed(0) + '의 ' + (sr * 100).toFixed(0) + '%). 측정 오차가 그만큼 커져요.');

        // 3) 하늘 고리가 별빛을 먹거나 멀리 떨어졌는가: 깨끗한 참고 고리와 비교
        const gap = man.rIn - man.rAp;
        const bias = (aS.flux - aRef.flux) / aRef.flux * 100;
        if (Math.abs(bias) > 2) add('bad', '하늘 고리 위치가 별에 너무 가까워요 (또는 먼 별이 섞여요)', '고리를 깨끗한 곳에 두었을 때보다 별빛이 ' + (bias > 0 ? '+' : '') + bias.toFixed(1) + '% 달라져요. ' + (gap < 1 ? '별 가장자리의 빛이 하늘로 계산되는 중이에요. 구경보다 1.5픽셀쯤은 바깥에 두세요.' : '고리 안에 다른 별이 걸렸는지 확인하세요.'));
        else if (gap < 1) add('warn', '고리가 구경에 너무 붙어 있어요', '별의 퍼진 가장자리 빛이 하늘로 계산될 수 있어요. 구경보다 1.5픽셀쯤 바깥이 좋아요.');
        else if (gap > 8) add('warn', '고리가 별에서 너무 멀어요', '멀리 있는 다른 별이나 얼룩이 섞이기 쉬워요.');
        else add('ok', '하늘 고리 위치가 알맞아요', '별빛이 ' + (bias > 0 ? '+' : '') + bias.toFixed(1) + '%밖에 안 달라지는 깨끗한 위치예요.');

        // 4) 하늘 고리 픽셀 수
        if (aS.nsky >= 80) add('ok', '하늘 고리의 픽셀이 충분해요', aS.nsky + '개의 픽셀로 하늘 값을 안정적으로 재요.');
        else if (aS.nsky >= 40) add('warn', '하늘 고리가 조금 좁아요', aS.nsky + '개뿐이에요. 고리를 두껍게 하면 하늘 값이 더 안정돼요.');
        else add('bad', '하늘 고리가 너무 좁아요', aS.nsky + '개뿐이라 하늘 값이 들쭉날쭉해요.');

        // 5) 이웃 별이 구경이나 고리에 걸렸는가
        const nb = st.stars.filter((s) => s.role !== 'target').map((s) => ({ id: s.id, x: s.x, y: s.y, mag: s.mag }))
          .concat(st.hidden.map((s) => ({ id: '숨은 별', x: s.x, y: s.y, mag: s.mag })));
        const target = st.stars[0];
        const dist = (s) => Math.hypot(s.x + e.jx - c.x, s.y + e.jy - c.y);
        const bright = nb.filter((s) => s.mag < target.mag + 2.5);
        const inAp = bright.filter((s) => dist(s) < man.rAp + 1.5).map((s) => s.id);
        const inRing = bright.filter((s) => dist(s) > man.rIn - 1.5 && dist(s) < man.rOut + 1.5).map((s) => s.id);
        if (inAp.length) add('bad', '이웃 별이 구경 안에 들어왔어요', inAp.join(', ') + ' 의 빛이 섞여요. 구경을 줄이거나 다른 날을 골라 보세요.');
        else if (inRing.length) add('bad', '이웃 별이 하늘 고리에 걸렸어요', inRing.join(', ') + ' 의 빛이 하늘 값을 높여서 별빛을 실제보다 어둡게 만들어요. 고리 크기를 바꿔 피해 보세요.');
        else add('ok', '이웃 별이 걸리지 않았어요', '구경과 하늘 고리 안에 다른 밝은 별이 없어요.');

        const okN = rows.filter((r) => r.kind === 'ok').length;
        manChecks.append(
          ...rows.map((r) => h('div', { class: 'chk-row ' + r.kind }, h('span', { class: 'ico' }, r.kind === 'ok' ? '✔' : r.kind === 'warn' ? '△' : '✘'), h('div', null, h('b', null, r.title), h('div', { class: 'muted', style: { fontSize: '.88rem' } }, r.text)))),
          h('div', { class: 'callout ' + (okN === rows.length ? 'good' : okN >= 3 ? 'warn' : 'bad'), style: { marginTop: '8px' } },
            h('b', null, '점검 ' + okN + ' / ' + rows.length + ' 통과. '),
            okN === rows.length ? '컴퓨터의 자동 설정과 비슷한 수준이에요! 이런 값을 매일 시상에 맞춰 자동으로 정해 주는 거예요.' : '빨간 항목부터 고쳐 보세요. 막히면 "자동 값으로 맞추기"를 눌러 컴퓨터는 어떻게 정했는지 볼 수 있어요.'));
      }

      // ---------- 차트 ----------
      function drawCharts() {
        const ph = C.getPhot(cur), t = eps.map((e) => e.t);
        const mt = ph.meas.TGT;
        const okI = mt.inst.map((v, i) => i).filter((i) => mt.snr[i] >= 4);
        const ys = okI.map((i) => mt.inst[i]);
        const yr = C.padRange(ys, 0.12);
        rawPlot.begin(0, C.SIM.NIGHTS + 1, yr[0], yr[1]);
        rawPlot.scatter(okI.map((i) => t[i]), ys, { color: '#e8741c', err: okI.map((i) => mt.err[i]) });
        rawPlot.vline(t[fi], { color: 'rgba(37,99,235,.35)', dash: [4, 3] });

        const chosen = sel();
        const rr = chosen.length ? Math.max(0.15, Math.min(0.6, Math.max.apply(null, chosen.map((id) => Math.max.apply(null, ph.diag[id].res.map(Math.abs)))) * 1.1)) : 0.3;
        resPlot.begin(0, C.SIM.NIGHTS + 1, -rr, rr);
        resPlot.line([0, 91], [0, 0], { color: '#9db0d6', w: 1 });
        chosen.forEach((id, k) => {
          const d = ph.diag[id];
          const pts = d.res.map((v, i) => i).filter((i) => mt.snr[i] >= 0 && ph.meas[id].snr[i] >= 5);
          resPlot.scatter(pts.map((i) => t[i]), pts.map((i) => d.res[i]), { color: COLORS[k % COLORS.length], r: 2.5 });
        });
        if (!chosen.length) resPlot.text(45, 0, '비교성을 고르면 여기에 나타나요', { align: 'center', color: '#6b7da8', dy: -6 });

        if (chosen.length) {
          const lc = C.getLC(cur);
          const dr = C.padRange(lc.m, 0.12);
          diffPlot.begin(0, C.SIM.NIGHTS + 1, dr[0], dr[1]);
          diffPlot.scatter(lc.t, lc.m, { color: '#12a36a', err: lc.err });
          const med = C.median(lc.err);
          diffNote.innerHTML = '측정 오차(중앙값) <b>' + med.toFixed(3) + ' 등급</b> · 사용한 점 ' + lc.t.length + '/' + N + (lc.nDropped ? ' (너무 어두워 찾지 못한 ' + lc.nDropped + '개 제외)' : '');
        } else {
          diffPlot.begin(0, C.SIM.NIGHTS + 1, 0, 1);
          diffPlot.text(45, 0.5, '비교성을 2개 이상 고르면 차등측광 결과가 나타나요', { align: 'center', color: '#6b7da8' });
          diffNote.textContent = '';
        }
      }

      // ---------- 비교성 표 ----------
      function drawComps() {
        const ph = C.getPhot(cur), chosen = sel();
        compBox.innerHTML = '';
        if (!chosen.length) {
          compBox.append(h('div', { class: 'callout warn' }, cur === first ? '왼쪽 사진에서 비교성(비교용 별)으로 쓸 별을 클릭하세요. 별마다 이름표(A, B, …)가 있어요. 2개 이상 고르면 좋아요.' : '비교성이 없습니다.'));
          return;
        }
        const rows = chosen.map((id, k) => {
          const d = ph.diag[id];
          return h('tr', null,
            h('td', null, h('span', { style: { color: COLORS[k % COLORS.length], fontWeight: 700 } }, '● ' + id)),
            h('td', { class: 'mono' }, d.cat.toFixed(2)),
            h('td', { class: 'mono' }, d.rms.toFixed(3)),
            h('td', null, h('span', { class: 'tag ' + (d.grade === 'ok' ? 'ok' : d.grade === 'warn' ? 'warn' : 'bad') }, d.reason)),
            h('td', null, h('button', { class: 'sm', onclick: () => toggleComp(id) }, '빼기')));
        });
        compBox.append(
          !manual() && cur !== first ? h('div', { class: 'callout' }, '이 별은 자동으로 고른 비교성을 쓰고 있어요. 사진에서 별을 클릭하면 직접 바꿀 수 있어요.') : null,
          h('table', null, h('tr', null, h('th', null, '비교성'), h('th', null, '알려진 등급(카탈로그)'), h('th', null, '밝기 흔들림'), h('th', { style: { textAlign: 'left' } }, '점검 결과'), h('th')), rows));
        const bad = chosen.filter((id) => ph.diag[id].grade === 'bad');
        if (bad.length) compBox.append(h('div', { class: 'callout bad' }, '⚠ ' + bad.join(', ') + ' 는 비교성으로 부적합해 보여요. 위 점검 결과를 보고 다른 별로 바꿔 보세요.'));
        else if (chosen.length >= 2 && chosen.every((id) => ph.diag[id].grade === 'ok')) compBox.append(h('div', { class: 'callout good' }, '👍 좋은 비교성 조합이에요. 밤마다 비교성들이 같이 밝아지거나 어두워지니, 그만큼을 목표 별 값에서 빼 주면 됩니다.'));
      }

      function toggleComp(id) {
        if (!S.comps[cur] || !S.comps[cur].length) S.comps[cur] = (cur === first ? [] : C.compsFor(cur).slice());
        const k = S.comps[cur].indexOf(id);
        if (k >= 0) S.comps[cur].splice(k, 1); else if (S.comps[cur].length < 6) S.comps[cur].push(id);
        S.an = {}; S.plFit = false; S.revealed = false; R.an = {};
        C.save(); redraw(); C.refreshNav();
      }

      // ---------- 변광성 선택 칩 + 일괄 처리 ----------
      function drawChips() {
        chips.innerHTML = '';
        ids.forEach((id) => {
          const has = S.comps[id] && S.comps[id].length;
          chips.append(h('div', { class: 'chip' + (id === cur ? ' cur' : ''), onclick: () => { cur = id; redraw(); } },
            id, h('span', { class: 's' }, has ? '✓' : (S.batchDone ? '자동' : '·'))));
        });
      }
      function drawBatch() {
        batchBox.innerHTML = '';
        const ready = (S.comps[first] || []).length >= 2;
        const btn = h('button', { class: 'primary', disabled: !ready, onclick: () => {
          ids.forEach((id) => {
            if (!S.comps[id] || !S.comps[id].length) {
              const ph = C.getPhot(id);
              S.comps[id] = C.autoComps(ph.diag, C.approxTargetMag(ph), 4);
            }
          });
          S.batchDone = true; S.an = {}; R.an = {}; C.save(); redraw(); C.refreshNav();
        } }, S.batchDone ? '다시 한꺼번에 처리' : '나머지 변광성도 같은 방법으로 한꺼번에 처리');
        batchBox.append(btn, ready ? null : h('span', { class: 'muted', style: { marginLeft: '8px' } }, first + '의 비교성을 먼저 2개 이상 골라야 해요'));
        if (S.batchDone) {
          const rows = ids.map((id) => {
            const lc = C.getLC(id);
            return h('tr', { class: 'clickable', onclick: () => { cur = id; redraw(); } }, h('td', null, id), h('td', null, S.comps[id].join(', ')), h('td', { class: 'mono' }, lc.t.length + '/' + N), h('td', { class: 'mono' }, C.median(lc.err).toFixed(3)));
          });
          batchBox.append(h('table', { style: { marginTop: '10px' } }, h('tr', null, h('th', null, '변광성'), h('th', null, '비교성'), h('th', null, '사용한 점'), h('th', null, '측정 오차(중앙값)')), rows),
            h('div', { class: 'callout good' }, '✔ 모든 변광성의 밝기 그래프(광도곡선)가 준비됐어요. 다음 단계에서 주기를 찾습니다.'));
        }
      }

      function redraw() { drawChips(); drawView(); drawCharts(); drawComps(); drawBatch(); updateMan(); }

      // ---------- 이벤트 ----------
      function pick(e) {
        const r = view.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * view.width, py = ((e.clientY - r.top) / r.height) * view.height;
        const st = C.varById(cur).stamp, ep = eps[fi];
        let best = null, bd = 16;
        st.stars.forEach((s) => {
          if (s.role === 'target') return;
          const d = Math.hypot((s.x + ep.jx + 0.5) * SCALE - px, (s.y + ep.jy + 0.5) * SCALE - py);
          if (d < bd) { bd = d; best = s; }
        });
        return best;
      }
      view.addEventListener('mousemove', (e) => {
        const s = pick(e), id = s ? s.id : null;
        if (id !== hover) {
          hover = id; drawView();
          hoverLine.textContent = s ? '별 ' + s.id + ' · 알려진 등급 ' + s.cat.toFixed(2) + ' (클릭하면 비교성으로 고르거나 뺄 수 있어요)' : '';
        }
      });
      view.addEventListener('click', (e) => { const s = pick(e); if (s) toggleComp(s.id); });
      slider.addEventListener('input', () => { fi = +slider.value; drawView(); drawCharts(); updateMan(); });
      playBtn.onclick = () => {
        if (timer) { clearInterval(timer); timer = null; playBtn.textContent = '▶ 재생'; return; }
        playBtn.textContent = '⏸ 멈춤';
        timer = setInterval(() => { fi = (fi + 1) % N; slider.value = fi; drawView(); drawCharts(); }, 260);
      };
      C.onLeave(() => { if (timer) clearInterval(timer); });

      root.append(
        h('h2', null, '3단계 · 구경측광과 차등측광'),
        h('p', { class: 'lead' }, '측광은 사진에서 별의 밝기를 숫자로 재는 일이에요. 그런데 밤마다 구름과 대기 상태가 달라서, 같은 별도 사진마다 다르게 찍혀요. 그래서 ', h('b', null, '밝기가 변하지 않는 이웃 별(비교성)'), '과 비교해서 밝기를 구해야 해요.'),
        h('div', { class: 'grid cols-2' },
          h('div', null,
            h('div', { class: 'panel' },
              h('h3', null, '① 구경측광: 별 둘레에 원을 그려 빛 모으기'),
              h('p', { class: 'muted' }, '노란 원(구경) 안의 빛을 모두 더하고, 점선 고리 안에서 잰 하늘빛을 원 안의 픽셀 수만큼 빼요. 원 크기는 그날 별이 퍼진 정도(시상)에 맞춰 자동으로 정해져요.'),
              view,
              h('div', { class: 'row', style: { marginTop: '8px' } }, playBtn, slider),
              info, hoverLine, h('div', { style: { marginTop: '8px' } }, readout),
              manPanel)),
          h('div', null,
            h('div', { class: 'panel' },
              h('h3', null, '② 비교성 고르기'),
              h('div', { style: { marginBottom: '8px' } }, chips),
              h('p', { class: 'muted' }, '좋은 비교성: 목표 별과 밝기가 비슷하고 · 바로 옆에 이웃 별이 없고 · 너무 밝아서 센서가 넘치지(포화) 않고 · 사진 가장자리가 아니고 · 밝기가 변하지 않는 별.'),
              compBox),
            h('div', { class: 'panel', style: { marginTop: '16px' } },
              h('h3', null, '③ 차등측광: 비교성과의 차이로 날씨 영향 없애기'),
              h('div', { class: 'muted', style: { margin: '2px 0' } }, '그대로 잰 값: 밤마다 들쭉날쭉 (구름과 대기 흔들림 때문)'), cvRaw,
              h('div', { class: 'muted', style: { margin: '10px 0 2px' } }, '비교성들의 밝기 변화 (곧 날씨의 영향)'), cvRes,
              h('div', { class: 'muted', style: { margin: '10px 0 2px' } }, '목표 별 − 비교성 = 차등측광 결과'), cvDiff, diffNote),
            h('div', { class: 'panel', style: { marginTop: '16px' } }, h('h3', null, '④ 나머지 별도 한꺼번에 처리'), batchBox))),
        h('details', null, h('summary', null, '차등측광은 어떻게 되는 건가요?'),
          h('p', null, '어떤 밤 구름이 끼면 모든 별이 같은 정도로 어둡게 찍혀요. 그래서 (목표 별의 측정 등급) − (비교성의 측정 등급)을 구하면 구름의 영향이 서로 사라져요. 여기에 비교성의 ', h('b', null, '알려진 등급(카탈로그 등급)'), '을 더하면 목표 별의 등급 m이 나와요:'),
          h('div', { class: 'formula' }, 'm', h('sub', null, '목표'), ' = m', h('sub', null, '측정, 목표'), ' − 평균 [ m', h('sub', null, '측정, 비교성'), ' − m', h('sub', null, '카탈로그, 비교성'), ' ]'),
          h('p', null, '비교성이 여러 개면 평균을 내서 측정 흔들림도 줄어요. 단, 비교성이 혼자 밝기가 변하는 별이면 오히려 결과가 엉망이 돼요.')));

      redraw();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
