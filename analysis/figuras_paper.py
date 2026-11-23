"""Figuras 1, 2 y 3 del paper, con el estilo del documento Word y las cifras de la Tabla 1.

Se generan desde las mismas salidas de pipeline.py que usan el texto y la Tabla 1, para que
las figuras, el texto y el sitio muestren exactamente los mismos valores.
Tamaño: el mismo ancho y proporción con que el Word las inserta (6,30 in a 300 dpi).

Uso:  python analysis/figuras_paper.py
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
from matplotlib.ticker import FuncFormatter

RAIZ = Path(__file__).resolve().parents[1]
DATOS = RAIZ / "site" / "datos"
SALIDA = RAIZ / "site" / "assets" / "img" / "paper"
DPI = 300
ANCHO_IN = 5759450 / 914400          # ancho con que el Word inserta las figuras (EMU → pulgadas)

VERDE, ROJO, AZUL, GRIS = "#2ca02c", "#d62728", "#1f77b4", "#7f7f7f"
plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "Liberation Serif", "Tinos", "DejaVu Serif"],
    "font.size": 9,
    "axes.labelsize": 10.5,
    "xtick.labelsize": 8.5,
    "ytick.labelsize": 8.5,
    "legend.fontsize": 8.5,
    "axes.linewidth": 0.8,
    "axes.unicode_minus": False,
})


def miles(v, _pos=None) -> str:
    """Separador de miles con punto, como en el texto del paper."""
    return f"{v:,.0f}".replace(",", ".")


def pesos(v: float) -> str:
    return f"$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def porcentaje(v: float) -> str:
    return f"{v:+.2f}%".replace(".", ",")


def eje_anios(ax) -> None:
    ax.xaxis.set_major_locator(mdates.YearLocator(1))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax.xaxis.set_minor_locator(mdates.MonthLocator())
    ax.set_xlim(pd.Timestamp("2007-11-15"), pd.Timestamp("2026-10-15"))
    for etiqueta in ax.get_xticklabels():
        etiqueta.set_rotation(45)
        etiqueta.set_ha("center")
    ax.grid(True, linestyle=":", linewidth=0.6, alpha=0.75)


def guardar(fig, nombre: str, alto_in: float) -> None:
    fig.set_size_inches(ANCHO_IN, alto_in)
    SALIDA.mkdir(parents=True, exist_ok=True)
    ruta = SALIDA / nombre
    fig.savefig(ruta, dpi=DPI, facecolor="white")
    plt.close(fig)
    print(f"{ruta.relative_to(RAIZ)}")


def main() -> None:
    serie = pd.read_csv(DATOS / "azucar_tendencia_hp.csv", parse_dates=["Periodo"])
    tabla = pd.read_csv(DATOS / "tabla1_estacionalidad.csv")
    assert len(serie) == 224, "La serie mensual debe tener 224 observaciones"
    media = serie["Precio_Real"].mean()

    # ---------------------------------------------------------------- Figura 1
    fig, ax = plt.subplots(layout="constrained")
    ax.plot(serie["Periodo"], serie["Precio_Real"], color=VERDE, lw=1.6, label="Bolsa 50 kg (pesos constantes de ago-2026)")
    ax.axhline(media, color=GRIS, lw=1.1, ls="--", label=f"Media histórica ({pesos(media)})")
    ax.set_ylabel("Precio real (ARS constantes)")
    ax.set_xlabel("Años")
    ax.yaxis.set_major_formatter(FuncFormatter(miles))
    eje_anios(ax)
    ax.legend(loc="upper left", frameon=True, framealpha=0.95, edgecolor="#bbbbbb")
    guardar(fig, "figura1-precio-real.png", 2927350 / 914400)

    # ---------------------------------------------------------------- Figura 2
    fig, (arriba, abajo) = plt.subplots(2, 1, sharex=True, layout="constrained", gridspec_kw={"height_ratios": [2, 1]})
    arriba.plot(serie["Periodo"], serie["Precio_Real"], color=AZUL, lw=1.1, alpha=0.65, label="Precio real (pesos constantes)")
    arriba.plot(serie["Periodo"], serie["Tendencia_Estructural"], color=ROJO, lw=2.2, label="Tendencia estructural (filtro HP, λ = 14.400)")
    arriba.set_ylabel("Precio (ARS constantes)")
    arriba.yaxis.set_major_formatter(FuncFormatter(miles))
    arriba.legend(loc="upper left", frameon=True, framealpha=0.95, edgecolor="#bbbbbb")
    abajo.plot(serie["Periodo"], serie["Ciclo_Estacional"], color=VERDE, lw=1.2, label="Componente cíclico-estacional (efecto zafra / interzafra)")
    abajo.axhline(0, color="black", lw=1, ls="--")
    abajo.set_ylabel("Desvío (ARS constantes)")
    abajo.set_xlabel("Años")
    abajo.yaxis.set_major_formatter(FuncFormatter(miles))
    abajo.legend(loc="upper left", frameon=True, framealpha=0.95, edgecolor="#bbbbbb")
    eje_anios(arriba)
    eje_anios(abajo)
    guardar(fig, "figura2-descomposicion-hp.png", 4203700 / 914400)

    # ---------------------------------------------------------------- Figura 3
    meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    rel = tabla.sort_values("mes")["rel"].round(2).tolist()
    fig, ax = plt.subplots(layout="constrained")
    ax.axvspan(-0.5, 2.5, color=VERDE, alpha=0.09, lw=0)
    ax.axvspan(4.5, 9.5, color=ROJO, alpha=0.09, lw=0)
    colores = ["#4caf50" if v > 0 else "#dc4446" for v in rel]
    barras = ax.bar(range(12), rel, color=colores, edgecolor="#333333", linewidth=0.6, width=0.8, zorder=2)
    for i in (rel.index(max(rel)), rel.index(min(rel))):   # pico (febrero) y valle (julio)
        barras[i].set_edgecolor("black")
        barras[i].set_linewidth(2.0)
    ax.axhline(0, color="black", lw=1.1, ls="--", zorder=3)
    for i, v in enumerate(rel):
        ax.text(i, v + (0.16 if v > 0 else -0.16), porcentaje(v).replace("+-", "-"), ha="center",
                va="bottom" if v > 0 else "top", fontsize=9, fontweight="bold", zorder=4)
    ax.set_xticks(range(12), meses)
    ax.set_xlim(-0.6, 11.6)
    ax.set_ylim(-6.1, 5.2)
    ax.set_ylabel("Desvío relativo promedio (%)")
    ax.set_xlabel("Mes del año")
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _p: f"{v:.0f}%"))
    ax.grid(axis="y", linestyle=":", linewidth=0.6, alpha=0.75, zorder=0)
    leyenda = [Patch(facecolor=VERDE, alpha=0.12, label="Ventana de venta (ene–mar, interzafra)"),
               Patch(facecolor=ROJO, alpha=0.12, label="Ventana de compra (jun–oct, zafra)"),
               Line2D([0], [0], color="black", lw=1.1, ls="--", label="Tendencia estructural (0%)")]
    ax.legend(handles=leyenda, loc="lower center", bbox_to_anchor=(0.5, 1.0), ncol=3, frameon=False, fontsize=8.5)
    guardar(fig, "figura3-patron-estacional.png", 3111500 / 914400)


if __name__ == "__main__":
    main()
