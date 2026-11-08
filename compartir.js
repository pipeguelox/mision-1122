// =========================================================
//  Misión 1122 — Imagen para compartir en historias (1080 x 1920)
// =========================================================
const ANCHO = 1080, ALTO = 1920;
let fondoElegido = "negro";   // "negro" o el id de una foto
let geoCompartir = null, riosCompartir = null;

async function datosMapa() {
  if (!geoCompartir) geoCompartir = await fetch("antioquia.json").then(r => r.json());
  if (!riosCompartir) riosCompartir = await fetch("rios.json").then(r => r.json()).catch(() => ({}));
}

function cargarImagen(src) {
  return new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src; });
}

// Convierte una insignia (SVG) en imagen para pintarla en el lienzo
async function insigniaImagen(id, color) {
  const svg = insigniaSVG(id, color, true).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" ')
    .replace('class="aro"', `fill="#1a1a1a" stroke="${color}" stroke-width="4"`);
  return cargarImagen("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
}

async function crearImagenHistoria() {
  await datosMapa();
  await document.fonts.load("800 100px Outfit").catch(() => {});
  const cv = document.createElement("canvas");
  cv.width = ANCHO; cv.height = ALTO;
  const x = cv.getContext("2d");

  // ---- Fondo
  x.fillStyle = "#000"; x.fillRect(0, 0, ANCHO, ALTO);
  const foto = fondoElegido !== "negro" && await DB.medio(fondoElegido);
  if (foto) {
    const img = await cargarImagen(URL.createObjectURL(foto));
    const k = Math.max(ANCHO / img.width, ALTO / img.height);
    x.filter = "blur(6px) saturate(1.2)";
    x.drawImage(img, (ANCHO - img.width * k) / 2, (ALTO - img.height * k) / 2, img.width * k, img.height * k);
    x.filter = "none";
    const os = x.createLinearGradient(0, 0, 0, ALTO);
    os.addColorStop(0, "rgba(0,0,0,.55)"); os.addColorStop(.45, "rgba(0,0,0,.35)"); os.addColorStop(1, "rgba(0,0,0,.9)");
    x.fillStyle = os; x.fillRect(0, 0, ANCHO, ALTO);
  } else {
    const rg = x.createRadialGradient(ANCHO / 2, 820, 60, ANCHO / 2, 820, 1100);
    rg.addColorStop(0, "#3a0b08"); rg.addColorStop(.5, "#120303"); rg.addColorStop(1, "#000");
    x.fillStyle = rg; x.fillRect(0, 0, ANCHO, ALTO);
    // grano sutil para que no se vea plano
    for (let i = 0; i < 9000; i++) {
      x.fillStyle = `rgba(255,255,255,${Math.random() * .05})`;
      x.fillRect(Math.random() * ANCHO, Math.random() * ALTO, 2, 2);
    }
  }

  // ---- Encabezado
  x.textAlign = "left"; x.textBaseline = "alphabetic";
  x.font = "800 64px Outfit, sans-serif";
  x.fillStyle = "#ff3b30"; x.fillText("Misión", 80, 170);
  const anchoMision = x.measureText("Misión ").width;
  x.fillStyle = "#fff"; x.fillText("1122", 80 + anchoMision, 170);
  x.font = "600 34px Outfit, sans-serif"; x.fillStyle = "rgba(255,255,255,.7)";
  x.fillText("ANTIOQUIA", 82, 222);

  // ---- Mapa
  const feats = geoCompartir.features;
  let minX = 999, minY = 999, maxX = -999, maxY = -999;
  const rec = c => { if (typeof c[0] === "number") { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); } else c.forEach(rec); };
  feats.forEach(f => rec(f.geometry.coordinates));
  const kx = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  const cajaW = 900, cajaH = 960, top = 290;
  const s = Math.min(cajaW / ((maxX - minX) * kx), cajaH / (maxY - minY));
  const ox = (ANCHO - (maxX - minX) * kx * s) / 2, oy = top + (cajaH - (maxY - minY) * s) / 2;
  const P = ([lon, lat]) => [ox + (lon - minX) * kx * s, oy + (maxY - lat) * s];
  const trazar = f => {
    const p = new Path2D();
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach(pl => pl.forEach(r => { r.forEach((pt, i) => { const [X, Y] = P(pt); i ? p.lineTo(X, Y) : p.moveTo(X, Y); }); p.closePath(); }));
    return p;
  };
  const caminos = feats.map(f => ({ c: f.properties.c, p: trazar(f) }));
  // sombra general
  x.save(); x.shadowColor = "rgba(0,0,0,.8)"; x.shadowBlur = 40; x.shadowOffsetY = 18;
  x.fillStyle = "#151515"; caminos.forEach(m => x.fill(m.p)); x.restore();
  // municipios sin conocer
  caminos.forEach(m => { if (!conocido(m.c)) { x.fillStyle = "#1e1e1e"; x.fill(m.p); } });
  // municipios conocidos, con brillo de su color
  caminos.forEach(m => {
    if (!conocido(m.c)) return;
    const col = SUBREGION_DE[m.c].color;
    x.save(); x.shadowColor = col; x.shadowBlur = 28; x.fillStyle = col; x.fill(m.p); x.restore();
  });
  // volumen: luz arriba
  x.save();
  const luz = x.createLinearGradient(0, top, 0, top + cajaH);
  luz.addColorStop(0, "rgba(255,255,255,.18)"); luz.addColorStop(.5, "rgba(255,255,255,0)"); luz.addColorStop(1, "rgba(0,0,0,.25)");
  caminos.forEach(m => { x.fillStyle = luz; x.fill(m.p); });
  x.restore();
  x.strokeStyle = "rgba(0,0,0,.85)"; x.lineWidth = 1.6; x.lineJoin = "round";
  caminos.forEach(m => x.stroke(m.p));
  // ríos
  x.strokeStyle = "rgba(80,170,255,.75)"; x.lineCap = "round";
  Object.entries(riosCompartir).forEach(([n, ls]) => {
    x.lineWidth = ["Cauca", "Magdalena", "Atrato"].includes(n) ? 4 : 2;
    ls.forEach(l => { x.beginPath(); l.forEach((pt, i) => { const [X, Y] = P(pt); i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke(); });
  });

  // ---- Números
  const n = Object.keys(estado.visitados).length;
  const pct = Math.round(n / TOTAL_MUNICIPIOS * 100);
  const yNum = 1440;
  x.textAlign = "left";
  x.font = "800 190px Outfit, sans-serif";
  const gn = x.createLinearGradient(0, yNum - 170, 0, yNum);
  gn.addColorStop(0, "#ff6a5f"); gn.addColorStop(1, "#d81f14");
  x.save(); x.shadowColor = "rgba(255,59,48,.6)"; x.shadowBlur = 40; x.fillStyle = gn; x.fillText(String(n), 80, yNum); x.restore();
  const anchoN = x.measureText(String(n)).width;
  x.font = "600 54px Outfit, sans-serif"; x.fillStyle = "#fff";
  x.fillText(`/ ${TOTAL_MUNICIPIOS}`, 80 + anchoN + 18, yNum - 8);
  x.font = "600 40px Outfit, sans-serif"; x.fillStyle = "rgba(255,255,255,.75)";
  x.fillText("municipios de Antioquia", 82, yNum + 60);
  // porcentaje a la derecha
  x.textAlign = "right"; x.font = "800 96px Outfit, sans-serif"; x.fillStyle = "#fff";
  x.fillText(pct + "%", ANCHO - 80, yNum - 10);
  // barra
  const yb = yNum + 100;
  x.fillStyle = "rgba(255,255,255,.12)"; redondo(x, 80, yb, ANCHO - 160, 18, 9); x.fill();
  const gb = x.createLinearGradient(80, 0, ANCHO - 80, 0); gb.addColorStop(0, "#ff8a00"); gb.addColorStop(1, "#ff3b30");
  x.fillStyle = gb; redondo(x, 80, yb, Math.max(18, (ANCHO - 160) * n / TOTAL_MUNICIPIOS), 18, 9); x.fill();

  // ---- Insignias ganadas
  const ganadas = estadoLogros().filter(l => estado.logros && estado.logros[l.id]);
  const nRec = Object.values(estado.visitados).reduce((a, v) => a + (v.medios || []).length, 0);
  x.textAlign = "left"; x.font = "600 34px Outfit, sans-serif"; x.fillStyle = "rgba(255,255,255,.75)";
  const yI = yb + 90;
  x.fillText(`🏅 ${ganadas.length} insignias   ·   📸 ${nRec} recuerdos`, 82, yI);
  let xi = 80;
  for (const l of ganadas.slice(0, 9)) {
    const im = await insigniaImagen(l.id, l.color);
    x.save(); x.shadowColor = l.color; x.shadowBlur = 20; x.drawImage(im, xi, yI + 24, 92, 92); x.restore();
    xi += 104;
  }

  // ---- Pie
  x.textAlign = "center"; x.font = "600 30px Outfit, sans-serif"; x.fillStyle = "rgba(255,255,255,.55)";
  x.fillText("pipeguelox.github.io/mision-1122", ANCHO / 2, ALTO - 70);
  return cv;
}

function redondo(x, X, Y, W, H, R) {
  x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R);
  x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath();
}

// ---------- Ventana de compartir ----------
const modalCompartir = document.getElementById("modal-compartir");
let imagenActual = null;

async function abrirCompartir() {
  pintarFondos();
  modalCompartir.showModal();
  await actualizarVistaPrevia();
}
async function actualizarVistaPrevia() {
  const prev = document.getElementById("comp-previa");
  prev.style.opacity = .4;
  const cv = await crearImagenHistoria();
  imagenActual = await new Promise(r => cv.toBlob(r, "image/png"));
  prev.src = URL.createObjectURL(imagenActual);
  prev.style.opacity = 1;
}
async function pintarFondos() {
  const cont = document.getElementById("comp-fondos");
  const fotos = [];
  Object.values(estado.visitados).forEach(v => (v.medios || []).forEach(m => { if (m.tipo === "foto") fotos.push(m); }));
  cont.innerHTML = `<button data-f="negro" class="${fondoElegido === "negro" ? "activo" : ""}">Negro</button>`;
  for (const m of fotos.slice(-12).reverse()) {
    const b = await DB.medio(m.id); if (!b) continue;
    const bt = document.createElement("button");
    bt.dataset.f = m.id; bt.className = fondoElegido === m.id ? "activo" : "";
    bt.style.backgroundImage = `url(${URL.createObjectURL(b)})`;
    cont.appendChild(bt);
  }
  cont.querySelectorAll("button").forEach(b => b.onclick = () => {
    fondoElegido = b.dataset.f;
    cont.querySelectorAll("button").forEach(o => o.classList.toggle("activo", o === b));
    actualizarVistaPrevia();
  });
}

document.getElementById("comp-compartir").onclick = async () => {
  if (!imagenActual) return;
  const archivo = new File([imagenActual], `mision-1122-${hoyLocal()}.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo] }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(archivo); a.download = archivo.name;
  document.body.appendChild(a); a.click(); a.remove();
  aviso("Imagen descargada ✓");
};
document.getElementById("comp-cerrar").onclick = () => modalCompartir.close();
document.querySelectorAll(".btn-compartir").forEach(b => b.onclick = abrirCompartir);
