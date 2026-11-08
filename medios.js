// =========================================================
//  Misión 1122 — Recuerdos: fotos y clips de 3 segundos
// =========================================================
const MAX_LADO_FOTO = 1080;   // píxeles del lado más largo de la foto
const CALIDAD_FOTO = 0.72;    // 0 a 1: más alto = mejor y más pesado
const DURACION_CLIP = 3;      // segundos
const MAX_LADO_CLIP = 540;    // píxeles del lado más largo del clip
let urlsAbiertas = [];

// ---------- Fotos: reducir tamaño y peso ----------
async function comprimirFoto(archivo) {
  let img;
  try { img = await createImageBitmap(archivo, { imageOrientation: "from-image" }); }
  catch {
    img = new Image();
    img.src = URL.createObjectURL(archivo);
    await img.decode();
  }
  const k = Math.min(1, MAX_LADO_FOTO / Math.max(img.width, img.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  // WebP pesa menos; si el celular no lo soporta, usamos JPEG
  let blob = await new Promise(r => cv.toBlob(r, "image/webp", CALIDAD_FOTO));
  if (!blob || blob.type !== "image/webp") blob = await new Promise(r => cv.toBlob(r, "image/jpeg", CALIDAD_FOTO));
  return blob;
}

async function agregarMedio(c, blob, tipo) {
  if (!conocido(c)) estado.visitados[c] = { fecha: hoyLocal(), medios: [] };
  const v = estado.visitados[c];
  v.medios = v.medios || [];
  const id = c + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await DB.guardarMedio(id, blob);
  v.medios.push({ id, tipo, fecha: hoyLocal() });
  estado.cambiosSinCopia++;
  await guardarEstado();
  pintarTodo();
}

// ---------- Galería dentro de la ficha ----------
async function pintarRecuerdos(c) {
  const gal = document.querySelector("#ficha .f-galeria");
  urlsAbiertas.forEach(u => URL.revokeObjectURL(u)); urlsAbiertas = [];
  gal.innerHTML = "";
  const lista = (estado.visitados[c] && estado.visitados[c].medios) || [];
  for (const m of lista) {
    const blob = await DB.medio(m.id);
    if (!blob || seleccionado !== c) continue;
    const url = URL.createObjectURL(blob); urlsAbiertas.push(url);
    const el = m.tipo === "clip"
      ? Object.assign(document.createElement("video"), { src: url, muted: true, loop: true, autoplay: true, playsInline: true })
      : Object.assign(document.createElement("img"), { src: url, alt: "" });
    if (m.tipo === "clip") el.setAttribute("playsinline", "");
    el.onclick = () => abrirVisor(c, m, url);
    gal.appendChild(el);
  }
  gal.hidden = !gal.children.length;
}

document.getElementById("in-foto").onchange = async (e) => {
  const c = seleccionado; const archivos = [...e.target.files]; e.target.value = "";
  if (!c || !archivos.length) return;
  aviso(archivos.length > 1 ? `Guardando ${archivos.length} fotos…` : "Guardando foto…");
  for (const a of archivos) {
    try { await agregarMedio(c, await comprimirFoto(a), "foto"); }
    catch (err) { console.error(err); aviso("No se pudo leer esa foto"); }
  }
  aviso("Foto guardada ✓");
};

// ---------- Visor a pantalla completa ----------
function abrirVisor(c, m, url) {
  const v = document.getElementById("visor");
  const cont = v.querySelector(".v-medio");
  cont.innerHTML = m.tipo === "clip"
    ? `<video src="${url}" autoplay loop muted playsinline></video>`
    : `<img src="${url}" alt="">`;
  v.querySelector(".v-info").textContent = `${NOMBRES[c]} · ${formatoFecha(m.fecha)}`;
  v.querySelector(".v-borrar").onclick = async () => {
    if (!(await confirmar("¿Borrar este recuerdo?"))) return;
    const vis = estado.visitados[c];
    vis.medios = vis.medios.filter(x => x.id !== m.id);
    await DB.borrarMedio(m.id);
    estado.cambiosSinCopia++;
    await guardarEstado();
    v.close(); pintarTodo();
  };
  v.showModal();
}
document.querySelector("#visor .v-cerrar").onclick = () => document.getElementById("visor").close();

// ---------- Clips: escoger 3 segundos y convertir ----------
const editor = document.getElementById("modal-clip");
const vid = document.getElementById("clip-video");
const tira = document.getElementById("clip-tira");
const ventana = document.getElementById("clip-ventana");
let inicioClip = 0, urlVideo = null, duracionVideo = 0;

const esperar = (el, ev) => new Promise(ok => el.addEventListener(ev, ok, { once: true }));
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

document.getElementById("in-clip").onchange = async (e) => {
  const a = e.target.files[0]; e.target.value = "";
  if (!a || !seleccionado) return;
  if (urlVideo) URL.revokeObjectURL(urlVideo);
  urlVideo = URL.createObjectURL(a);
  vid.src = urlVideo; vid.muted = true;
  document.getElementById("clip-estado").textContent = "";
  document.getElementById("clip-usar").disabled = false;
  editor.showModal();
  await esperar(vid, "loadedmetadata");
  duracionVideo = vid.duration;
  inicioClip = 0;
  const anchoVentana = Math.min(1, DURACION_CLIP / duracionVideo);
  ventana.style.width = (anchoVentana * 100) + "%";
  ventana.hidden = duracionVideo <= DURACION_CLIP;
  moverVentana(0);
  await crearTira();
  vid.currentTime = 0;
  vid.play().catch(() => {});
};

// Miniaturas del video para la barra (como en Instagram)
async function crearTira() {
  tira.querySelectorAll("canvas").forEach(x => x.remove());
  const n = 8;
  try { await vid.play(); vid.pause(); } catch {}
  for (let i = 0; i < n; i++) {
    vid.currentTime = Math.min(duracionVideo - 0.05, (i + 0.5) * duracionVideo / n);
    await esperar(vid, "seeked");
    const cv = document.createElement("canvas");
    cv.width = 80; cv.height = 80 * vid.videoHeight / vid.videoWidth || 45;
    cv.getContext("2d").drawImage(vid, 0, 0, cv.width, cv.height);
    tira.insertBefore(cv, ventana);
  }
}

function moverVentana(t) {
  inicioClip = Math.max(0, Math.min(t, Math.max(0, duracionVideo - DURACION_CLIP)));
  ventana.style.left = (inicioClip / duracionVideo * 100) + "%";
  const fin = Math.min(duracionVideo, inicioClip + DURACION_CLIP);
  document.getElementById("clip-tiempo").textContent = `${mmss(inicioClip)} – ${mmss(fin)}`;
}

// Arrastrar el recuadro por la barra
(() => {
  let arrastrando = false;
  const desdeX = (x) => {
    const r = tira.getBoundingClientRect();
    const t = (x - r.left) / r.width * duracionVideo - DURACION_CLIP / 2;
    moverVentana(t);
    vid.currentTime = inicioClip;
  };
  tira.addEventListener("pointerdown", e => { arrastrando = true; tira.setPointerCapture(e.pointerId); desdeX(e.clientX); });
  tira.addEventListener("pointermove", e => { if (arrastrando) desdeX(e.clientX); });
  tira.addEventListener("pointerup", () => { arrastrando = false; vid.play().catch(() => {}); });
})();

// La vista previa repite solo el pedazo escogido
vid.addEventListener("timeupdate", () => {
  if (!grabando && vid.currentTime > inicioClip + DURACION_CLIP) vid.currentTime = inicioClip;
});

let grabando = false;
async function grabarClip() {
  const k = Math.min(1, MAX_LADO_CLIP / Math.max(vid.videoWidth, vid.videoHeight));
  const cv = document.createElement("canvas");
  cv.width = Math.round(vid.videoWidth * k / 2) * 2; cv.height = Math.round(vid.videoHeight * k / 2) * 2;
  const ctx = cv.getContext("2d");
  const tipos = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const mime = tipos.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if (!mime) throw new Error("Este celular no permite convertir video");
  const rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 1200000 });
  const partes = [];
  rec.ondataavailable = e => { if (e.data.size) partes.push(e.data); };

  grabando = true;
  vid.pause();
  vid.currentTime = inicioClip; await esperar(vid, "seeked");
  ctx.drawImage(vid, 0, 0, cv.width, cv.height);
  const fin = Math.min(duracionVideo, inicioClip + DURACION_CLIP);
  rec.start(200);
  await vid.play();
  await new Promise(ok => {
    const paso = () => {
      ctx.drawImage(vid, 0, 0, cv.width, cv.height);
      const p = Math.min(1, (vid.currentTime - inicioClip) / (fin - inicioClip));
      document.getElementById("clip-estado").textContent = `Convirtiendo… ${Math.round(p * 100)}%`;
      if (vid.currentTime >= fin || vid.ended) ok(); else requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
  vid.pause();
  const parado = esperar(rec, "stop"); rec.stop(); await parado;
  grabando = false;
  return new Blob(partes, { type: mime.split(";")[0] });
}

document.getElementById("clip-usar").onclick = async () => {
  const boton = document.getElementById("clip-usar");
  boton.disabled = true;
  try {
    const blob = await grabarClip();
    await agregarMedio(seleccionado, blob, "clip");
    editor.close();
    aviso(`Clip guardado ✓ (${Math.round(blob.size / 1024)} KB)`);
  } catch (err) {
    console.error(err);
    grabando = false;
    document.getElementById("clip-estado").textContent = "No se pudo convertir: " + err.message;
    boton.disabled = false;
  }
};
document.getElementById("clip-cancelar").onclick = () => { vid.pause(); editor.close(); };
editor.addEventListener("close", () => { vid.pause(); vid.removeAttribute("src"); vid.load(); });
