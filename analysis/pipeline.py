"""
Pipeline reproducible del paper
"Análisis de la Estacionalidad del Precio del Azúcar en el Mercado Interno de Tucumán"
Autor: Héctor Matías Veliz — UTN Facultad Regional Tucumán

Etapas (idénticas al cuaderno CuadernoComparación_V2.ipynb):
  1. Ingesta y validación de la serie diaria nominal (CACTU).
  2. Submuestreo mensual con .resample('MS').mean().
  3. Deflactación con coeficientes de la serie de IPC empalmada con la metodología del BCRA, a pesos de agosto de 2026.
  4. Filtro de Hodrick-Prescott (lambda = 14.400) bajo modelo aditivo y_t = tau_t + c_t.
  5. Agregación del componente cíclico por mes calendario (Tabla 1).
  6. Validación complementaria (sensibilidad a lambda, métodos alternativos, pruebas no paramétricas, backtest).
  7. Exportación de datos para la web (site/assets/data/azucar.js) y CSV descargables (site/datos/).

Uso:  python analysis/pipeline.py
"""
from __future__ import annotations

import json
from datetime import date
from decimal import ROUND_HALF_EVEN, Decimal
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import sparse, stats
from scipy.sparse.linalg import spsolve

RAIZ = Path(__file__).resolve().parents[1]
DATOS = RAIZ / "site" / "datos"
SALIDA_JS = RAIZ / "site" / "assets" / "data" / "azucar.js"

LAMBDA = 14_400
COL_COEF = "Coeficiente de ajuste a Pesos de Agosto de 2026"
MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
         "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

# Fase operativa y señal de mercado tal como figuran en la Tabla 1 del paper.
FASE = ["Interzafra", "Interzafra", "Interzafra", "Pre-zafra", "Inicio zafra", "Zafra",
        "Plena zafra", "Plena zafra", "Plena zafra", "Fin zafra", "Fin zafra", "Interzafra"]
SENAL = ["Venta", "Venta óptima (pico)", "Venta", "Neutral / transición", "Transición", "Compra",
         "Compra óptima (valle)", "Compra (mediana neg.)", "Compra", "Compra fuerte", "Acopio", "Retención"]
# Ventanas operativas del paper: compra jun–oct, venta ene–mar.
VENTANA = ["venta", "venta", "venta", "neutral", "neutral", "compra",
           "compra", "compra", "compra", "compra", "neutral", "neutral"]


# ----------------------------------------------------------------------------
# Filtro de Hodrick-Prescott
# ----------------------------------------------------------------------------
def hp_filter(y: np.ndarray, lamb: float) -> tuple[np.ndarray, np.ndarray]:
    """Devuelve (ciclo, tendencia). Resuelve (I + lambda K'K) tau = y con K = matriz de
    segundas diferencias. Es la misma formulación que statsmodels.tsa.filters.hpfilter."""
    y = np.asarray(y, dtype=float)
    n = len(y)
    identidad = sparse.eye(n, format="csc")
    diag = np.repeat([[1.0], [-2.0], [1.0]], n, axis=1)
    k = sparse.dia_matrix((diag, [0, 1, 2]), shape=(n - 2, n)).tocsc()
    tendencia = spsolve(identidad + lamb * k.T.dot(k), y)
    return y - tendencia, tendencia


def hp_con_statsmodels_si_existe(y: pd.Series, lamb: float) -> tuple[np.ndarray, np.ndarray]:
    ciclo, tendencia = hp_filter(y.values, lamb)
    try:  # Si statsmodels está instalado, se verifica que ambas implementaciones coincidan.
        import statsmodels.api as sm

        c_sm, t_sm = sm.tsa.filters.hpfilter(y, lamb=lamb)
        assert np.allclose(c_sm.values, ciclo, atol=1e-6)
        assert np.allclose(t_sm.values, tendencia, atol=1e-6)
        print("✓ statsmodels.hpfilter y la implementación propia coinciden")
    except ImportError:
        print("· statsmodels no disponible: se usa la implementación matricial equivalente")
    return ciclo, tendencia


def r2(x) -> float | None:
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    return round(float(x), 2)


def main() -> None:
    # ------------------------------------------------------------------ 1. Ingesta
    diario = pd.read_csv(DATOS / "precio_azucar_50kg_desde_2008.csv")
    diario["Fecha"] = pd.to_datetime(diario["Fecha"])
    diario = diario.sort_values("Fecha").reset_index(drop=True)
    assert diario["Fecha"].is_unique, "Hay fechas duplicadas"
    assert diario["50Kg"].notna().all(), "Hay precios nulos"

    i_min, i_max = diario["50Kg"].idxmin(), diario["50Kg"].idxmax()
    calidad = {
        "registros": int(len(diario)),
        "fecha_inicio": diario["Fecha"].min().strftime("%Y-%m-%d"),
        "fecha_fin": diario["Fecha"].max().strftime("%Y-%m-%d"),
        "dias_calendario": int((diario["Fecha"].max() - diario["Fecha"].min()).days + 1),
        "nulos": int(diario["50Kg"].isna().sum()),
        "duplicados": 0,
        "nominal_min": r2(diario.loc[i_min, "50Kg"]),
        "nominal_min_fecha": diario.loc[i_min, "Fecha"].strftime("%Y-%m-%d"),
        "nominal_max": r2(diario.loc[i_max, "50Kg"]),
        "nominal_max_fecha": diario.loc[i_max, "Fecha"].strftime("%Y-%m-%d"),
        "registros_por_anio": {int(k): int(v) for k, v in diario.groupby(diario["Fecha"].dt.year).size().items()},
    }

    # ------------------------------------------------------------------ 2. Submuestreo mensual
    mensual = diario.set_index("Fecha")["50Kg"].resample("MS").mean().round(2).dropna().reset_index()

    # ------------------------------------------------------------------ 3. Deflactación IPC
    ipc = pd.read_csv(DATOS / "ipc_coeficientes_desde_2008.csv")
    ipc["Periodo"] = pd.to_datetime(ipc["Periodo"])
    real = pd.merge(mensual, ipc, left_on="Fecha", right_on="Periodo", how="inner")
    real["Precio_Real"] = (real["50Kg"] * real[COL_COEF]).round(2)
    assert len(real) == 224, f"Se esperaban 224 meses y se obtuvieron {len(real)}"

    s = real["Precio_Real"]
    # Mediana exacta en aritmética decimal (n par: promedio de los dos valores centrales = 52.544,845)
    # redondeada "al par" (ROUND_HALF_EVEN), criterio con el que se informó 52.544,84 en el paper.
    centro = sorted(Decimal(str(v)) for v in s)
    mediana_exacta = (centro[len(centro) // 2 - 1] + centro[len(centro) // 2]) / 2 if len(centro) % 2 == 0 \
        else centro[len(centro) // 2]
    resumen = {
        "n": int(len(real)),
        "media": r2(s.mean()),
        "mediana": float(mediana_exacta.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)),
        "desvio": r2(s.std()),
        "min": r2(s.min()),
        "min_fecha": real.loc[s.idxmin(), "Fecha"].strftime("%Y-%m"),
        "max": r2(s.max()),
        "max_fecha": real.loc[s.idxmax(), "Fecha"].strftime("%Y-%m"),
        "inflacion_acumulada_factor": r2(real[COL_COEF].iloc[0]),
    }

    # ------------------------------------------------------------------ 4. Filtro HP
    serie = real.set_index("Fecha")["Precio_Real"]
    ciclo, tendencia = hp_con_statsmodels_si_existe(serie, LAMBDA)
    real["Tendencia_Estructural"] = tendencia
    real["Ciclo_Estacional"] = ciclo
    real["Desvio_Relativo_pct"] = ciclo / tendencia * 100
    real["Mes"] = real["Fecha"].dt.month
    real["Anio"] = real["Fecha"].dt.year

    real[["Fecha", "50Kg", COL_COEF, "Precio_Real", "Tendencia_Estructural", "Ciclo_Estacional",
          "Desvio_Relativo_pct"]].rename(columns={"Fecha": "Periodo", "50Kg": "Precio_Nominal_Promedio"}).to_csv(
        DATOS / "azucar_tendencia_hp.csv", index=False, date_format="%Y-%m-%d", float_format="%.2f")

    # ------------------------------------------------------------------ 5. Tabla 1
    g = real.groupby("Mes")
    tabla = []
    for m in range(1, 13):
        sub = real[real["Mes"] == m]
        tabla.append({
            "mes": m,
            "nombre": MESES[m - 1],
            "fase": FASE[m - 1],
            "senal": SENAL[m - 1],
            "ventana": VENTANA[m - 1],
            "media": r2(g["Ciclo_Estacional"].mean()[m]),
            "mediana": r2(g["Ciclo_Estacional"].median()[m]),
            "rel": r2(g["Desvio_Relativo_pct"].mean()[m]),
            "rel_mediana": r2(g["Desvio_Relativo_pct"].median()[m]),
            "n": int(len(sub)),
            "pct_bajo_tendencia": r2((sub["Ciclo_Estacional"] < 0).mean() * 100),
            "rel_min": r2(sub["Desvio_Relativo_pct"].min()),
            "rel_max": r2(sub["Desvio_Relativo_pct"].max()),
            "rel_q1": r2(sub["Desvio_Relativo_pct"].quantile(0.25)),
            "rel_q3": r2(sub["Desvio_Relativo_pct"].quantile(0.75)),
        })
    pd.DataFrame(tabla).to_csv(DATOS / "tabla1_estacionalidad.csv", index=False, float_format="%.2f")

    feb, jul = tabla[1], tabla[6]
    arbitraje = {
        "rel_pp": r2(feb["rel"] - jul["rel"]),
        "mediana_ars": r2(feb["mediana"] - jul["mediana"]),
        "media_ars": r2(feb["media"] - jul["media"]),
    }

    # Matriz año × mes (mapa de calor)
    piv = real.pivot(index="Anio", columns="Mes", values="Desvio_Relativo_pct")
    matriz = {"anios": [int(a) for a in piv.index],
              "rel": [[r2(v) for v in fila] for fila in piv.values.tolist()]}

    # ------------------------------------------------------------------ 6. Validación complementaria
    y = serie.values
    meses = real["Mes"].values
    sensibilidad = {}
    for lam in [1_600, 6_400, 14_400, 50_000, 129_600]:
        c, t = hp_filter(y, lam)
        rel = pd.Series(c / t * 100).groupby(meses).mean()
        med = pd.Series(c).groupby(meses).median()
        sensibilidad[str(lam)] = {
            "rel": [r2(v) for v in rel.values],
            "min_mes": int(rel.idxmin()), "max_mes": int(rel.idxmax()),
            "spread_pp": r2(rel[2] - rel[7]),
            "spread_mediana_ars": r2(med[2] - med[7]),
        }

    # Descomposición clásica (media móvil centrada 2×12) y HP sobre logaritmos
    ser = pd.Series(y)
    mm = ser.rolling(12, center=True).mean().rolling(2).mean().shift(-1)
    clasica = ((ser - mm) / mm * 100).groupby(meses).mean()
    c_log, _ = hp_filter(np.log(y), LAMBDA)
    loghp = pd.Series(c_log * 100).groupby(meses).mean()
    sin_23_24 = real[~real["Anio"].isin([2023, 2024])].groupby("Mes")["Desvio_Relativo_pct"].mean()

    completos = piv.dropna()
    fr = stats.friedmanchisquare(*[completos[m].values for m in range(1, 13)])
    rangos = completos.rank(axis=1).mean()
    pares = piv[[2, 7]].dropna()
    wil = stats.wilcoxon(pares[2], pares[7])
    inter = real[real["Mes"].isin([1, 2, 3])]["Desvio_Relativo_pct"]
    zafra = real[real["Mes"].isin([6, 7, 8, 9, 10])]["Desvio_Relativo_pct"]
    mw = stats.mannwhitneyu(inter, zafra, alternative="greater")
    kw = stats.kruskal(*[real[real["Mes"] == m]["Desvio_Relativo_pct"].values for m in range(1, 13)])
    friedman_lam = {}
    for lam in [1_600, 129_600]:
        c, t = hp_filter(y, lam)
        p2 = pd.DataFrame({"a": real["Anio"], "m": meses, "r": c / t * 100}).pivot(index="a", columns="m", values="r").dropna()
        friedman_lam[str(lam)] = r2(stats.friedmanchisquare(*[p2[m].values for m in range(1, 13)]).pvalue * 100) / 100

    pruebas = {
        "friedman": {"chi2": r2(fr.statistic), "p": round(float(fr.pvalue), 4), "anios": int(len(completos)),
                     "rango_medio": [r2(v) for v in rangos.values], "p_lambda": friedman_lam},
        "wilcoxon_feb_jul": {"stat": r2(wil.statistic), "p": round(float(wil.pvalue), 4),
                             "pct_feb_mayor": r2((pares[2] > pares[7]).mean() * 100), "n": int(len(pares))},
        "mannwhitney_inter_zafra": {"u": r2(mw.statistic), "p": round(float(mw.pvalue), 4),
                                    "mediana_inter": r2(inter.median()), "mediana_zafra": r2(zafra.median()),
                                    "media_inter": r2(inter.mean()), "media_zafra": r2(zafra.mean())},
        "kruskal_sin_bloques": {"h": r2(kw.statistic), "p": round(float(kw.pvalue), 4)},
    }

    # Backtest: comprar en julio del año Y y vender en febrero de Y+1 (precios reales observados)
    backtest = []
    for anio in range(2008, 2026):
        b = real[(real["Anio"] == anio) & (real["Mes"] == 7)]
        v = real[(real["Anio"] == anio + 1) & (real["Mes"] == 2)]
        if len(b) and len(v):
            backtest.append({
                "anio": anio,
                "compra": r2(b["Precio_Real"].iloc[0]),
                "venta": r2(v["Precio_Real"].iloc[0]),
                "retorno": r2((v["Precio_Real"].iloc[0] / b["Precio_Real"].iloc[0] - 1) * 100),
                "ciclo_pp": r2(v["Desvio_Relativo_pct"].iloc[0] - b["Desvio_Relativo_pct"].iloc[0]),
                "tendencia_pct": r2((v["Tendencia_Estructural"].iloc[0] / b["Tendencia_Estructural"].iloc[0] - 1) * 100),
            })
    bt = pd.DataFrame(backtest)
    resumen_bt = {
        "n": int(len(bt)),
        "positivos": int((bt["retorno"] > 0).sum()),
        "media": r2(bt["retorno"].mean()),
        "mediana": r2(bt["retorno"].median()),
        "min": r2(bt["retorno"].min()), "min_anio": int(bt.loc[bt["retorno"].idxmin(), "anio"]),
        "max": r2(bt["retorno"].max()), "max_anio": int(bt.loc[bt["retorno"].idxmax(), "anio"]),
        "ciclo_positivos": int((bt["ciclo_pp"] > 0).sum()),
    }

    # ------------------------------------------------------------------ 7. Exportación
    inicio = diario["Fecha"].min()
    payload = {
        "meta": {
            "titulo": "Análisis de la Estacionalidad del Precio del Azúcar en el Mercado Interno de Tucumán",
            "autor": "Héctor Matías Veliz",
            "tutores": ["Dra. Dorigatti Mariana", "Ing. Sardi Duilio"],
            "laboratorio": "Laboratorio GIITNI Datos",
            "filiacion": "Universidad Tecnológica Nacional, Facultad Regional Tucumán",
            "periodo": "Enero 2008 – Agosto 2026",
            "base": "Pesos constantes de agosto de 2026",
            "lambda": LAMBDA,
            "generado": date.today().isoformat(),
        },
        "calidad": calidad,
        "resumen": resumen,
        "mensual": {
            "fechas": real["Fecha"].dt.strftime("%Y-%m").tolist(),
            "nominal": [r2(v) for v in real["50Kg"]],
            # 8 decimales: con menos, nominal × coeficiente no reproduce el precio real al centavo
            "coef": [round(float(v), 8) for v in real[COL_COEF]],
            "real": [r2(v) for v in real["Precio_Real"]],
            "tendencia": [r2(v) for v in real["Tendencia_Estructural"]],
            "ciclo": [r2(v) for v in real["Ciclo_Estacional"]],
            "rel": [r2(v) for v in real["Desvio_Relativo_pct"]],
        },
        "diario": {
            "inicio": inicio.strftime("%Y-%m-%d"),
            "dias": [int(d) for d in (diario["Fecha"] - inicio).dt.days],
            "precios": [r2(v) for v in diario["50Kg"]],
        },
        "tabla1": tabla,
        "arbitraje": arbitraje,
        "matriz": matriz,
        "robustez": {
            "sensibilidad": sensibilidad,
            "clasica": [r2(v) for v in clasica.values],
            "loghp": [r2(v) for v in loghp.values],
            "sin_2023_2024": [r2(v) for v in sin_23_24.values],
            "pruebas": pruebas,
        },
        "backtest": {"operaciones": backtest, "resumen": resumen_bt},
    }
    SALIDA_JS.parent.mkdir(parents=True, exist_ok=True)
    SALIDA_JS.write_text(
        "/* Generado por analysis/pipeline.py — no editar a mano */\n"
        "window.AZUCAR = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )

    # Reporte de control contra las cifras publicadas en el paper
    print(f"Registros diarios: {calidad['registros']}  |  Meses: {resumen['n']}")
    print(f"Media {resumen['media']}  Mediana {resumen['mediana']}  Desvío {resumen['desvio']}  "
          f"Mín {resumen['min']}  Máx {resumen['max']}")
    print(f"Julio  rel {jul['rel']}%  media {jul['media']}  mediana {jul['mediana']}")
    print(f"Febrero rel {feb['rel']}%  media {feb['media']}  mediana {feb['mediana']}")
    print(f"Arbitraje {arbitraje['rel_pp']} pp  |  {arbitraje['mediana_ars']} ARS por bolsa (medianas)")
    print(f"Friedman chi2={pruebas['friedman']['chi2']} p={pruebas['friedman']['p']}")
    print(f"Archivo web: {SALIDA_JS.relative_to(RAIZ)} ({SALIDA_JS.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
