/* ==========================================================================
   Mini biblioteca de gráficos SVG (líneas, barras, mapa de calor, puntos).
   Responsiva (ResizeObserver), con tooltips y soporte táctil. Sin dependencias.
   ========================================================================== */
(function () {
  "use strict";
  const AZ = (window.AZ = window.AZ || {});
  const SVGNS = "http://www.w3.org/2000/svg";
  const r1 = (v) => Math.round(v * 10) / 10;

  function escalaLineal(d0, d1, r0, r1_) {
    const k = d1 === d0 ? 0 : (r1_ - r0) / (d1 - d0);
    const f = (v) => r0 + (v - d0) * k;
    f.inversa = (p) => d0 + (p - r0) / (k || 1);
    return f;
  }
  function escalaLog(d0, d1, r0, r1_) {
    const l0 = Math.log10(d0), l1 = Math.log10(d1), k = (r1_ - r0) / (l1 - l0);
    const f = (v) => r0 + (Math.log10(Math.max(v, 1e-9)) - l0) * k;
    f.inversa = (p) => Math.pow(10, l0 + (p - r0) / k);
    return f;
  }
  function marcasLindas(min, max, n = 5) {
    if (min === max) { min -= 1; max += 1; }
    const paso0 = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(paso0))), res = paso0 / mag;
    const paso = (res < 1.5 ? 1 : res < 2.25 ? 2 : res < 3.5 ? 2.5 : res < 7.5 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(min / paso) * paso; v <= max + paso * 1e-6; v += paso) out.push(Math.abs(v) < paso * 1e-9 ? 0 : v);
    return out;
  }
  function marcasLog(min, max) {
    const out = [];
    for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
      [1, 2, 5].forEach((m) => { const v = m * Math.pow(10, e); if (v >= min * 0.999 && v <= max * 1.001) out.push(v); });
    }
    return out;
  }
  function crearBurbuja(cont) {
    let b = cont.querySelector(".burbuja");
    if (!b) { b = document.createElement("div"); b.className = "burbuja"; b.setAttribute("aria-hidden", "true"); cont.appendChild(b); }
    return b;
  }
  function ubicarBurbuja(b, cont, x, y) {
    const w = b.offsetWidth, h = b.offsetHeight, W = cont.clientWidth;
    let left = x + 16, top = y - h - 12;
    if (left + w > W - 4) left = x - w - 16;
    if (left < 4) left = 4;
    if (top < 4) top = y + 18;
    b.style.left = left + "px";
    b.style.top = top + "px";
  }
  function observar(el, dibujar) {
    let ancho = 0, pendiente = null;
    const ro = new ResizeObserver((entradas) => {
      const w = Math.round(entradas[0].contentRect.width);
      if (w && Math.abs(w - ancho) > 2) { ancho = w; clearTimeout(pendiente); pendiente = setTimeout(dibujar, 60); }
    });
    ro.observe(el);
    return ro;
  }
  function busquedaBinaria(xs, x) {
    let lo = 0, hi = xs.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] < x) lo = mid; else hi = mid; }
    return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
  }

  // ------------------------------------------------------------------ líneas
  function lineas(cont, opciones) {
    let op = opciones;
    cont.classList.add("grafico");
    const burbuja = crearBurbuja(cont);
    let svg;

    function dibujar() {
      const W = cont.clientWidth || 600;
      const H = typeof op.alto === "function" ? op.alto(W) : op.alto || Math.max(260, Math.min(460, W * 0.5));
      const m = { t: 16, r: op.margenDer ?? 14, b: 34, l: op.margenIzq ?? (W < 520 ? 54 : 74) };
      const series = op.series.filter((s) => !s.oculta);
      let xMin = op.xMin ?? Infinity, xMax = op.xMax ?? -Infinity, yMin = Infinity, yMax = -Infinity;
      series.forEach((s) => s.x.forEach((x, i) => {
        if (op.xMin === undefined && x < xMin) xMin = x;
        if (op.xMax === undefined && x > xMax) xMax = x;
      }));
      series.forEach((s) => s.x.forEach((x, i) => {
        if (x < xMin || x > xMax) return;
        const v = s.y[i]; if (v === null || v === undefined) return;
        if (v < yMin) yMin = v; if (v > yMax) yMax = v;
      }));
      if (op.yMin !== undefined) yMin = op.yMin;
      if (op.yMax !== undefined) yMax = op.yMax;
      if (!op.logY && op.yMin === undefined) { const pad = (yMax - yMin) * 0.06; yMin -= pad; yMax += pad; if (op.desdeCero && yMin > 0) yMin = 0; }
      if (op.logY) { yMin = Math.max(yMin * 0.8, 1e-6); yMax = yMax * 1.25; }
      const sx = escalaLineal(xMin, xMax, m.l, W - m.r);
      const sy = op.logY ? escalaLog(yMin, yMax, H - m.b, m.t) : escalaLineal(yMin, yMax, H - m.b, m.t);
      const fy = op.formatoY || ((v) => AZ.fmt.num(v));
      const marcasY = op.logY ? marcasLog(yMin, yMax) : marcasLindas(yMin, yMax, H < 300 ? 4 : 5);

      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${op.etiqueta || "Gráfico de líneas"}">`;
      // bandas
      (op.bandas || []).forEach((b) => {
        const x0 = Math.max(m.l, sx(b.x0)), x1 = Math.min(W - m.r, sx(b.x1));
        if (x1 > x0) s += `<rect class="banda" x="${r1(x0)}" y="${m.t}" width="${r1(x1 - x0)}" height="${H - m.t - m.b}"/>`;
      });
      // grilla Y
      s += `<g class="grilla eje">`;
      marcasY.forEach((v) => { const y = r1(sy(v)); s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/><text x="${m.l - 10}" y="${y + 4}" text-anchor="end">${fy(v)}</text>`; });
      s += `</g>`;
      // eje X (años)
      const a0 = new Date(xMin).getUTCFullYear(), a1 = new Date(xMax).getUTCFullYear();
      const span = a1 - a0 + 1, maxEtiquetas = Math.max(2, Math.floor((W - m.l - m.r) / 58));
      const paso = [1, 2, 3, 4, 5, 10].find((p) => span / p <= maxEtiquetas) || 10;
      s += `<g class="eje">`;
      for (let a = a0; a <= a1 + 1; a++) {
        const t = Date.UTC(a, 0, 1); if (t < xMin || t > xMax) continue;
        if ((a - a0) % paso !== 0 && span > 3) continue;
        const x = r1(sx(t));
        s += `<line x1="${x}" x2="${x}" y1="${H - m.b}" y2="${H - m.b + 5}" stroke="rgba(255,255,255,.18)"/><text x="${x}" y="${H - m.b + 21}" text-anchor="middle">${a}</text>`;
      }
      if (span <= 3) {
        for (let t = Date.UTC(a0, 0, 1); t <= xMax; t = Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth() + 3, 1)) {
          if (t < xMin) continue; const d = new Date(t);
          if (d.getUTCMonth() === 0) continue;
          s += `<text x="${r1(sx(t))}" y="${H - m.b + 21}" text-anchor="middle" opacity=".55">${AZ.MESES_CORTOS[d.getUTCMonth()]}</text>`;
        }
      }
      s += `</g>`;
      if (op.cero && !op.logY && yMin < 0 && yMax > 0) s += `<line class="cero" x1="${m.l}" x2="${W - m.r}" y1="${r1(sy(0))}" y2="${r1(sy(0))}"/>`;
      if (op.referencia && op.referencia.y > yMin && op.referencia.y < yMax) {
        const y = r1(sy(op.referencia.y));
        s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.35)" stroke-dasharray="6 6"/><text class="eje" x="${W - m.r - 6}" y="${y - 7}" text-anchor="end">${op.referencia.texto || ""}</text>`;
      }
      s += `<defs><clipPath id="clip-${cont.id || "g"}"><rect x="${m.l}" y="${m.t - 4}" width="${W - m.l - m.r}" height="${H - m.t - m.b + 8}"/></clipPath>`;
      series.forEach((se, k) => { if (se.area) s += `<linearGradient id="grad-${cont.id || "g"}-${k}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${se.color}" stop-opacity="${se.area}"/><stop offset="1" stop-color="${se.color}" stop-opacity="0"/></linearGradient>`; });
      s += `</defs><g clip-path="url(#clip-${cont.id || "g"})">`;
      series.forEach((se, k) => {
        let d = "", primero = true, xi0 = null, xi1 = null;
        for (let i = 0; i < se.x.length; i++) {
          const v = se.y[i];
          if (v === null || v === undefined || se.x[i] < xMin - 40 * 864e5 || se.x[i] > xMax + 40 * 864e5) { primero = true; continue; }
          const px = r1(sx(se.x[i])), py = r1(sy(v));
          d += (primero ? "M" : "L") + px + " " + py; primero = false;
          if (xi0 === null) xi0 = px; xi1 = px;
        }
        if (se.area && d) { const base = op.logY ? H - m.b : r1(sy(Math.max(yMin, 0))); s += `<path d="${d}L${xi1} ${base}L${xi0} ${base}Z" fill="url(#grad-${cont.id || "g"}-${k})"/>`; }
        if (se.tipo === "barras") {
          const ancho = Math.max(1, (W - m.l - m.r) / se.x.filter((x) => x >= xMin && x <= xMax).length * 0.72);
          const y0 = sy(0);
          for (let i = 0; i < se.x.length; i++) {
            if (se.x[i] < xMin || se.x[i] > xMax || se.y[i] === null) continue;
            const y = sy(se.y[i]), c = typeof se.color === "function" ? se.color(se.y[i], i) : se.color;
            s += `<rect x="${r1(sx(se.x[i]) - ancho / 2)}" y="${r1(Math.min(y, y0))}" width="${r1(ancho)}" height="${r1(Math.abs(y - y0))}" fill="${c}"/>`;
          }
        } else {
          s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.ancho || 2}" stroke-linejoin="round" stroke-linecap="round" opacity="${se.opacidad ?? 1}" ${se.guiones ? `stroke-dasharray="${se.guiones}"` : ""}/>`;
        }
      });
      s += `</g>`;
      (op.anotaciones || []).forEach((a) => {
        if (a.x < xMin || a.x > xMax) return;
        const x = r1(sx(a.x)), y = r1(sy(a.y)), izq = x > W * 0.7;
        s += `<circle cx="${x}" cy="${y}" r="5" fill="${a.color || "var(--verde)"}" stroke="var(--fondo)" stroke-width="2"/>`;
        s += `<text class="eje" x="${izq ? x - 10 : x + 10}" y="${y + (a.dy || -10)}" text-anchor="${izq ? "end" : "start"}" style="fill:var(--texto);font-weight:600">${a.texto}</text>`;
      });
      s += `<line class="cruz" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" visibility="hidden"/>`;
      series.forEach((se, k) => { if (se.tipo !== "barras" && !se.sinPunto) s += `<circle class="punto-${k}" r="5" fill="${se.color}" stroke="var(--fondo)" stroke-width="2" visibility="hidden"/>`; });
      s += `<rect class="captura" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/>`;
      s += `</svg>`;
      cont.querySelector("svg")?.remove();
      cont.insertAdjacentHTML("afterbegin", s);
      svg = cont.querySelector("svg");

      const cruz = svg.querySelector(".cruz"), captura = svg.querySelector(".captura");
      const primera = series[0];
      const mover = (ev) => {
        const caja = svg.getBoundingClientRect();
        const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - caja.left;
        const xv = sx.inversa(px);
        const idx = busquedaBinaria(primera.x, xv);
        const xr = primera.x[idx];
        if (xr < xMin || xr > xMax) return;
        const X = r1(sx(xr));
        cruz.setAttribute("x1", X); cruz.setAttribute("x2", X); cruz.setAttribute("visibility", "visible");
        const filas = [];
        series.forEach((se, k) => {
          const j = se.x === primera.x ? idx : busquedaBinaria(se.x, xr);
          const v = se.y[j];
          const p = svg.querySelector(".punto-" + k);
          if (p && v !== null && v !== undefined) { p.setAttribute("cx", r1(sx(se.x[j]))); p.setAttribute("cy", r1(sy(v))); p.setAttribute("visibility", "visible"); }
          filas.push({ serie: se, valor: v, indice: j });
        });
        burbuja.innerHTML = op.tooltip ? op.tooltip(idx, filas) :
          `<span class="fecha">${AZ.fmt.mes(new Date(xr).toISOString().slice(0, 7))}</span>` +
          filas.map((f) => `<div class="fila"><span><i style="background:${typeof f.serie.color === "string" ? f.serie.color : "var(--verde)"}"></i> ${f.serie.nombre}</span><b>${(f.serie.formato || fy)(f.valor)}</b></div>`).join("");
        burbuja.classList.add("visible");
        ubicarBurbuja(burbuja, cont, X, Math.min(...filas.filter((f) => f.valor != null).map((f) => sy(f.valor))));
      };
      const salir = () => { cruz.setAttribute("visibility", "hidden"); svg.querySelectorAll("[class^='punto-']").forEach((p) => p.setAttribute("visibility", "hidden")); burbuja.classList.remove("visible"); };
      captura.addEventListener("pointermove", mover);
      captura.addEventListener("pointerdown", mover);
      captura.addEventListener("pointerleave", salir);
      captura.addEventListener("touchmove", mover, { passive: true });
      captura.addEventListener("touchend", () => setTimeout(salir, 1600));
    }
    dibujar();
    observar(cont, dibujar);
    return { actualizar(nuevas) { op = Object.assign({}, op, nuevas); dibujar(); }, opciones: () => op };
  }

  // ------------------------------------------------------------------ barras (categorías)
  function barras(cont, opciones) {
    let op = opciones, sel = op.seleccion ?? null;
    cont.classList.add("grafico");
    const burbuja = crearBurbuja(cont);
    function dibujar() {
      const W = cont.clientWidth || 600;
      const H = typeof op.alto === "function" ? op.alto(W) : op.alto || Math.max(260, Math.min(420, W * 0.48));
      const m = { t: 30, r: 10, b: 34, l: op.margenIzq ?? (W < 520 ? 48 : 64) };
      const vals = op.valores;
      let yMin = Math.min(0, ...vals), yMax = Math.max(0, ...vals);
      if (op.yMin !== undefined) yMin = op.yMin; if (op.yMax !== undefined) yMax = op.yMax;
      const pad = (yMax - yMin) * 0.12; yMin = yMin < 0 ? yMin - pad : yMin; yMax = yMax > 0 ? yMax + pad : yMax;
      const sy = escalaLineal(yMin, yMax, H - m.b, m.t);
      const n = vals.length, banda = (W - m.l - m.r) / n, ancho = banda * (op.grosor || 0.66);
      const fy = op.formatoY || ((v) => AZ.fmt.num(v));
      const fv = op.formatoValor || fy;
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${op.etiqueta || "Gráfico de barras"}">`;
      s += `<g class="grilla eje">`;
      marcasLindas(yMin, yMax, 5).forEach((v) => { const y = r1(sy(v)); s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/><text x="${m.l - 10}" y="${y + 4}" text-anchor="end">${fy(v)}</text>`; });
      s += `</g>`;
      (op.bandas || []).forEach((b) => { s += `<rect class="banda" x="${r1(m.l + b.desde * banda)}" y="${m.t - 22}" width="${r1((b.hasta - b.desde + 1) * banda)}" height="${H - m.t - m.b + 22}" rx="10" ${b.color ? `style="fill:${b.color}"` : ""}/>${b.texto ? `<text class="eje" x="${r1(m.l + (b.desde + (b.hasta - b.desde + 1) / 2) * banda)}" y="${m.t - 8}" text-anchor="middle" style="font-weight:700;letter-spacing:.08em;fill:${b.colorTexto || "var(--tenue)"}">${b.texto}</text>` : ""}`; });
      const y0 = r1(sy(0));
      vals.forEach((v, i) => {
        const x = m.l + i * banda + (banda - ancho) / 2, y = sy(v), c = typeof op.colores === "function" ? op.colores(v, i) : op.colores[i];
        const atenuada = sel !== null && sel !== i ? " atenuada" : "";
        s += `<g class="barra${atenuada}" data-i="${i}" tabindex="0" role="button" aria-label="${op.etiquetas[i]}: ${fv(v)}">`;
        s += `<rect x="${r1(m.l + i * banda)}" y="${m.t}" width="${r1(banda)}" height="${H - m.t - m.b}" fill="transparent"/>`;
        s += `<rect x="${r1(x)}" y="${r1(Math.min(y, sy(0)))}" width="${r1(ancho)}" height="${r1(Math.max(1, Math.abs(sy(0) - y)))}" rx="${Math.min(6, ancho / 4)}" fill="${c}" ${sel === i ? 'stroke="#fff" stroke-width="2"' : ""}/>`;
        if (op.mostrarValores !== false && banda > 34) s += `<text class="valor" x="${r1(x + ancho / 2)}" y="${r1(v >= 0 ? y - 8 : y + 17)}" text-anchor="middle">${fv(v)}</text>`;
        s += `</g>`;
      });
      s += `<line class="cero" x1="${m.l}" x2="${W - m.r}" y1="${y0}" y2="${y0}"/>`;
      s += `<g class="eje">`;
      op.etiquetas.forEach((e, i) => { s += `<text x="${r1(m.l + i * banda + banda / 2)}" y="${H - m.b + 21}" text-anchor="middle" ${sel === i ? 'style="fill:var(--texto);font-weight:700"' : ""}>${W < 520 ? e.slice(0, 1) : e}</text>`; });
      s += `</g></svg>`;
      cont.querySelector("svg")?.remove();
      cont.insertAdjacentHTML("afterbegin", s);
      cont.querySelectorAll(".barra").forEach((g) => {
        const i = +g.dataset.i;
        const mostrar = (ev) => {
          if (!op.tooltip) return;
          burbuja.innerHTML = op.tooltip(i);
          burbuja.classList.add("visible");
          const caja = cont.getBoundingClientRect(), r = g.getBoundingClientRect();
          ubicarBurbuja(burbuja, cont, r.left - caja.left + r.width / 2, Math.min(sy(vals[i]), sy(0)));
        };
        g.addEventListener("pointerenter", mostrar);
        g.addEventListener("focus", mostrar);
        g.addEventListener("pointerleave", () => burbuja.classList.remove("visible"));
        g.addEventListener("blur", () => burbuja.classList.remove("visible"));
        const elegir = () => { if (op.alClic) op.alClic(i); };
        g.addEventListener("click", elegir);
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); elegir(); } });
      });
    }
    dibujar();
    observar(cont, dibujar);
    return {
      actualizar(nuevas) { op = Object.assign({}, op, nuevas); if ("seleccion" in nuevas) sel = nuevas.seleccion; dibujar(); },
      seleccionar(i) { sel = i; dibujar(); },
    };
  }

  // ------------------------------------------------------------------ mapa de calor
  function calor(cont, op) {
    cont.classList.add("grafico");
    const burbuja = crearBurbuja(cont);
    function dibujar() {
      const W = Math.max(cont.clientWidth || 700, 640);
      const m = { t: 8, r: 8, b: 30, l: 50 };
      const nf = op.filas.length, nc = op.columnas.length;
      const cw = (W - m.l - m.r) / nc, ch = Math.max(20, Math.min(32, cw * 0.48));
      const H = m.t + nf * ch + m.b;
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${op.etiqueta || "Mapa de calor"}">`;
      op.filas.forEach((f, r) => {
        s += `<text class="eje" x="${m.l - 10}" y="${r1(m.t + r * ch + ch / 2 + 4)}" text-anchor="end">${f}</text>`;
        op.columnas.forEach((c, k) => {
          const v = op.valores[r][k];
          if (v === null || v === undefined) return;
          const x = m.l + k * cw, y = m.t + r * ch;
          s += `<rect class="celda" data-r="${r}" data-c="${k}" x="${r1(x + 1)}" y="${r1(y + 1)}" width="${r1(cw - 2)}" height="${r1(ch - 2)}" rx="4" fill="${op.color(v)}"/>`;
          if (cw > 34 && ch >= 20) s += `<text x="${r1(x + cw / 2)}" y="${r1(y + ch / 2 + 4)}" text-anchor="middle" style="font:500 11px var(--fuente);fill:${op.colorTexto ? op.colorTexto(v) : "#fff"};pointer-events:none">${op.formato(v)}</text>`;
        });
      });
      op.columnas.forEach((c, k) => { s += `<text class="eje" x="${r1(m.l + k * cw + cw / 2)}" y="${H - 9}" text-anchor="middle">${c}</text>`; });
      s += `</svg>`;
      cont.querySelector("svg")?.remove();
      cont.insertAdjacentHTML("afterbegin", s);
      cont.querySelectorAll(".celda").forEach((el) => {
        const r = +el.dataset.r, c = +el.dataset.c;
        el.addEventListener("pointerenter", () => {
          burbuja.innerHTML = op.tooltip(r, c);
          burbuja.classList.add("visible");
          ubicarBurbuja(burbuja, cont, m.l + c * cw + cw / 2, m.t + r * ch);
        });
        el.addEventListener("pointerleave", () => burbuja.classList.remove("visible"));
        if (op.alClic) el.addEventListener("click", () => op.alClic(r, c));
      });
    }
    dibujar();
    observar(cont, dibujar);
    return { dibujar };
  }

  // ------------------------------------------------------------------ puntos (distribución de un mes)
  function puntos(cont, op) {
    cont.classList.add("grafico");
    const burbuja = crearBurbuja(cont);
    function dibujar() {
      const W = cont.clientWidth || 320, H = op.alto || 120, m = { t: 26, r: 14, b: 26, l: 14 };
      const vs = op.valores.map((p) => p.v);
      const lim = Math.max(10, Math.ceil(Math.max(...vs.map(Math.abs)) / 10) * 10);
      const sx = escalaLineal(-lim, lim, m.l, W - m.r);
      const yc = (H - m.b + m.t) / 2;
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Distribución por año">`;
      s += `<line x1="${m.l}" x2="${W - m.r}" y1="${yc}" y2="${yc}" stroke="var(--linea-fuerte)"/>`;
      s += `<line x1="${r1(sx(0))}" x2="${r1(sx(0))}" y1="${m.t - 8}" y2="${H - m.b + 4}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 4"/>`;
      [-lim, -lim / 2, lim / 2, lim].forEach((v) => { s += `<text class="eje" x="${r1(sx(v))}" y="${H - 6}" text-anchor="middle">${AZ.fmt.num(v, 0, true)}%</text>`; });
      s += `<text class="eje" x="${r1(sx(0))}" y="${H - 6}" text-anchor="middle">0</text>`;
      if (op.mediana !== undefined) s += `<line x1="${r1(sx(op.mediana))}" x2="${r1(sx(op.mediana))}" y1="${m.t - 12}" y2="${yc + 14}" stroke="var(--verde)" stroke-width="2"/><text x="${r1(sx(op.mediana))}" y="${m.t - 15}" text-anchor="middle" style="font:600 11px var(--fuente);fill:var(--verde)">mediana</text>`;
      const ocupado = {};
      op.valores.forEach((p, i) => {
        const x = sx(p.v), clave = Math.round(x / 9);
        const n = (ocupado[clave] = (ocupado[clave] || 0) + 1) - 1;
        const y = yc + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 9;
        s += `<circle class="pto" data-i="${i}" cx="${r1(x)}" cy="${r1(y)}" r="6" fill="${p.v >= 0 ? "var(--verde)" : "var(--compra)"}" stroke="var(--fondo)" stroke-width="1.5" style="cursor:pointer"/>`;
      });
      s += `</svg>`;
      cont.querySelector("svg")?.remove();
      cont.insertAdjacentHTML("afterbegin", s);
      cont.querySelectorAll(".pto").forEach((c) => {
        const p = op.valores[+c.dataset.i];
        c.addEventListener("pointerenter", () => {
          burbuja.innerHTML = `<span class="fecha">${p.etiqueta}</span><b>${AZ.fmt.pct(p.v, 1)}</b> respecto de la tendencia`;
          burbuja.classList.add("visible");
          ubicarBurbuja(burbuja, cont, +c.getAttribute("cx"), +c.getAttribute("cy"));
        });
        c.addEventListener("pointerleave", () => burbuja.classList.remove("visible"));
      });
    }
    dibujar();
    observar(cont, dibujar);
    return { actualizar(nuevas) { Object.assign(op, nuevas); dibujar(); } };
  }

  AZ.graficos = { lineas, barras, calor, puntos, escalaLineal, marcasLindas };
  AZ.svgns = SVGNS;
})();
