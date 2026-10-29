// 2단계: 촬영 — 날짜가 흘러가며 프레임이 한 장씩 쌓이는 연출
(function (g) {
  const C = g.CEPH;
  const h = C.h;

  C.steps[2] = {
    render(root) {
      const S = C.S, R = C.world(), sched = R.schedule;
      const ids = S.picked;
      const first = ids[0];
      const nOk = sched.nights.filter((n) => n.status === 'ok').length;
      const nCloud = sched.nights.filter((n) => n.status === 'cloud').length;

      const cells = sched.nights.map((n) => h('div', { class: 'night pending', title: 'Day ' + n.day }));
      const timeline = h('div', { class: 'timeline' }, cells);
      const dayEl = h('div', { class: 'bigcount' }, S.observed ? String(C.SIM.NIGHTS) : '0');
      const status = h('div', { class: 'muted' }, S.observed ? '관측이 끝났어요.' : '아직 촬영 전');
      const view = h('canvas', { class: 'view', style: { width: '100%', maxWidth: '360px', aspectRatio: '1' } });
      const caption = h('div', { class: 'muted', style: { marginTop: '6px', fontSize: '.85rem' } });
      const thumbs = h('div', { class: 'thumbs' });
      const log = h('div', { class: 'muted', style: { fontSize: '.85rem', maxHeight: '110px', overflow: 'auto' } });
      const startBtn = h('button', { class: 'primary big' }, '🔭 촬영 시작');
      const stat = h('div');

      function paintCell(i, status, now) {
        cells[i].className = 'night ' + status + (now ? ' now' : '');
      }
      function showFrame(id, n) {
        const v = C.varById(id);
        C.drawFrame(view, R.frames[id][n], v.stamp.W, v.stamp.H, 4);
        const ep = sched.epochs[n];
        caption.textContent = id + ' 주변 · Day ' + ep.day + ' · 대기 흔들림(시상) ' + ep.fwhm.toFixed(1) + ' 픽셀 · ' + (ep.transp > 0.12 ? '엷은 구름' : '맑음');
      }
      function summary() {
        stat.innerHTML = '';
        stat.append(h('div', { class: 'kpi' },
          h('div', null, h('div', { class: 'v' }, String(nOk)), h('div', { class: 'l' }, '사진을 찍은 날')),
          h('div', null, h('div', { class: 'v' }, String(nCloud)), h('div', { class: 'l' }, '구름으로 놓친 밤')),
          h('div', null, h('div', { class: 'v' }, String(ids.length)), h('div', { class: 'l' }, '추적한 변광성')),
          h('div', null, h('div', { class: 'v' }, String(nOk * ids.length)), h('div', { class: 'l' }, '모은 사진 수'))));
      }

      if (S.observed) {
        C.ensureFrames();
        let ep = 0;
        sched.nights.forEach((n, i) => paintCell(i, n.status, false));
        showFrame(first, sched.epochs.length - 1);
        summary();
        startBtn.disabled = true; startBtn.textContent = '✔ 촬영 완료';
        log.textContent = '이미 촬영을 마쳤어요. "다음"을 눌러 밝기 재기(측광)를 시작하세요.';
      } else {
        cells.forEach((c) => c.className = 'night pending');
      }

      startBtn.onclick = () => {
        startBtn.disabled = true;
        const frames = {};
        ids.forEach((id) => { frames[id] = []; });
        let d = 0, ei = 0, stopped = false;
        C.onLeave(() => { stopped = true; });
        function tick() {
          if (stopped) return;
          if (d >= sched.nights.length) {
            ids.forEach((id) => { R.frames[id] = frames[id]; });
            S.observed = true; C.save();
            status.textContent = '관측 완료!';
            startBtn.textContent = '✔ 촬영 완료';
            summary(); C.refreshNav();
            return;
          }
          const n = sched.nights[d];
          dayEl.textContent = String(n.day);
          if (n.status === 'ok') {
            const ep = sched.epochs[ei];
            const fr = C.renderEpoch(R.field, ep, ids);
            ids.forEach((id) => frames[id].push(fr[id]));
            R.frames[first] = frames[first];
            showFrame(first, ei);
            const tc = document.createElement('canvas');
            tc.title = 'Day ' + n.day;
            C.drawFrame(tc, fr[first], R.field.vars[0].stamp.W, R.field.vars[0].stamp.H, 1);
            tc.style.width = tc.style.height = '';
            thumbs.appendChild(tc);
            while (thumbs.children.length > 14) thumbs.removeChild(thumbs.firstChild);
            paintCell(d, 'ok', true);
            status.textContent = 'Day ' + n.day + ' · 10분 동안 촬영 · 사진 ' + ids.length + '장 저장';
            ei++;
          } else if (n.status === 'cloud') {
            paintCell(d, 'cloud', true);
            status.textContent = 'Day ' + n.day + ' · ☁ 구름 때문에 관측 불가';
          } else {
            paintCell(d, 'off', true);
            status.textContent = 'Day ' + n.day + ' · 망원경을 쓸 수 없는 밤';
          }
          if (d > 0) cells[d - 1].classList.remove('now');
          d++;
          setTimeout(tick, n.status === 'ok' ? 75 : 35);
        }
        tick();
      };

      root.append(
        h('h2', null, '2단계 · 촬영'),
        h('p', { class: 'lead' }, '세페이드의 주기는 며칠~수십 일이라 하룻밤 사진으로는 알 수 없어요. 약 석 달 동안 틈틈이 같은 하늘을 찍어 밝기 변화를 쌓아야 합니다.'),
        h('div', { class: 'grid cols-2' },
          h('div', { class: 'panel' },
            h('div', { class: 'row' }, h('div', null, h('div', { class: 'muted' }, '관측 일수'), h('div', { class: 'row', style: { alignItems: 'baseline' } }, dayEl, h('span', { class: 'muted' }, ' / ' + C.SIM.NIGHTS + '일'))), h('span', { class: 'spacer' }), startBtn),
            status,
            h('div', { style: { margin: '12px 0 6px' } }, timeline),
            h('div', { class: 'legend' },
              h('span', null, h('i', { style: { background: 'var(--green)' } }), '촬영 성공'),
              h('span', null, h('i', { style: { background: '#9fb0d4' } }), '구름'),
              h('span', null, h('i', { style: { background: '#f1f5fc', border: '1px solid #e0e9f8' } }), '망원경을 못 쓴 밤')),
            h('div', { style: { marginTop: '12px' } }, stat)),
          h('div', { class: 'panel' },
            h('h3', null, '방금 찍은 사진'),
            view, caption,
            h('div', { style: { margin: '10px 0 4px' }, class: 'muted' }, '최근 사진들'),
            thumbs, h('div', { style: { marginTop: '8px' } }, log))),
        h('details', null, h('summary', null, '관측은 이렇게 이루어져요'),
          h('p', null, '가상의 큰 망원경에 V 필터(사람 눈에 가장 가까운 노란-초록빛만 통과시키는 필터)를 끼우고, 한 장에 10분(600초)씩 찍어요. 하늘 상태는 밤마다 달라서 어떤 밤은 구름이 끼고, 어떤 밤은 대기가 흔들려 별이 번져 보여요(시상). 망원경을 매일 쓸 수도 없어서 촬영 간격은 ', h('b', null, '불규칙'), '합니다. 그래서 4단계에서는 간격이 불규칙해도 쓸 수 있는 방법(Lomb–Scargle)을 써요.'),
          h('p', null, '이번에 선택한 변광성 주변 사진은 ' + ids.length + '곳 × ' + nOk + '번 = ' + (ids.length * nOk) + '장입니다. (교육용 시뮬레이션이라 사진 한 장에는 변광성 주변의 좁은 하늘만 담겨요.)')));
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
