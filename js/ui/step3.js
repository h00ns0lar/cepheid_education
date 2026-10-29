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
      const rawPlot = new C.Plot(cvRaw, { xlabel: '날짜 (일)', ylabel: '계기등급 (−2.5 log 플럭스)', invertY: true });
      const resPlot = new C.Plot(cvRes, { xlabel: '날짜 (일)', ylabel: '비교성 변화 (mag)', invertY: true });
      const diffPlot = new C.Plot(cvDiff, { xlabel: '날짜 (일)', ylabel: '차등측광 등급 (mag)', invertY: true });

      const sel = () => (S.comps[cur] && S.comps[cur].length ? S.comps[cur] : (cur === first ? [] : C.compsFor(cur)));
      const manual = () => !!(S.comps[cur] && S.comps[cur].length);

      // ---------- 이미지 뷰 ----------
      function drawView() {
        const v = C.varById(cur), st = v.stamp, e = eps[fi];
        const ctx = C.drawFrame(view, R.frames[cur][fi], st.W, st.H, SCALE);
        const ap = C.autoAperture(e.fwhm);
        const P = (s) => [(s.x + e.jx + 0.5) * SCALE, (s.y + e.jy + 0.5) * SCALE];
        const chosen = sel();
        st.stars.forEach((s) => {
          const [x, y] = P(s);
          if (s.role === 'target') {
            ctx.strokeStyle = '#ffcb47'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y, ap.rAp * SCALE, 0, 6.2832); ctx.stroke();
            ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,203,71,.8)';
            ctx.beginPath(); ctx.arc(x, y, ap.rIn * SCALE, 0, 6.2832); ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y, ap.rOut * SCALE, 0, 6.2832); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffcb47'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
            ctx.fillText('본성 ' + cur, x + ap.rOut * SCALE * 0.72 + 2, y - ap.rOut * SCALE * 0.72);
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
        info.textContent = 'Day ' + e.day + ' · 시상(FWHM) ' + e.fwhm.toFixed(1) + ' px · 하늘 ' + e.sky.toFixed(0) + ' e⁻/px · 투명도 손실 ' + (e.transp > 0 ? '+' : '') + e.transp.toFixed(2) + ' mag';
        // 이 사진에서의 구경측광 값
        const c = C.centroid(R.frames[cur][fi], st.W, st.H, st.stars[0].x + e.jx, st.stars[0].y + e.jy, 1.2 * e.fwhm);
        const a = C.aperture(R.frames[cur][fi], st.W, st.H, c.x, c.y, ap.rAp, ap.rIn, ap.rOut);
        const f = Math.max(a.flux, 1);
        readout.innerHTML = '';
        readout.append(h('table', null,
          h('tr', null, h('td', null, '구경 안 총합'), h('td', { class: 'mono' }, (a.flux + a.sky * a.npix).toFixed(0))),
          h('tr', null, h('td', null, '하늘 (픽셀당) × 픽셀 수'), h('td', { class: 'mono' }, a.sky.toFixed(1) + ' × ' + a.npix.toFixed(0))),
          h('tr', null, h('td', null, h('b', null, '별의 빛 = 총합 − 하늘')), h('td', { class: 'mono' }, a.flux.toFixed(0) + ' e⁻')),
          h('tr', null, h('td', null, h('b', null, '계기등급 −2.5 log F')), h('td', { class: 'mono' }, (-2.5 * Math.log10(f)).toFixed(3)))));
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
          diffNote.innerHTML = '측정 오차 중앙값 <b>' + med.toFixed(3) + ' mag</b> · 사용한 점 ' + lc.t.length + '/' + N + (lc.nDropped ? ' (너무 어두워 검출 실패 ' + lc.nDropped + '개 제외)' : '');
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
          compBox.append(h('div', { class: 'callout warn' }, cur === first ? '왼쪽 사진에서 비교성으로 쓸 별을 클릭하세요. 별마다 이름표(A, B, …)가 있어요. 2개 이상 고르면 좋아요.' : '비교성이 없습니다.'));
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
          h('table', null, h('tr', null, h('th', null, '비교성'), h('th', null, '카탈로그 등급'), h('th', null, '밝기 흔들림(rms)'), h('th', { style: { textAlign: 'left' } }, '점검 결과'), h('th')), rows));
        const bad = chosen.filter((id) => ph.diag[id].grade === 'bad');
        if (bad.length) compBox.append(h('div', { class: 'callout bad' }, '⚠ ' + bad.join(', ') + ' 는 비교성으로 부적합해 보여요. 위 점검 결과를 보고 다른 별로 바꿔 보세요.'));
        else if (chosen.length >= 2 && chosen.every((id) => ph.diag[id].grade === 'ok')) compBox.append(h('div', { class: 'callout good' }, '👍 좋은 비교성 조합이에요. 비교성들의 밝기가 밤마다 같이 움직이므로, 그만큼을 본성에서 빼 주면 됩니다.'));
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
        } }, S.batchDone ? '다시 일괄 처리' : '나머지 변광성도 같은 방법으로 일괄 처리');
        batchBox.append(btn, ready ? null : h('span', { class: 'muted', style: { marginLeft: '8px' } }, first + '의 비교성을 먼저 2개 이상 골라야 해요'));
        if (S.batchDone) {
          const rows = ids.map((id) => {
            const lc = C.getLC(id);
            return h('tr', { class: 'clickable', onclick: () => { cur = id; redraw(); } }, h('td', null, id), h('td', null, S.comps[id].join(', ')), h('td', { class: 'mono' }, lc.t.length + '/' + N), h('td', { class: 'mono' }, C.median(lc.err).toFixed(3)));
          });
          batchBox.append(h('table', { style: { marginTop: '10px' } }, h('tr', null, h('th', null, '변광성'), h('th', null, '비교성'), h('th', null, '사용한 점'), h('th', null, '오차 중앙값')), rows),
            h('div', { class: 'callout good' }, '✔ 모든 변광성의 광도곡선이 준비됐어요. 다음 단계에서 주기를 찾습니다.'));
        }
      }

      function redraw() { drawChips(); drawView(); drawCharts(); drawComps(); drawBatch(); }

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
          hoverLine.textContent = s ? '별 ' + s.id + ' · 카탈로그 등급 ' + s.cat.toFixed(2) + ' (클릭해서 비교성으로 선택/해제)' : '';
        }
      });
      view.addEventListener('click', (e) => { const s = pick(e); if (s) toggleComp(s.id); });
      slider.addEventListener('input', () => { fi = +slider.value; drawView(); drawCharts(); });
      playBtn.onclick = () => {
        if (timer) { clearInterval(timer); timer = null; playBtn.textContent = '▶ 재생'; return; }
        playBtn.textContent = '⏸ 멈춤';
        timer = setInterval(() => { fi = (fi + 1) % N; slider.value = fi; drawView(); drawCharts(); }, 260);
      };
      C.onLeave(() => { if (timer) clearInterval(timer); });

      root.append(
        h('h2', null, '3단계 · 구경측광과 차등측광'),
        h('p', { class: 'lead' }, '사진에서 별의 빛의 양을 재는 것이 측광이에요. 하지만 밤마다 구름·대기 상태가 달라서, 같은 별도 사진마다 다르게 찍힙니다. 그래서 ', h('b', null, '밝기가 변하지 않는 이웃 별(비교성)'), '과의 차이를 재야 해요.'),
        h('div', { class: 'grid cols-2' },
          h('div', null,
            h('div', { class: 'panel' },
              h('h3', null, '① 구경측광: 별의 빛 모으기'),
              h('p', { class: 'muted' }, '노란 원(구경) 안의 빛을 모두 더하고, 점선 고리(하늘) 속 배경 값을 픽셀 수만큼 빼요. 원 크기는 그날의 시상에 맞춰 자동으로 정해집니다.'),
              view,
              h('div', { class: 'row', style: { marginTop: '8px' } }, playBtn, slider),
              info, hoverLine, h('div', { style: { marginTop: '8px' } }, readout))),
          h('div', null,
            h('div', { class: 'panel' },
              h('h3', null, '② 비교성 고르기'),
              h('div', { style: { marginBottom: '8px' } }, chips),
              h('p', { class: 'muted' }, '좋은 비교성: 본성과 밝기가 비슷하고 · 이웃 별이 붙어 있지 않고 · 너무 밝아 포화되지 않고 · 가장자리가 아니고 · 밝기가 변하지 않는 별.'),
              compBox),
            h('div', { class: 'panel', style: { marginTop: '16px' } },
              h('h3', null, '③ 차등측광: 공통된 흔들림 빼기'),
              h('div', { class: 'muted', style: { margin: '2px 0' } }, '원시 측정: 밤마다 들쭉날쭉 (구름·시상 때문)'), cvRaw,
              h('div', { class: 'muted', style: { margin: '10px 0 2px' } }, '비교성들의 밝기 변화 (이게 곧 대기 상태의 영향)'), cvRes,
              h('div', { class: 'muted', style: { margin: '10px 0 2px' } }, '본성 − 비교성 = 차등측광 결과'), cvDiff, diffNote),
            h('div', { class: 'panel', style: { marginTop: '16px' } }, h('h3', null, '④ 나머지 별 일괄 처리'), batchBox))),
        h('details', null, h('summary', null, '차등측광은 어떻게 되는 건가요?'),
          h('p', null, '어떤 밤 구름이 끼면 모든 별이 같은 정도로 어둡게 찍혀요. 그래서 (본성의 계기등급) − (비교성의 계기등급)을 구하면 구름의 영향이 서로 상쇄됩니다. 여기에 비교성의 ', h('b', null, '카탈로그 등급'), '(알려진 진짜 등급)을 더하면 본성의 등급 m이 나와요:'),
          h('div', { class: 'formula' }, 'm', h('sub', null, '본성'), ' = m', h('sub', null, '계기, 본성'), ' − 평균 [ m', h('sub', null, '계기, 비교성'), ' − m', h('sub', null, '카탈로그, 비교성'), ' ]'),
          h('p', null, '비교성이 여러 개면 평균을 내어 잡음도 줄어듭니다. 단, 비교성이 혼자 변하는 별이면 오히려 광도곡선이 엉망이 돼요.')));

      redraw();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
