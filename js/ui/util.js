// DOM 헬퍼
(function (g) {
  const C = g.CEPH = g.CEPH || {};
  C.steps = C.steps || {};

  // append(null|false) 가 "null" 글자로 찍히지 않게 한다 (조건부 자식 편의)
  if (typeof Element !== 'undefined') {
    const nativeAppend = Element.prototype.append;
    Element.prototype.append = function () {
      return nativeAppend.apply(this, Array.prototype.filter.call(arguments, (x) => x != null && x !== false));
    };
  }

  // h('div', {class:'x', onclick:fn}, '텍스트', [자식...])
  C.h = function (tag, props) {
    const el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((k) => {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    const add = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    };
    for (let i = 2; i < arguments.length; i++) add(arguments[i]);
    return el;
  };

  // window.confirm 은 환경에 따라 막히므로, 페이지 안에서 띄우는 확인 창을 쓴다.
  C.ask = function (msg, onYes, yesLabel) {
    const close = () => { dlg.close(); dlg.remove(); };
    const dlg = C.h('dialog', { class: 'ask' },
      C.h('p', { class: 'lead' }, msg),
      C.h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
        C.h('button', { onclick: close }, '취소'),
        C.h('button', { class: 'primary', onclick: () => { close(); onYes(); } }, yesLabel || '확인')));
    dlg.addEventListener('cancel', () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
  };

  C.$ = (sel, root) => (root || document).querySelector(sel);
  C.fmt = (x, d) => (x == null || !isFinite(x) ? '—' : x.toFixed(d == null ? 2 : d));
  C.pcFmt = function (dpc) {
    if (dpc >= 1e6) return (dpc / 1e6).toFixed(2) + ' Mpc';
    if (dpc >= 1e3) return (dpc / 1e3).toFixed(1) + ' kpc';
    return dpc.toFixed(0) + ' pc';
  };
  C.lyFmt = (dpc) => (dpc * 3.26156 / 1e6).toFixed(2) + ' 백만 광년';

  // 이미지 → 캔버스 (asinh 스트레칭)
  C.drawFrame = function (canvas, img, W, H, scale) {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const ctx = off.getContext('2d');
    const id = ctx.createImageData(W, H);
    const med = C.median(Array.from(img));
    let sd = 0;
    for (let i = 0; i < img.length; i++) if (img[i] < med * 1.8 + 40) sd += (img[i] - med) * (img[i] - med);
    sd = Math.sqrt(sd / img.length) || 1;
    const norm = Math.asinh(1500);
    for (let i = 0; i < img.length; i++) {
      const x = Math.max(0, (img[i] - med) / sd);
      const v = Math.min(1, Math.asinh(x / 10) / norm * 1.2);
      const k = i * 4, c = Math.round(255 * Math.pow(v, 0.85));
      id.data[k] = c; id.data[k + 1] = Math.min(255, c * 1.02); id.data[k + 2] = Math.min(255, c * 1.12 + 6); id.data[k + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    canvas.width = W * scale; canvas.height = H * scale;
    const cx = canvas.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.drawImage(off, 0, 0, W * scale, H * scale);
    return cx;
  };
})(typeof window !== 'undefined' ? window : globalThis);
