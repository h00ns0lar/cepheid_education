// 앱 상태, 내비게이션, 공유 도우미
(function (g) {
  const C = g.CEPH;
  const h = C.h;
  const KEY = 'ceph-v1';

  C.STEP_NAMES = ['변광성 찾기', '촬영', '밝기 재기', '주기 찾기', '주기-광도 관계', '거리 계산'];
  C.steps = C.steps || {};

  function fresh() {
    return { galaxyId: null, seed: 0, step: 1, picked: [], observed: false, comps: {}, batchDone: false, an: {}, incl: {}, calib: false, plFit: false, ext: false, revealed: false };
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.galaxyId !== undefined) return Object.assign(fresh(), s); } catch (e) { /* 무시 */ }
    return fresh();
  }
  C.S = load();
  C.R = { field: null, schedule: null, frames: {}, phot: {}, lc: {}, an: {} };
  C.save = function () { try { localStorage.setItem(KEY, JSON.stringify(C.S)); } catch (e) { /* 무시 */ } };

  C.world = function () {
    const S = C.S, R = C.R;
    if (!S.galaxyId) return null;
    if (!R.field || R.field.seed !== S.seed || R.field.galaxy.id !== S.galaxyId) {
      R.field = C.buildField(C.galaxyById(S.galaxyId), S.seed);
      R.schedule = C.makeSchedule(S.seed);
      R.frames = {}; R.phot = {}; R.lc = {}; R.an = {};
    }
    return R;
  };
  C.varById = (id) => C.world().field.vars.find((v) => v.id === id);

  // 관측 완료 후 선택한 변광성의 프레임을 확보 (복원 시 한꺼번에 생성)
  C.ensureFrames = function () {
    const R = C.world();
    const need = C.S.picked.filter((id) => !R.frames[id]);
    if (!need.length) return R;
    const fr = C.renderAllFrames(R.field, R.schedule, need);
    need.forEach((id) => { R.frames[id] = fr[id]; });
    return R;
  };

  C.getPhot = function (id) {
    const R = C.ensureFrames();
    if (!R.phot[id]) R.phot[id] = C.photometerVariable(C.varById(id), R.frames[id], R.schedule.epochs);
    return R.phot[id];
  };

  C.compsFor = function (id) {
    const S = C.S;
    if (S.comps[id] && S.comps[id].length) return S.comps[id];
    const ph = C.getPhot(id);
    return C.autoComps(ph.diag, C.approxTargetMag(ph), 4);
  };

  C.getLC = function (id) {
    const R = C.world();
    const comps = C.compsFor(id);
    const key = comps.join(',');
    if (!R.lc[id] || R.lc[id].key !== key) {
      const ph = C.getPhot(id);
      R.lc[id] = { key, lc: C.buildLightCurve(C.varById(id), ph, R.schedule.epochs, comps) };
      delete R.an[id];
    }
    return R.lc[id].lc;
  };

  C.getAuto = function (id) {
    const R = C.world();
    const lc = C.getLC(id);
    if (!R.an[id]) R.an[id] = C.analyzeLightCurve(lc);
    return R.an[id];
  };

  // ---- 단계 완료 조건 ----
  C.isDone = function (n) {
    const S = C.S;
    switch (n) {
      case 1: return !!S.galaxyId && S.picked.length >= 6;
      case 2: return S.observed;
      case 3: return S.batchDone && (S.comps[S.picked[0]] || []).length >= 2;
      case 4: return S.picked.length > 0 && S.picked.every((id) => S.an[id] && S.an[id].type);
      case 5: return S.plFit;
      case 6: return S.revealed;
    }
    return false;
  };
  C.maxStep = function () {
    let n = 1;
    while (n < 6 && C.isDone(n)) n++;
    return n;
  };

  // ---- 화면 전환 ----
  const cleanups = [];
  C.onLeave = (fn) => cleanups.push(fn);

  C.go = function (n) {
    n = Math.max(1, Math.min(6, n));
    if (n > C.maxStep()) n = C.maxStep();
    while (cleanups.length) { try { cleanups.pop()(); } catch (e) { /* 무시 */ } }
    C.S.step = n; C.save();
    const stage = C.$('#stage');
    stage.innerHTML = '';
    try { C.steps[n].render(stage); } catch (e) {
      console.error(e);
      stage.appendChild(h('div', { class: 'callout bad' }, '화면을 그리는 중 오류가 났어요: ' + e.message));
    }
    C.refreshNav();
    window.scrollTo(0, 0);
  };

  C.refreshNav = function () {
    const S = C.S, mx = C.maxStep();
    const st = C.$('#stepper');
    st.innerHTML = '';
    C.STEP_NAMES.forEach((name, i) => {
      const n = i + 1;
      const cls = 'step-pill' + (n === S.step ? ' cur' : '') + (C.isDone(n) ? ' done' : '') + (n > mx ? ' locked' : '');
      st.appendChild(h('div', { class: cls, onclick: () => { if (n <= C.maxStep()) C.go(n); } },
        h('span', { class: 'n' }, C.isDone(n) ? '✓' : String(n)), name));
    });
    C.$('#btn-prev').disabled = S.step <= 1;
    const nxt = C.$('#btn-next');
    nxt.style.visibility = S.step >= 6 ? 'hidden' : 'visible';
    nxt.disabled = !C.isDone(S.step);
    C.$('#nav-hint').textContent = C.isDone(S.step) || S.step >= 6 ? '' : (C.hintFor ? C.hintFor(S.step) : '');
  };

  C.hintFor = function (n) {
    const S = C.S;
    switch (n) {
      case 1: return !S.galaxyId ? '먼저 은하를 뽑아 보세요' : '변광성을 6개 이상 선택하면 다음으로 갈 수 있어요 (' + S.picked.length + '/6)';
      case 2: return '"촬영 시작"을 눌러 관측을 끝내세요';
      case 3: return '비교성(비교용 별)을 2개 이상 고르고, 나머지 변광성도 한꺼번에 처리하세요';
      case 4: return '모든 변광성을 세페이드인지 아닌지 나눠 주세요';
      case 5: return '버튼을 눌러 주기-광도 관계를 완성하세요';
      default: return '';
    }
  };

  C.resetAll = function () {
    C.ask('처음부터 다시 시작할까요? 지금까지의 진행이 지워집니다.', () => {
      try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ }
      C.S = fresh();
      C.R = { field: null, schedule: null, frames: {}, phot: {}, lc: {}, an: {} };
      C.go(1);
    }, '처음부터');
  };

  // ---- 용어집 ----
  const GLOSS = [
    ['세페이드 변광성', '밝기가 일정한 주기로 밝아졌다 어두워졌다 하는 별. 주기가 길수록 실제로 더 밝다.'],
    ['등급', '별의 밝기를 나타내는 숫자. 숫자가 작을수록 더 밝다. (예: 1등급은 6등급보다 100배 밝다)'],
    ['겉보기등급 m', '지구에서 보이는 밝기. 별이 멀수록 어둡게 보여서 숫자가 커진다.'],
    ['절대등급 M', '별을 10 pc(약 32.6광년) 거리에 놓았다고 가정했을 때의 등급. 별의 진짜 밝기를 나타낸다.'],
    ['광도', '별이 내는 빛의 총량. 보통 태양을 1로 놓고 몇 배인지로 나타낸다.'],
    ['측광', '사진에서 별의 밝기를 숫자로 재는 일.'],
    ['구경측광', '별 둘레에 원(구경)을 그려 그 안의 빛을 모두 더하고, 원 바깥 고리에서 잰 하늘빛을 빼서 별이 낸 빛의 양을 구하는 방법.'],
    ['계기등급 (측정 등급)', '잰 빛의 양에서 바로 계산한 등급(m = −2.5 log F). 날씨와 장비에 따라 밤마다 값이 달라져서 그대로는 쓸 수 없다.'],
    ['차등측광', '같은 사진 속 밝기가 변하지 않는 별(비교성)과의 차이로 목표 별의 밝기를 구하는 방법. 구름이나 대기 흔들림 같은 밤마다의 영향이 함께 사라진다.'],
    ['비교성', '비교용으로 쓰는 별. 밝기가 변하지 않고, 목표 별과 밝기가 비슷하며, 이웃 별이 없고 알려진 등급(카탈로그 등급)이 있어야 한다.'],
    ['포화', '별이 너무 밝아서 카메라 센서가 담을 수 있는 양을 넘친 상태. 이런 별은 밝기를 정확히 잴 수 없다.'],
    ['시상 (seeing)', '대기가 흔들려서 별이 번져 보이는 정도. 숫자가 클수록 별이 더 퍼져 보인다.'],
    ['광도곡선', '시간에 따라 별의 밝기가 어떻게 변하는지 나타낸 그래프.'],
    ['Lomb–Scargle 주기도', '촬영 간격이 불규칙한 자료에서 주기를 찾는 방법. 주기마다 얼마나 잘 맞는지를 그래프로 그리고, 가장 높은 봉우리가 후보 주기이다.'],
    ['위상 접기', '관측 시각을 "한 주기 중 어디쯤인가(0~1)"로 바꿔서 한 주기 안에 겹쳐 그리는 것. 주기가 맞으면 점들이 매끈한 곡선을 이룬다.'],
    ['가짜 봉우리 (앨리어싱·조화 피크)', '촬영 간격이나 곡선 모양 때문에 진짜 주기의 2배, 절반 같은 자리에 생기는 가짜 봉우리.'],
    ['식쌍성', '두 별이 서로의 둘레를 돌면서 번갈아 상대를 가려 밝기가 변하는 별. 세페이드가 아니라서 주기-광도 관계에 쓰면 안 된다.'],
    ['주기-광도 관계 (리비트 법칙)', '세페이드는 주기가 길수록 더 밝다는 법칙. 주기의 로그와 절대등급이 직선 관계를 이룬다. 1912년 리비트가 소마젤란은하의 세페이드에서 발견했다.'],
    ['시차', '지구가 태양 둘레를 돌 때, 가까운 별이 먼 배경 별들에 비해 조금 움직여 보이는 각도. 각이 클수록 가까워서, 거리(pc) = 1000 / 시차(밀리각초) 로 구한다.'],
    ['pc (파섹)', '천문학에서 쓰는 거리 단위. 1 pc ≈ 3.26광년. 1 kpc(킬로파섹) = 1000 pc, 1 Mpc(메가파섹) = 100만 pc.'],
    ['거리 모듈러스 μ', 'μ = m − M. 겉보기등급과 절대등급의 차이로, 별까지의 거리를 담고 있는 값.'],
    ['포그슨 방정식', 'm − M = 5 log₁₀(d / 10 pc). 거리 모듈러스로부터 거리 d를 구하는 식.'],
    ['성간소광 A_V', '별과 지구 사이의 우주 먼지가 별빛을 어둡게(그리고 붉게) 만드는 정도. 보정하지 않으면 별이 실제보다 멀게 계산된다.']
  ];

  function init() {
    C.$('#gloss-body').append(...GLOSS.map(([t, d]) => h('div', null, h('dt', null, t), h('dd', null, d))));
    C.$('#btn-gloss').onclick = () => C.$('#gloss').showModal();
    C.$('#btn-reset').onclick = C.resetAll;
    C.$('#btn-prev').onclick = () => C.go(C.S.step - 1);
    C.$('#btn-next').onclick = () => C.go(C.S.step + 1);
    window.addEventListener('resize', () => { if (C.steps[C.S.step] && C.steps[C.S.step].resize) C.steps[C.S.step].resize(); });
    let start = C.S.step;
    if (!C.S.galaxyId) start = 1;
    C.go(start);
  }
  document.addEventListener('DOMContentLoaded', init);
})(typeof window !== 'undefined' ? window : globalThis);
