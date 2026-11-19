# Estacionalidad del precio del azúcar en Tucumán

Sitio web interactivo del paper **«Análisis de la Estacionalidad del Precio del Azúcar en el Mercado Interno de Tucumán»**
— Héctor Matías Veliz · Universidad Tecnológica Nacional, Facultad Regional Tucumán.

El estudio determina en qué meses conviene comprar y vender la bolsa de azúcar común tipo A de 50 kg en el mercado
interno de Tucumán, a partir de 6.791 cotizaciones diarias (CACTU, 2008–2026) deflactadas con el IPC a pesos
constantes de agosto de 2026 y descompuestas con el filtro de Hodrick-Prescott (λ = 14.400).

| Resultado | Valor |
|---|---|
| Ventana de compra (zafra) | junio – octubre · piso en julio: −4,66 % bajo la tendencia |
| Ventana de venta (interzafra) | enero – marzo · pico en febrero: +3,96 % sobre la tendencia |
| Diferencial de arbitraje julio → febrero | 8,62 pp reales · $ 9.509,33 por bolsa sobre medianas |

## Páginas

| Página | Contenido |
|---|---|
| `index.html` | Resultados, rueda anual, diagrama de 12 bloques clickeables, explorador de series, Tabla 1 interactiva, mapa de calor, simulador de arbitraje, galería de láminas 4K y el paper completo |
| `datos.html` | Fuentes (CACTU, INDEC), pipeline de ingeniería de datos, control de calidad, deflactor IPC con conversor, diccionario, tabla explorable y descargas en CSV |
| `justificacion.html` | Hipótesis, precios reales, IPC frente al dólar, filtro HP con λ interactivo, validación estadística, backtest, limitaciones y reglas de decisión |
| `futuro.html` | Hoja de ruta, arquitectura de datos, prueba de concepto de machine learning y variables exógenas |

## Estructura

```
analisis_azucar_tucuman/
├── netlify.toml              # despliegue: publica la carpeta site/
├── analysis/
│   ├── pipeline.py           # serie real, filtro HP, Tabla 1, validación y datos del sitio
│   ├── figuras.py            # láminas 4K (web y versión paper) y fórmulas SVG
│   ├── prototipo_ml.py       # pronóstico walk-forward (prueba de concepto)
│   ├── hero/                 # generador procedural de la imagen de portada
│   ├── fuentes/              # tipografías usadas en las figuras (OFL)
│   └── requirements.txt
└── site/                     # sitio estático (HTML, CSS y JavaScript sin dependencias externas)
    ├── index.html · datos.html · justificacion.html · futuro.html · 404.html
    ├── datos/                # CSV descargables
    └── assets/               # css, js, data (JSON generado), fonts, img (4K)
```

## Desplegar en Netlify

1. En Netlify: **Add new site → Import an existing project → GitHub** y elegir este repositorio.
2. Netlify lee `netlify.toml`: no hay comando de compilación y el directorio publicado es `site`.
3. Cada `git push` a la rama principal vuelve a publicar el sitio.

Alternativa sin Git: arrastrar la carpeta `site/` a <https://app.netlify.com/drop>.

## Reproducir el análisis

```bash
pip install -r analysis/requirements.txt
python analysis/pipeline.py      # recalcula datos, Tabla 1 y pruebas; escribe site/assets/data/azucar.js
python analysis/figuras.py       # regenera las láminas 4K y las fórmulas
python analysis/prototipo_ml.py  # regenera la prueba de concepto de machine learning
python -m http.server --directory site 8000   # ver el sitio en http://localhost:8000
```

`pipeline.py` reproduce exactamente las cifras del paper (media 60.042,71; mediana 52.544,84; desvío 24.205,77;
Tabla 1 completa). Si `statsmodels` está instalado, verifica que `sm.tsa.filters.hpfilter` y la implementación
matricial propia coincidan.

## Fuentes y licencia de los datos

Precios: Centro de Agricultores Cañeros de Tucumán (CACTU). Coeficientes de actualización: IPC (INDEC), serie empalmada.
Los datos se publican con fines académicos y de verificación; citar siempre la fuente original.
El contenido del sitio no constituye asesoramiento financiero.
