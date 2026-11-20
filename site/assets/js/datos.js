/* ==========================================================================
   Página «Datos»: calidad, deflactor, conversor, tabla explorable y descargas.
   ========================================================================== */
(function () {
  "use strict";
  const D = window.AZUCAR, AZ = window.AZ, F = AZ.fmt;
  const VERDE = "#2BD46B";
  const mensualX = D.mensual.fechas.map((f) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, 1));

  document.addEventListener("DOMContentLoaded", () => {
    AZ.conectarDetalles(document.querySelector("#pipeline"));
    registros();
    diario();
    deflactor();
    tabla();
    descargas();
  });

  function registros() {
    const cont = document.getElementById("g-registros");
    const anios = Object.keys(D.calidad.registros_por_anio);
    const vals = anios.map((a) => D.calidad.registros_por_anio[a]);
    AZ.graficos.barras(cont, {
      etiqueta: "Registros diarios por año", etiquetas: anios.map((a) => "’" + a.slice(2)), valores: vals,
      colores: (v, i) => (anios[i] === "2026" ? "rgba(43,212,107,.45)" : v < 360 ? "#EDF2EE" : VERDE),
      formatoY: (v) => F.num(v), formatoValor: (v) => F.num(v), mostrarValores: false, yMin: 0, yMax: 370,
      tooltip: (i) => `<span class="fecha">${anios[i]}</span><div class="fila"><span>Registros</span><b>${F.num(vals[i])}</b></div>${vals[i] < 360 && anios[i] !== "2026" ? '<div class="fila"><span>Con días faltantes</span><b>sí</b></div>' : ""}`,
      alto: (w) => (w < 560 ? 240 : 300),
    });
  }

  function diario() {
    const cont = document.getElementById("g-diario"), log = document.getElementById("d-log");
    const x = D.diario.dias.map((d) => Date.UTC(2008, 0, 1) + d * 864e5);
    const op = () => ({
      etiqueta: "Serie diaria nominal", logY: log.checked,
      series: [{ nombre: "Precio nominal", x, y: D.diario.precios, color: VERDE, ancho: 1.4, area: 0.2 }],
      formatoY: (v) => "$ " + F.num(v),
      tooltip: (i) => `<span class="fecha">${F.fecha(new Date(x[i]))}</span><div class="fila"><span>Precio</span><b>${F.pesos(D.diario.precios[i])}</b></div>`,
      anotaciones: [
        { x: Date.UTC(2008, 10, 27), y: 55, texto: "Mínimo $ 55,00", dy: -14 },
        { x: Date.UTC(2026, 5, 18), y: 37165, texto: "Máximo $ 37.165,00", dy: -12 },
      ],
      alto: (w) => (w < 560 ? 280 : Math.min(420, w * 0.4)),
    });
    const g = AZ.graficos.lineas(cont, op());
    log.addEventListener("change", () => g.actualizar(op()));
  }

  // Tramos del empalme del IPC según la metodología del BCRA (nota del ITCRM, enero de 2019)
  const TRAMOS_IPC = [
    { hasta: "2012-07", nombre: "IPC San Luis" },
    { hasta: "2016-04", nombre: "Promedio CABA y San Luis" },
    { hasta: "2016-12", nombre: "IPC GBA (INDEC)" },
    { hasta: "9999-12", nombre: "IPC nacional (INDEC)" },
  ];
  const tramoIPC = (fecha) => TRAMOS_IPC.find((t) => fecha <= t.hasta).nombre;

  function deflactor() {
    AZ.graficos.lineas(document.getElementById("g-coef"), {
      etiqueta: "Coeficiente IPC, serie empalmada con la metodología del BCRA", logY: true,
      series: [{ nombre: "Coeficiente IPC", x: mensualX, y: D.mensual.coef, color: VERDE, ancho: 3, area: 0.15, formato: (v) => "× " + F.num(v, 2) }],
      formatoY: (v) => "× " + F.num(v),
      // franjas en los tramos San Luis y GBA: alternan con los tramos sin sombrear
      bandas: [{ x0: Date.UTC(2008, 0, 1), x1: Date.UTC(2012, 6, 31) }, { x0: Date.UTC(2016, 4, 1), x1: Date.UTC(2016, 11, 31) }],
      tooltip: (i) => `<span class="fecha">${F.mesLargo(D.mensual.fechas[i])}</span><div class="fila"><span>Coeficiente</span><b>× ${F.num(D.mensual.coef[i], 2)}</b></div><div class="fila"><span>$ 1 de entonces</span><b>${F.pesos(D.mensual.coef[i])} de hoy</b></div><div class="fila"><span>Índice</span><b>${tramoIPC(D.mensual.fechas[i])}</b></div>`,
      alto: (w) => (w < 560 ? 260 : 340),
    });
    const selA = document.getElementById("c-anio"), selM = document.getElementById("c-mes");
    for (let a = 2008; a <= 2026; a++) selA.insertAdjacentHTML("beforeend", `<option value="${a}">${a}</option>`);
    const llenarMeses = () => {
      const a = +selA.value, previo = selM.value;
      selM.innerHTML = AZ.MESES.map((m, i) => (a === 2026 && i > 7 ? "" : `<option value="${i + 1}">${m}</option>`)).join("");
      if (previo && selM.querySelector(`option[value="${previo}"]`)) selM.value = previo;
    };
    const calcular = () => {
      const clave = `${selA.value}-${String(selM.value).padStart(2, "0")}`, i = D.mensual.fechas.indexOf(clave);
      if (i < 0) return;
      document.getElementById("c-calculo").innerHTML =
        `<span class="tenue">${F.mesLargo(clave)}</span><br><b class="num">${F.pesos(D.mensual.nominal[i])}</b> × <b class="num">${F.num(D.mensual.coef[i], 8)}</b> =<b class="num verde" style="font-size:1.25em">${F.pesos(D.mensual.real[i])}</b>`;
      document.getElementById("c-datos").innerHTML = `
        <div class="dato-clave"><b class="num">${F.pesos(D.mensual.tendencia[i], 0)}</b><span>tendencia HP de ese mes</span></div>
        <div class="dato-clave"><b class="num">${F.pesos(D.mensual.ciclo[i], 0, true)}</b><span>ciclo (precio − tendencia)</span></div>
        <div class="dato-clave"><b class="num">${F.pct(D.mensual.rel[i])}</b><span>desvío relativo</span></div>`;
    };
    selA.value = "2008"; llenarMeses(); selM.value = "1";
    selA.addEventListener("change", () => { llenarMeses(); calcular(); });
    selM.addEventListener("change", calcular);
    calcular();
  }

  function tabla() {
    const tbody = document.querySelector("#t-datos tbody"), selA = document.getElementById("t-anio"), selM = document.getElementById("t-mes"), conteo = document.getElementById("t-conteo");
    for (let a = 2008; a <= 2026; a++) selA.insertAdjacentHTML("beforeend", `<option value="${a}">${a}</option>`);
    AZ.MESES.forEach((m, i) => selM.insertAdjacentHTML("beforeend", `<option value="${i + 1}">${m}</option>`));
    const filas = D.mensual.fechas.map((f, i) => ({ fecha: f, nominal: D.mensual.nominal[i], coef: D.mensual.coef[i], real: D.mensual.real[i], tendencia: D.mensual.tendencia[i], ciclo: D.mensual.ciclo[i], rel: D.mensual.rel[i] }));
    let col = "fecha", dir = 1;
    const pintar = () => {
      const a = selA.value, m = selM.value;
      const vista = filas.filter((r) => (!a || r.fecha.startsWith(a)) && (!m || +r.fecha.slice(5, 7) === +m))
        .sort((p, q) => (p[col] > q[col] ? 1 : p[col] < q[col] ? -1 : 0) * dir);
      tbody.innerHTML = vista.map((r) => `<tr><td>${F.mes(r.fecha)}</td><td>${F.num(r.nominal, 2)}</td><td>${F.num(r.coef, 4)}</td><td><b>${F.num(r.real, 2)}</b></td><td>${F.num(r.tendencia, 2)}</td><td class="${r.ciclo >= 0 ? "pos" : "neg"}">${F.num(r.ciclo, 2, true)}</td><td class="${r.rel >= 0 ? "pos" : "neg"}">${F.num(r.rel, 2, true)} %</td></tr>`).join("");
      conteo.textContent = `${vista.length} ${vista.length === 1 ? "mes" : "meses"}`;
      document.querySelectorAll("#t-datos .ordenar").forEach((b) => {
        const activa = b.dataset.col === col;
        b.dataset.dir = activa ? (dir > 0 ? "asc" : "desc") : "";
        b.parentElement.setAttribute("aria-sort", activa ? (dir > 0 ? "ascending" : "descending") : "none");
      });
    };
    document.querySelectorAll("#t-datos .ordenar").forEach((b) => b.addEventListener("click", () => {
      if (col === b.dataset.col) dir = -dir; else { col = b.dataset.col; dir = col === "fecha" ? 1 : -1; }
      pintar();
    }));
    selA.addEventListener("change", pintar);
    selM.addEventListener("change", pintar);
    pintar();
  }

  function descargas() {
    const archivos = [
      ["precio_azucar_50kg_desde_2008.csv", "Serie diaria nominal limpia (CACTU)", "6.791 filas · Fecha, 50Kg", "129 KB"],
      ["promedio_mensual_azucar_desde_2008.csv", "Promedio mensual nominal (.resample('MS').mean())", "225 filas · Fecha, 50Kg", "4 KB"],
      ["ipc_coeficientes_desde_2008.csv", "Coeficientes IPC a pesos de agosto de 2026", "224 filas · Periodo, Coeficiente", "7 KB"],
      ["precio_real_azucar_desde_2008.csv", "Unión nominal + IPC y precio real", "224 filas · 5 columnas", "13 KB"],
      ["precio_actualizado_agosto2026_azucar_mensual.csv", "Serie real lista para el modelo", "224 filas · Periodo, Precio actualizado", "5 KB"],
      ["azucar_tendencia_hp.csv", "Serie integrada: real, tendencia, ciclo y desvío", "224 filas · 7 columnas", "13 KB"],
      ["tabla1_estacionalidad.csv", "Tabla 1 ampliada con dispersión por mes", "12 filas · 15 columnas", "1 KB"],
    ];
    document.getElementById("lista-descargas").innerHTML = archivos.map(([f, t, d, s]) => `
      <a class="tarjeta tarjeta--clic revelar visible" href="datos/${f}" download style="text-decoration:none;display:grid;gap:10px;align-content:start">
        <span class="tarjeta__mas" aria-hidden="true">${AZ.icono.descarga}</span>
        <span class="etiqueta">CSV · ${s}</span>
        <h3 style="font-size:1.05rem;word-break:break-word">${f}</h3>
        <p style="margin:0">${t}</p>
        <span class="tenue" style="font-size:.85rem">${d}</span>
      </a>`).join("");
  }
})();
