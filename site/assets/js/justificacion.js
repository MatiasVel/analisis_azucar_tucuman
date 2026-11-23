/* ==========================================================================
   Página «Justificación»: calendario de fases, real vs. nominal, laboratorio
   del filtro HP con λ interactivo, pruebas estadísticas y backtest.
   ========================================================================== */
(function () {
  "use strict";
  const D = window.AZUCAR, AZ = window.AZ, F = AZ.fmt;
  const VERDE = "#2BD46B", BLANCO = "#EDF2EE", GRIS = "#4B5B51";
  const T1 = D.tabla1;
  const mensualX = D.mensual.fechas.map((f) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, 1));

  document.addEventListener("DOMContentLoaded", () => {
    calendario();
    reales();
    laboratorio();
    pruebas();
    backtest();
    AZ.conectarDetalles(document.querySelector("#mecanismo"));
    AZ.conectarFiguras();
  });

  function calendario() {
    const cont = document.getElementById("calendario");
    if (!cont) return;
    cont.innerHTML = T1.map((f, i) => `
      <div class="mes-fase mes-fase--${f.ventana}" role="listitem">
        <b>${AZ.MESES_CORTOS[i][0].toUpperCase() + AZ.MESES_CORTOS[i].slice(1)}</b>
        <span>${f.fase}</span>
        <span class="mes-fase__valor num ${f.rel >= 0 ? "pos" : "neg"}">${F.pct(f.rel)}</span>
        <i style="background:${f.ventana === "venta" ? VERDE : f.ventana === "compra" ? BLANCO : GRIS}"></i>
      </div>`).join("");
  }

  function reales() {
    const cont = document.getElementById("g-reales");
    if (!cont) return;
    const vistas = {
      nominal: { series: [{ nombre: "Precio nominal mensual", x: mensualX, y: D.mensual.nominal, color: VERDE, ancho: 2.4, area: 0.18 }], logY: true, nota: "Pesos corrientes · escala logarítmica" },
      real: { series: [{ nombre: "Precio real", x: mensualX, y: D.mensual.real, color: "#F2F6F3", ancho: 2.2, area: 0.12 }], logY: false, nota: "Pesos constantes de agosto de 2026", desdeCero: true },
    };
    const op = (v) => ({
      etiqueta: "Precio nominal y real", series: vistas[v].series, logY: vistas[v].logY, desdeCero: vistas[v].desdeCero,
      formatoY: (y) => "$ " + F.num(y),
      tooltip: (i) => `<span class="fecha">${F.mesLargo(D.mensual.fechas[i])}</span><div class="fila"><span>Nominal</span><b>${F.pesos(D.mensual.nominal[i])}</b></div><div class="fila"><span>Coeficiente</span><b>× ${F.num(D.mensual.coef[i], 2)}</b></div><div class="fila"><span>Real</span><b>${F.pesos(D.mensual.real[i])}</b></div>`,
      alto: (w) => (w < 560 ? 280 : Math.min(420, w * 0.42)),
    });
    const g = AZ.graficos.lineas(cont, op("nominal"));
    const nota = document.getElementById("r-nota");
    nota.textContent = vistas.nominal.nota;
    document.querySelectorAll("#r-vistas button").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll("#r-vistas button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      g.actualizar(op(b.dataset.vista));
      nota.textContent = vistas[b.dataset.vista].nota;
    }));
  }

  function laboratorio() {
    const rango = document.getElementById("lam");
    if (!rango) return;
    const LAMBDAS = [100, 400, 1600, 6400, 14400, 50000, 129600, 500000, 1000000];
    const etiqueta = document.getElementById("lam-valor"), metricas = document.getElementById("lam-metricas");
    let gSerie = null, gPatron = null;
    const actualizar = () => {
      const lam = LAMBDAS[+rango.value];
      const r = AZ.patronEstacional(D.mensual.fechas, D.mensual.real, lam);
      etiqueta.textContent = "λ = " + F.num(lam);
      const opSerie = {
        etiqueta: "Precio real y tendencia HP", desdeCero: true,
        series: [
          { nombre: "Precio real", x: mensualX, y: D.mensual.real, color: "rgba(242,246,243,.7)", ancho: 1.4 },
          { nombre: "Tendencia (λ = " + F.num(lam) + ")", x: mensualX, y: r.tendencia, color: VERDE, ancho: 3 },
        ],
        formatoY: (v) => "$ " + F.num(v / 1000) + "k",
        tooltip: (i) => `<span class="fecha">${F.mesLargo(D.mensual.fechas[i])}</span><div class="fila"><span>Real</span><b>${F.pesos(D.mensual.real[i], 0)}</b></div><div class="fila"><span>Tendencia</span><b>${F.pesos(r.tendencia[i], 0)}</b></div>`,
        alto: (w) => (w < 560 ? 240 : 300), margenIzq: 58,
      };
      const imin = r.rel.indexOf(Math.min(...r.rel)), imax = r.rel.indexOf(Math.max(...r.rel));
      const opPatron = {
        etiqueta: "Patrón estacional", etiquetas: AZ.MESES_CORTOS.map((m) => m[0].toUpperCase() + m.slice(1)), valores: r.rel,
        colores: (v, i) => (i === imin ? BLANCO : i === imax ? VERDE : v >= 0 ? "rgba(43,212,107,.45)" : "rgba(237,242,238,.4)"),
        formatoY: (v) => F.num(v, 0, true) + " %", formatoValor: (v) => F.num(v, 1, true), seleccion: null,
        tooltip: (i) => `<span class="fecha">${AZ.MESES[i]}</span><div class="fila"><span>Desvío medio</span><b>${F.pct(r.rel[i])}</b></div><div class="fila"><span>Con λ = 14.400</span><b>${F.pct(T1[i].rel)}</b></div>`,
        alto: (w) => (w < 560 ? 240 : 300), margenIzq: 48,
      };
      if (!gSerie) { gSerie = AZ.graficos.lineas(document.getElementById("g-lam-serie"), opSerie); gPatron = AZ.graficos.barras(document.getElementById("g-lam-patron"), opPatron); }
      else { gSerie.actualizar(opSerie); gPatron.actualizar(opPatron); }
      const red = (v) => Math.round(v * 100) / 100; // mismo criterio del paper: diferencia de valores redondeados
      const dif = red(r.rel[1]) - red(r.rel[6]), difMed = red(r.medianaArs[1]) - red(r.medianaArs[6]);
      const mantiene = imin === 6 && imax === 1;
      metricas.innerHTML = `
        <div class="dato-clave"><b class="num">${AZ.MESES[imin]}</b><span>valle · ${F.pct(r.rel[imin])}</span></div>
        <div class="dato-clave"><b class="num">${AZ.MESES[imax]}</b><span>pico · ${F.pct(r.rel[imax])}</span></div>
        <div class="dato-clave"><b class="num verde">${F.num(dif, 2, true)} %</b><span>diferencial febrero − julio</span></div>
        <div class="dato-clave"><b class="num" style="color:${mantiene ? "var(--verde)" : "var(--compra)"}">${mantiene ? "Se mantiene" : "Cambia"}</b><span>${mantiene ? "valle en julio y pico en febrero" : "el valle o el pico se desplazan"} · medianas ${F.pesos(difMed, 0, true)}</span></div>`;
    };
    rango.addEventListener("input", actualizar);
    actualizar();
  }

  function pruebas() {
    const P = D.robustez.pruebas, tbody = document.querySelector("#t-pruebas tbody");
    if (!tbody) return;
    const p = (v) => (v < 0.001 ? "< 0,001" : F.num(v, 3));
    const filas = [
      ["Friedman (bloques por año)", "¿Difieren los meses dentro de un mismo año?", `χ² = ${F.num(P.friedman.chi2, 2)}`, p(P.friedman.p), `Sí, al 5 %. ${P.friedman.anios} años completos; ranking medio: febrero ${F.num(P.friedman.rango_medio[1], 2)}, julio ${F.num(P.friedman.rango_medio[6], 2)} (sobre 12).`, true],
      ["Wilcoxon (pares por año)", "¿Febrero supera a julio del mismo año?", `W = ${F.num(P.wilcoxon_feb_jul.stat, 0)}`, p(P.wilcoxon_feb_jul.p), `Sí, al 5 %: febrero > julio en ${F.num(P.wilcoxon_feb_jul.pct_feb_mayor, 0)} % de los ${P.wilcoxon_feb_jul.n} años.`, true],
      ["Mann-Whitney (unilateral)", "¿La interzafra (ene–mar) supera a la zafra (jun–oct)?", `U = ${F.num(P.mannwhitney_inter_zafra.u, 0)}`, p(P.mannwhitney_inter_zafra.p), `Sí, al 5 %: medianas ${F.pct(P.mannwhitney_inter_zafra.mediana_inter, 1)} frente a ${F.pct(P.mannwhitney_inter_zafra.mediana_zafra, 1)}.`, true],
      ["Kruskal-Wallis (sin bloques)", "¿Difieren los meses ignorando el año?", `H = ${F.num(P.kruskal_sin_bloques.h, 2)}`, p(P.kruskal_sin_bloques.p), "No: la variabilidad entre años (ciclos plurianuales) domina cuando no se controla por año.", false],
    ];
    tbody.innerHTML = filas.map(([a, b, c, d, e, ok]) => `<tr><td class="izq"><b>${a}</b></td><td class="izq" style="white-space:normal;max-width:260px">${b}</td><td>${c}</td><td><b class="${ok ? "pos" : "neg"}">${d}</b></td><td class="izq" style="white-space:normal;max-width:360px">${e}</td></tr>`).join("");
    const t = T1, bt = D.backtest.resumen;
    document.getElementById("consistencia").innerHTML = `
      <div class="dato-clave revelar visible"><b class="num">${Math.round((t[6].pct_bajo_tendencia / 100) * t[6].n)} de ${t[6].n}</b><span>años con julio bajo la tendencia</span></div>
      <div class="dato-clave revelar visible"><b class="num">${Math.round((P.wilcoxon_feb_jul.pct_feb_mayor / 100) * P.wilcoxon_feb_jul.n)} de ${P.wilcoxon_feb_jul.n}</b><span>años con febrero por encima de julio del mismo año</span></div>
      <div class="dato-clave revelar visible"><b class="num">${bt.ciclo_positivos} de ${bt.n}</b><span>ciclos julio → febrero siguiente con mejora relativa a la tendencia</span></div>
      <div class="dato-clave revelar visible"><b class="num">5 de 5</b><span>valores de λ probados con valle en julio y pico en febrero</span></div>`;
  }

  function backtest() {
    const cont = document.getElementById("g-backtest");
    if (!cont) return;
    const ops = D.backtest.operaciones, R = D.backtest.resumen;
    document.getElementById("bt-resumen").innerHTML = `
      <div class="dato-clave"><b class="num">${R.positivos} de ${R.n}</b><span>ciclos con retorno real positivo</span></div>
      <div class="dato-clave"><b class="num verde">${F.num(R.mediana, 1, true)} %</b><span>mediana del retorno real</span></div>
      <div class="dato-clave"><b class="num">${F.num(R.media, 1, true)} %</b><span>promedio del retorno real</span></div>
      <div class="dato-clave"><b class="num">${F.num(R.min, 0, true)} / ${F.num(R.max, 0, true)} %</b><span>peor (${R.min_anio}/${String(R.min_anio + 1).slice(2)}) y mejor ciclo (${R.max_anio}/${String(R.max_anio + 1).slice(2)})</span></div>`;
    AZ.graficos.barras(cont, {
      etiqueta: "Retorno real julio a febrero por ciclo", etiquetas: ops.map((o) => `${String(o.anio).slice(2)}/${String(o.anio + 1).slice(2)}`),
      valores: ops.map((o) => o.retorno), colores: (v) => (v >= 0 ? VERDE : BLANCO),
      formatoY: (v) => F.num(v, 0, true) + " %", formatoValor: (v) => F.num(v, 0, true),
      tooltip: (i) => {
        const o = ops[i];
        return `<span class="fecha">Ciclo ${o.anio}/${o.anio + 1}</span>
          <div class="fila"><span>Compra jul-${o.anio}</span><b>${F.pesos(o.compra, 0)}</b></div>
          <div class="fila"><span>Venta feb-${o.anio + 1}</span><b>${F.pesos(o.venta, 0)}</b></div>
          <div class="fila"><span>Retorno real</span><b>${F.pct(o.retorno, 1)}</b></div>
          <div class="fila"><span>Posición vs. tendencia</span><b>${F.num(o.ciclo_pp, 1, true)} %</b></div>
          <div class="fila"><span>Cambio de la tendencia</span><b>${F.pct(o.tendencia_pct, 1)}</b></div>`;
      },
      alto: (w) => (w < 560 ? 280 : 360),
    });
  }
})();
