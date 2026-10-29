// 코어 조각들을 이어 붙인 파이프라인 (UI 와 테스트가 공유).
(function (g) {
  const C = g.CEPH = g.CEPH || {};

  // 전 변광성 × 전 에포크 프레임
  C.renderAllFrames = function (field, schedule, ids, onProgress) {
    const frames = {};
    field.vars.forEach((v) => { if (!ids || ids.indexOf(v.id) >= 0) frames[v.id] = []; });
    schedule.epochs.forEach((ep) => {
      const fr = C.renderEpoch(field, ep, ids);
      Object.keys(fr).forEach((id) => frames[id].push(fr[id]));
      if (onProgress) onProgress(ep.n);
    });
    return frames;
  };

  // 변광성 하나의 측광: 모든 별 측광 → 비교성 진단 → (선택된 비교성으로) 차등측광
  C.photometerVariable = function (v, frames, epochs, compIds) {
    const meas = C.measureStamp(v.stamp, frames, epochs);
    const diag = C.compDiagnostics(v.stamp, meas, epochs);
    return { meas, diag };
  };

  C.buildLightCurve = function (v, ph, epochs, compIds) {
    const cats = {};
    compIds.forEach((id) => { cats[id] = ph.diag[id].cat; });
    const d = C.differential(ph.meas, 'TGT', compIds, cats);
    const idx = [];
    d.valid.forEach((ok, i) => { if (ok) idx.push(i); });
    return {
      t: idx.map((i) => epochs[i].t), m: idx.map((i) => d.m[i]), err: idx.map((i) => d.err[i]),
      idx, nDropped: epochs.length - idx.length
    };
  };

  // 본성의 대략적 등급(계기등급 + 영점 중앙값) — 자동 비교성 선택용
  C.approxTargetMag = function (ph) {
    const ids = Object.keys(ph.diag);
    const zp = C.median(ids.map((id) => ph.diag[id].cat - C.median(ph.meas[id].inst)));
    return C.median(ph.meas.TGT.inst) + zp;
  };

  // 자동 분석: 주기도 → 최고 피크 → 푸리에 적합 → 모양 판정
  C.analyzeLightCurve = function (lc) {
    const pg = C.periodogram(lc.t, lc.m, 1.5, 60);
    const best = pg.peaks[0];
    const P = C.refinePeriod(lc.t, lc.m, best.period);
    const fit = C.fourierFit(lc.t, lc.m, P, 3);
    return { pg, P, fit, type: C.suggestType(fit), perr: C.periodError(lc.t, fit) };
  };
})(typeof window !== 'undefined' ? window : globalThis);
