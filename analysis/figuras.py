"""
Genera las figuras del paper y del sitio en resolución 4K (3840 × 2160 px).

  * Versión web  (fondo negro/verde, tipografías Montserrat + Inter): WebP 3840 px, WebP 1600 px y PNG 3840 px.
  * Versión paper (fondo blanco, Times New Roman o Liberation Serif, sin título embebido): PNG 3840 px.
  * Fórmulas en SVG (mathtext de Matplotlib) para la web.

Requiere haber corrido antes  analysis/pipeline.py  (lee site/datos/azucar_tendencia_hp.csv).
Uso:  python analysis/figuras.py
"""
from __future__ import annotations

import io
import json
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from matplotlib import font_manager as fm  # noqa: E402
from matplotlib.colors import LinearSegmentedColormap  # noqa: E402
from matplotlib.patches import FancyBboxPatch  # noqa: E402
from matplotlib.ticker import FuncFormatter, LogLocator  # noqa: E402
from PIL import Image  # noqa: E402
from scipy import sparse  # noqa: E402
from scipy.sparse.linalg import spsolve  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
DATOS = RAIZ / "site" / "datos"
SALIDA = RAIZ / "site" / "assets" / "img" / "figuras"
SALIDA_FORMULAS = RAIZ / "site" / "assets" / "img" / "formulas"
FUENTES = Path(__file__).resolve().parent / "fuentes"

for archivo in FUENTES.glob("*.[ot]tf"):
    fm.fontManager.addfont(str(archivo))
for candidata in ["/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
                  "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
                  "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"]:
    if Path(candidata).exists():
        fm.fontManager.addfont(candidata)
NOMBRES = {f.name for f in fm.fontManager.ttflist}
SERIF = "Times New Roman" if "Times New Roman" in NOMBRES else ("Liberation Serif" if "Liberation Serif" in NOMBRES else "DejaVu Serif")
SANS = "Inter" if "Inter" in NOMBRES else "DejaVu Sans"
DISPLAY = "Montserrat" if "Montserrat" in NOMBRES else SANS

MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
VENTANA = ["venta", "venta", "venta", "neutral", "neutral", "compra", "compra", "compra", "compra", "compra",
           "neutral", "neutral"]
ANCHO, ALTO, DPI = 16, 9, 240  # 16 × 9 pulgadas a 240 ppp = 3840 × 2160 px

TEMAS = {
    "web": dict(bg="#0A120E", fg="#EEF3EF", muted="#8FA397", grid="#1C2921", verde="#2BD46B",
                verde_osc="#1C8F4A", blanco="#F2F5F1", neutro="#4B5B51", banda="#12221A",
                fuente=SANS, titulo=DISPLAY),
    "paper": dict(bg="#FFFFFF", fg="#111111", muted="#4A4A4A", grid="#D9D9D9", verde="#1B7F45",
                  verde_osc="#0F5C30", blanco="#1A1A1A", neutro="#9A9A9A", banda="#EEF5F0",
                  fuente=SERIF, titulo=SERIF),
}


def num(x: float, dec: int = 0, signo: bool = False) -> str:
    """Formato numérico argentino: 1.234,56 con signo menos tipográfico."""
    texto = f"{abs(x):,.{dec}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if x < 0:
        return "−" + texto
    return ("+" + texto) if signo and x > 0 else texto


def hp_filter(y: np.ndarray, lamb: float):
    n = len(y)
    diag = np.repeat([[1.0], [-2.0], [1.0]], n, axis=1)
    k = sparse.dia_matrix((diag, [0, 1, 2]), shape=(n - 2, n)).tocsc()
    tendencia = spsolve(sparse.eye(n, format="csc") + lamb * k.T.dot(k), y)
    return y - tendencia, tendencia


def lienzo(t: dict, tema: str, titulo: str, subtitulo: str, fuente: str = "Fuente: CACTU (precios diarios) e IPC empalmado con la metodología del BCRA. Elaboración propia — Veliz, UTN-FRT."):
    plt.rcParams.update({
        "font.family": t["fuente"], "font.size": 13, "text.color": t["fg"],
        "axes.edgecolor": t["grid"], "axes.labelcolor": t["muted"], "axes.facecolor": t["bg"],
        "xtick.color": t["muted"], "ytick.color": t["muted"], "figure.facecolor": t["bg"],
        "axes.titlecolor": t["fg"], "axes.unicode_minus": True, "mathtext.fontset": "custom",
        "mathtext.rm": t["fuente"], "mathtext.it": f"{t['fuente']}:italic", "mathtext.bf": f"{t['fuente']}:bold",
        "mathtext.cal": t["fuente"], "mathtext.sf": t["fuente"], "mathtext.tt": t["fuente"],
    })
    fig = plt.figure(figsize=(ANCHO, ALTO), dpi=DPI)
    if tema == "web":
        fig.text(0.045, 0.935, titulo, fontsize=24, fontweight="bold", family=t["titulo"], color=t["fg"], va="center")
        fig.text(0.045, 0.885, subtitulo, fontsize=14, color=t["muted"], va="center")
        fig.text(0.045, 0.035, fuente, fontsize=11, color=t["muted"], va="center")
        fig.text(0.955, 0.035, "Estacionalidad del azúcar · Tucumán", fontsize=11, color=t["verde"], ha="right", va="center",
                 fontweight="semibold")
        ax = fig.add_axes([0.075, 0.12, 0.885, 0.70])
    else:
        ax = fig.add_axes([0.085, 0.10, 0.885, 0.85])
    ax.set_facecolor(t["bg"])
    for lado in ["top", "right", "left"]:
        ax.spines[lado].set_visible(False)
    ax.spines["bottom"].set_color(t["grid"])
    ax.tick_params(length=0, labelsize=13, pad=8)
    ax.grid(axis="y", color=t["grid"], linewidth=1.0, linestyle="-")
    ax.set_axisbelow(True)
    return fig, ax


def guardar(fig, nombre: str, tema: str) -> None:
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=DPI, facecolor=fig.get_facecolor())
    plt.close(fig)
    buffer.seek(0)
    img = Image.open(buffer).convert("RGB")
    assert img.size == (3840, 2160), img.size
    if tema == "web":
        img.save(SALIDA / f"{nombre}-3840.png", optimize=True)
        img.save(SALIDA / f"{nombre}-3840.webp", quality=88, method=6)
        img.resize((1600, 900), Image.LANCZOS).save(SALIDA / f"{nombre}-1600.webp", quality=86, method=6)
    else:
        img.save(SALIDA / f"{nombre}-paper-3840.png", optimize=True)
    print(f"  {nombre} [{tema}]")


def eje_fechas(ax, paso: int = 2) -> None:
    ax.xaxis.set_major_locator(mdates.YearLocator(paso))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))


def anotar(ax, t, x, y, texto, xytext, ha="left"):
    ax.annotate(texto, xy=(x, y), xytext=xytext, textcoords="offset points", fontsize=13, color=t["fg"], ha=ha,
                arrowprops=dict(arrowstyle="-", color=t["muted"], lw=1.2),
                bbox=dict(boxstyle="round,pad=0.45", fc=t["bg"], ec=t["grid"], lw=1.0))
    ax.plot([x], [y], "o", ms=9, mfc=t["verde"], mec=t["bg"], mew=2, zorder=5)


# ---------------------------------------------------------------------------------------------
def figuras(tema: str, d: dict) -> None:
    t = TEMAS[tema]
    diario, m, tabla, piv = d["diario"], d["mensual"], d["tabla"], d["piv"]

    # Fig. 1 — Serie nominal diaria (escala logarítmica)
    fig, ax = lienzo(t, tema, "Precio nominal diario de la bolsa de azúcar de 50 kg",
                     "Mercado interno de Tucumán · 6.791 registros diarios (01/2008 – 09/2026) · escala logarítmica")
    ax.plot(diario["Fecha"], diario["50Kg"], color=t["verde"], lw=1.6)
    ax.fill_between(diario["Fecha"], diario["50Kg"], 30, color=t["verde"], alpha=0.10 if tema == "web" else 0.06, lw=0)
    ax.set_yscale("log")
    ax.set_ylim(30, 90_000)
    ax.yaxis.set_major_locator(LogLocator(base=10, subs=(1.0, 2.0, 5.0)))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: "$ " + num(v)))
    ax.yaxis.set_minor_formatter(FuncFormatter(lambda v, _: ""))
    eje_fechas(ax)
    ax.set_ylabel("ARS corrientes por bolsa (escala log)")
    i_min, i_max = diario["50Kg"].idxmin(), diario["50Kg"].idxmax()
    anotar(ax, t, diario.loc[i_min, "Fecha"], diario.loc[i_min, "50Kg"],
           f"Mínimo nominal: $ {num(diario.loc[i_min, '50Kg'], 2)}\n{diario.loc[i_min, 'Fecha']:%d/%m/%Y}", (30, -10))
    anotar(ax, t, diario.loc[i_max, "Fecha"], diario.loc[i_max, "50Kg"],
           f"Máximo nominal: $ {num(diario.loc[i_max, '50Kg'], 2)}\n{diario.loc[i_max, 'Fecha']:%d/%m/%Y}", (-40, 34), ha="right")
    guardar(fig, "fig01-nominal", tema)

    # Fig. 2 — Precio real y tendencia HP
    fig, ax = lienzo(t, tema, "Precio real y tendencia estructural (filtro HP, λ = 14.400)",
                     "Pesos constantes de agosto de 2026 · 224 observaciones mensuales (ene-2008 a ago-2026)")
    ax.plot(m["Periodo"], m["Precio_Real"], color=t["blanco"], lw=1.8, alpha=0.9, label="Precio real mensual  $y_t$")
    ax.plot(m["Periodo"], m["Tendencia_Estructural"], color=t["verde"], lw=4.0, label="Tendencia estructural  $\\tau_t$")
    media = m["Precio_Real"].mean()
    ax.axhline(media, color=t["muted"], lw=1.2, ls=(0, (6, 6)))
    ax.text(pd.Timestamp("2016-03-01"), media + 2500, f"Media histórica $ {num(media, 2)}", color=t["muted"], fontsize=12,
            ha="center", va="bottom")
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: "$ " + num(v)))
    ax.set_ylim(0, 175_000)
    eje_fechas(ax)
    ax.set_ylabel("ARS constantes (ago-2026) por bolsa")
    i_max, i_min = m["Precio_Real"].idxmax(), m["Precio_Real"].idxmin()
    anotar(ax, t, m.loc[i_max, "Periodo"], m.loc[i_max, "Precio_Real"],
           f"Máximo real: $ {num(m.loc[i_max, 'Precio_Real'], 2)}\n{m.loc[i_max, 'Periodo']:%m/%Y} · escasez", (-40, -20), ha="right")
    anotar(ax, t, m.loc[i_min, "Periodo"], m.loc[i_min, "Precio_Real"],
           f"Mínimo real: $ {num(m.loc[i_min, 'Precio_Real'], 2)}\n{m.loc[i_min, 'Periodo']:%m/%Y}", (-40, -62), ha="right")
    leyenda = ax.legend(loc="upper left", frameon=False, fontsize=14)
    for txt in leyenda.get_texts():
        txt.set_color(t["fg"])
    guardar(fig, "fig02-real-tendencia", tema)

    # Fig. 3 — Componente cíclico-estacional
    fig, ax = lienzo(t, tema, "Componente cíclico-estacional del precio real",
                     "c = y − τ: desvío respecto de la tendencia HP (ARS constantes) · franjas: meses de zafra (junio a octubre)")
    for anio in range(2008, 2027):
        ini, fin = pd.Timestamp(f"{anio}-06-01"), pd.Timestamp(f"{anio}-10-31")
        if ini <= m["Periodo"].max():
            ax.axvspan(ini, min(fin, m["Periodo"].max() + pd.Timedelta(days=30)), color=t["banda"], lw=0, zorder=0)
    colores = np.where(m["Ciclo_Estacional"] >= 0, t["verde"], t["blanco"])
    ax.bar(m["Periodo"], m["Ciclo_Estacional"], width=24, color=colores, alpha=0.95, zorder=2)
    ax.axhline(0, color=t["muted"], lw=1.3, zorder=3)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: num(v, signo=True)))
    eje_fechas(ax)
    ax.set_ylabel("Desvío sobre la tendencia (ARS constantes)")
    ax.text(0.995, 0.97, "▲ sobre la tendencia", transform=ax.transAxes, ha="right", va="top", color=t["verde"], fontsize=13, fontweight="semibold")
    ax.text(0.995, 0.03, "▼ bajo la tendencia", transform=ax.transAxes, ha="right", va="bottom", color=t["blanco"], fontsize=13, fontweight="semibold")
    guardar(fig, "fig03-ciclo", tema)

    # Fig. 4 — Patrón estacional (Tabla 1)
    fig, ax = lienzo(t, tema, "Patrón estacional: desvío relativo medio por mes",
                     "Promedio 2008–2026 del componente cíclico en % de la tendencia · ventanas operativas del estudio")
    rel = [f["rel"] for f in tabla]
    col = [t["verde"] if v == "venta" else (t["blanco"] if v == "compra" else t["neutro"]) for v in VENTANA]
    barras = ax.bar(range(12), rel, color=col, width=0.68, zorder=2)
    ax.axhline(0, color=t["muted"], lw=1.3)
    for b, v in zip(barras, rel):
        ax.text(b.get_x() + b.get_width() / 2, v + (0.22 if v >= 0 else -0.22), num(v, 2, signo=True) + " %",
                ha="center", va="bottom" if v >= 0 else "top", fontsize=13, fontweight="semibold", color=t["fg"])
    ax.set_xticks(range(12), MESES_CORTOS)
    ax.set_ylim(-6.4, 6.2)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: num(v, 0, signo=True) + " %"))
    ax.set_ylabel("Desvío relativo medio sobre la tendencia")
    ax.annotate("", xy=(-0.4, 5.35), xytext=(2.4, 5.35), arrowprops=dict(arrowstyle="<->", color=t["verde"], lw=2))
    ax.text(1, 5.6, "VENTANA DE VENTA · interzafra", ha="center", color=t["verde"], fontsize=13, fontweight="bold")
    ax.annotate("", xy=(4.6, 5.35), xytext=(9.4, 5.35), arrowprops=dict(arrowstyle="<->", color=t["blanco"], lw=2))
    ax.text(7, 5.6, "VENTANA DE COMPRA Y ACOPIO · zafra", ha="center", color=t["blanco"], fontsize=13, fontweight="bold")
    ax.text(1, 4.85, "PICO", ha="center", color=t["verde"], fontsize=12, fontweight="bold")
    ax.text(6, -5.85, "VALLE", ha="center", color=t["fg"], fontsize=12, fontweight="bold")
    guardar(fig, "fig04-patron-estacional", tema)

    # Fig. 5 — Mapa de calor año × mes
    fig, ax = lienzo(t, tema, "Mapa de calor: desvío relativo por año y mes",
                     "Componente cíclico en % de la tendencia HP · verde: precio sobre la tendencia · claro: bajo la tendencia")
    ax.grid(False)
    ax.spines["bottom"].set_visible(False)
    if tema == "web":
        cmap = LinearSegmentedColormap.from_list("az", ["#F2F5F1", "#8C9A90", "#0A120E", "#1C8F4A", "#5BF08F"])
    else:
        cmap = LinearSegmentedColormap.from_list("az", ["#3A3A3A", "#BDBDBD", "#FFFFFF", "#7CC79A", "#0F5C30"])
    valores = piv.values
    im = ax.imshow(valores, aspect="auto", cmap=cmap, vmin=-40, vmax=40, interpolation="nearest")
    ax.set_xticks(range(12), MESES_CORTOS)
    ax.set_yticks(range(len(piv.index)), [str(a) for a in piv.index])
    ax.tick_params(labelsize=12)
    for i in range(valores.shape[0]):
        for j in range(12):
            v = valores[i, j]
            if np.isnan(v):
                continue
            claro = (tema == "web" and (v < -18 or v > 24)) or (tema == "paper" and (v < -22 or v > 24))
            color_txt = ("#0A120E" if v < 0 else "#0A120E") if (tema == "web" and claro) else ("#FFFFFF" if claro else t["fg"])
            ax.text(j, i, num(v, 0, signo=True), ha="center", va="center", fontsize=10.5, color=color_txt)
    cb = fig.colorbar(im, ax=ax, fraction=0.025, pad=0.015)
    cb.outline.set_visible(False)
    cb.ax.tick_params(labelsize=11, colors=t["muted"], length=0)
    cb.ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: num(v, 0, signo=True) + " %"))
    guardar(fig, "fig05-mapa-calor", tema)

    # Fig. 6 — Distribución por mes (boxplot)
    fig, ax = lienzo(t, tema, "Distribución del desvío relativo por mes",
                     "Caja: rango intercuartílico · línea: mediana · rombo: media · 18–19 observaciones por mes")
    datos_mes = [m.loc[m["Mes"] == k, "Desvio_Relativo_pct"].values for k in range(1, 13)]
    bp = ax.boxplot(datos_mes, positions=range(12), widths=0.55, patch_artist=True, showfliers=True,
                    medianprops=dict(color=t["bg"] if tema == "web" else "#FFFFFF", lw=2.4),
                    whiskerprops=dict(color=t["muted"], lw=1.4), capprops=dict(color=t["muted"], lw=1.4),
                    flierprops=dict(marker="o", ms=5, mfc=t["muted"], mec="none", alpha=0.7))
    for caja, c in zip(bp["boxes"], col):
        caja.set_facecolor(c)
        caja.set_edgecolor(c)
        caja.set_alpha(0.92)
    ax.plot(range(12), [np.mean(x) for x in datos_mes], "D", ms=9, mfc=t["fg"], mec=t["bg"], mew=1.5, zorder=4)
    ax.axhline(0, color=t["muted"], lw=1.2)
    ax.set_xticks(range(12), MESES_CORTOS)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: num(v, 0, signo=True) + " %"))
    ax.set_ylabel("Desvío relativo sobre la tendencia")
    guardar(fig, "fig06-distribucion", tema)

    # Fig. 7 — Ruta del arbitraje estacional
    fig, ax = lienzo(t, tema, "Arbitraje estacional: comprar en julio, vender en febrero",
                     "Desvío relativo medio por mes · recorrido de la posición desde el valle de zafra al pico de interzafra")
    orden = [6, 7, 8, 9, 10, 11, 0, 1]  # jul → feb
    etiquetas = [MESES_CORTOS[i] for i in orden]
    y = [rel[i] for i in orden]
    ax.plot(range(len(orden)), y, color=t["verde"], lw=4, zorder=2)
    ax.fill_between(range(len(orden)), y, -6, color=t["verde"], alpha=0.08 if tema == "web" else 0.05, lw=0)
    ax.scatter(range(len(orden)), y, s=120, color=t["verde"], edgecolor=t["bg"], linewidth=2, zorder=3)
    ax.set_xticks(range(len(orden)), etiquetas)
    ax.set_ylim(-6.5, 6.5)
    ax.axhline(0, color=t["muted"], lw=1.2)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: num(v, 0, signo=True) + " %"))
    ax.annotate("COMPRA · julio\n−4,66 % bajo la tendencia\nmediana −$ 5.169,95", xy=(0, rel[6]), xytext=(0.35, -5.6),
                fontsize=14, color=t["fg"], fontweight="semibold", va="center",
                arrowprops=dict(arrowstyle="-", color=t["muted"], lw=1.2))
    ax.annotate("VENTA · febrero\n+3,96 % sobre la tendencia\nmediana +$ 4.339,38", xy=(7, rel[1]), xytext=(5.2, 5.3),
                fontsize=14, color=t["fg"], fontweight="semibold", ha="left", va="center",
                arrowprops=dict(arrowstyle="-", color=t["muted"], lw=1.2))
    caja = FancyBboxPatch((0.75, 2.05), 2.5, 2.9, boxstyle="round,pad=0.12,rounding_size=0.25",
                          fc=t["banda"], ec=t["verde"], lw=1.6, zorder=1)
    ax.add_patch(caja)
    ax.text(2.0, 4.0, "8,62 %", ha="center", va="center", fontsize=34, fontweight="bold", family=t["titulo"], color=t["verde"])
    ax.text(2.0, 2.85, "margen bruto estacional promedio\n$ 9.509,33 por bolsa (medianas)", ha="center", va="center", fontsize=13, color=t["fg"])
    ax.set_ylabel("Desvío relativo medio sobre la tendencia")
    guardar(fig, "fig07-arbitraje", tema)

    # Fig. 8 — Robustez: sensibilidad a lambda y método
    fig, ax = lienzo(t, tema, "Robustez del patrón estacional",
                     "Desvío relativo medio por mes con distintos λ del filtro HP y métodos alternativos de descomposición")
    y_val = m["Precio_Real"].values
    meses = m["Mes"].values
    estilos = [(1_600, t["muted"], 1.8, (0, (2, 3)), "HP λ = 1.600"),
               (129_600, t["blanco"], 1.8, (0, (8, 4)), "HP λ = 129.600 (Ravn-Uhlig)"),
               (14_400, t["verde"], 4.2, "-", "HP λ = 14.400 (paper)")]
    for lam, c, lw, ls, et in estilos:
        cc, tt = hp_filter(y_val, lam)
        patron = pd.Series(cc / tt * 100).groupby(meses).mean().values
        ax.plot(range(12), patron, color=c, lw=lw, ls=ls, label=et, marker="o" if lam == 14_400 else None, ms=8)
    ser = pd.Series(y_val)
    mm = ser.rolling(12, center=True).mean().rolling(2).mean().shift(-1)
    clasica = ((ser - mm) / mm * 100).groupby(meses).mean().values
    ax.plot(range(12), clasica, color=t["verde_osc"] if tema == "web" else "#6E6E6E", lw=2.2, ls=(0, (1, 2)),
            label="Descomposición clásica (media móvil 2×12)")
    ax.axhline(0, color=t["muted"], lw=1.2)
    ax.axvspan(5.5, 9.5, color=t["banda"], lw=0, zorder=0)
    ax.axvspan(-0.5, 2.5, color=t["banda"], lw=0, zorder=0)
    ax.set_xticks(range(12), MESES_CORTOS)
    ax.set_xlim(-0.5, 11.5)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: num(v, 0, signo=True) + " %"))
    ax.set_ylabel("Desvío relativo medio sobre la tendencia")
    leyenda = ax.legend(loc="upper right", frameon=False, fontsize=13, ncol=1)
    for txt in leyenda.get_texts():
        txt.set_color(t["fg"])
    guardar(fig, "fig08-robustez", tema)

    # Fig. 9 — Coeficiente IPC
    fig, ax = lienzo(t, tema, "Deflactor: coeficiente de actualización IPC a pesos de agosto de 2026",
                     "Serie de IPC empalmada con la metodología del BCRA · cuántos pesos de ago-2026 equivalen a 1 peso de cada mes",
                     fuente="Fuente: BCRA (metodología de empalme del IPC); INDEC y direcciones de estadística de San Luis y CABA. Elaboración propia — Veliz, UTN-FRT.")
    # tramos del empalme (nota metodológica del ITCRM, BCRA, enero de 2019)
    tramos = [(pd.Timestamp("2008-01-01"), pd.Timestamp("2012-08-01"), "IPC San Luis", True),
              (pd.Timestamp("2012-08-01"), pd.Timestamp("2016-05-01"), "Promedio CABA y San Luis", False),
              (pd.Timestamp("2016-05-01"), pd.Timestamp("2017-01-01"), "GBA", True),
              (pd.Timestamp("2017-01-01"), pd.Timestamp("2026-09-01"), "IPC nacional (INDEC)", False)]
    eje_x = ax.get_xaxis_transform()
    for desde, hasta, nombre, sombra in tramos:
        if sombra:
            ax.axvspan(desde, hasta, color=t["banda"], zorder=0, lw=0)
        ax.axvline(desde, color=t["grid"], lw=1, zorder=1)
        medio = desde + (hasta - desde) / 2
        ax.text(medio, 0.06, nombre, transform=eje_x, ha="center", va="bottom", fontsize=12 if nombre != "GBA" else 10.5,
                color=t["muted"], linespacing=1.15)
    ax.plot(m["Periodo"], m["Coef"], color=t["verde"], lw=3)
    ax.set_yscale("log")
    ax.yaxis.set_major_locator(LogLocator(base=10, subs=(1.0, 2.0, 5.0)))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: num(v)))
    ax.yaxis.set_minor_formatter(FuncFormatter(lambda v, _: ""))
    eje_fechas(ax)
    ax.set_ylabel("Coeficiente (escala log)")
    anotar(ax, t, m["Periodo"].iloc[0], m["Coef"].iloc[0], f"Enero 2008: × {num(m['Coef'].iloc[0], 2)}", (40, -30))
    anotar(ax, t, m["Periodo"].iloc[-1], m["Coef"].iloc[-1], "Agosto 2026: × 1 (base)", (-40, 40), ha="right")
    guardar(fig, "fig09-ipc", tema)

    # Fig. 10 — Backtest julio → febrero
    fig, ax = lienzo(t, tema, "Backtest histórico: comprar en julio y vender en febrero siguiente",
                     "Retorno real de cada ciclo (precio de febrero de Y+1 / precio de julio de Y − 1), en pesos constantes")
    bt = d["backtest"]
    colores = [t["verde"] if v > 0 else t["blanco"] for v in bt["retorno"]]
    barras = ax.bar(range(len(bt)), bt["retorno"], color=colores, width=0.66, zorder=2)
    for b, v in zip(barras, bt["retorno"]):
        ax.text(b.get_x() + b.get_width() / 2, v + (2 if v >= 0 else -2), num(v, 0, signo=True) + " %",
                ha="center", va="bottom" if v >= 0 else "top", fontsize=11.5, color=t["fg"])
    mediana = float(np.median(bt["retorno"]))
    ax.axhline(0, color=t["muted"], lw=1.2)
    ax.axhline(mediana, color=t["verde"], lw=1.4, ls=(0, (6, 4)))
    ax.text(len(bt) - 0.4, mediana + 2.5, f"mediana {num(mediana, 1, signo=True)} %", ha="right", color=t["verde"], fontsize=13,
            fontweight="semibold")
    ax.set_xticks(range(len(bt)), [f"{a}/{str(a + 1)[2:]}" for a in bt["anio"]], rotation=0, fontsize=11)
    ax.set_ylim(-62, 92)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: num(v, 0, signo=True) + " %"))
    ax.set_ylabel("Retorno real de la operación")
    guardar(fig, "fig10-backtest", tema)


# ---------------------------------------------------------------------------------------------
FORMULAS = {
    "deflactacion": r"$P^{\,real}_{t} \;=\; P^{\,nominal}_{t} \times \mathrm{Coef}^{\,IPC}_{t \rightarrow ago\,2026}$",
    "aditivo": r"$y_t \;=\; \tau_t \;+\; c_t \qquad t = 1, \ldots, T$",
    "hp": r"$\min_{\{\tau_t\}} \; \sum_{t=1}^{T} (y_t-\tau_t)^2 \;+\; \lambda \sum_{t=2}^{T-1} \left[(\tau_{t+1}-\tau_t)-(\tau_t-\tau_{t-1})\right]^2$",
    "matricial": r"$\hat{\tau} \;=\; (\,I + \lambda K^{\top}K\,)^{-1}\, y \qquad \lambda = 14\,400$",
    "relativo": r"$d_t \;=\; \dfrac{c_t}{\tau_t} \times 100 \qquad \bar{d}_m \;=\; \dfrac{1}{n_m}\sum_{t \,\in\, m} d_t$",
    "arbitraje": r"$\Delta \;=\; \bar{d}_{feb} - \bar{d}_{jul} \;=\; 3{,}96 - (-4{,}66) \;=\; 8{,}62\,\%$",
}


def formulas_svg() -> None:
    SALIDA_FORMULAS.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({"mathtext.fontset": "stix", "svg.fonttype": "path", "font.family": "STIXGeneral"})
    incrustadas = {}
    for nombre, tex in FORMULAS.items():
        fig = plt.figure(figsize=(0.01, 0.01))
        fig.text(0, 0, tex, fontsize=22, color="#000000")
        buffer = io.StringIO()
        fig.savefig(buffer, format="svg", transparent=True, bbox_inches="tight", pad_inches=0.04)
        plt.close(fig)
        svg = buffer.getvalue()
        svg = re.sub(r"<\?xml[^>]*>\s*", "", svg)
        svg = re.sub(r"<!DOCTYPE[^>]*>\s*", "", svg, flags=re.S)
        svg = re.sub(r"<metadata>.*?</metadata>\s*", "", svg, flags=re.S)
        svg = re.sub(r"<!--.*?-->\s*", "", svg, flags=re.S)
        svg = svg.replace("#000000", "currentColor").replace("fill: #000000", "fill: currentColor")
        svg = re.sub(r'width="([\d.]+)pt" height="([\d.]+)pt"',
                     lambda mm: f'width="{float(mm.group(1)) * 1.333:.1f}" height="{float(mm.group(2)) * 1.333:.1f}" fill="currentColor" role="img"', svg)
        # identificadores únicos por fórmula para poder incrustar varias en la misma página
        svg = svg.replace('id="', f'id="f-{nombre}-').replace('href="#', f'href="#f-{nombre}-')
        svg = re.sub(r">\s+<", "><", svg).strip()
        (SALIDA_FORMULAS / f"{nombre}.svg").write_text(svg, encoding="utf-8")
        incrustadas[nombre] = svg
        print(f"  fórmula {nombre}.svg")
    destino = RAIZ / "site" / "assets" / "js" / "formulas.js"
    destino.write_text("/* Generado por analysis/figuras.py — fórmulas en SVG (mathtext STIX) */\n"
                       "window.AZ_FORMULAS = " + json.dumps(incrustadas, ensure_ascii=False) + ";\n", encoding="utf-8")


def main() -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    diario = pd.read_csv(DATOS / "precio_azucar_50kg_desde_2008.csv", parse_dates=["Fecha"])
    m = pd.read_csv(DATOS / "azucar_tendencia_hp.csv", parse_dates=["Periodo"])
    m = m.rename(columns={"Coeficiente de ajuste a Pesos de Agosto de 2026": "Coef", "Precio_Nominal_Promedio": "Nominal"})
    m["Mes"] = m["Periodo"].dt.month
    m["Anio"] = m["Periodo"].dt.year
    tabla = pd.read_csv(DATOS / "tabla1_estacionalidad.csv").to_dict("records")
    piv = m.pivot(index="Anio", columns="Mes", values="Desvio_Relativo_pct")
    filas = []
    for anio in range(2008, 2026):
        b = m[(m["Anio"] == anio) & (m["Mes"] == 7)]["Precio_Real"]
        v = m[(m["Anio"] == anio + 1) & (m["Mes"] == 2)]["Precio_Real"]
        if len(b) and len(v):
            filas.append({"anio": anio, "retorno": (v.iloc[0] / b.iloc[0] - 1) * 100})
    datos = {"diario": diario, "mensual": m, "tabla": tabla, "piv": piv, "backtest": pd.DataFrame(filas)}
    print(f"Tipografías: títulos={DISPLAY}, texto={SANS}, paper={SERIF}")
    for tema in ["web", "paper"]:
        figuras(tema, datos)
    formulas_svg()


if __name__ == "__main__":
    main()
