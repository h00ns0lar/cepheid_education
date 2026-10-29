// 체험 무대가 되는 은하들 (교육용 근사값).
// 거리 모듈러스 μ는 문헌에서 널리 쓰이는 값을 단순화한 것이고, A_V는 시뮬레이션용 소광 값이다.
(function (g) {
  const C = g.CEPH = g.CEPH || {};

  C.GALAXIES = [
    {
      id: 'm31', name: '안드로메다 은하 (M31)', short: 'M31',
      mu: 24.47, Av: 0.20, where: '안드로메다자리 · 나선은하', arm: [120, 170, 255],
      inc: 77, pa: 35, pitch: 13, hr: 0.2, core: [255, 214, 160],
      look: { bulge: 1.0, dust: 1.0, hii: 0.5, glow: 1.15 },
      fact: '1923~24년 허블이 이 은하에서 주기 약 31일의 세페이드 V1을 찾아, 안드로메다가 우리 은하 바깥의 "섬 우주"임을 증명했습니다.'
    },
    {
      id: 'm33', name: '삼각형자리 은하 (M33)', short: 'M33',
      mu: 24.62, Av: 0.15, where: '삼각형자리 · 나선은하', arm: [110, 200, 255],
      inc: 54, pa: 22, pitch: 21, hr: 0.19, core: [190, 215, 255],
      look: { bulge: 0.25, dust: 0.35, hii: 1.3, glow: 0.95 },
      fact: '안드로메다와 같은 국부은하군의 나선은하로, 허블도 이 은하의 세페이드로 거리를 쟀습니다.'
    },
    {
      id: 'ngc300', name: '조각가자리 NGC 300', short: 'NGC 300',
      mu: 26.4, Av: 0.10, where: '조각가자리 · 나선은하', arm: [150, 190, 255],
      inc: 42, pa: 110, pitch: 22, hr: 0.2, core: [255, 235, 200],
      look: { bulge: 0.4, dust: 0.45, hii: 0.9, glow: 0.95 },
      fact: '안드로메다보다 두 배 이상 먼 나선은하로, 세페이드를 이용한 정밀한 거리 측정이 이루어진 대표적인 은하입니다.'
    },
    {
      id: 'ngc2403', name: '기린자리 NGC 2403', short: 'NGC 2403',
      mu: 27.5, Av: 0.10, where: '기린자리 · 나선은하', arm: [130, 160, 255],
      inc: 63, pa: 124, pitch: 18, hr: 0.18, core: [225, 225, 255],
      look: { bulge: 0.45, dust: 0.6, hii: 1.0, glow: 1.0 },
      fact: '세 번째로 먼 은하라서 세페이드가 훨씬 어둡게 보입니다. 우주 거리 사다리의 첫 계단을 오르는 데 쓰인 은하 중 하나입니다.'
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
  C.spiralSample = function (rand, gal) {
    let r;
    do { r = -gal.hr * Math.log(1 - rand() * 0.93) + 0.03; } while (r > C.ARM_RMAX);
    const arm = rand() < 0.5 ? 0 : 1;
    const th = C.armTheta(gal, r, arm) + rand.gauss() * 0.22;
    const p = C.spiralProject(gal, r, th);
    return { u: p.u, v: p.v, r };
  };
})(typeof window !== 'undefined' ? window : globalThis);
