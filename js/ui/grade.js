// 결과 등급: 실제로 활동한 시간 재기, 별점(★1~5) 또는 "보조 관측원" 등급, 결과 코드 만들기·확인하기
(function (g) {
  const C = g.CEPH;
  const h = C.h;

  // ---------- 실제로 활동한 시간 ----------
  // 은하를 뽑은 순간부터 정답을 처음 확인할 때까지. 탭을 떠나 있거나 2분 넘게 아무것도 안 한 시간은 빼요.
  const IDLE = 120000, TICK = 5000;
  let lastAct = Date.now(), lastTick = Date.now();
  C.startTimer = function () {
    ['pointerdown', 'keydown', 'wheel', 'input', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true, capture: true }));
    setInterval(() => {
      const now = Date.now(), dt = Math.min(now - lastTick, TICK * 2);
      lastTick = now;
      const S = C.S;
      if (!S.galaxyId || S.result || document.visibilityState !== 'visible' || now - lastAct > IDLE) return;
      if (!S.time) S.time = { active: 0, partial: true }; // 이 기능이 생기기 전에 시작한 기록
      S.time.active += dt;
      C.save();
    }, TICK);
  };
  C.activeMinutes = () => Math.round(((C.S.time && C.S.time.active) || 0) / 60000);

  // 몇 번째 도전인지: "처음부터"를 눌러도 지워지지 않게 따로 저장한다
  const AKEY = 'ceph-attempts';
  C.nextAttempt = function () {
    let n = 0;
    try { n = parseInt(localStorage.getItem(AKEY), 10) || 0; localStorage.setItem(AKEY, String(n + 1)); } catch (e) { /* 무시 */ }
    return n + 1;
  };

  // ---------- 등급 계산 ----------
  // ctx: { rows(6단계에 쓴 세페이드), err(오차 %), dTrue(pc) }
  C.gradeResult = function (ctx) {
    const S = C.S, log = S.log || {}, pred = S.pred || {};
    // 별마다 직접 할 수 있는 일: 4단계 주기·분류, 5단계 절대등급, 6단계 거리
    const how = [];
    S.picked.forEach((id) => { const a = S.an[id] || {}; how.push(a.howP, a.howType); });
    ctx.rows.forEach((r) => { how.push((log.pl || {})[r.id], (log.pog || {})[r.id]); });
    const direct = how.filter((x) => x === '직접').length, total = how.length;
    const ratio = total ? direct / total : 0;
    const peeked = how.filter((x) => x === '풀이').length;

    const ae = Math.abs(ctx.err);
    const acc = ae < 5 ? 30 : ae < 10 ? 22 : ae < 20 ? 12 : 5;
    const dir = Math.round(30 * ratio);

    // 예측 4가지 (각 3.75점)
    const first = S.picked[0], fin = S.an[first] && S.an[first].P;
    const dLy = ctx.dTrue * 3.26156;
    const fd = pred.dist0 ? Math.max(pred.dist0 / dLy, dLy / pred.dist0) : Infinity;
    const fp = pred.p1 > 0 && fin ? Math.abs(pred.p1 / fin - 1) : Infinity;
    const brightest = ctx.rows.length ? ctx.rows.reduce((a, r) => (r.P > a.P ? r : a)).id : null;
    const predHits = [
      { name: '처음 예상한 거리', s: fd <= 2 ? 1 : fd <= 5 ? 0.5 : 0 },
      { name: first + ' 주기 어림', s: fp <= 0.15 ? 1 : fp <= 0.3 ? 0.5 : 0 },
      { name: '가장 밝은 별', s: pred.bright && pred.bright === brightest ? 1 : 0 },
      { name: '먼지 보정 방향', s: pred.ext === 'near' ? 1 : 0 }
    ];
    const prd = Math.round(predHits.reduce((a, p) => a + p.s, 0) * 3.75);

    const min = C.activeMinutes();
    const tim = min >= 20 && min <= 60 ? 15 : (min >= 12 && min < 20) || (min > 60 && min <= 90) ? 10 : min < 12 || min <= 120 ? 5 : 3;

    const hints = log.hints || 0;
    const pen = Math.min(10, 2 * hints + 2 * peeked);
    const score = Math.max(0, Math.min(100, acc + dir + prd + tim - pen));
    const stars = score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 45 ? 2 : 1;
    const track = ratio < 0.5 ? 'assist' : 'star';
    const res = {
      track, stars, score, ratio, direct, total, err: ctx.err, min, hints, peeked,
      partial: !!(S.time && S.time.partial), attempt: S.attempt || 1,
      gal: C.galaxyById(S.galaxyId).short.replace(/\s+/g, ''),
      parts: { acc, dir, prd, tim, pen }, predHits
    };
    res.code = C.resultCode(res);
    return res;
  };

  // ---------- 결과 코드 ----------
  // 예: M31-S4-E3-T38-N2-K7Q2 (은하-별점(B는 보조 관측원)-오차 %-분-몇 번째 도전-확인 글자)
  const sig = (body) => (C.hashStr('cepheid-lab#' + body) % 1679616).toString(36).toUpperCase().padStart(4, '0');
  C.resultCode = function (r) {
    const body = [r.gal, r.track === 'star' ? 'S' + r.stars : 'B', 'E' + Math.round(Math.abs(r.err)), 'T' + r.min, 'N' + r.attempt].join('-');
    return body + '-' + sig(body);
  };
  C.checkCode = function (code) {
    const m = String(code || '').trim().toUpperCase().match(/^([A-Z0-9]+)-(S[1-5]|B)-E(\d+)-T(\d+)-N(\d+)-([A-Z0-9]{4})$/);
    if (!m) return null;
    const body = [m[1], m[2], 'E' + m[3], 'T' + m[4], 'N' + m[5]].join('-');
    if (sig(body) !== m[6]) return { ok: false };
    const gal = C.GALAXIES.find((x) => x.short.replace(/\s+/g, '').toUpperCase() === m[1]);
    return { ok: true, gal: gal ? gal.name : m[1], grade: m[2] === 'B' ? '보조 관측원' : '★' + m[2].slice(1), err: +m[3], min: +m[4], attempt: +m[5] };
  };

  // 선생님용: 주소 뒤에 ?code=결과코드 를 붙여 열면 코드가 진짜인지 알려 준다
  C.showCodeCheck = function () {
    let code = null;
    try { code = new URLSearchParams(location.search).get('code'); } catch (e) { /* 무시 */ }
    if (!code) return;
    const r = C.checkCode(code);
    const msg = !r ? '"' + code + '"는 결과 코드 형식이 아니에요.'
      : !r.ok ? '"' + code + '"는 확인 글자가 맞지 않아요. 숫자를 고쳐 쓴 코드일 수 있어요.'
        : '올바른 결과 코드예요. ' + r.gal + ' · ' + r.grade + ' · 거리 오차 ' + r.err + '% · 활동 시간 ' + r.min + '분 · ' + r.attempt + '번째 도전';
    C.ask(msg, () => {}, '확인');
  };

  // ---------- 결과 카드 ----------
  C.gradeCard = function (r) {
    const starRow = (n) => h('div', { class: 'stars', 'aria-label': '별 5개 중 ' + n + '개' },
      [1, 2, 3, 4, 5].map((i) => h('span', { class: i <= n ? 'on' : '' }, '★')));
    const pct = Math.round(r.ratio * 100);
    const head = r.track === 'star'
      ? h('div', { class: 'grade-head' }, starRow(r.stars), h('div', null, h('b', null, '별 5개 중 ' + r.stars + '개'), h('small', null, '100점 중 ' + r.score + '점')))
      : h('div', { class: 'grade-head assist' }, h('div', { class: 'badge' }, '보조 관측원'),
        h('div', null, h('b', null, '컴퓨터의 도움을 많이 받았어요'), h('small', null, '직접 푼 비율 ' + pct + '% · 절반 넘게 직접 풀면 별점을 받아요')));
    const P = r.parts;
    const rows = [
      ['거리 정확도', P.acc + ' / 30', '오차 ' + Math.abs(r.err).toFixed(1) + '%'],
      ['직접 풀이', P.dir + ' / 30', r.direct + ' / ' + r.total + '개 직접 (' + pct + '%)'],
      ['예측', P.prd + ' / 15', r.predHits.filter((p) => p.s === 1).length + ' / 4개 맞힘'],
      ['활동 시간', P.tim + ' / 15', r.min + '분' + (r.partial ? ' (중간부터 잼)' : '') + ' · 20~60분이면 만점'],
      ['힌트·풀이 보기', P.pen ? '−' + P.pen : '0', '힌트 ' + r.hints + '번 · 풀이 보고 넘어감 ' + r.peeked + '번']
    ];
    return h('div', { class: 'grade-card' },
      head,
      h('table', null, rows.map(([a, b, c]) => h('tr', null, h('td', null, a), h('td', { class: 'mono' }, b), h('td', null, c)))),
      h('div', { class: 'code-row' },
        h('span', null, '결과 코드'), h('code', null, r.code),
        h('button', { class: 'sm', onclick: (e) => { try { navigator.clipboard.writeText(r.code); e.target.textContent = '복사됨'; } catch (er) { /* 무시 */ } } }, '복사')),
      h('small', { class: 'muted' }, r.attempt + '번째 도전 · 처음 정답을 확인한 순간 기준으로 매긴 등급이라, 그 뒤에 값을 바꿔도 달라지지 않아요. 선생님께 결과 코드를 제출하세요.'),
      r.track === 'assist' ? h('div', { class: 'callout', style: { marginTop: '10px' } }, '다음 도전에서는 V1뿐 아니라 다른 별의 주기·분류, 5단계 절대등급, 6단계 거리도 직접 풀어 보세요. 직접 푼 비율이 절반을 넘으면 별점을 받을 수 있어요.') : null);
  };
})(typeof window !== 'undefined' ? window : globalThis);
