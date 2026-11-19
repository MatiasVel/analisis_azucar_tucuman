/* ==========================================================================
   Núcleo compartido: formato numérico, navegación, revelado, panel de detalle,
   visor de imágenes 4K y utilidades. Sin dependencias externas.
   ========================================================================== */
(function () {
  "use strict";
  document.documentElement.classList.remove("sin-js");
  const AZ = (window.AZ = window.AZ || {});

  // ------------------------------------------------------------ formato (es-AR)
  const cache = {};
  function nf(dec) {
    const k = String(dec);
    if (!cache[k]) cache[k] = new Intl.NumberFormat("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return cache[k];
  }
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  AZ.MESES = MESES;
  AZ.MESES_CORTOS = MESES_CORTOS;
  AZ.fmt = {
    num(v, dec = 0, signo = false) {
      if (v === null || v === undefined || Number.isNaN(v)) return "—";
      const t = nf(dec).format(Math.abs(v));
      if (v < 0 && Number(t.replace(/\./g, "").replace(",", ".")) !== 0) return "−" + t;
      return (signo && v > 0 ? "+" : "") + t;
    },
    pesos(v, dec = 2, signo = false) {
      if (v === null || v === undefined || Number.isNaN(v)) return "—";
      const s = signo && v > 0 ? "+" : v < 0 ? "−" : "";
      return s + "$ " + nf(dec).format(Math.abs(v));
    },
    pct(v, dec = 2, signo = true) { return AZ.fmt.num(v, dec, signo) + " %"; },
    mes(iso) { const [a, m] = iso.split("-"); return MESES_CORTOS[+m - 1] + " " + a; },
    mesLargo(iso) { const [a, m] = iso.split("-"); return MESES[+m - 1] + " de " + a; },
    fecha(d) { return d.getUTCDate().toString().padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + d.getUTCFullYear(); },
  };

  // ------------------------------------------------------------ íconos
  AZ.icono = {
    mas: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 2v12M2 8h12"/></svg>',
    flecha: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5"/></svg>',
    cerrar: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>',
    izq: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l-6 6 6 6"/></svg>',
    der: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4l6 6-6 6"/></svg>',
    descarga: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3v10M5.5 8.5L10 13l4.5-4.5M4 17h12"/></svg>',
    lupa: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="M13.2 13.2L17 17M9 6.5v5M6.5 9h5"/></svg>',
    info: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><path d="M10 9v5M10 6.2v.1"/></svg>',
  };

  // ------------------------------------------------------------ navegación
  function iniciarNavegacion() {
    const nav = document.querySelector(".nav");
    const boton = document.querySelector(".nav__menu");
    const menu = document.querySelector(".menu-movil");
    if (boton && menu) {
      const alternar = (abrir) => {
        boton.setAttribute("aria-expanded", String(abrir));
        menu.classList.toggle("abierto", abrir);
        document.body.style.overflow = abrir ? "hidden" : "";
        if (abrir) menu.querySelector("a")?.focus({ preventScroll: true });
      };
      boton.addEventListener("click", () => alternar(boton.getAttribute("aria-expanded") !== "true"));
      menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => alternar(false)));
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("abierto")) { alternar(false); boton.focus(); } });
    }
    const progreso = document.querySelector(".progreso");
    let pendiente = false;
    const alDesplazar = () => {
      pendiente = false;
      const y = window.scrollY;
      if (nav) nav.classList.toggle("nav--solida", y > 40);
      if (progreso) {
        const total = document.documentElement.scrollHeight - window.innerHeight;
        progreso.style.transform = `scaleX(${total > 0 ? Math.min(1, y / total) : 0})`;
      }
    };
    window.addEventListener("scroll", () => { if (!pendiente) { pendiente = true; requestAnimationFrame(alDesplazar); } }, { passive: true });
    alDesplazar();
  }

  // ------------------------------------------------------------ revelado y contadores
  function iniciarRevelado() {
    const elementos = document.querySelectorAll(".revelar");
    if (!("IntersectionObserver" in window)) { elementos.forEach((el) => el.classList.add("visible")); return; }
    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("visible"); obs.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    elementos.forEach((el) => obs.observe(el));

    const contadores = document.querySelectorAll("[data-contar]");
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const obsC = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (!en.isIntersecting) return;
        obsC.unobserve(en.target);
        const el = en.target, fin = parseFloat(el.dataset.contar), dec = +(el.dataset.dec || 0);
        const pre = el.dataset.pre || "", suf = el.dataset.suf || "", signo = el.dataset.signo === "1";
        if (reducir) { el.textContent = pre + AZ.fmt.num(fin, dec, signo) + suf; return; }
        const t0 = performance.now(), dur = 1400;
        const paso = (t) => {
          const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
          el.textContent = pre + AZ.fmt.num(fin * e, dec, signo) + suf;
          if (p < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      });
    }, { threshold: 0.4 });
    contadores.forEach((el) => obsC.observe(el));
  }

  // ------------------------------------------------------------ tostada / copiar
  AZ.tostada = function (texto) {
    let t = document.querySelector(".tostada");
    if (!t) { t = document.createElement("div"); t.className = "tostada"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = texto;
    t.classList.add("visible");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("visible"), 2200);
  };
  AZ.copiar = async function (texto) {
    try { await navigator.clipboard.writeText(texto); AZ.tostada("Copiado al portapapeles"); }
    catch (e) {
      const area = document.createElement("textarea"); area.value = texto; document.body.appendChild(area); area.select();
      try { document.execCommand("copy"); AZ.tostada("Copiado al portapapeles"); } catch (_) { AZ.tostada("No se pudo copiar"); }
      area.remove();
    }
  };

  // ------------------------------------------------------------ panel de detalle (drawer / bottom sheet)
  AZ.panel = (function () {
    let raiz, hoja, titulo, etiqueta, cuerpo, nav, anterior = null, grupo = [], indice = -1, alNavegar = null;
    function construir() {
      raiz = document.createElement("div");
      raiz.className = "panel";
      raiz.setAttribute("aria-hidden", "true");
      raiz.innerHTML = `
        <div class="panel__fondo" data-cerrar></div>
        <section class="panel__hoja" role="dialog" aria-modal="true" aria-labelledby="panel-titulo" tabindex="-1">
          <header class="panel__cabecera">
            <div><span class="etiqueta" id="panel-etiqueta"></span><h2 id="panel-titulo"></h2></div>
            <button class="boton-icono" type="button" data-cerrar aria-label="Cerrar detalle">${AZ.icono.cerrar}</button>
          </header>
          <div class="panel__cuerpo" id="panel-cuerpo"></div>
          <nav class="panel__navegacion" aria-label="Navegar entre detalles">
            <button class="btn btn--secundario btn--chico" type="button" data-ant>${AZ.icono.izq}<span>Anterior</span></button>
            <button class="btn btn--secundario btn--chico" type="button" data-sig><span>Siguiente</span>${AZ.icono.der}</button>
          </nav>
        </section>`;
      document.body.appendChild(raiz);
      hoja = raiz.querySelector(".panel__hoja");
      titulo = raiz.querySelector("#panel-titulo");
      etiqueta = raiz.querySelector("#panel-etiqueta");
      cuerpo = raiz.querySelector("#panel-cuerpo");
      nav = raiz.querySelector(".panel__navegacion");
      raiz.addEventListener("click", (e) => { if (e.target.closest("[data-cerrar]")) cerrar(); });
      raiz.querySelector("[data-ant]").addEventListener("click", () => mover(-1));
      raiz.querySelector("[data-sig]").addEventListener("click", () => mover(1));
      document.addEventListener("keydown", (e) => {
        if (!raiz.classList.contains("abierto")) return;
        if (e.key === "Escape") cerrar();
        if (e.key === "Tab") atraparFoco(e);
      });
      // gesto de deslizar hacia abajo para cerrar en celulares
      let y0 = null;
      hoja.addEventListener("touchstart", (e) => { if (cuerpo.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
      hoja.addEventListener("touchmove", (e) => {
        if (y0 === null || window.innerWidth > 700) return;
        const dy = e.touches[0].clientY - y0;
        if (dy > 0) hoja.style.transform = `translateY(${dy}px)`;
      }, { passive: true });
      hoja.addEventListener("touchend", (e) => {
        if (y0 === null) return;
        const dy = e.changedTouches[0].clientY - y0; y0 = null; hoja.style.transform = "";
        if (dy > 110 && window.innerWidth <= 700) cerrar();
      });
    }
    function atraparFoco(e) {
      const focos = hoja.querySelectorAll('a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])');
      if (!focos.length) return;
      const primero = focos[0], ultimo = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    }
    function pintar(item) {
      etiqueta.textContent = item.etiqueta || "Detalle";
      titulo.textContent = item.titulo || "";
      cuerpo.innerHTML = "";
      if (item.plantilla) {
        const tpl = document.getElementById(item.plantilla);
        if (tpl) cuerpo.appendChild(tpl.content.cloneNode(true));
      } else if (item.html) cuerpo.innerHTML = item.html;
      AZ.formulas(cuerpo);
      AZ.resaltarPython(cuerpo);
      cuerpo.scrollTop = 0;
      nav.style.display = grupo.length > 1 ? "" : "none";
      if (typeof item.alAbrir === "function") item.alAbrir(cuerpo);
      if (alNavegar) alNavegar(item, indice);
    }
    function mover(d) {
      if (grupo.length < 2) return;
      indice = (indice + d + grupo.length) % grupo.length;
      pintar(grupo[indice]);
    }
    function abrir(item, lista, cb) {
      if (!raiz) construir();
      anterior = document.activeElement;
      grupo = lista || [item];
      indice = Math.max(0, grupo.indexOf(item));
      alNavegar = cb || null;
      pintar(item);
      raiz.classList.add("abierto");
      raiz.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      setTimeout(() => hoja.focus({ preventScroll: true }), 60);
    }
    function cerrar() {
      if (!raiz) return;
      raiz.classList.remove("abierto");
      raiz.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (alNavegar) alNavegar(null, -1);
      if (anterior && anterior.focus) anterior.focus({ preventScroll: true });
    }
    return { abrir, cerrar };
  })();

  /* Conecta elementos [data-detalle="id-plantilla"] con el panel. Agrupa por [data-grupo]. */
  AZ.conectarDetalles = function (raiz = document, alNavegar) {
    const elementos = Array.from(raiz.querySelectorAll("[data-detalle]"));
    const grupos = {};
    const items = elementos.map((el) => {
      const item = { el, plantilla: el.dataset.detalle, titulo: el.dataset.titulo || el.querySelector("h3, .nodo__titulo")?.textContent.trim() || el.textContent.trim(), etiqueta: el.dataset.etiqueta };
      const g = el.dataset.grupo || "general";
      (grupos[g] = grupos[g] || []).push(item);
      item.grupo = g;
      return item;
    });
    items.forEach((item) => {
      const activar = (e) => {
        if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
        if (e.type === "keydown") e.preventDefault();
        AZ.panel.abrir(item, grupos[item.grupo], alNavegar);
      };
      item.el.addEventListener("click", activar);
      if (item.el.tagName !== "BUTTON" && item.el.tagName !== "A") {
        item.el.setAttribute("tabindex", "0");
        item.el.setAttribute("role", "button");
        item.el.addEventListener("keydown", activar);
      }
    });
    return items;
  };

  // ------------------------------------------------------------ visor de figuras 4K
  AZ.visor = (function () {
    let raiz, img, tituloEl, textoEl, contador, botones, lista = [], i = 0, anterior = null;
    function construir() {
      raiz = document.createElement("div");
      raiz.className = "visor";
      raiz.setAttribute("role", "dialog");
      raiz.setAttribute("aria-modal", "true");
      raiz.setAttribute("aria-label", "Visor de figuras en alta resolución");
      raiz.innerHTML = `
        <div class="visor__barra">
          <span class="contador"></span>
          <div class="visor__acciones">
            <button class="boton-icono" type="button" data-zoom aria-label="Ver a resolución completa (3840 × 2160)">${AZ.icono.lupa}</button>
            <button class="boton-icono" type="button" data-cerrar aria-label="Cerrar visor">${AZ.icono.cerrar}</button>
          </div>
        </div>
        <div class="visor__lienzo"><span class="visor__cargando">Cargando imagen 4K…</span><img alt=""></div>
        <div class="visor__pie"><div><h3></h3><p></p></div><div class="visor__botones"></div></div>
        <button class="boton-icono visor__flecha visor__flecha--izq" type="button" data-ant aria-label="Figura anterior">${AZ.icono.izq}</button>
        <button class="boton-icono visor__flecha visor__flecha--der" type="button" data-sig aria-label="Figura siguiente">${AZ.icono.der}</button>`;
      document.body.appendChild(raiz);
      img = raiz.querySelector("img");
      tituloEl = raiz.querySelector(".visor__pie h3");
      textoEl = raiz.querySelector(".visor__pie p");
      contador = raiz.querySelector(".contador");
      botones = raiz.querySelector(".visor__botones");
      const cargando = raiz.querySelector(".visor__cargando");
      img.addEventListener("load", () => { cargando.style.display = "none"; });
      img.addEventListener("click", alternarZoom);
      raiz.querySelector("[data-zoom]").addEventListener("click", alternarZoom);
      raiz.querySelector("[data-cerrar]").addEventListener("click", cerrar);
      raiz.querySelector("[data-ant]").addEventListener("click", () => mostrar(i - 1));
      raiz.querySelector("[data-sig]").addEventListener("click", () => mostrar(i + 1));
      document.addEventListener("keydown", (e) => {
        if (!raiz.classList.contains("abierto")) return;
        if (e.key === "Escape") cerrar();
        if (e.key === "ArrowLeft") mostrar(i - 1);
        if (e.key === "ArrowRight") mostrar(i + 1);
      });
      let x0 = null;
      raiz.addEventListener("touchstart", (e) => { if (!raiz.classList.contains("ampliado")) x0 = e.touches[0].clientX; }, { passive: true });
      raiz.addEventListener("touchend", (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 60) mostrar(i + (dx < 0 ? 1 : -1));
      });
    }
    function alternarZoom() {
      raiz.classList.toggle("ampliado");
      const lienzo = raiz.querySelector(".visor__lienzo");
      if (raiz.classList.contains("ampliado")) {
        requestAnimationFrame(() => { lienzo.scrollLeft = (lienzo.scrollWidth - lienzo.clientWidth) / 2; lienzo.scrollTop = (lienzo.scrollHeight - lienzo.clientHeight) / 2; });
      }
    }
    function mostrar(n) {
      if (!lista.length) return;
      i = (n + lista.length) % lista.length;
      const f = lista[i];
      raiz.classList.remove("ampliado");
      raiz.querySelector(".visor__cargando").style.display = "";
      img.src = f.src4k;
      img.alt = f.titulo;
      tituloEl.textContent = (f.num ? f.num + " · " : "") + f.titulo;
      textoEl.textContent = f.texto || "";
      contador.textContent = `${i + 1} / ${lista.length} · 3840 × 2160 px`;
      botones.innerHTML = "";
      if (f.png) botones.insertAdjacentHTML("beforeend", `<a class="btn btn--primario btn--chico" href="${f.png}" download>${AZ.icono.descarga}<span>PNG 4K</span></a>`);
      if (f.paper) botones.insertAdjacentHTML("beforeend", `<a class="btn btn--secundario btn--chico" href="${f.paper}" download>${AZ.icono.descarga}<span>Versión paper (fondo blanco)</span></a>`);
      if (f.enlace) {
        botones.insertAdjacentHTML("beforeend", `<a class="btn btn--secundario btn--chico" href="${f.enlace}" data-profundizar><span>Profundizar</span>${AZ.icono.flecha}</a>`);
        botones.querySelector("[data-profundizar]").addEventListener("click", cerrar);
      }
      raiz.querySelectorAll(".visor__flecha").forEach((b) => (b.style.visibility = lista.length > 1 ? "" : "hidden"));
      // precarga de la siguiente
      const sig = lista[(i + 1) % lista.length];
      if (sig) { const p = new Image(); p.src = sig.src4k; }
    }
    function abrir(figuras, n) {
      if (!raiz) construir();
      anterior = document.activeElement;
      lista = figuras;
      raiz.classList.add("abierto");
      document.body.style.overflow = "hidden";
      mostrar(n);
      setTimeout(() => raiz.querySelector("[data-cerrar]").focus({ preventScroll: true }), 50);
    }
    function cerrar() {
      raiz.classList.remove("abierto", "ampliado");
      document.body.style.overflow = "";
      if (anterior && anterior.focus) anterior.focus({ preventScroll: true });
    }
    return { abrir, cerrar };
  })();

  /* Conecta botones .figura[data-figura] con el visor. */
  AZ.conectarFiguras = function (selector = ".figura[data-src4k]") {
    const els = Array.from(document.querySelectorAll(selector));
    const datos = (lista) => lista.map((el) => ({
      src4k: el.dataset.src4k, png: el.dataset.png, paper: el.dataset.paper, enlace: el.dataset.enlace,
      num: el.dataset.num, titulo: el.dataset.titulo || el.querySelector(".figura__titulo")?.textContent, texto: el.dataset.texto,
    }));
    els.forEach((el) => el.addEventListener("click", () => {
      const visibles = els.filter((x) => !x.hidden);
      AZ.visor.abrir(datos(visibles), visibles.indexOf(el));
    }));
  };

  // ------------------------------------------------------------ resaltado mínimo de código Python
  AZ.resaltarPython = function (raiz = document) {
    raiz.querySelectorAll("pre.codigo[data-py]").forEach((pre) => {
      if (pre.dataset.resaltado) return;
      const lineas = pre.textContent.split("\n").map((l) => {
        const esc = l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const i = esc.indexOf("#");
        const codigo = i >= 0 ? esc.slice(0, i) : esc, comentario = i >= 0 ? `<span class="c">${esc.slice(i)}</span>` : "";
        const c = codigo
          .replace(/("[^"]*"|'[^']*')/g, '<span class="s">$1</span>')
          .replace(/\b(import|from|as|def|return|for|in|if|else|elif|lambda|with|True|False|None)\b/g, '<span class="k">$1</span>')
          .replace(/\b(\d+(?:[._]\d+)*)\b/g, '<span class="n">$1</span>');
        return c + comentario;
      });
      pre.innerHTML = lineas.join("\n");
      pre.dataset.resaltado = "1";
    });
  };

  // ------------------------------------------------------------ conectores entre nodos de un diagrama
  AZ.conectores = function (flujo, svg) {
    const nodos = Array.from(flujo.querySelectorAll(".nodo[data-hacia]"));
    function dibujar() {
      if (window.innerWidth <= 1100) { svg.innerHTML = ""; return; }
      const base = flujo.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${base.width} ${base.height}`);
      let s = "";
      nodos.forEach((n) => {
        const a = n.getBoundingClientRect();
        n.dataset.hacia.split(",").forEach((id) => {
          const t = document.getElementById(id.trim()); if (!t) return;
          const b = t.getBoundingClientRect();
          let d, ex, ey;
          if (Math.abs(a.left - b.left) < 30) {
            const x = a.left + a.width / 2 - base.left, y1 = a.bottom - base.top, y2 = b.top - base.top;
            d = `M${x} ${y1}L${x} ${y2}`; ex = x; ey = y2;
          } else {
            const sx = a.right - base.left, sy = a.top + a.height / 2 - base.top;
            const tx = b.left - base.left, ty = b.top + b.height / 2 - base.top, dx = (tx - sx) / 2;
            d = `M${sx} ${sy}C${sx + dx} ${sy},${tx - dx} ${ty},${tx} ${ty}`; ex = tx; ey = ty;
          }
          s += `<path d="${d}" data-desde="${n.id}" data-hasta="${id.trim()}"/><circle cx="${ex}" cy="${ey}" r="3"/>`;
        });
      });
      svg.innerHTML = s;
    }
    const resaltar = (id, on) => svg.querySelectorAll(`path[data-desde="${id}"], path[data-hasta="${id}"]`).forEach((p) => p.classList.toggle("activa", on));
    flujo.querySelectorAll(".nodo").forEach((n) => {
      n.addEventListener("pointerenter", () => resaltar(n.id, true));
      n.addEventListener("pointerleave", () => resaltar(n.id, false));
      n.addEventListener("focus", () => resaltar(n.id, true));
      n.addEventListener("blur", () => resaltar(n.id, false));
    });
    dibujar();
    new ResizeObserver(() => requestAnimationFrame(dibujar)).observe(flujo);
    if (document.fonts) document.fonts.ready.then(dibujar);
  };

  // ------------------------------------------------------------ fórmulas SVG incrustadas
  AZ.formulas = function (raiz = document) {
    const F = window.AZ_FORMULAS || {};
    raiz.querySelectorAll("[data-formula]").forEach((el) => {
      if (el.dataset.lista || !F[el.dataset.formula]) return;
      el.innerHTML = F[el.dataset.formula];
      const svg = el.querySelector("svg");
      if (svg) {
        const vb = svg.viewBox.baseVal, escala = +(el.dataset.escala || 1.45);
        svg.setAttribute("aria-label", el.dataset.alt || "Fórmula");
        svg.setAttribute("width", Math.round(vb.width * escala));
        svg.setAttribute("height", Math.round(vb.height * escala));
        svg.style.width = Math.round(vb.width * escala) + "px";
        svg.style.height = "auto";
      }
      el.dataset.lista = "1";
    });
  };

  // ------------------------------------------------------------ copiar cita
  function iniciarCopiado() {
    document.querySelectorAll("[data-copiar]").forEach((b) => b.addEventListener("click", () => {
      const objetivo = document.querySelector(b.dataset.copiar);
      if (objetivo) AZ.copiar(objetivo.innerText.trim());
    }));
  }

  document.addEventListener("DOMContentLoaded", () => {
    iniciarNavegacion();
    iniciarRevelado();
    iniciarCopiado();
    AZ.resaltarPython();
    AZ.formulas();
    document.querySelectorAll("[data-anio]").forEach((el) => (el.textContent = new Date().getFullYear()));
  });
})();
