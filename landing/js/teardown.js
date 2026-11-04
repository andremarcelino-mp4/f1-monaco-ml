/* Ferrari F1 23 setup map. Skill teardown: one explosion axis (Y, top first),
   assembled offset = 0 reconstructs the car, labels in a fixed column. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const S0 = {
  asa_dianteira: 50, asa_traseira: 50, dif_com_acel: 50, dif_sem_acel: 53,
  cambagem_diant: -2.5, cambagem_tras: -1.0, convergencia_diant: 0.05, convergencia_tras: 0.25,
  suspensao_diant: 41, suspensao_tras: 13, barra_diant: 7, barra_tras: 5,
  altura_diant: 32, altura_tras: 36, freio_balanco: 53, pneu_diant: 22.5, pneu_tras: 20.0
};
const S10 = {
  ...S0, asa_traseira: 47, dif_sem_acel: 50, convergencia_diant: 0.08, convergencia_tras: 0.20,
  suspensao_diant: 12, suspensao_tras: 7, barra_diant: 5, barra_tras: 2,
  altura_diant: 36, altura_tras: 42, freio_balanco: 54, pneu_diant: 22.2
};

/* consenso importancias.csv (média das seis colunas), % */
const PARTS = [
  { id: "dif", idx: "01", name: "Diferencial s/ acel.", key: "dif_sem_acel", pct: 26.0, unit: "%", extra: "dif. c/ acel. 0,5%",
    text: "Maior alavanca de acerto no consenso. S2 (80) foi o pior tratamento da Alfa. S10 baixa de 53 para 50." },
  { id: "chassis", idx: "02", name: "Chassis Ferrari", key: null, pct: 15.0, unit: "", extra: "indicador carro_ferrari",
    text: "Não é um parafuso: é o efeito de equipe com desempenho real ligado. Time Trial apagaria esses 15%." },
  { id: "toe", idx: "03", name: "Convergência", key: "convergencia_diant", pct: 3.4, unit: "°", extra: "dianteira no consenso; traseira 1,1%",
    text: "O Lasso valoriza a convergência dianteira; as árvores quase ignoram. Por isso o estudo usa seis rankings." },
  { id: "tyre", idx: "04", name: "Pneus / pressão", key: "pneu_tras", pct: 1.5, unit: "psi", extra: "idade do pneu 42,7% é contexto, não peça",
    text: "A idade do pneu domina o tempo, mas não se escolhe no setup da volta 1. A pressão traseira (S8) é o que o engenheiro mexe." },
  { id: "ride", idx: "05", name: "Altura / rake", key: "altura_tras", pct: 1.4, unit: "", extra: "altura dianteira 0,5%",
    text: "S7 inverte a altura (30/45). S10 sobe a dianteira para 36 e a traseira para 42." },
  { id: "fw", idx: "06", name: "Asa dianteira", key: "asa_dianteira", pct: 0.9, unit: "", extra: "",
    text: "Em Mônaco a asa dianteira quase não se mexe no desenho (fica em 50). Downforce de curva lenta, pouco sinal no MAE." },
  { id: "rw", idx: "07", name: "Asa traseira", key: "asa_traseira", pct: 0.5, unit: "", extra: "S9: 50 → 45; S10: 47",
    text: "Mônaco quase não tem reta. Tirar asa (S9) é um controle: o tempo não deveria cair por velocidade final." },
  { id: "bar", idx: "08", name: "Barras anti-rolagem", key: "barra_diant", pct: 0.3, unit: "", extra: "S5/S6 e S10 mais macias",
    text: "S5 e S6 isolam barra dianteira e traseira. S10 amolece as duas (5 e 2)." },
  { id: "susp", idx: "09", name: "Suspensão", key: "suspensao_diant", pct: 0.3, unit: "", extra: "S0 41/13 → S10 12/7",
    text: "S10 mexe forte na suspensão. Isolada, a família quase não aparece no consenso." },
  { id: "brake", idx: "10", name: "Balanço de freio", key: "freio_balanco", pct: 0.5, unit: "%", extra: "S0 53 → S10 54",
    text: "Mônaco é frenagem. Mesmo assim o balanço quase não explica o tempo entre sessões." },
  { id: "pu", idx: "11", name: "Unidade de potência", key: null, pct: 0, unit: "", extra: "fora do desenho",
    text: "Motor, turbo e ERS não foram fatores. Cinza de propósito: não é um teardown de F1 2026." }
];

function tint(pct, gray) {
  if (gray) return 0x4a4a52;
  const t = Math.min(1, pct / 26);
  const r = Math.round(80 + 145 * t);
  const g = Math.round(20 + 10 * (1 - t));
  const b = Math.round(24 * (1 - t));
  return (r << 16) | (g << 8) | b;
}

function mat(pct, gray) {
  return new THREE.MeshStandardMaterial({
    color: tint(pct, gray), metalness: gray ? 0.55 : 0.28, roughness: gray ? 0.42 : 0.48
  });
}

const canvas = document.getElementById("tdCanvas");
if (!canvas) { /* landing without garage */ } else {

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x0a0a0c, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
camera.position.set(4.8, 2.6, 5.4);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0.35, 0);
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 4;
controls.maxDistance = 12;

scene.add(new THREE.HemisphereLight(0xc8c8d4, 0x1a1a1f, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 1.35);
key.position.set(4, 8, 3);
scene.add(key);
const rim = new THREE.DirectionalLight(0xff6a60, 0.35);
rim.position.set(-5, 2, -4);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(7, 48),
  new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 1, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.02;
scene.add(floor);

const car = new THREE.Group();
scene.add(car);
const pick = [];

function addPart(id, mesh, rest, explode) {
  mesh.position.copy(rest);
  mesh.userData = { id, rest: rest.clone(), explode: explode.clone() };
  mesh.castShadow = false;
  car.add(mesh);
  pick.push(mesh);
  return mesh;
}

function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }

const mCh = mat(15, false);
const mDif = mat(26, false);
const mToe = mat(3.4, false);
const mTy = mat(1.5, false);
const mRide = mat(1.4, false);
const mFw = mat(0.9, false);
const mRw = mat(0.5, false);
const mBar = mat(0.3, false);
const mSu = mat(0.3, false);
const mBr = mat(0.5, false);
const mPu = mat(0, true);
const mBlk = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.7, metalness: 0.2 });
const mHalo = new THREE.MeshStandardMaterial({ color: 0xc9c9ce, metalness: 0.8, roughness: 0.25 });

/* chassis */
addPart("chassis", box(1.15, 0.22, 2.35, mCh), new THREE.Vector3(0, 0.38, 0.05), new THREE.Vector3(0, 0.15, 0));
const nose = box(0.22, 0.12, 0.85, mCh);
addPart("chassis", nose, new THREE.Vector3(0, 0.32, 1.45), new THREE.Vector3(0, 0.55, 0.15));
const cockpit = box(0.42, 0.28, 0.55, mBlk);
addPart("chassis", cockpit, new THREE.Vector3(0, 0.58, 0.15), new THREE.Vector3(0, 0.85, 0));
const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 20, Math.PI), mHalo);
halo.rotation.x = Math.PI / 2;
addPart("chassis", halo, new THREE.Vector3(0, 0.78, 0.28), new THREE.Vector3(0, 1.15, 0));

/* floor / ride height */
addPart("ride", box(1.35, 0.04, 2.5, mRide), new THREE.Vector3(0, 0.18, 0.05), new THREE.Vector3(0, -0.35, 0));

/* wings */
const fw = box(1.55, 0.05, 0.28, mFw);
addPart("fw", fw, new THREE.Vector3(0, 0.22, 1.85), new THREE.Vector3(0, 0.95, 0.55));
const rw = box(0.95, 0.42, 0.08, mRw);
addPart("rw", rw, new THREE.Vector3(0, 0.72, -1.22), new THREE.Vector3(0, 1.35, -0.55));
addPart("rw", box(0.08, 0.42, 0.28, mRw), new THREE.Vector3(-0.44, 0.52, -1.18), new THREE.Vector3(-0.15, 1.2, -0.45));
addPart("rw", box(0.08, 0.42, 0.28, mRw), new THREE.Vector3(0.44, 0.52, -1.18), new THREE.Vector3(0.15, 1.2, -0.45));

/* PU (not in experiment) */
addPart("pu", box(0.55, 0.32, 0.7, mPu), new THREE.Vector3(0, 0.48, -0.45), new THREE.Vector3(0, 0.55, -0.15));

/* differential */
addPart("dif", box(0.48, 0.22, 0.38, mDif), new THREE.Vector3(0, 0.32, -0.95), new THREE.Vector3(0, 0.25, -0.85));

/* bars */
addPart("bar", box(1.05, 0.04, 0.04, mBar), new THREE.Vector3(0, 0.28, 0.85), new THREE.Vector3(0, -0.15, 0.35));
addPart("bar", box(1.05, 0.04, 0.04, mBar), new THREE.Vector3(0, 0.28, -0.7), new THREE.Vector3(0, -0.15, -0.35));

/* suspension arms */
[[-0.55, 0.95, 1], [0.55, 0.95, -1], [-0.55, -0.85, 1], [0.55, -0.85, -1]].forEach(([x, z, s]) => {
  const arm = box(0.55, 0.04, 0.04, mSu);
  addPart("susp", arm, new THREE.Vector3(x * 0.55, 0.26, z), new THREE.Vector3(s * 0.55, -0.05, z * 0.12));
});

/* brakes */
[[-0.72, 0.95], [0.72, 0.95], [-0.78, -0.88], [0.78, -0.88]].forEach(([x, z]) => {
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 16), mBr);
  disc.rotation.z = Math.PI / 2;
  addPart("brake", disc, new THREE.Vector3(x, 0.22, z), new THREE.Vector3(x * 1.35, 0.05, z * 1.08));
});

/* wheels + toe (front) / tyres */
function wheel(x, z, id, m, ex) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 22), m);
  tire.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.17, 16), mBlk);
  rim.rotation.z = Math.PI / 2;
  g.add(tire, rim);
  addPart(id, g, new THREE.Vector3(x, 0.24, z), ex);
}
wheel(-0.78, 0.95, "toe", mToe, new THREE.Vector3(-1.15, 0.05, 0.85));
wheel(0.78, 0.95, "toe", mToe, new THREE.Vector3(1.15, 0.05, 0.85));
wheel(-0.82, -0.88, "tyre", mTy, new THREE.Vector3(-1.25, 0.02, -0.95));
wheel(0.82, -0.88, "tyre", mTy, new THREE.Vector3(1.25, 0.02, -0.95));

function size() {
  const w = canvas.clientWidth || canvas.parentElement.clientWidth;
  const h = canvas.clientHeight || 520;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
size();
addEventListener("resize", size);

let explode = 0.72;
const slider = document.getElementById("tdExplode");
if (slider) slider.addEventListener("input", () => { explode = +slider.value / 100; });

function applyExplode() {
  car.traverse(obj => {
    if (!obj.userData || !obj.userData.rest) return;
    obj.position.copy(obj.userData.rest).addScaledVector(obj.userData.explode, explode);
  });
}

let selected = "dif";
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();

function show(id) {
  selected = id;
  const p = PARTS.find(x => x.id === id) || PARTS[0];
  const nome = document.getElementById("tdNome");
  const spec = document.getElementById("tdSpec");
  const texto = document.getElementById("tdTexto");
  const index = document.getElementById("tdIndex");
  if (index) index.textContent = p.idx;
  if (nome) nome.textContent = p.name;
  const s0 = p.key != null ? S0[p.key] : "—";
  const s10 = p.key != null ? S10[p.key] : "—";
  if (spec) spec.textContent = p.pct
    ? `consenso ${String(p.pct).replace(".", ",")}% · S0 ${s0} → S10 ${s10}${p.extra ? " · " + p.extra : ""}`
    : p.extra;
  if (texto) texto.textContent = p.text;
  document.querySelectorAll("#tdList li").forEach(li => li.classList.toggle("on", li.dataset.id === id));
  pick.forEach(m => {
    const on = m.userData.id === id;
    if (m.material && m.material.emissive) m.material.emissive.setHex(on ? 0x3a0a08 : 0x000000);
    if (m.type === "Group") m.traverse(ch => {
      if (ch.material && ch.material.emissive) ch.material.emissive.setHex(on ? 0x3a0a08 : 0x000000);
    });
  });
}

function list() {
  const ol = document.getElementById("tdList");
  if (!ol) return;
  ol.innerHTML = PARTS.map(p =>
    `<li data-id="${p.id}"><span class="idx">${p.idx}</span><span>${p.name}</span><span class="idx">${p.pct ? p.pct.toFixed(1) + "%" : "—"}</span></li>`
  ).join("");
  ol.onclick = e => {
    const li = e.target.closest("li");
    if (li) show(li.dataset.id);
  };
}

canvas.addEventListener("pointerdown", e => {
  const r = canvas.getBoundingClientRect();
  ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(pick, true)[0];
  if (!hit) return;
  let o = hit.object;
  while (o && !o.userData.id) o = o.parent;
  if (o && o.userData.id) show(o.userData.id);
});

list();
show("dif");

function tick() {
  applyExplode();
  car.rotation.y += 0.0012;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
}
