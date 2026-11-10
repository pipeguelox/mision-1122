// =========================================================
//  M1122 — Logros: insignias por departamento y por subregión de Antioquia
// =========================================================
const LOGRO_TOTAL = { id: "antioquia", nombre: "Antioquia", color: "#FFC83D" };
const LOGRO_COLOMBIA = { id: "colombia", nombre: "Colombia completa", color: "#FFC83D" };
let siluetas = {};   // dibujo (SVG) de cada departamento y subregión

function siluetaDe(feats) {
  let minX = 999, minY = 999, maxX = -999, maxY = -999;
  const rec = c => { if (typeof c[0] === "number") { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); } else c.forEach(rec); };
  feats.forEach(f => rec(f.geometry.coordinates));
  const kx = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  const w = (maxX - minX) * kx, h = maxY - minY, s = 86 / Math.max(w, h);
  const ox = (100 - w * s) / 2, oy = (100 - h * s) / 2;
  const P = ([lon, lat]) => (ox + (lon - minX) * kx * s).toFixed(1) + "," + (oy + (maxY - lat) * s).toFixed(1);
  return feats.map(f => {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    return polys.map(p => p.map(r => "M" + r.map(P).join("L") + "Z").join("")).join("");
  }).join("");
}

// Dibuja la silueta de cada grupo de municipios dentro de un cuadro de 100 x 100
async function prepararSiluetas() {
  const ant = await fetch("antioquia.json").then(r => r.json());
  SUBREGIONES.forEach(s => siluetas[s.id] = siluetaDe(ant.features.filter(f => SUBREGION_DE[f.properties.c] === s)));
  siluetas[LOGRO_TOTAL.id] = siluetaDe(ant.features);
  const col = await fetch("colombia.json").then(r => r.json());
  DEPARTAMENTOS.forEach(d => { if (d.id !== "05") siluetas["d" + d.id] = siluetaDe(col.features.filter(f => f.properties.d === d.id)); });
  siluetas[LOGRO_COLOMBIA.id] = siluetaDe(col.features.filter(f => f.properties.d !== "88"));
}

function insigniaSVG(id, color, ganada) {
  const relleno = ganada ? color : "#4a4a4a";
  return `<svg viewBox="0 0 100 100" class="insignia ${ganada ? "ganada" : ""}" style="--c:${color}">
    <circle cx="50" cy="50" r="48" class="aro"/>
    <path d="${siluetas[id] || ""}" fill="${relleno}" stroke="${relleno}" stroke-width=".6" stroke-linejoin="round" transform="translate(50 50) scale(.72) translate(-50 -50)"/>
  </svg>`;
}

// Todas las insignias, con su avance
function estadoLogros() {
  const cuenta = cods => cods.filter(conocido).length;
  const lista = [];
  lista.push({ ...LOGRO_COLOMBIA, seccion: "colombia", especial: true, hechos: Object.keys(estado.visitados).length, total: 1122 });
  DEPARTAMENTOS.forEach(d => {
    if (d.id === "05") lista.push({ ...LOGRO_TOTAL, seccion: "colombia", hechos: cuenta(d.codigos), total: d.codigos.length });
    else lista.push({ id: "d" + d.id, nombre: d.nombre, color: d.color, seccion: "colombia", hechos: cuenta(d.codigos), total: d.codigos.length });
  });
  SUBREGIONES.forEach(s => lista.push({ id: s.id, nombre: s.nombre, color: s.color, seccion: "antioquia", hechos: cuenta(s.codigos), total: s.codigos.length }));
  return lista;
}

// Revisa si se ganó (o se perdió) alguna insignia y celebra las nuevas
let logrosListos = false;
async function revisarLogros() {
  if (!logrosListos) return;
  const primeraVez = !estado.logros || !estado.logrosV2;
  estado.logros = estado.logros || {};
  estado.logrosV2 = true;
  const nuevas = [];
  for (const l of estadoLogros()) {
    const completa = l.hechos === l.total;
    if (completa && !estado.logros[l.id]) { estado.logros[l.id] = hoyLocal(); if (!primeraVez) nuevas.push(l); }
    if (!completa && estado.logros[l.id]) delete estado.logros[l.id];
  }
  await guardarEstado();
  pintarLogros();
  for (const l of nuevas) await celebrar(l);
}

function tarjeta(l) {
  const fecha = estado.logros && estado.logros[l.id];
  return `<div class="logro ${fecha ? "ganado" : ""} ${l.especial ? "especial" : ""}">
    ${insigniaSVG(l.id, l.color, !!fecha)}
    <div class="l-nombre">${l.nombre}</div>
    <div class="l-estado">${fecha ? "🏅 " + formatoFecha(fecha) : `🔒 ${l.hechos} / ${l.total}`}</div>
    ${fecha ? "" : `<div class="barra"><i style="width:${l.hechos / l.total * 100}%;background:${l.color}"></i></div>`}
  </div>`;
}

function pintarLogros() {
  const cont = document.getElementById("logros-contenido");
  if (!cont) return;
  const lista = estadoLogros();
  const ganadas = lista.filter(l => estado.logros && estado.logros[l.id]).length;
  document.getElementById("logros-resumen").textContent = `${ganadas} de ${lista.length} insignias`;
  // Primero las ganadas, después las que van más avanzadas
  const g = id => !!(estado.logros || {})[id];
  const ordenar = arr => arr.slice().sort((a, b) => (g(b.id) - g(a.id)) || (b.hechos / b.total - a.hechos / a.total));
  const col = lista.filter(l => l.seccion === "colombia");
  const ant = lista.filter(l => l.seccion === "antioquia");
  cont.innerHTML =
    `<h3 class="l-seccion">Departamentos</h3><div class="l-grilla">${tarjeta(col[0])}${ordenar(col.slice(1)).map(tarjeta).join("")}</div>
     <h3 class="l-seccion">Subregiones de Antioquia</h3><div class="l-grilla">${ordenar(ant).map(tarjeta).join("")}</div>`;
}

// ---------- Celebración ----------
function celebrar(l) {
  return new Promise(ok => {
    const capa = document.getElementById("celebracion");
    capa.style.setProperty("--c", l.color);
    capa.querySelector(".c-insignia").innerHTML = insigniaSVG(l.id, l.color, true);
    capa.querySelector(".c-titulo").textContent = l.id === LOGRO_COLOMBIA.id ? "¡Conoces toda Colombia!" : `¡Completaste ${l.nombre}!`;
    capa.querySelector(".c-texto").textContent = `${l.total} municipios conocidos`;
    capa.classList.add("visible");
    try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch {}
    confeti(l.color);
    capa.querySelector(".c-btn").onclick = () => { capa.classList.remove("visible"); ok(); };
  });
}

function confeti(color) {
  const cv = document.getElementById("confeti");
  const ctx = cv.getContext("2d");
  const dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  const colores = [color, "#ff3b30", "#ffffff", "#FFC83D"];
  const piezas = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .4,
    vx: (Math.random() - .5) * 14, vy: -Math.random() * 16 - 4,
    r: Math.random() * 6 + 4, giro: Math.random() * 6, vg: (Math.random() - .5) * .4,
    c: colores[Math.floor(Math.random() * colores.length)]
  }));
  const inicio = performance.now();
  (function paso(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    piezas.forEach(p => {
      p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.giro += p.vg;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.giro);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    });
    if (t - inicio < 3500) requestAnimationFrame(paso); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(inicio);
}

// ---------- Arranque ----------
prepararSiluetas().then(() => { logrosListos = true; revisarLogros(); }).catch(e => console.warn("Logros", e));
