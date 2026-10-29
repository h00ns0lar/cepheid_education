// 가벼운 Canvas 차트
(function (g) {
  const C = g.CEPH = g.CEPH || {};

  function niceTicks(lo, hi, n) {
    const span = hi - lo;
    if (!(span > 0)) return [lo];
    const raw = span / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag;
    const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(Math.round(v / step) * step);
    return out;
  }

  C.Plot = function (canvas, opt) {
    this.c = canvas;
    this.o = Object.assign({ xlabel: '', ylabel: '', invertY: false, xlog: false, m: { l: 58, r: 14, t: 12, b: 40 } }, opt || {});
    this.range = { x0: 0, x1: 1, y0: 0, y1: 1 };
    this.clicks = [];
    const self = this;
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const d = self.fromPx(px, py);
      self.clicks.forEach((f) => f(d.x, d.y, px, py));
    });
  };
  const P = C.Plot.prototype;

  P.onClick = function (f) { this.clicks.push(f); if (this.c.style) this.c.style.cursor = 'pointer'; };

  P.begin = function (x0, x1, y0, y1) {
    const c = this.c, dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth || 600, h = c.clientHeight || 240;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    this.ctx = c.getContext('2d');
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    this.range = { x0, x1, y0, y1 };
    this.axes();
    return this;
  };

  P.fx = function (x) { return this.o.xlog ? Math.log10(x) : x; };
  P.X = function (x) {
    const r = this.range, m = this.o.m;
    return m.l + ((this.fx(x) - this.fx(r.x0)) / (this.fx(r.x1) - this.fx(r.x0))) * (this.w - m.l - m.r);
  };
  P.Y = function (y) {
    const r = this.range, m = this.o.m;
    let t = (y - r.y0) / (r.y1 - r.y0);
    if (this.o.invertY) t = 1 - t;
    return this.h - m.b - t * (this.h - m.t - m.b);
  };
  P.fromPx = function (px, py) {
    const r = this.range, m = this.o.m;
    let tx = (px - m.l) / (this.w - m.l - m.r);
    let x = this.fx(r.x0) + tx * (this.fx(r.x1) - this.fx(r.x0));
    if (this.o.xlog) x = Math.pow(10, x);
    let ty = (this.h - m.b - py) / (this.h - m.t - m.b);
    if (this.o.invertY) ty = 1 - ty;
    return { x, y: r.y0 + ty * (r.y1 - r.y0) };
  };

  P.axes = function () {
    const ctx = this.ctx, m = this.o.m, r = this.range;
    ctx.fillStyle = '#f6f9ff'; ctx.fillRect(0, 0, this.w, this.h);
    ctx.font = '11px sans-serif'; ctx.lineWidth = 1;
    let xt;
    if (this.o.xlog) {
      xt = [];
      for (let e = Math.floor(Math.log10(r.x0)); e <= Math.ceil(Math.log10(r.x1)); e++) {
        [1, 2, 5].forEach((k) => { const v = k * Math.pow(10, e); if (v >= r.x0 && v <= r.x1) xt.push(v); });
      }
    } else xt = niceTicks(r.x0, r.x1, 7);
    const yt = niceTicks(r.y0, r.y1, 5);
    ctx.strokeStyle = '#dde7f8'; ctx.fillStyle = '#6b7da8';
    ctx.textAlign = 'center';
    xt.forEach((v) => {
      const x = this.X(v);
      ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, this.h - m.b); ctx.stroke();
      ctx.fillText(String(+v.toPrecision(4)), x, this.h - m.b + 14);
    });
    ctx.textAlign = 'right';
    yt.forEach((v) => {
      const y = this.Y(v);
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(this.w - m.r, y); ctx.stroke();
      ctx.fillText(String(+v.toPrecision(4)), m.l - 6, y + 4);
    });
    ctx.strokeStyle = '#9db0d6';
    ctx.strokeRect(m.l, m.t, this.w - m.l - m.r, this.h - m.t - m.b);
    ctx.fillStyle = '#33456f'; ctx.textAlign = 'center';
    ctx.fillText(this.o.xlabel, m.l + (this.w - m.l - m.r) / 2, this.h - 6);
    ctx.save(); ctx.translate(13, m.t + (this.h - m.t - m.b) / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(this.o.ylabel, 0, 0); ctx.restore();
  };

  P.clip = function (fn) {
    const ctx = this.ctx, m = this.o.m;
    ctx.save(); ctx.beginPath();
    ctx.rect(m.l, m.t, this.w - m.l - m.r, this.h - m.t - m.b); ctx.clip();
    fn(ctx); ctx.restore();
  };

  P.scatter = function (xs, ys, o) {
    o = o || {};
    this.clip((ctx) => {
      xs.forEach((x, i) => {
        const px = this.X(x), py = this.Y(ys[i]);
        const col = o.colors ? o.colors[i] : (o.color || '#2563eb');
        if (o.err && o.err[i] != null) {
          ctx.strokeStyle = col; ctx.globalAlpha = 0.6;
          ctx.beginPath(); ctx.moveTo(px, this.Y(ys[i] - o.err[i])); ctx.lineTo(px, this.Y(ys[i] + o.err[i])); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(px, py, o.r || 3, 0, 6.2832); ctx.fill();
        if (o.ring && o.ring[i]) { ctx.strokeStyle = '#172445'; ctx.beginPath(); ctx.arc(px, py, (o.r || 3) + 3, 0, 6.2832); ctx.stroke(); }
      });
    });
    return this;
  };

  P.line = function (xs, ys, o) {
    o = o || {};
    this.clip((ctx) => {
      ctx.strokeStyle = o.color || '#e8890c'; ctx.lineWidth = o.w || 1.6;
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.beginPath();
      xs.forEach((x, i) => { const px = this.X(x), py = this.Y(ys[i]); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke(); ctx.setLineDash([]);
    });
    return this;
  };

  P.vline = function (x, o) {
    o = o || {};
    this.clip((ctx) => {
      ctx.strokeStyle = o.color || '#e8890c'; ctx.lineWidth = o.w || 1;
      if (o.dash) ctx.setLineDash(o.dash);
      const px = this.X(x);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, this.h); ctx.stroke(); ctx.setLineDash([]);
    });
    return this;
  };

  P.text = function (x, y, s, o) {
    o = o || {};
    const ctx = this.ctx;
    ctx.fillStyle = o.color || '#172445'; ctx.font = o.font || '12px sans-serif'; ctx.textAlign = o.align || 'left';
    ctx.fillText(s, this.X(x) + (o.dx || 0), this.Y(y) + (o.dy || 0));
    return this;
  };

  C.padRange = function (arr, pad) {
    let lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr);
    const d = (hi - lo || 1) * (pad == null ? 0.08 : pad);
    return [lo - d, hi + d];
  };
})(typeof window !== 'undefined' ? window : globalThis);
