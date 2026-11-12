// 체험 무대가 되는 은하들 (교육용 근사값).
// 거리 모듈러스 μ는 문헌에서 널리 쓰이는 값을 단순화한 것이고, A_V는 시뮬레이션용 소광 값이다.
(function (g) {
  const C = g.CEPH = g.CEPH || {};

  C.GALAXIES = [
    {
      id: 'm31', name: '안드로메다 은하 (M31)', short: 'M31',
      mu: 24.47, Av: 0.20, where: '안드로메다자리 · 나선은하', arm: [125, 150, 235],
      inc: 72, pa: 35, pitch: 13, hr: 0.2, core: [255, 214, 160],
      look: { bulge: 1.0, dust: 1.7, hii: 0.45, glow: 0.9, warm: 1.5, armW: 1.7, ridge: 0.3, sats: [{ du: 0.03, dv: -0.13, r: 0.02, q: 0.85 }, { du: -0.09, dv: 0.165, r: 0.05, q: 0.55, ang: 0.6 }] },
      fact: '1923~24년 허블이 이 은하에서 주기 약 31일의 세페이드 V1을 찾아, 안드로메다가 우리 은하 바깥의 "섬 우주"임을 증명했습니다.'
    },
    {
      id: 'm33', name: '삼각형자리 은하 (M33)', short: 'M33',
      mu: 24.62, Av: 0.15, where: '삼각형자리 · 나선은하', arm: [150, 175, 235],
      inc: 54, pa: 22, pitch: 21, hr: 0.19, core: [190, 215, 255],
      look: { bulge: 0.18, dust: 0.5, hii: 1.7, glow: 0.9, floc: 1, armW: 2.4, ridge: 0.15, armA: 0.5, diskA: 1.7, warm: 0.35, warmCol: [200, 205, 225], spikes: 10, big: { r: 0.6, arm: 1, d: 0.05 } },
      fact: '안드로메다와 같은 국부은하군의 나선은하로, 허블도 이 은하의 세페이드로 거리를 쟀습니다.'
    },
    {
      id: 'ngc300', name: '조각가자리 NGC 300', short: 'NGC 300',
      mu: 26.4, Av: 0.10, where: '조각가자리 · 나선은하', arm: [150, 150, 255],
      inc: 40, pa: 150, pitch: 24, hr: 0.2, core: [255, 200, 185],
      look: { bulge: 0.55, dust: 0.5, hii: 1.3, glow: 1.0, ring: 1.6, floc: 0.5, hot: 0.35, spikes: 14, armW: 2.1, ridge: 0.3, armA: 0.65, diskA: 1.6, warm: 0.7, warmCol: [235, 185, 170] },
      fact: '안드로메다보다 두 배 이상 먼 나선은하로, 세페이드를 이용한 정밀한 거리 측정이 이루어진 대표적인 은하입니다.'
    },
    {
      id: 'lmc', name: '대마젤란 은하 (LMC)', short: 'LMC', kind: 'irregular',
      mu: 18.48, Av: 0.25, where: '황새치자리 · 막대가 있는 불규칙은하', arm: [120, 165, 255],
      inc: 35, pa: 0, pitch: 20, hr: 0.2, core: [255, 232, 200],
      off: -6, // 아주 가까워서 별이 밝다: 노출을 짧게(약 1/250) 찍었다고 보고 카메라 영점을 옮긴다
      look: { glow: 1.0, hii: 1.4 },
      fact: '우리 은하 둘레를 도는 가까운 이웃 은하예요. 1908~1912년 헨리에타 리비트가 마젤란 은하들의 세페이드를 조사해 "주기가 길수록 밝다"는 규칙을 처음 찾았고, 지금도 우주 거리 사다리의 기준점으로 쓰입니다.'
    }
  ];

  C.galaxyById = (id) => C.GALAXIES.find((x) => x.id === id);

  // 은하 평면의 (반지름 r, 각도 th) -> 캔버스 좌표(0~1). 기울기(inc)와 방향(pa)을 반영한다.
  C.spiralProject = function (gal, r, th) {
    const x = r * Math.cos(th);
    const y = r * Math.sin(th) * Math.cos((gal.inc * Math.PI) / 180);
    const pa = (gal.pa * Math.PI) / 180;
    return {
      u: 0.5 + (x * Math.cos(pa) - y * Math.sin(pa)) * 1.3,
      v: 0.5 + (x * Math.sin(pa) + y * Math.cos(pa)) * 1.3
    };
  };
  C.ARM_RMAX = 0.34;
  C.armTheta = (gal, r, arm) => Math.log(r / 0.03) / Math.tan((gal.pitch * Math.PI) / 180) + arm * Math.PI;

  // 은하 평면 위의 한 점을 나선팔 분포로 뽑아 캔버스 좌표(0~1)로 돌려준다.
  // 대마젤란 은하: 밝은 막대 + 위쪽의 푸른 별 생성 지역 + 둥근 원반 (캔버스 좌표 0~1)
  C.LMC = {
    bar: { u: 0.5, v: 0.58, L: 0.27, W: 0.075, ang: -0.1 },
    arc: { u: 0.5, v: 0.58, R: 0.25, a0: 3.3, a1: 6.0 },
    disk: { u: 0.5, v: 0.52, R: 0.36 },
    tar: { u: 0.34, v: 0.45 }
  };
  C.irrSample = function (rand) {
    const L = C.LMC, k = rand();
    if (k < 0.45) {
      const t = (rand() * 2 - 1) * L.bar.L, w = rand.gauss() * L.bar.W * 0.8;
      const c = Math.cos(L.bar.ang), s = Math.sin(L.bar.ang);
      return { u: L.bar.u + t * c - w * s, v: L.bar.v + t * s + w * c, r: Math.abs(t) };
    }
    if (k < 0.8) {
      const a = L.arc.a0 + rand() * (L.arc.a1 - L.arc.a0), R = L.arc.R * (1 + 0.14 * rand.gauss());
      return { u: L.arc.u + R * Math.cos(a), v: L.arc.v + R * Math.sin(a) * 0.95, r: R };
    }
    const a = rand() * 6.2832, R = L.disk.R * Math.sqrt(rand()) * 0.9;
    return { u: L.disk.u + R * Math.cos(a), v: L.disk.v + R * Math.sin(a) * 0.95, r: R };
  };

  C.spiralSample = function (rand, gal) {
    if (gal.kind === 'irregular') return C.irrSample(rand);
    let r;
    do { r = -gal.hr * Math.log(1 - rand() * 0.93) + 0.03; } while (r > C.ARM_RMAX);
    const arm = rand() < 0.5 ? 0 : 1;
    const th = C.armTheta(gal, r, arm) + rand.gauss() * 0.22;
    const p = C.spiralProject(gal, r, th);
    return { u: p.u, v: p.v, r };
  };
})(typeof window !== 'undefined' ? window : globalThis);
