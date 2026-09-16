import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const canvas = document.querySelector('#simulador');
const loading = document.querySelector('#cargando');
const loadingMessage = document.querySelector('#mensaje-carga');
const loadingProgress = document.querySelector('#progreso-carga');
const status = document.querySelector('#estado');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#515854');
scene.fog = new THREE.Fog('#515854', 5, 13);

const camera = new THREE.PerspectiveCamera(42, 1, .01, 100);
camera.position.set(.68, .62, .86);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.08, 0);
controls.enableDamping = true;
controls.dampingFactor = .065;
controls.maxPolarAngle = Math.PI / 2.02;
controls.minDistance = .35;
controls.maxDistance = 8;

scene.add(new THREE.HemisphereLight('#dce5df', '#323834', 2.4));
const keyLight = new THREE.DirectionalLight('#fff5da', 3.2);
keyLight.position.set(-2.8, 4.4, 1.8);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -3;
keyLight.shadow.camera.right = 3;
keyLight.shadow.camera.top = 3;
keyLight.shadow.camera.bottom = -3;
scene.add(keyLight);

const texture = new THREE.TextureLoader().load('assets/pista-sistemas-embebidos.png');
texture.colorSpace = THREE.SRGBColorSpace;
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(4.8, 4.8),
  new THREE.MeshStandardMaterial({ map: texture, roughness: .88, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const robot = new THREE.Group();
scene.add(robot);
const pressed = new Set();
let leftCommand = 0;
let rightCommand = 0;
let lastTime = performance.now();
const MAX_TRACK_SPEED = .46;
const TRACK_SEPARATION = .086;

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.add('visible');
  status.classList.toggle('error', error);
  if (!error) setTimeout(() => status.classList.remove('visible'), 2100);
}

async function fetchWithProgress(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar el archivo STEP (${response.status}).`);
  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body || !total) return new Uint8Array(await response.arrayBuffer());

  const reader = response.body.getReader();
  let received = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    loadingProgress.textContent = `${Math.round(received / total * 100)} % descargado`;
  }
  const file = new Uint8Array(received);
  let offset = 0;
  chunks.forEach(chunk => { file.set(chunk, offset); offset += chunk.length; });
  return file;
}

function makeMesh(source) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(source.attributes.position.array, 3));
  if (source.attributes.normal) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(source.attributes.normal.array, 3));
  }
  geometry.setIndex(Array.from(source.index.array));
  const color = source.color
    ? new THREE.Color(source.color[0], source.color[1], source.color[2])
    : new THREE.Color('#9ca39e');
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .56, metalness: .22 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

async function loadRobot() {
  try {
    loadingMessage.textContent = 'Descargando el modelo CAD del Zumo 2040…';
    const file = await fetchWithProgress('assets/zumo-2040-robot.step');
    loadingMessage.textContent = 'Convirtiendo la geometría STEP para la escena…';
    loadingProgress.textContent = 'Este proceso ocurre localmente en tu navegador';
    const occt = await window.occtimportjs();
    const result = occt.ReadStepFile(file, {
      linearDeflectionType: 'bounding_box_ratio',
      linearDeflection: .003,
      angularDeflection: .5,
    });
    if (!result.success) throw new Error('OpenCascade no pudo interpretar el archivo STEP.');

    const cad = new THREE.Group();
    result.meshes.forEach(source => cad.add(makeMesh(source)));
    // The source STEP uses Y as its vertical axis, matching the Three.js scene.
    cad.scale.setScalar(.001);
    robot.add(cad);
    const bounds = new THREE.Box3().setFromObject(cad);
    cad.position.y -= bounds.min.y;
    loading.classList.add('oculto');
    setStatus('Modelo CAD listo');
  } catch (error) {
    console.error(error);
    loadingMessage.textContent = 'No fue posible cargar el modelo CAD.';
    loadingProgress.textContent = error.message;
    status.classList.add('visible', 'error');
    status.textContent = 'Error al cargar el STEP';
  }
}

function updateCommands() {
  if (pressed.has('ArrowUp')) [leftCommand, rightCommand] = [4200, 4200];
  else if (pressed.has('ArrowDown')) [leftCommand, rightCommand] = [-3300, -3300];
  else if (pressed.has('ArrowLeft')) [leftCommand, rightCommand] = [-2500, 2500];
  else if (pressed.has('ArrowRight')) [leftCommand, rightCommand] = [2500, -2500];
  else [leftCommand, rightCommand] = [0, 0];
}

function moveRobot(dt) {
  updateCommands();
  const vL = leftCommand / 6000 * MAX_TRACK_SPEED;
  const vR = rightCommand / 6000 * MAX_TRACK_SPEED;
  const velocity = (vL + vR) / 2;
  const rotation = (vR - vL) / TRACK_SEPARATION;
  robot.rotation.y += rotation * dt;
  robot.position.x += Math.sin(robot.rotation.y) * velocity * dt;
  robot.position.z += Math.cos(robot.rotation.y) * velocity * dt;
  robot.position.x = THREE.MathUtils.clamp(robot.position.x, -2.2, 2.2);
  robot.position.z = THREE.MathUtils.clamp(robot.position.z, -2.2, 2.2);
}

function resize() {
  const { clientWidth, clientHeight } = canvas;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, .05);
  lastTime = now;
  moveRobot(dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
window.addEventListener('keydown', event => {
  if (event.key.startsWith('Arrow')) {
    pressed.add(event.key);
    event.preventDefault();
  }
});
window.addEventListener('keyup', event => pressed.delete(event.key));
window.addEventListener('blur', () => pressed.clear());
resize();
requestAnimationFrame(loop);
loadRobot();
