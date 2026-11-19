"""
Renderiza la imagen de portada procedural (cañaveral + Aconquija) en 4K con Chrome headless.

Requiere: pip install playwright pillow  y un Chrome/Chromium instalado.
Uso:      python analysis/hero/render_hero.py [--chrome RUTA] [--seed 7]
Salida:   site/assets/img/hero/*.webp y *.png
"""
from __future__ import annotations

import argparse
import base64
import io
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

AQUI = Path(__file__).resolve().parent
SALIDA = AQUI.parents[1] / "site" / "assets" / "img" / "hero"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chrome", default=None, help="ruta al ejecutable de Chrome (opcional)")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--preview", action="store_true", help="render rápido 1920×1080")
    args = parser.parse_args()
    ancho, alto = (1920, 1080) if args.preview else (3840, 2160)
    SALIDA.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        navegador = p.chromium.launch(executable_path=args.chrome, args=["--no-sandbox"]) if args.chrome \
            else p.chromium.launch()
        pagina = navegador.new_page(viewport={"width": 1280, "height": 720})
        url = (AQUI / "canaveral.html").as_uri() + f"?w={ancho}&h={alto}&seed={args.seed}"
        pagina.goto(url, wait_until="domcontentloaded")
        pagina.wait_for_function("window.LISTO === true", timeout=600_000, polling=500)
        print("render (ms):", pagina.evaluate("window.TIEMPO"))
        datos = pagina.evaluate("document.getElementById('lienzo').toDataURL('image/png')")
        navegador.close()
    img = Image.open(io.BytesIO(base64.b64decode(datos.split(",", 1)[1]))).convert("RGB")
    if args.preview:
        img.save(SALIDA / "preview.png")
        print("preview listo")
        return
    img.save(SALIDA / "canaveral-3840.webp", quality=84, method=6)
    img.resize((2560, 1440), Image.LANCZOS).save(SALIDA / "canaveral-2560.webp", quality=84, method=6)
    img.resize((1600, 900), Image.LANCZOS).save(SALIDA / "canaveral-1600.webp", quality=82, method=6)
    # recorte vertical para celulares (relación 9:16 sobre el sector iluminado de la escena)
    recorte_ancho = round(alto * 9 / 16)
    x0 = round(ancho * 0.60 - recorte_ancho / 2)
    vertical = img.crop((x0, 0, x0 + recorte_ancho, alto))
    vertical.save(SALIDA / "canaveral-vertical-1215.webp", quality=82, method=6)
    print("portada lista:", sorted(f.name for f in SALIDA.glob("canaveral-*")))


if __name__ == "__main__":
    main()
