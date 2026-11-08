// =========================================================
//  Misión 1122 — app principal (fase 2)
//  Mapa + lista + contador + "Guardar copia" + recuerdos (fotos y clips)
// =========================================================

// ---------- 1. Guardado en el celular (IndexedDB) ----------
// IndexedDB es una "bodega" del navegador donde guardamos tus marcas.
const DB = {
  _db: null,
  async abrir() {
    if (this._db) return this._db;
    this._db = await new Promise((ok, mal) => {
      const r = indexedDB.open("mi-antioquia", 2);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
        if (!db.objectStoreNames.contains("medios")) db.createObjectStore("medios");
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    return this._db;
  },
  async leer(clave) {
    try {
      const db = await this.abrir();
      return await new Promise((ok) => {
        const r = db.transaction("kv").objectStore("kv").get(clave);
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ok(undefined);
      });
    } catch { return JSON.parse(localStorage.getItem(clave) || "null"); }
  },
  async guardar(clave, valor) {
    try {
      const db = await this.abrir();
      await new Promise((ok, mal) => {
        const t = db.transaction("kv", "readwrite");
        t.objectStore("kv").put(valor, clave);
        t.oncomplete = ok; t.onerror = () => mal(t.error);
      });
    } catch { localStorage.setItem(clave, JSON.stringify(valor)); }
  },
  // Fotos y clips: se guardan aparte, como archivos (Blob)
  async medio(id) {
    const db = await this.abrir();
    return new Promise(ok => { const r = db.transaction("medios").objectStore("medios").get(id); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); });
  },
  async guardarMedio(id, blob) {
    const db = await this.abrir();
    return new Promise((ok, mal) => { const t = db.transaction("medios", "readwrite"); t.objectStore("medios").put(blob, id); t.oncomplete = ok; t.onerror = () => mal(t.error); });
  },
  async borrarMedio(id) {
    const db = await this.abrir();
    return new Promise(ok => { const t = db.transaction("medios", "readwrite"); t.objectStore("medios").delete(id); t.oncomplete = ok; t.onerror = ok; });
  }
};

// Fecha de hoy en hora de Colombia (no en hora universal)
function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Estado: qué municipios conoces y cuándo los marcaste
let estado = { visitados: {}, ultimaCopia: null, cambiosSinCopia: 0 };

async function cargarEstado() {
  const e = await DB.leer("estado");
  if (e) estado = Object.assign(estado, e);
  // Pedimos al navegador que no borre los datos por falta de espacio
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
async function guardarEstado() { await DB.guardar("estado", estado); }

function conocido(c) { return !!estado.visitados[c]; }

async function alternar(c) {
  if (conocido(c)) {
    const n = (estado.visitados[c].medios || []).length;
    if (n && !(await confirmar(`¿Quitar ${NOMBRES[c]}? Se borrarán también sus ${n} recuerdos.`))) return;
    for (const m of estado.visitados[c].medios || []) await DB.borrarMedio(m.id);
    delete estado.visitados[c];
  }
  else estado.visitados[c] = { fecha: hoyLocal(), medios: [] };
  estado.cambiosSinCopia++;
  await guardarEstado();
  pintarTodo();
}

// ---------- 2. Mapa ----------
const svg = document.getElementById("mapa");
const gMunis = document.getElementById("g-munis");
const gRios = document.getElementById("g-rios");
const gEtiq = document.getElementById("g-etiquetas");
let proyectar, vista, vistaInicial;
let seleccionado = null;

// Convierte longitud/latitud en puntos x/y de la pantalla
function crearProyeccion(features) {
  let minX = 999, minY = 999, maxX = -999, maxY = -999;
  const recorrer = (coords) => {
    if (typeof coords[0] === "number") {
      minX = Math.min(minX, coords[0]); maxX = Math.max(maxX, coords[0]);
      minY = Math.min(minY, coords[1]); maxY = Math.max(maxY, coords[1]);
    } else coords.forEach(recorrer);
  };
  features.forEach(f => recorrer(f.geometry.coordinates));
  const kx = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  const S = 1000 / (maxY - minY);
  proyectar = ([lon, lat]) => [((lon - minX) * kx * S), ((maxY - lat) * S)];
  vistaInicial = { x: -30, y: -30, w: (maxX - minX) * kx * S + 60, h: 1060 };
  vista = { ...vistaInicial };
}

function anillo(ring) {
  return "M" + ring.map(p => proyectar(p).map(n => n.toFixed(1)).join(",")).join("L") + "Z";
}
function trazo(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  return polys.map(p => p.map(anillo).join("")).join("");
}

async function dibujarMapa() {
  const geo = await fetch("antioquia.json").then(r => r.json());
  crearProyeccion(geo.features);
  const ns = "http://www.w3.org/2000/svg";
  geo.features.forEach(f => {
    const c = f.properties.c;
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", trazo(f.geometry));
    p.dataset.c = c;
    p.style.setProperty("--color", SUBREGION_DE[c].color);
    gMunis.appendChild(p);
  });
  // Ríos (© colaboradores de OpenStreetMap)
  try {
    const rios = await fetch("rios.json").then(r => r.json());
    Object.entries(rios).forEach(([nombre, lineas]) => {
      lineas.forEach(l => {
        if (l.length < 2) return;
        const p = document.createElementNS(ns, "path");
        p.setAttribute("d", "M" + l.map(pt => proyectar(pt).map(n => n.toFixed(1)).join(",")).join("L"));
        const grande = ["Cauca", "Magdalena", "Atrato"].includes(nombre);
        p.setAttribute("class", grande ? "rio rio-grande" : "rio");
        gRios.appendChild(p);
      });
    });
  } catch (e) { console.warn("Sin ríos", e); }
  aplicarVista();
  activarGestos();
}

function aplicarVista() {
  svg.setAttribute("viewBox", `${vista.x} ${vista.y} ${vista.w} ${vista.h}`);
  // Grosor de líneas y letras constante aunque hagas zoom
  const escala = vista.w / svg.clientWidth;
  svg.style.setProperty("--k", escala);
}

// Gestos: arrastrar para mover, pellizcar (dos dedos) para zoom, tocar para elegir
function activarGestos() {
  const dedos = new Map();
  let inicio = null, movido = 0, distAnterior = 0;

  const aPunto = (e) => {
    const r = svg.getBoundingClientRect();
    return { x: vista.x + (e.clientX - r.left) / r.width * vista.w,
             y: vista.y + (e.clientY - r.top) / r.height * vista.h };
  };
  const zoom = (factor, centro) => {
    const nw = Math.min(vistaInicial.w * 1.3, Math.max(vistaInicial.w / 14, vista.w * factor));
    const f = nw / vista.w;
    vista.x = centro.x - (centro.x - vista.x) * f;
    vista.y = centro.y - (centro.y - vista.y) * f;
    vista.w *= f; vista.h *= f;
    aplicarVista();
  };

  svg.addEventListener("pointerdown", e => {
    svg.setPointerCapture(e.pointerId);
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.size === 1) { inicio = { x: e.clientX, y: e.clientY, t: Date.now() }; movido = 0; }
    if (dedos.size === 2) { const [a, b] = [...dedos.values()]; distAnterior = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  svg.addEventListener("pointermove", e => {
    if (!dedos.has(e.pointerId)) return;
    const antes = dedos.get(e.pointerId);
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.size === 1) {
      const r = svg.getBoundingClientRect();
      const dx = e.clientX - antes.x, dy = e.clientY - antes.y;
      movido += Math.abs(dx) + Math.abs(dy);
      vista.x -= dx / r.width * vista.w;
      vista.y -= dy / r.height * vista.h;
      aplicarVista();
    } else if (dedos.size === 2) {
      movido += 99;
      const [a, b] = [...dedos.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (distAnterior > 0) zoom(distAnterior / d, aPunto({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }));
      distAnterior = d;
    }
  });
  const soltar = e => {
    if (dedos.size === 1 && inicio && movido < 10 && Date.now() - inicio.t < 500) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.dataset && el.dataset.c) seleccionar(el.dataset.c);
      else seleccionar(null);
    }
    dedos.delete(e.pointerId);
    if (dedos.size < 2) distAnterior = 0;
  };
  svg.addEventListener("pointerup", soltar);
  svg.addEventListener("pointercancel", e => { dedos.delete(e.pointerId); });
  svg.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 0.87, aPunto(e)); }, { passive: false });

  document.getElementById("zoom-mas").onclick = () => zoom(0.7, { x: vista.x + vista.w / 2, y: vista.y + vista.h / 2 });
  document.getElementById("zoom-menos").onclick = () => zoom(1.4, { x: vista.x + vista.w / 2, y: vista.y + vista.h / 2 });
  document.getElementById("zoom-reset").onclick = () => { vista = { ...vistaInicial }; aplicarVista(); };
  window.addEventListener("resize", aplicarVista);
}

// Centra el mapa en un municipio (desde la lista)
function irA(c) {
  const p = gMunis.querySelector(`[data-c="${c}"]`);
  if (!p) return;
  const b = p.getBBox();
  const w = Math.max(b.width, b.height) * 4;
  const prop = svg.clientHeight / svg.clientWidth || 1;
  vista = { x: b.x + b.width / 2 - w / 2, y: b.y + b.height / 2 - (w * prop) / 2, w, h: w * prop };
  aplicarVista();
}

// ---------- 3. Ficha del municipio (abajo) ----------
const ficha = document.getElementById("ficha");
function seleccionar(c) {
  seleccionado = c;
  gMunis.querySelectorAll(".sel").forEach(p => p.classList.remove("sel"));
  gEtiq.innerHTML = "";
  if (!c) { ficha.classList.remove("abierta"); return; }
  const p = gMunis.querySelector(`[data-c="${c}"]`);
  if (p) {
    p.classList.add("sel");
    p.parentNode.appendChild(p); // al frente
    const b = p.getBBox();
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", b.x + b.width / 2); t.setAttribute("y", b.y + b.height / 2);
    t.textContent = NOMBRES[c];
    gEtiq.appendChild(t);
  }
  pintarFicha();
  ficha.classList.add("abierta");
}
function pintarFicha() {
  const c = seleccionado; if (!c) return;
  const s = SUBREGION_DE[c];
  const v = estado.visitados[c];
  ficha.querySelector(".f-sub").textContent = s.nombre;
  ficha.querySelector(".f-sub").style.color = s.color;
  ficha.querySelector(".f-nombre").textContent = NOMBRES[c];
  ficha.querySelector(".f-fecha").textContent = v ? "Marcado el " + formatoFecha(v.fecha) : "Todavía no lo has marcado";
  const btn = ficha.querySelector(".f-btn");
  btn.textContent = v ? "Quitar de conocidos" : "✓ Lo conozco";
  btn.classList.toggle("quitar", !!v);
  if (window.pintarRecuerdos) pintarRecuerdos(c);
}
document.querySelector("#ficha .f-btn").onclick = () => seleccionado && alternar(seleccionado);
document.querySelector("#ficha .f-cerrar").onclick = () => seleccionar(null);

function formatoFecha(iso) {
  const [a, m, d] = iso.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${+d} ${meses[+m - 1]} ${a}`;
}

// ---------- 4. Lista ----------
const lista = document.getElementById("lista-contenido");
const buscador = document.getElementById("buscador");
const sinTildes = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function pintarLista() {
  const q = sinTildes(buscador.value.trim());
  lista.innerHTML = "";
  SUBREGIONES.forEach(s => {
    const cods = s.codigos.filter(c => !q || sinTildes(NOMBRES[c]).includes(q))
      .sort((a, b) => NOMBRES[a].localeCompare(NOMBRES[b], "es"));
    if (!cods.length) return;
    const hechos = s.codigos.filter(conocido).length;
    const sec = document.createElement("section");
    sec.style.setProperty("--color", s.color);
    sec.innerHTML = `<h3><span>${s.nombre}</span><small>${hechos} / ${s.codigos.length}</small></h3>
      <div class="barra"><i style="width:${hechos / s.codigos.length * 100}%"></i></div>`;
    cods.forEach(c => {
      const fila = document.createElement("label");
      fila.className = "fila" + (conocido(c) ? " hecho" : "");
      const nm = conocido(c) ? (estado.visitados[c].medios || []).length : 0;
      fila.innerHTML = `<input type="checkbox" ${conocido(c) ? "checked" : ""}><span class="nombre">${NOMBRES[c]}</span>
        ${nm ? `<span class="n-medios">📸 ${nm}</span>` : ""}<button class="ver" title="Ver en el mapa">📍</button>`;
      fila.querySelector("input").onchange = () => alternar(c);
      fila.querySelector(".ver").onclick = (e) => { e.preventDefault(); cambiarPestana("mapa"); irA(c); seleccionar(c); };
      sec.appendChild(fila);
    });
    lista.appendChild(sec);
  });
}
buscador.addEventListener("input", pintarLista);

// ---------- 5. Contador y pintado general ----------
function pintarTodo() {
  const n = Object.keys(estado.visitados).length;
  document.getElementById("contador").innerHTML = `<b>${n}</b> / 1.122`;
  document.getElementById("etapa-n").textContent = `${n} / ${TOTAL_MUNICIPIOS}`;
  document.getElementById("progreso").style.width = (n / TOTAL_MUNICIPIOS * 100) + "%";
  gMunis.querySelectorAll("path").forEach(p => p.classList.toggle("conocido", conocido(p.dataset.c)));
  pintarLista();
  pintarFicha();
  document.getElementById("btn-copia").classList.toggle("pendiente", estado.cambiosSinCopia > 0);
  if (window.revisarLogros) revisarLogros();
}

// ---------- 6. Pestañas ----------
function cambiarPestana(nombre) {
  document.querySelectorAll(".vista").forEach(v => v.hidden = v.id !== "vista-" + nombre);
  document.querySelectorAll(".pestanas button").forEach(b => b.classList.toggle("activa", b.dataset.p === nombre));
  if (nombre === "mapa") aplicarVista();
}
document.querySelectorAll(".pestanas button").forEach(b => b.onclick = () => cambiarPestana(b.dataset.p));

// ---------- 7. Guardar copia ----------
const modal = document.getElementById("modal-copia");
document.getElementById("btn-copia").onclick = () => {
  document.getElementById("ultima-copia").textContent = estado.ultimaCopia
    ? "Última copia: " + formatoFecha(estado.ultimaCopia)
    : "Todavía no has guardado ninguna copia.";
  modal.showModal();
};
document.getElementById("cerrar-modal").onclick = () => modal.close();

document.getElementById("descargar-copia").onclick = async () => {
  const hoy = hoyLocal();
  aviso("Preparando copia…");
  const medios = {};
  for (const v of Object.values(estado.visitados)) for (const m of v.medios || []) {
    const b = await DB.medio(m.id);
    if (b) medios[m.id] = { tipo: b.type, datos: await aBase64(b) };
  }
  const datos = { app: "mi-antioquia", version: 2, fecha: hoy, visitados: estado.visitados, medios };
  const archivo = new File([JSON.stringify(datos)], `mision-1122-copia-${hoy}.json`, { type: "application/json" });
  // En el celular intentamos "Compartir" (guardar en Archivos / Drive); si no, descarga normal
  let hecho = false;
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: "Copia de Misión 1122" }); hecho = true; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  if (!hecho) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(archivo); a.download = archivo.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  estado.ultimaCopia = hoy; estado.cambiosSinCopia = 0;
  await guardarEstado(); pintarTodo(); modal.close();
  aviso("Copia guardada ✓");
};

document.getElementById("archivo-copia").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const datos = JSON.parse(await f.text());
    if (datos.app !== "mi-antioquia" || !datos.visitados) throw new Error("formato");
    aviso("Cargando copia…");
    for (const [id, m] of Object.entries(datos.medios || {})) await DB.guardarMedio(id, deBase64(m.datos, m.tipo));
    // Unimos: no se pierde nada de lo que ya tenías marcado
    for (const [c, v] of Object.entries(datos.visitados)) {
      if (!estado.visitados[c]) { estado.visitados[c] = v; continue; }
      const ya = new Set((estado.visitados[c].medios || []).map(m => m.id));
      estado.visitados[c].medios = (estado.visitados[c].medios || []).concat((v.medios || []).filter(m => !ya.has(m.id)));
    }
    await guardarEstado(); pintarTodo(); modal.close();
    aviso(`Copia cargada: ${Object.keys(estado.visitados).length} municipios`);
  } catch { aviso("Ese archivo no es una copia de Misión 1122"); }
};

function aBase64(blob) {
  return new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result.split(",")[1]); r.readAsDataURL(blob); });
}
function deBase64(b64, tipo) {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: tipo });
}

// Pregunta de sí / no con el estilo de la app
function confirmar(texto) {
  return new Promise(ok => {
    const d = document.getElementById("modal-confirmar");
    d.querySelector("p").textContent = texto;
    d.querySelector(".si").onclick = () => { d.close(); ok(true); };
    d.querySelector(".no").onclick = () => { d.close(); ok(false); };
    d.showModal();
  });
}

function aviso(texto) {
  const t = document.getElementById("aviso");
  t.textContent = texto; t.classList.add("visible");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("visible"), 2500);
}

// ---------- 8. Arranque ----------
(async function iniciar() {
  await cargarEstado();
  try { await dibujarMapa(); }
  catch (e) { document.getElementById("vista-mapa").insertAdjacentHTML("beforeend", `<p class="error">No se pudo cargar el mapa. Revisa tu conexión y vuelve a abrir la app.</p>`); }
  pintarTodo();
  document.body.classList.add("lista");
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
