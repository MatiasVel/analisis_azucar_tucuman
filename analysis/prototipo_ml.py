"""
Prueba de concepto — predicción del precio real de la bolsa de 50 kg con aprendizaje automático.

NO es un pronóstico oficial. Es una evaluación retrospectiva (walk-forward) para dimensionar
el desafío predictivo y motivar los trabajos futuros del paper.

Diseño experimental
  * Serie: precio real mensual (pesos constantes de agosto de 2026), 224 observaciones.
  * Objetivo: precio del mes t+h (h = 1, 3 y 6 meses) usando solo información disponible en t.
  * Validación: origen móvil con ventana expansiva; el modelo se reentrena cada mes con
    observaciones cuyo objetivo ya era conocido en t (sin fuga de información).
  * Período de prueba: septiembre de 2022 a agosto de 2026.
  * Modelos: ingenuo, ingenuo estacional, Ridge y Gradient Boosting (scikit-learn).

Uso:  python analysis/prototipo_ml.py
"""
from __future__ import annotations

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge

warnings.filterwarnings("ignore")
RAIZ = Path(__file__).resolve().parents[1]
INICIO_PRUEBA = pd.Timestamp("2022-09-01")
HORIZONTES = [1, 3, 6]


def construir_variables(log_precio: pd.Series, h: int) -> pd.DataFrame:
    df = pd.DataFrame({"y": log_precio})
    for rezago in [0, 1, 2, 3, 5, 11]:
        df[f"rezago_{rezago}"] = log_precio.shift(rezago)
    df["momento_1"] = log_precio - log_precio.shift(1)
    df["momento_3"] = log_precio - log_precio.shift(3)
    df["momento_12"] = log_precio - log_precio.shift(12)
    df["distancia_media_12"] = log_precio.rolling(12).mean() - log_precio
    mes_objetivo = (log_precio.index.month + h - 1) % 12
    for k in range(12):
        df[f"mes_objetivo_{k + 1}"] = (mes_objetivo == k).astype(float)
    df["objetivo"] = log_precio.shift(-h) - log_precio  # variación logarítmica a predecir
    return df


def main() -> None:
    real = pd.read_csv(RAIZ / "site" / "datos" / "precio_real_azucar_desde_2008.csv", parse_dates=["Fecha"])
    precio = pd.Series(real["Precio_Real"].values, index=real["Fecha"])
    log_precio = np.log(precio)

    metricas, serie_h1 = [], None
    for h in HORIZONTES:
        df = construir_variables(log_precio, h)
        x_cols = [c for c in df.columns if c not in ("y", "objetivo")]
        df = df.dropna(subset=x_cols)
        pred = {"ingenuo": [], "ingenuo_estacional": [], "ridge": [], "gradient_boosting": []}
        observado, fechas = [], []
        for t in df.index:
            if t < INICIO_PRUEBA:
                continue
            destino = t + pd.DateOffset(months=h)
            if destino > log_precio.index[-1]:
                break
            entrenamiento = df[df.index <= t - pd.DateOffset(months=h)].dropna()
            x, y = entrenamiento[x_cols], entrenamiento["objetivo"]
            xt = df.loc[[t], x_cols]
            base = log_precio.loc[t]
            ridge = Ridge(alpha=1.0).fit(x, y)
            gbr = HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=300, random_state=0).fit(x, y)
            hace_un_anio = t - pd.DateOffset(months=12)
            cambio_estacional = log_precio.loc[t - pd.DateOffset(months=12 - h)] - log_precio.loc[hace_un_anio]
            pred["ingenuo"].append(float(np.exp(base)))
            pred["ingenuo_estacional"].append(float(np.exp(base + cambio_estacional)))
            pred["ridge"].append(float(np.exp(base + ridge.predict(xt)[0])))
            pred["gradient_boosting"].append(float(np.exp(base + gbr.predict(xt)[0])))
            observado.append(float(precio.loc[destino]))
            fechas.append(destino.strftime("%Y-%m"))
        obs = np.array(observado)
        for modelo, valores in pred.items():
            v = np.array(valores)
            metricas.append({
                "h": h,
                "modelo": modelo,
                "mape": round(float(np.mean(np.abs(v - obs) / obs) * 100), 2),
                "mae": round(float(np.mean(np.abs(v - obs))), 0),
                "n": int(len(obs)),
            })
        if h == 1:
            serie_h1 = {"fechas": fechas, "observado": [round(v, 2) for v in observado],
                        **{k: [round(x, 2) for x in v] for k, v in pred.items()}}

    salida = {"inicio_prueba": INICIO_PRUEBA.strftime("%Y-%m"), "metricas": metricas, "serie_h1": serie_h1}
    destino_js = RAIZ / "site" / "assets" / "data" / "ml.js"
    destino_js.write_text("/* Generado por analysis/prototipo_ml.py — no editar a mano */\n"
                          "window.AZUCAR_ML = " + json.dumps(salida, ensure_ascii=False, separators=(",", ":")) + ";\n",
                          encoding="utf-8")
    for m in metricas:
        print(f"h={m['h']}  {m['modelo']:<20} MAPE {m['mape']:>6.2f}%  MAE {m['mae']:>9,.0f}  n={m['n']}")


if __name__ == "__main__":
    main()
