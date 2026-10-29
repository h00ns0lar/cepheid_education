// 구경측광(aperture photometry)과 차등측광(differential photometry).
(function (g) {
  const C = g.CEPH = g.CEPH || {};

  const median = (a) => {
    if (!a.length) return NaN;
    const s = Array.from(a).sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]);
  };
  C.median = median;

  // 밤마다 seeing 에 맞춰 구경 반지름과 하늘 고리를 자동으로 정한다.
  C.autoAperture = function (fwhm) {
    const rAp = 1.6 * fwhm;
    return { rAp, rIn: rAp + 1.5, rOut: rAp + 5 };
  };

  // 별 중심 보정 (밝기 가중 평균)
  C.centroid = function (img, W, H, x0, y0, r) {
    let x = x0, y = y0;
    for (let it = 0; it < 4; it++) {
      let sx = 0, sy = 0, sw = 0, lo = 1e30;
      const xa = Math.max(0, Math.floor(x - r)), xb = Math.min(W - 1, Math.ceil(x + r));
      const ya = Math.max(0, Math.floor(y - r)), yb = Math.min(H - 1, Math.ceil(y + r));
      for (let j = ya; j <= yb; j++) for (let i = xa; i <= xb; i++) {
        if ((i - x) * (i - x) + (j - y) * (j - y) <= r * r) lo = Math.min(lo, img[j * W + i]);
      }
      for (let j = ya; j <= yb; j++) for (let i = xa; i <= xb; i++) {
        if ((i - x) * (i - x) + (j - y) * (j - y) <= r * r) {
          const w = img[j * W + i] - lo;
          sx += w * i; sy += w * j; sw += w;
        }
      }
      if (sw <= 0) break;
      x = sx / sw; y = sy / sw;
    }
    // 예측 위치에서 너무 멀어지면 무시
    if (Math.hypot(x - x0, y - y0) > 1.5) return { x: x0, y: y0 };
    return { x, y };
  };

  // 구경측광: 원 안의 합 − 하늘 × 픽셀 수
  C.aperture = function (img, W, H, cx, cy, rAp, rIn, rOut) {
    const sky = [];
    let tot = 0, npix = 0, peak = 0;
    const xa = Math.max(0, Math.floor(cx - rOut)), xb = Math.min(W - 1, Math.ceil(cx + rOut));
    const ya = Math.max(0, Math.floor(cy - rOut)), yb = Math.min(H - 1, Math.ceil(cy + rOut));
    const inner = [];
    for (let j = ya; j <= yb; j++) for (let i = xa; i <= xb; i++) {
      const d = Math.hypot(i - cx, j - cy);
      const v = img[j * W + i];
      if (d >= rIn && d <= rOut) sky.push(v);
      else if (d < rAp + 0.5) {
        const w = Math.min(1, Math.max(0, rAp + 0.5 - d));
        inner.push([v, w]);
        if (v > peak) peak = v;
      }
    }
    // 하늘: 시그마 클리핑 평균
    let s = median(sky);
    let sd = 0;
    let use = sky;
    for (let it = 0; it < 4; it++) {
      const m = use.reduce((a, b) => a + b, 0) / Math.max(1, use.length);
      sd = Math.sqrt(use.reduce((a, b) => a + (b - m) * (b - m), 0) / Math.max(1, use.length - 1));
      s = m;
      const nu = sky.filter((v) => Math.abs(v - m) < 3 * sd);
      if (nu.length === use.length || nu.length < 5) break;
      use = nu;
    }
    inner.forEach(([v, w]) => { tot += w * (v - s); npix += w; });
    const err = Math.sqrt(Math.max(tot, 0) + npix * sd * sd * (1 + npix / Math.max(1, use.length)));
    return { flux: tot, sky: s, skySd: sd, npix, nsky: use.length, err, peak };
  };

  // 한 변광성 시야의 모든 카탈로그 별을 모든 프레임에서 측광
  C.measureStamp = function (stamp, frames, epochs) {
    const W = stamp.W, H = stamp.H;
    const res = {};
    stamp.stars.forEach((s) => {
      const r = { inst: [], err: [], snr: [], peak: [] };
      epochs.forEach((ep, n) => {
        const ap = C.autoAperture(ep.fwhm);
        const c = C.centroid(frames[n], W, H, s.x + ep.jx, s.y + ep.jy, 1.2 * ep.fwhm);
        const a = C.aperture(frames[n], W, H, c.x, c.y, ap.rAp, ap.rIn, ap.rOut);
        const f = Math.max(a.flux, 1);
        r.inst.push(-2.5 * Math.log10(f));
        r.err.push((1.0857 * a.err) / f);
        r.snr.push(a.flux / a.err);
        r.peak.push(a.peak);
      });
      res[s.id] = r;
    });
    return res;
  };

  // 비교성 후보 진단: 밤마다 공통으로 변하는 양(투명도 등)을 빼고도 일정한가?
  C.compDiagnostics = function (stamp, meas, epochs) {
    const cands = stamp.stars.filter((s) => s.role !== 'target');
    const N = epochs.length;
    const base = {};
    cands.forEach((s) => { base[s.id] = median(meas[s.id].inst); });
    const drift = [];
    for (let n = 0; n < N; n++) drift.push(median(cands.map((s) => meas[s.id].inst[n] - base[s.id])));
    const zps = cands.map((s) => s.cat - base[s.id]);
    const zpMed = median(zps);
    const out = {};
    const rOut = C.autoAperture(median(epochs.map((e) => e.fwhm))).rOut;
    cands.forEach((s, i) => {
      const m = meas[s.id];
      const res = m.inst.map((v, n) => v - drift[n] - base[s.id]);
      const mean = res.reduce((a, b) => a + b, 0) / N;
      const rms = Math.sqrt(res.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (N - 1));
      const zpOff = zps[i] - zpMed;
      const peak = Math.max.apply(null, m.peak);
      const medErr = median(m.err);
      const edge = s.x < rOut + 1 || s.y < rOut + 1 || s.x > stamp.W - rOut - 1 || s.y > stamp.H - rOut - 1;
      let grade = 'ok', reason = '사용 가능';
      if (peak > 0.9 * C.SIM.SAT) { grade = 'bad'; reason = '포화 (너무 밝음)'; }
      else if (edge) { grade = 'bad'; reason = '가장자리 (구경이 잘림)'; }
      else if (rms > 0.06) {
        grade = 'bad';
        reason = medErr > 0.04 ? '너무 어두워 잡음이 큼' : '밝기가 혼자 변함 (변광 의심)';
      } else if (Math.abs(zpOff) > 0.12) { grade = 'warn'; reason = '영점 불일치 (이웃 별 혼입 의심)'; }
      out[s.id] = { rms, zpOff, peak, medErr, edge, grade, reason, cat: s.cat, res: res.map((x) => x - mean) };
    });
    return out;
  };

  // 차등측광: 비교성들의 (계기등급 − 카탈로그 등급) 평균을 본성에서 뺀다.
  // S/N 이 너무 낮은 측정(검출 실패)은 버리고 valid=false 로 표시한다.
  C.differential = function (meas, targetId, compIds, cats) {
    const t = meas[targetId];
    const N = t.inst.length;
    const m = [], err = [], valid = [];
    for (let n = 0; n < N; n++) {
      let off = 0, ev = 0, k = 0;
      compIds.forEach((id) => {
        if (meas[id].snr[n] < 5) return;
        off += meas[id].inst[n] - cats[id];
        ev += meas[id].err[n] * meas[id].err[n];
        k++;
      });
      if (!k || t.snr[n] < 4) { m.push(NaN); err.push(NaN); valid.push(false); continue; }
      off /= k; ev /= k * k;
      m.push(t.inst[n] - off);
      err.push(Math.sqrt(t.err[n] * t.err[n] + ev));
      valid.push(true);
    }
    return { m, err, valid };
  };

  // 자동 비교성: 진단이 좋은 별 중 본성과 밝기가 비슷한 순
  C.autoComps = function (diag, targetApprox, n) {
    const ok = Object.keys(diag).filter((id) => diag[id].grade === 'ok');
    ok.sort((a, b) => Math.abs(diag[a].cat - targetApprox) - Math.abs(diag[b].cat - targetApprox));
    return ok.slice(0, n || 4);
  };
})(typeof window !== 'undefined' ? window : globalThis);
