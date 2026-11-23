/* ==========================================================================
   Página principal: rueda anual, diagrama interactivo, explorador de series,
   Tabla 1 interactiva, mapa de calor, simulador de arbitraje y galería 4K.
   ========================================================================== */
(function () {
  "use strict";
  const D = window.AZUCAR, AZ = window.AZ, F = AZ.fmt;
  const VERDE = "#2BD46B", BLANCO = "#EDF2EE", GRIS = "#4B5B51";
  const T1 = D.tabla1;
  const colorVentana = (v) => (v === "venta" ? VERDE : v === "compra" ? BLANCO : GRIS);
  const mensualX = D.mensual.fechas.map((f) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, 1));

  document.addEventListener("DOMContentLoaded", () => {
    rueda();
    diagrama();
    explorador();
    estacionalidad();
    tablaPaper();
    mapaCalor();
    simulador();
    galeria();
    AZ.conectarDetalles(document.querySelector("#respuesta"));
    AZ.conectarDetalles(document.querySelector("#impacto"));
    document.addEventListener("click", (e) => {
      const a = e.target.closest(".panel a[href^='#']");
      if (a) AZ.panel.cerrar();
    });
  });

  // ------------------------------------------------------------------ rueda anual
  function rueda() {
    const cont = document.getElementById("rueda");
    if (!cont) return;
    const cx = 300, cy = 300, R0 = 192, K = 11.5;
    const ang = (i) => -90 + i * 30;
    const p = (r, a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
    const sector = (r0, r1, a0, a1) => {
      const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
      return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r1} ${r1} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}A${r0} ${r0} 0 0 0 ${x3.toFixed(1)} ${y3.toFixed(1)}Z`;
    };
    const arco = (r, a0, a1) => { const [x0, y0] = p(r, a0), [x1, y1] = p(r, a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    let s = `<svg viewBox="-30 -30 660 660" role="group" aria-label="Desvío relativo medio por mes respecto de la tendencia">`;
    s += `<circle cx="${cx}" cy="${cy}" r="${R0 + 50}" fill="none" stroke="rgba(255,255,255,.05)"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${R0 - 58}" fill="none" stroke="rgba(255,255,255,.05)"/>`;
    // fases del ciclo agroindustrial
    s += `<path d="${arco(286, ang(11) - 14, ang(14) + 14)}" stroke="${VERDE}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".9"/>`;
    s += `<path d="${arco(286, ang(4) - 14, ang(10) + 14)}" stroke="${BLANCO}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".75"/>`;
    s += `<text x="${p(312, ang(0.5))[0]}" y="${p(312, ang(0.5))[1] - 4}" text-anchor="middle" style="font:700 15px var(--fuente);letter-spacing:.16em;fill:${VERDE}">INTERZAFRA</text>`;
    s += `<text x="${p(316, ang(7))[0]}" y="${p(316, ang(7))[1] + 14}" text-anchor="middle" style="font:700 15px var(--fuente);letter-spacing:.16em;fill:${BLANCO}">ZAFRA</text>`;
    T1.forEach((f, i) => {
      const a0 = ang(i) - 12.5, a1 = ang(i) + 12.5, r = R0 + f.rel * K;
      const color = f.rel >= 0 ? VERDE : BLANCO;
      const [lx, ly] = p(262, ang(i));
      s += `<g class="gajo" data-i="${i}" tabindex="0" role="button" aria-label="${f.nombre}: ${F.pct(f.rel)} respecto de la tendencia">`;
      s += `<path d="${sector(120, 268, ang(i) - 15, ang(i) + 15)}" fill="transparent"/>`;
      s += `<path d="${sector(Math.min(r, R0), Math.max(r, R0), a0, a1)}" fill="${color}" opacity="${f.ventana === "neutral" ? 0.45 : 0.95}"/>`;
      s += `<text x="${lx.toFixed(1)}" y="${(ly + 5).toFixed(1)}" text-anchor="middle" style="font:600 14px var(--fuente);fill:var(--texto-2)">${AZ.MESES_CORTOS[i].toUpperCase()}</text>`;
      s += `</g>`;
    });
    s += `<circle cx="${cx}" cy="${cy}" r="${R0}" fill="none" stroke="rgba(255,255,255,.55)" stroke-dasharray="4 6"/>`;
    s += `</svg>`;
    cont.insertAdjacentHTML("afterbegin", s);
    const fase = document.getElementById("rueda-fase"), mes = document.getElementById("rueda-mes"),
      valor = document.getElementById("rueda-valor"), detalle = document.getElementById("rueda-detalle");
    const gajos = cont.querySelectorAll(".gajo");
    let fijo = null;
    const mostrar = (i) => {
      if (i === null) {
        cont.classList.remove("con-foco");
        gajos.forEach((g) => g.classList.remove("activo"));
        fase.textContent = "Ciclo anual"; mes.textContent = "Año azucarero"; valor.textContent = "12 meses";
        valor.style.color = ""; detalle.textContent = "Tocá un mes para ver su desvío";
        return;
      }
      const f = T1[i];
      cont.classList.add("con-foco");
      gajos.forEach((g) => g.classList.toggle("activo", +g.dataset.i === i));
      fase.textContent = f.fase; mes.textContent = f.nombre; valor.textContent = F.pct(f.rel);
      valor.style.color = f.rel >= 0 ? VERDE : BLANCO;
      detalle.innerHTML = `Mediana ${F.pesos(f.mediana, 2, true)}<br>${f.senal}`;
    };
    gajos.forEach((g) => {
      const i = +g.dataset.i;
      g.addEventListener("pointerenter", () => { if (fijo === null) mostrar(i); });
      g.addEventListener("pointerleave", () => { if (fijo === null) mostrar(null); });
      g.addEventListener("focus", () => mostrar(i));
      g.addEventListener("blur", () => { if (fijo === null) mostrar(null); });
      const fijar = () => { fijo = fijo === i ? null : i; mostrar(fijo); };
      g.addEventListener("click", fijar);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fijar(); } });
    });
  }

  // ------------------------------------------------------------------ diagrama
  function diagrama() {
    const flujo = document.getElementById("flujo"), svg = document.getElementById("flujo-lineas");
    if (!flujo) return;
    AZ.conectarDetalles(flujo, (item) => {
      flujo.querySelectorAll(".nodo").forEach((n) => n.classList.toggle("activo", !!item && n === item.el));
    });
    AZ.conectarDetalles(document.querySelector(".flujo-extra"));
    AZ.conectores(flujo, svg);
  }

  // ------------------------------------------------------------------ explorador de la serie
  function explorador() {
    const cont = document.getElementById("exp-grafico");
    if (!cont) return;
    const diarioX = D.diario.dias.map((d) => Date.UTC(2008, 0, 1) + d * 864e5);
    const bandasZafra = [];
    for (let a = 2008; a <= 2026; a++) bandasZafra.push({ x0: Date.UTC(a, 5, 1), x1: Date.UTC(a, 9, 31) });
    const R = D.resumen;
    const rangos = {
      todo: [Date.UTC(2008, 0, 1), Date.UTC(2026, 8, 15)],
      "2008-2013": [Date.UTC(2008, 0, 1), Date.UTC(2013, 11, 31)],
      "2014-2019": [Date.UTC(2014, 0, 1), Date.UTC(2019, 11, 31)],
      "2020-2026": [Date.UTC(2020, 0, 1), Date.UTC(2026, 8, 15)],
    };
    const fechaMes = (i) => F.mesLargo(D.mensual.fechas[i]);
    const vistas = {
      nominal: {
        etiqueta: "Etapa 1 · Dato crudo", titulo: "Precio nominal diario",
        texto: "La serie en pesos corrientes está dominada por la inflación: el promedio mensual pasó de $ 63,00 en enero de 2008 a $ 35.822,90 en agosto de 2026. En escala logarítmica, cada aceleración inflacionaria se ve como un quiebre de pendiente. Sin deflactar, comparar meses de distintos años es engañoso.",
        metricas: [["6.791", "registros diarios"], ["$ 55,00", "mínimo · 27/11/2008"], ["$ 37.165", "máximo · 18/06/2026"], ["×569", "promedio mensual 2008 → 2026"]],
        series: [{ nombre: "Precio nominal", x: diarioX, y: D.diario.precios, color: VERDE, ancho: 1.4, area: 0.22 }],
        formatoY: (v) => "$ " + F.num(v), log: true,
        tooltip: (i) => `<span class="fecha">${F.fecha(new Date(diarioX[i]))}</span><div class="fila"><span>Precio nominal</span><b>${F.pesos(D.diario.precios[i])}</b></div>`,
      },
      real: {
        etiqueta: "Etapa 2 · Deflactación", titulo: "Precio real (pesos de agosto de 2026)",
        texto: "Multiplicando cada promedio mensual por su coeficiente IPC desaparece el velo monetario. Se distinguen ciclos largos: el máximo real de septiembre de 2023 ($ 155.786,60) responde a un episodio de escasez, y el mínimo de septiembre de 2025 ($ 30.127,98) a un mercado sobreofertado.",
        metricas: [["$ 60.043", "media histórica"], ["$ 52.545", "mediana"], ["$ 24.206", "desvío estándar"], ["224", "meses"]],
        series: [{ nombre: "Precio real", x: mensualX, y: D.mensual.real, color: "#F2F6F3", ancho: 2, area: 0.12 }],
        formatoY: (v) => "$ " + F.num(v), referencia: { y: R.media, texto: "media $ 60.042,71" }, desdeCero: true,
        tooltip: (i) => `<span class="fecha">${fechaMes(i)}</span><div class="fila"><span>Precio real</span><b>${F.pesos(D.mensual.real[i])}</b></div><div class="fila"><span>Nominal</span><b>${F.pesos(D.mensual.nominal[i])}</b></div><div class="fila"><span>Coeficiente IPC</span><b>× ${F.num(D.mensual.coef[i], 2)}</b></div>`,
      },
      tendencia: {
        etiqueta: "Etapa 3 · Filtro HP", titulo: "Precio real y tendencia estructural",
        texto: "El filtro de Hodrick-Prescott (λ = 14.400) separa la trayectoria estructural —máximos en febrero de 2011 y abril de 2023, valle en marzo de 2016— de las oscilaciones de corto plazo. En los extremos de la muestra el filtro es menos preciso (efecto de borde).",
        metricas: [["$ 87.695", "pico de tendencia · feb-2011"], ["$ 82.844", "pico de tendencia · abr-2023"], ["$ 41.674", "valle · mar-2016"], ["λ = 14.400", "suavizado mensual"]],
        series: [
          { nombre: "Precio real", x: mensualX, y: D.mensual.real, color: "rgba(242,246,243,.75)", ancho: 1.6 },
          { nombre: "Tendencia HP", x: mensualX, y: D.mensual.tendencia, color: VERDE, ancho: 3.4 },
        ],
        formatoY: (v) => "$ " + F.num(v), desdeCero: true,
        tooltip: (i) => `<span class="fecha">${fechaMes(i)}</span><div class="fila"><span><i style="background:#F2F6F3"></i> Precio real</span><b>${F.pesos(D.mensual.real[i])}</b></div><div class="fila"><span><i style="background:${VERDE}"></i> Tendencia τ</span><b>${F.pesos(D.mensual.tendencia[i])}</b></div><div class="fila"><span>Ciclo c</span><b>${F.pesos(D.mensual.ciclo[i], 2, true)}</b></div>`,
      },
      ciclo: {
        etiqueta: "Etapa 4 · Componente cíclico", titulo: "Ciclo c = y − τ en pesos constantes",
        texto: "El componente cíclico concentra estacionalidad, ciclos cortos y ruido. Activá «Marcar zafra»: los meses de junio a octubre tienden a quedar bajo la tendencia. El mayor desvío positivo (septiembre de 2023, +$ 75.351) coincide con la escasez de ese año.",
        metricas: [["+$ 75.351", "máximo · sep-2023"], ["−$ 29.914", "mínimo · jun-2024"], ["±18 %", "desvío absoluto medio"], ["0", "media por construcción"]],
        series: [{ nombre: "Ciclo", x: mensualX, y: D.mensual.ciclo, tipo: "barras", color: (v) => (v >= 0 ? VERDE : BLANCO) }],
        formatoY: (v) => F.num(v, 0, true), cero: true, zafra: true,
        tooltip: (i) => `<span class="fecha">${fechaMes(i)}</span><div class="fila"><span>Ciclo</span><b>${F.pesos(D.mensual.ciclo[i], 2, true)}</b></div><div class="fila"><span>Desvío relativo</span><b>${F.pct(D.mensual.rel[i])}</b></div>`,
      },
      rel: {
        etiqueta: "Etapa 5 · Normalización", titulo: "Desvío relativo sobre la tendencia",
        texto: "Expresar el ciclo en porcentaje de la tendencia lo vuelve comparable entre años con niveles de precio muy distintos. Promediando estos valores por mes calendario se obtiene la columna «Desvío relativo» de la Tabla 1.",
        metricas: [["+93,7 %", "máximo · sep-2023"], ["−44,9 %", "mínimo · jun-2024"], ["−4,66 %", "promedio de julio"], ["+3,96 %", "promedio de febrero"]],
        series: [{ nombre: "Desvío relativo", x: mensualX, y: D.mensual.rel, tipo: "barras", color: (v) => (v >= 0 ? VERDE : BLANCO) }],
        formatoY: (v) => F.num(v, 0, true) + " %", cero: true, zafra: true,
        tooltip: (i) => `<span class="fecha">${fechaMes(i)}</span><div class="fila"><span>Desvío relativo</span><b>${F.pct(D.mensual.rel[i])}</b></div><div class="fila"><span>Ciclo</span><b>${F.pesos(D.mensual.ciclo[i], 2, true)}</b></div>`,
      },
    };
    let vista = "tendencia", rango = "todo";
    const zafra = document.getElementById("exp-zafra"), log = document.getElementById("exp-log"), logCtrl = document.getElementById("exp-log-control");
    const grafico = AZ.graficos.lineas(cont, opciones());
    function opciones() {
      const v = vistas[vista];
      return {
        etiqueta: v.titulo, series: v.series, logY: !!(v.log && log.checked), formatoY: v.formatoY, tooltip: v.tooltip,
        referencia: v.referencia, cero: v.cero, desdeCero: v.desdeCero, yMin: undefined, yMax: undefined,
        xMin: rangos[rango][0], xMax: rangos[rango][1], bandas: zafra.checked ? bandasZafra : [],
        alto: (w) => (w < 560 ? 300 : Math.min(470, w * 0.52)),
      };
    }
    function lectura() {
      const v = vistas[vista];
      document.getElementById("exp-etiqueta").textContent = v.etiqueta;
      document.getElementById("exp-titulo").textContent = v.titulo;
      document.getElementById("exp-texto").textContent = v.texto;
      document.getElementById("exp-metricas").innerHTML = v.metricas.map(([a, b]) => `<div class="metrica-mini"><b class="num">${a}</b><span>${b}</span></div>`).join("");
      logCtrl.style.display = v.log ? "" : "none";
    }
    const botones = (sel, attr, cb) => document.querySelectorAll(sel + " button").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(sel + " button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      cb(b.dataset[attr]);
    }));
    botones("#exp-vistas", "vista", (v) => { vista = v; if (vistas[v].zafra && !zafra.dataset.tocado) zafra.checked = true; lectura(); grafico.actualizar(opciones()); });
    botones("#exp-rangos", "rango", (r) => { rango = r; grafico.actualizar(opciones()); });
    zafra.addEventListener("change", () => { zafra.dataset.tocado = "1"; grafico.actualizar(opciones()); });
    log.addEventListener("change", () => grafico.actualizar(opciones()));
    lectura();
  }

  // ------------------------------------------------------------------ Tabla 1 interactiva
  function estacionalidad() {
    const cont = document.getElementById("est-grafico"), ficha = document.getElementById("est-ficha"), tbody = document.querySelector("#tabla1 tbody");
    if (!cont) return;
    let metrica = "rel", sel = 6;
    const valores = () => T1.map((f) => f[metrica]);
    const fmt = (v) => (metrica === "rel" ? F.num(v, 2, true) + " %" : F.num(v, 0, true));
    const grafico = AZ.graficos.barras(cont, {
      etiqueta: "Patrón estacional por mes", etiquetas: AZ.MESES_CORTOS.map((m) => m[0].toUpperCase() + m.slice(1)),
      valores: valores(), colores: (v, i) => colorVentana(T1[i].ventana), seleccion: sel,
      formatoY: fmt, formatoValor: (v) => (metrica === "rel" ? F.num(v, 2, true) : F.num(v / 1000, 1, true) + "k"),
      bandas: [{ desde: 0, hasta: 2, texto: "VENTA", colorTexto: VERDE }, { desde: 5, hasta: 9, texto: "COMPRA", colorTexto: BLANCO, color: "rgba(255,255,255,.04)" }],
      tooltip: (i) => `<span class="fecha">${T1[i].nombre} · ${T1[i].fase}</span><div class="fila"><span>Desvío relativo</span><b>${F.pct(T1[i].rel)}</b></div><div class="fila"><span>Media cíclica</span><b>${F.pesos(T1[i].media, 2, true)}</b></div><div class="fila"><span>Mediana cíclica</span><b>${F.pesos(T1[i].mediana, 2, true)}</b></div>`,
      alClic: (i) => elegir(i),
      alto: (w) => (w < 560 ? 300 : Math.min(420, w * 0.5)),
    });
    document.querySelectorAll("#est-metricas button").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll("#est-metricas button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      metrica = b.dataset.metrica;
      grafico.actualizar({ valores: valores(), formatoY: fmt, seleccion: sel });
    }));
    // tabla
    const pildora = (v, t) => `<span class="pildora pildora--${v}">${t}</span>`;
    tbody.innerHTML = T1.map((f, i) => `<tr data-mes="${i}" tabindex="0">
      <td><b>${f.nombre}</b></td><td class="izq">${f.fase}</td>
      <td class="${f.media >= 0 ? "pos" : "neg"}">${F.num(f.media, 2, true)}</td>
      <td class="${f.mediana >= 0 ? "pos" : "neg"}">${F.num(f.mediana, 2, true)}</td>
      <td class="${f.rel >= 0 ? "pos" : "neg"}"><b>${F.num(f.rel, 2, true)} %</b></td>
      <td>${Math.round((f.pct_bajo_tendencia / 100) * f.n)} de ${f.n}</td>
      <td class="izq">${pildora(f.ventana, f.senal)}</td></tr>`).join("");
    tbody.querySelectorAll("tr").forEach((tr) => {
      const i = +tr.dataset.mes;
      tr.addEventListener("click", () => elegir(i));
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); elegir(i); } });
    });
    let puntos = null;
    function elegir(i) {
      sel = i;
      grafico.seleccionar(i);
      tbody.querySelectorAll("tr").forEach((tr) => tr.classList.toggle("seleccionada", +tr.dataset.mes === i));
      const f = T1[i];
      const valoresAnio = D.matriz.anios.map((a, k) => ({ v: D.matriz.rel[k][i], etiqueta: `${f.nombre} ${a}` })).filter((p) => p.v !== null);
      const bajo = Math.round((f.pct_bajo_tendencia / 100) * f.n);
      ficha.innerHTML = `
        <span class="etiqueta ${f.ventana === "compra" ? "etiqueta--blanca" : f.ventana === "neutral" ? "etiqueta--gris" : ""}">${f.fase}</span>
        <div class="ficha-mes__mes">${f.nombre}</div>
        <div class="ficha-mes__senal"><span class="pildora pildora--${f.ventana}">${f.senal}</span></div>
        <div class="datos-clave">
          <div class="dato-clave"><b class="num ${f.rel >= 0 ? "pos" : "neg"}">${F.pct(f.rel)}</b><span>desvío relativo medio</span></div>
          <div class="dato-clave"><b class="num">${F.pesos(f.mediana, 0, true)}</b><span>mediana cíclica (ARS)</span></div>
          <div class="dato-clave"><b class="num">${F.pesos(f.media, 0, true)}</b><span>media cíclica (ARS)</span></div>
          <div class="dato-clave"><b class="num">${bajo} de ${f.n}</b><span>años bajo la tendencia</span></div>
        </div>
        <div><span class="campo"><span class="rotulo">Cada punto es un año</span></span><div class="grafico" id="est-puntos"></div></div>
        <p class="ficha-mes__nota">Rango interanual: ${F.pct(f.rel_min, 1)} a ${F.pct(f.rel_max, 1)}. La amplitud refleja ciclos plurianuales; por eso el estudio informa también medianas.</p>`;
      puntos = AZ.graficos.puntos(document.getElementById("est-puntos"), { valores: valoresAnio, mediana: f.rel_mediana, alto: 120 });
    }
    elegir(sel);
  }

  function tablaPaper() {
    const tbody = document.querySelector("#tabla1-paper tbody");
    if (!tbody) return;
    tbody.innerHTML = T1.map((f) => `<tr><td><b>${f.nombre}</b></td><td class="izq">${f.fase}</td><td class="${f.media >= 0 ? "pos" : "neg"}">${F.num(f.media, 2, true)}</td><td class="${f.mediana >= 0 ? "pos" : "neg"}">${F.num(f.mediana, 2, true)}</td><td class="${f.rel >= 0 ? "pos" : "neg"}">${F.num(f.rel, 2, true)} %</td><td class="izq"><span class="pildora pildora--${f.ventana}">${f.senal}</span></td></tr>`).join("");
  }

  // ------------------------------------------------------------------ mapa de calor
  function hexARgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mezclar(a, b, t) { const x = hexARgb(a), y = hexARgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`; }
  AZ.colorCalor = function (v) {
    const c = Math.max(-40, Math.min(40, v));
    if (c < -20) return mezclar("#8C9A90", "#F2F5F1", (-c - 20) / 20);
    if (c < 0) return mezclar("#0A120E", "#8C9A90", -c / 20);
    if (c < 20) return mezclar("#0A120E", "#1C8F4A", c / 20);
    return mezclar("#1C8F4A", "#5BF08F", (c - 20) / 20);
  };
  function mapaCalor() {
    const cont = document.getElementById("calor");
    if (!cont) return;
    const M = D.matriz, idx = {};
    D.mensual.fechas.forEach((f, i) => (idx[f] = i));
    AZ.graficos.calor(cont, {
      etiqueta: "Mapa de calor del desvío del precio real respecto de su tendencia, por año (filas) y mes (columnas). Los valores de cada mes figuran en la tabla «Los 224 meses» de la página Datos.", filas: M.anios.map(String), columnas: AZ.MESES_CORTOS.map((m) => m[0].toUpperCase() + m.slice(1)),
      valores: M.rel, color: AZ.colorCalor, formato: (v) => F.num(v, 0, true),
      colorTexto: (v) => (v < -18 || v > 26 ? "#06100B" : "#F2F6F3"),
      tooltip: (r, c) => {
        const clave = `${M.anios[r]}-${String(c + 1).padStart(2, "0")}`, i = idx[clave];
        return `<span class="fecha">${AZ.MESES[c]} ${M.anios[r]}</span><div class="fila"><span>Desvío relativo</span><b>${F.pct(M.rel[r][c], 1)}</b></div><div class="fila"><span>Precio real</span><b>${F.pesos(D.mensual.real[i], 0)}</b></div><div class="fila"><span>Tendencia</span><b>${F.pesos(D.mensual.tendencia[i], 0)}</b></div>`;
      },
      alClic: (r, c) => {
        const clave = `${M.anios[r]}-${String(c + 1).padStart(2, "0")}`, i = idx[clave], f = T1[c];
        AZ.panel.abrir({
          etiqueta: `${f.fase} · ${f.senal}`, titulo: `${AZ.MESES[c]} de ${M.anios[r]}`,
          html: `<div class="datos-clave">
              <div class="dato-clave"><b>${F.pesos(D.mensual.nominal[i])}</b><span>promedio nominal del mes</span></div>
              <div class="dato-clave"><b>× ${F.num(D.mensual.coef[i], 2)}</b><span>coeficiente IPC</span></div>
              <div class="dato-clave"><b>${F.pesos(D.mensual.real[i])}</b><span>precio real (ago-2026)</span></div>
              <div class="dato-clave"><b>${F.pesos(D.mensual.tendencia[i])}</b><span>tendencia HP</span></div>
              <div class="dato-clave"><b>${F.pesos(D.mensual.ciclo[i], 2, true)}</b><span>ciclo c</span></div>
              <div class="dato-clave"><b>${F.pct(D.mensual.rel[i])}</b><span>desvío relativo</span></div>
            </div>
            <p>En promedio, ${AZ.MESES[c].toLowerCase()} se ubica <strong>${F.pct(f.rel)}</strong> respecto de la tendencia (mediana ${F.pesos(f.mediana, 2, true)}). Este mes de ${M.anios[r]} estuvo <strong>${D.mensual.rel[i] >= f.rel ? "por encima" : "por debajo"}</strong> de ese patrón.</p>`,
        });
      },
    });
  }

  // ------------------------------------------------------------------ simulador
  function simulador() {
    const $ = (id) => document.getElementById(id);
    const compra = $("sim-compra"), venta = $("sim-venta"), bolsas = $("sim-bolsas"), precio = $("sim-precio"), costo = $("sim-costo");
    if (!compra) return;
    const opcionesMes = AZ.MESES.map((m, i) => `<option value="${i}">${m}</option>`).join("");
    compra.innerHTML = opcionesMes; venta.innerHTML = opcionesMes;
    compra.value = "6"; venta.value = "1";
    const grafico = AZ.graficos.barras($("sim-grafico"), {
      etiqueta: "Meses de la operación", etiquetas: AZ.MESES_CORTOS.map((m) => m[0].toUpperCase() + m.slice(1)),
      valores: T1.map((f) => f.rel), colores: () => GRIS, formatoY: (v) => F.num(v, 0, true) + " %", formatoValor: (v) => F.num(v, 1, true),
      alto: (w) => (w < 560 ? 210 : 230), mostrarValores: true, margenIzq: 44,
    });
    function calcular() {
      const b = +compra.value, s = +venta.value;
      const meses = ((s - b + 12) % 12) || 12;
      const diff = T1[s].rel - T1[b].rel;
      const p = Math.max(0, +precio.value || 0), n = Math.max(0, Math.round(+bolsas.value || 0)), c = +costo.value;
      const bruto = (p * diff) / 100, costoT = (p * c * meses) / 100, neto = bruto - costoT;
      $("sim-costo-valor").textContent = F.num(c, 1) + " % por mes";
      $("sim-titulo").textContent = `Diferencial estacional ${AZ.MESES[b].toLowerCase()} → ${AZ.MESES[s].toLowerCase()}`;
      $("sim-diferencial").textContent = F.num(diff, 2, true) + " %";
      $("sim-diferencial").style.color = diff >= 0 ? "var(--verde)" : "var(--compra)";
      $("sim-explicacion").textContent = `${AZ.MESES[s]} (${F.pct(T1[s].rel)}) menos ${AZ.MESES[b].toLowerCase()} (${F.pct(T1[b].rel)}). Sobre las medianas de la Tabla 1, la diferencia es de ${F.pesos(T1[s].mediana - T1[b].mediana, 2, true)} por bolsa.`;
      $("sim-meses").textContent = meses;
      $("sim-bruto").textContent = F.pesos(bruto, 0, true);
      $("sim-costo-total").textContent = F.pesos(-costoT, 0);
      $("sim-neto").textContent = F.pesos(neto, 0, true);
      $("sim-neto").style.color = neto >= 0 ? "var(--verde)" : "var(--compra)";
      const total = neto * n;
      $("sim-total").textContent = Math.abs(total) >= 1e6 ? (total < 0 ? "−" : "") + "$ " + F.num(Math.abs(total) / 1e6, 2) + " M" : F.pesos(total, 0, true);
      $("sim-total-rotulo").textContent = `resultado estimado para ${F.num(n)} bolsas`;
      $("sim-equilibrio").textContent = diff > 0 ? F.num(diff / meses, 2) + " %" : "—";
      // evidencia histórica de la combinación elegida
      const M = D.matriz; let ok = 0, tot = 0;
      for (let k = 0; k < M.anios.length; k++) {
        const kv = s > b ? k : k + 1;
        if (kv >= M.anios.length) continue;
        const vb = M.rel[k][b], vs = M.rel[kv][s];
        if (vb === null || vs === null) continue;
        tot++; if (vs > vb) ok++;
      }
      $("sim-historia").innerHTML = tot ? `Evidencia histórica: en <b>${ok} de ${tot}</b> ciclos (${F.num((ok / tot) * 100, 0)} %), el desvío de ${AZ.MESES[s].toLowerCase()} superó al de ${AZ.MESES[b].toLowerCase()}${s > b ? " del mismo año" : " del año anterior"}.` : "";
      const enRuta = (i) => { for (let j = 0; j <= meses; j++) if ((b + j) % 12 === i) return true; return false; };
      grafico.actualizar({ colores: (v, i) => (i === b ? BLANCO : i === s ? VERDE : enRuta(i) ? "rgba(43,212,107,.35)" : "rgba(255,255,255,.08)") });
    }
    [compra, venta, bolsas, precio, costo].forEach((el) => el.addEventListener("input", calcular));
    document.getElementById("sim-form").addEventListener("submit", (e) => e.preventDefault());
    calcular();
  }

  // ------------------------------------------------------------------ galería
  function galeria() {
    AZ.conectarFiguras();
    const botones = document.querySelectorAll("#filtros-figuras button");
    botones.forEach((b) => b.addEventListener("click", () => {
      botones.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const f = b.dataset.filtro;
      document.querySelectorAll("#galeria .figura").forEach((el) => { el.hidden = !(f === "todas" || el.dataset.cat === f); });
    }));
  }
})();
