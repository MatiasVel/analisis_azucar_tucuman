"""Genera la imagen para compartir el sitio en redes y mensajería (Open Graph, 1200 × 630).

Parte de la ilustración de portada en 4K y le superpone el título, la bajada y la autoría.
Uso:  python analysis/compartir.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parents[1]
FUENTES = RAIZ / "analysis" / "fuentes"
ORIGEN = RAIZ / "site" / "assets" / "img" / "hero" / "canaveral-3840.webp"
DESTINO = RAIZ / "site" / "assets" / "img" / "compartir-1200x630.jpg"

ANCHO, ALTO, MARGEN = 1200, 630, 64
VERDE, BLANCO, GRIS, TENUE = (43, 212, 107), (242, 246, 243), (188, 201, 192), (135, 153, 141)


def fuente(nombre: str, tam: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FUENTES / nombre), tam)


def main() -> None:
    fondo = Image.open(ORIGEN).convert("RGB")
    alto = round(fondo.height * ANCHO / fondo.width)
    fondo = fondo.resize((ANCHO, alto), Image.LANCZOS)
    arriba = (alto - ALTO) // 2
    lienzo = fondo.crop((0, arriba, ANCHO, arriba + ALTO))

    # velo oscuro de izquierda a derecha para que el texto se lea sobre el cañaveral
    velo = Image.new("L", (ANCHO, 1))
    for x in range(ANCHO):
        t = x / ANCHO
        velo.putpixel((x, 0), int(238 * max(0.0, 1 - (t / 0.78) ** 1.6)))
    velo = velo.resize((ANCHO, ALTO))
    lienzo = Image.composite(Image.new("RGB", (ANCHO, ALTO), (5, 8, 6)), lienzo, velo)

    d = ImageDraw.Draw(lienzo)
    y = 70
    ante = fuente("Inter-SemiBold.otf", 19)
    d.line([(MARGEN, y + 11), (MARGEN + 30, y + 11)], fill=VERDE, width=3)
    x = MARGEN + 44
    for letra in "PAPER DE INVESTIGACIÓN · UTN FACULTAD REGIONAL TUCUMÁN":
        d.text((x, y), letra, font=ante, fill=VERDE)
        x += d.textlength(letra, font=ante) + 2.6

    # título en dos líneas, con «azúcar» en verde como en la portada
    tam = 74
    titulo = fuente("Montserrat-ExtraBold.ttf", tam)
    while d.textlength("Estacionalidad del precio", font=titulo) > 860:
        tam -= 2
        titulo = fuente("Montserrat-ExtraBold.ttf", tam)
    y = 128
    d.text((MARGEN - 3, y), "Estacionalidad del precio", font=titulo, fill=BLANCO)
    y += round(tam * 1.08)
    x = MARGEN - 3
    for parte, color in (("del ", BLANCO), ("azúcar", VERDE), (" en Tucumán", BLANCO)):
        d.text((x, y), parte, font=titulo, fill=color)
        x += d.textlength(parte, font=titulo)

    y += round(tam * 1.42)
    bajada = fuente("Inter-Regular.otf", 27)
    for linea in ("Comprar en zafra, vender en interzafra: 224 meses",
                  "en pesos constantes y el filtro de Hodrick-Prescott."):
        d.text((MARGEN, y), linea, font=bajada, fill=GRIS)
        y += 38

    # autoría
    y = ALTO - 104
    d.line([(MARGEN, y - 18), (MARGEN + 520, y - 18)], fill=(40, 58, 47), width=1)
    nombre = fuente("Inter-SemiBold.otf", 22)
    texto = fuente("Inter-Regular.otf", 19)
    d.text((MARGEN, y), "Héctor Matías Veliz", font=nombre, fill=BLANCO)
    x = MARGEN + d.textlength("Héctor Matías Veliz", font=nombre) + 14
    d.text((x, y + 2), "· Tutores: Dra. Dorigatti Mariana e Ing. Sardi Duilio", font=texto, fill=GRIS)
    d.text((MARGEN, y + 36), "Laboratorio GIITNI Datos · UTN Facultad Regional Tucumán", font=texto, fill=TENUE)

    lienzo.save(DESTINO, "JPEG", quality=86, optimize=True, progressive=True)
    print(f"{DESTINO.relative_to(RAIZ)}: {DESTINO.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
