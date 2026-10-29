// 선형 회귀, 은하수 보정 세페이드, 포그슨 방정식.
(function (g) {
  const C = g.CEPH = g.CEPH || {};

  C.linreg = function (x, y) {
    const n = x.length;
    const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (x[i] - mx) * (x[i] - mx); sxy += (x[i] - mx) * (y[i] - my); }
    const slope = sxy / sxx, intercept = my - slope * mx;
    let ss = 0;
    for (let i = 0; i < n; i++) ss += Math.pow(y[i] - (intercept + slope * x[i]), 2);
    const rms = Math.sqrt(ss / Math.max(1, n - 2));
    return { slope, intercept, rms, n, sigSlope: rms / Math.sqrt(sxx), mx, my };
  };

  // 포그슨 방정식:  m - M = 5 log10(d / 10 pc)
  C.distFromMu = (mu) => Math.pow(10, (mu + 5) / 5);   // pc
  C.muFromDist = (dpc) => 5 * Math.log10(dpc / 10);

  // 은하수 보정용 세페이드 (교육용 가상 세트: 시차로 거리를 아는 별들).
  // PL 관계식에 약간의 산포를 얹어 고정 시드로 만든다. 소광은 이미 보정된 값.
  C.MW_CALIB = (function () {
    const rand = C.rng(C.hashStr('milkyway-calibrators'));
    const logPs = [0.45, 0.62, 0.78, 0.95, 1.1, 1.28, 1.45];
    const dpcs = [330, 520, 780, 1100, 1500, 2100, 2900];
    return logPs.map((lp, i) => {
      const M = C.absMag(lp) + 0.12 * rand.gauss();
      const d = dpcs[i];
      return {
        name: 'MW-' + (i + 1), logP: lp, P: Math.pow(10, lp),
        parallax: Math.round((1000 / d) * 1000) / 1000,   // mas
        mV: Math.round((M + C.muFromDist(d)) * 100) / 100
      };
    });
  })();

  // 광도 (L☉): M_bol 근사 없이 V등급만으로 단순 환산. M_sun,V = 4.83
  C.lumSun = (M) => Math.pow(10, 0.4 * (4.83 - M));
})(typeof window !== 'undefined' ? window : globalThis);
