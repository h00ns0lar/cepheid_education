// node tests/test_core.js
const path = require('path');
const root = path.join(__dirname, '..', 'js', 'core');
['rng', 'galaxies', 'sim', 'photometry', 'timeseries', 'plfit', 'pipeline'].forEach((f) => require(path.join(root, f + '.js')));
const C = globalThis.CEPH;

let fail = 0;
function ok(cond, msg) { if (!cond) { fail++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); }

// 1. 포그슨 왕복
{
  const mu = 24.47;
  ok(Math.abs(C.muFromDist(C.distFromMu(mu)) - mu) < 1e-9, '포그슨 정/역변환 왕복');
  ok(Math.abs(C.distFromMu(5) - 100) < 1e-9, 'm-M=5 → 100 pc');
}

// 2. 회귀
{
  const x = [0, 1, 2, 3, 4], y = x.map((v) => 2.5 * v - 1);
  const r = C.linreg(x, y);
  ok(Math.abs(r.slope - 2.5) < 1e-9 && Math.abs(r.intercept + 1) < 1e-9, '회귀 기울기/절편 복원');
}

// 3. Lomb-Scargle 주기 복원 (불규칙 샘플)
{
  const rand = C.rng(7);
  const t = [];
  for (let i = 0; i < 40; i++) t.push(rand.range(0, 90));
  t.sort((a, b) => a - b);
  const P = 11.3;
  const y = t.map((x) => 21 + 0.4 * Math.sin((2 * Math.PI * x) / P) + 0.02 * rand.gauss());
  const pg = C.periodogram(t, y);
  ok(Math.abs(pg.peaks[0].period - P) / P < 0.03, 'LS 주기 복원 ' + pg.peaks[0].period.toFixed(2));
}

// 4. 전체 파이프라인 (4개 은하)
C.GALAXIES.forEach((gal) => {
  console.log('\n==', gal.short);
  const field = C.buildField(gal, 12345);
  const sched = C.makeSchedule(12345);
  const epochs = sched.epochs;
  console.log('  에포크 수', epochs.length);
  const t0 = Date.now();
  const frames = C.renderAllFrames(field, sched);
  console.log('  프레임 생성 ms', Date.now() - t0);

  const rows = [];
  let wrongType = 0;
  field.vars.forEach((v) => {
    const ph = C.photometerVariable(v, frames[v.id], epochs);
    const comps = C.autoComps(ph.diag, C.approxTargetMag(ph), 4);
    const lc = C.buildLightCurve(v, ph, epochs, comps);
    const an = C.analyzeLightCurve(lc);
    const okP = v.type === 'cepheid' ? Math.abs(an.P - v.P) / v.P < 0.04 : null;
    if (an.type !== v.type) wrongType++;
    const magErr = an.fit.meanMag - v.meanMag;
    rows.push({ v, an, okP, magErr });
    console.log('  ', v.id, v.type.padEnd(8), 'P진', v.P.toFixed(2), 'P측', an.P.toFixed(2), '판정', an.type.padEnd(8), '<m>오차', magErr.toFixed(3), 'comps', comps.join(''));
  });
  const ceph = rows.filter((r) => r.v.type === 'cepheid');
  ok(ceph.every((r) => r.okP), '세페이드 8개 주기 ±4% 복원');
  ok(wrongType === 0, '모양 판정이 정답과 일치 (틀린 수 ' + wrongType + ')');

  // PL → 거리
  const calib = C.MW_CALIB.map((c) => ({ logP: c.logP, M: c.mV - C.muFromDist(1000 / c.parallax) }));
  const cal = C.linreg(calib.map((c) => c.logP - 1), calib.map((c) => c.M));
  const mus = ceph.map((r) => r.an.fit.meanMag - (cal.slope * (Math.log10(r.an.P) - 1) + cal.intercept));
  const mu = mus.reduce((a, b) => a + b, 0) / mus.length;
  const dTrue = C.distFromMu(gal.mu) / 1e6, dMeas = C.distFromMu(mu) / 1e6, dCorr = C.distFromMu(mu - gal.Av) / 1e6;
  console.log('  보정 PL: slope', cal.slope.toFixed(2), 'zp', cal.intercept.toFixed(2));
  console.log('  d진 ', dTrue.toFixed(3), 'Mpc  d측(소광무시)', dMeas.toFixed(3), ' d측(소광보정)', dCorr.toFixed(3));
  ok(Math.abs(dCorr - dTrue) / dTrue < 0.12, '소광 보정 후 거리 ±12% 이내');
});

console.log(fail ? '\n실패 ' + fail : '\n모두 통과');
process.exit(fail ? 1 : 0);
