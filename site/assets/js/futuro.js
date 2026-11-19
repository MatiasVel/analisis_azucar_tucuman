/* ==========================================================================
   Página «Aportes futuros»: hoja de ruta, arquitectura interactiva y
   prueba de concepto de pronóstico con machine learning.
   ========================================================================== */
(function () {
  "use strict";
  const AZ = window.AZ, F = AZ.fmt, ML = window.AZUCAR_ML;
  const VERDE = "#2BD46B";
  const NOMBRES = {
    ridge: ["Ridge", "Regresión lineal regularizada con rezagos del precio, momentos y mes del año.", "Ciencia de datos"],
    gradient_boosting: ["Gradient Boosting", "Árboles de decisión potenciados (HistGradientBoosting) con las mismas variables.", "Machine learning"],
    ingenuo: ["Ingenuo", "El pronóstico es el último precio observado. Es la referencia mínima a superar.", "Referencia"],
    ingenuo_estacional: ["Ingenuo estacional", "Repite la variación que tuvo el precio en el mismo tramo del año anterior.", "Referencia"],
  };

  document.addEventListener("DOMContentLoaded", () => {
    AZ.conectarDetalles(document.querySelector("#hoja-de-ruta"));
    AZ.conectarDetalles(document.querySelector("#variables"));
    const flujo = document.getElementById("flujo-arq");
    if (flujo) { AZ.conectarDetalles(flujo); AZ.conectores(flujo, document.getElementById("lineas-arq")); }
    prototipo();
  });

  function prototipo() {
    const cont = document.getElementById("g-ml");
    if (!cont || !ML) return;
    const S = ML.serie_h1, x = S.fechas.map((f) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, 1));
    const mape = (m, h) => ML.metricas.find((r) => r.modelo === m && r.h === h);
    // tabla de métricas
    const mejores = {};
    [1, 3, 6].forEach((h) => { mejores[h] = ML.metricas.filter((r) => r.h === h).sort((a, b) => a.mape - b.mape)[0].modelo; });
    document.querySelector("#t-ml tbody").innerHTML = Object.keys(NOMBRES).map((m) => `<tr><td><b>${NOMBRES[m][0]}</b></td><td class="izq" style="white-space:normal;max-width:380px">${NOMBRES[m][1]}</td>${[1, 3, 6].map((h) => `<td class="${mejores[h] === m ? "pos" : ""}">${mejores[h] === m ? "<b>" : ""}${F.num(mape(m, h).mape, 2)} %${mejores[h] === m ? "</b>" : ""}</td>`).join("")}</tr>`).join("");
    let modelo = "ridge";
    const op = () => ({
      etiqueta: "Pronóstico a un mes frente al precio observado",
      series: [
        { nombre: "Observado", x, y: S.observado, color: "#F2F6F3", ancho: 2.4 },
        { nombre: NOMBRES[modelo][0], x, y: S[modelo], color: VERDE, ancho: 2.4, guiones: modelo.startsWith("ingenuo") ? "6 5" : null },
      ],
      formatoY: (v) => "$ " + F.num(v / 1000) + "k", margenIzq: 64,
      tooltip: (i) => `<span class="fecha">${F.mesLargo(S.fechas[i])}</span><div class="fila"><span><i style="background:#F2F6F3"></i> Observado</span><b>${F.pesos(S.observado[i], 0)}</b></div><div class="fila"><span><i style="background:${VERDE}"></i> ${NOMBRES[modelo][0]}</span><b>${F.pesos(S[modelo][i], 0)}</b></div><div class="fila"><span>Error</span><b>${F.pct(((S[modelo][i] - S.observado[i]) / S.observado[i]) * 100, 1)}</b></div>`,
      alto: (w) => (w < 560 ? 280 : Math.min(420, w * 0.5)),
    });
    const g = AZ.graficos.lineas(cont, op());
    const lectura = () => {
      const n = NOMBRES[modelo];
      document.getElementById("ml-etiqueta").textContent = n[2];
      document.getElementById("ml-titulo").textContent = n[0];
      document.getElementById("ml-texto").textContent = n[1];
      document.getElementById("ml-metricas").innerHTML = [1, 3, 6].map((h) => `<div class="metrica-mini"><b class="num ${mejores[h] === modelo ? "verde" : ""}">${F.num(mape(modelo, h).mape, 1)} %</b><span>MAPE a ${h} ${h === 1 ? "mes" : "meses"}</span></div>`).join("") +
        `<div class="metrica-mini"><b class="num">${F.pesos(mape(modelo, 1).mae, 0)}</b><span>error absoluto medio a 1 mes</span></div>`;
    };
    document.querySelectorAll("#ml-modelos button").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll("#ml-modelos button").forEach((x2) => x2.setAttribute("aria-pressed", String(x2 === b)));
      modelo = b.dataset.modelo; g.actualizar(op()); lectura();
    }));
    lectura();
  }
})();
