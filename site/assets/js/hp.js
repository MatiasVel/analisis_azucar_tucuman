/* ==========================================================================
   Filtro de Hodrick-Prescott en el navegador.
   Resuelve (I + λ·K'K)·τ = y, con K la matriz de segundas diferencias (T−2 × T).
   La matriz es simétrica y pentadiagonal: eliminación gaussiana en banda, O(T).
   Reproduce sm.tsa.filters.hpfilter de statsmodels.
   ========================================================================== */
(function () {
  "use strict";
  const AZ = (window.AZ = window.AZ || {});

  AZ.hp = function (y, lambda) {
    const n = y.length;
    if (n < 5) throw new Error("La serie necesita al menos 5 observaciones");
    // Banda: M[i][j - i + 2] guarda el elemento (i, j) para j ∈ [i-2, i+2]
    const M = Array.from({ length: n }, () => new Float64Array(5));
    for (let i = 0; i < n; i++) {
      const diag = i === 0 || i === n - 1 ? 1 : i === 1 || i === n - 2 ? 5 : 6;
      M[i][2] = 1 + lambda * diag;
      if (i + 1 < n) {
        const v = lambda * (i === 0 || i === n - 2 ? -2 : -4);
        M[i][3] = v; M[i + 1][1] = v;
      }
      if (i + 2 < n) { M[i][4] = lambda; M[i + 2][0] = lambda; }
    }
    const b = Float64Array.from(y);
    for (let k = 0; k < n; k++) {
      const pivote = M[k][2];
      for (let r = 1; r <= 2 && k + r < n; r++) {
        const f = M[k + r][2 - r] / pivote;
        if (f === 0) continue;
        for (let c = 0; c <= 2 && k + c < n; c++) M[k + r][2 + c - r] -= f * M[k][2 + c];
        b[k + r] -= f * b[k];
      }
    }
    const tendencia = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      if (i + 1 < n) s -= M[i][3] * tendencia[i + 1];
      if (i + 2 < n) s -= M[i][4] * tendencia[i + 2];
      tendencia[i] = s / M[i][2];
    }
    const ciclo = Array.from(y, (v, i) => v - tendencia[i]);
    return { tendencia: Array.from(tendencia), ciclo };
  };

  /* Patrón estacional: promedio por mes calendario del desvío relativo c/τ·100 */
  AZ.patronEstacional = function (fechas, y, lambda) {
    const { tendencia, ciclo } = AZ.hp(y, lambda);
    const suma = new Array(12).fill(0), cant = new Array(12).fill(0), med = Array.from({ length: 12 }, () => []);
    fechas.forEach((f, i) => {
      const m = +f.slice(5, 7) - 1, rel = (ciclo[i] / tendencia[i]) * 100;
      suma[m] += rel; cant[m] += 1; med[m].push(ciclo[i]);
    });
    const mediana = (a) => { const s = [...a].sort((p, q) => p - q), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
    return {
      tendencia, ciclo,
      rel: suma.map((s, m) => s / cant[m]),
      medianaArs: med.map(mediana),
    };
  };
})();
