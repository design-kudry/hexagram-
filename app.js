import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

// ------------------- КОНФИГУРАЦИЯ -------------------
const LINES = 6;
const COINS_PER_LINE = 3;

// Таблица соответствия бинарных сигнатур номерам гексаграмм
const KING_WEN_BY_BINARY = {
  "111111": 1, "000000": 2, "100010": 3, "010001": 4, "111010": 5, "010111": 6, "010000": 7, "000010": 8,
  "111011": 9, "110111": 10, "111000": 11, "000111": 12, "101111": 13, "111101": 14, "001000": 15, "000100": 16,
  "100110": 17, "011001": 18, "110000": 19, "000011": 20, "100101": 21, "101001": 22, "000001": 23, "100000": 24,
  "100111": 25, "111001": 26, "100001": 27, "011110": 28, "010010": 29, "101101": 30, "001110": 31, "011100": 32,
  "001111": 33, "111100": 34, "000101": 35, "101000": 36, "101011": 37, "110101": 38, "001010": 39, "010100": 40,
  "110001": 41, "100011": 42, "111110": 43, "011111": 44, "000110": 45, "011000": 46, "010110": 47, "011010": 48,
  "101110": 49, "011101": 50, "100100": 51, "001001": 52, "001011": 53, "110100": 54, "101100": 55, "001101": 56,
  "011011": 57, "110110": 58, "010011": 59, "110010": 60, "110011": 61, "001100": 62, "101010": 63, "010101": 64,
};

// ------------------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ -------------------
let hexagramLookup = null;
let larichevLookup = null;
let coinRefs = [];
let lines = [];
let isTossing = false;

// DOM элементы
const tossBtn = document.getElementById("tossBtn");
const resetBtn = document.getElementById("resetBtn");
const hexagramEl = document.getElementById("hexagram");
const coinsContainer = document.getElementById("coinsContainer");
const readingEl = document.getElementById("reading");
const readingMetaEl = document.getElementById("readingMeta");
const readingLarichevEl = document.getElementById("readingLarichev");
const readingAphorismEl = document.getElementById("readingAphorism");
const readingCommentaryEl = document.getElementById("readingCommentary");

// ------------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ -------------------
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function tossCoinInternal() {
  return Math.random() < 0.5;
}

// Функция для нормализации угла в диапазон [0, 2PI]
function normalizeAngle(angle) {
  angle = angle % (2 * Math.PI);
  if (angle < 0) angle += 2 * Math.PI;
  return angle;
}

// Анимация вращения одной монеты - начинается с текущего угла, докручивает до целевого
async function animateCoin(index, targetIsHeads) {
  const ref = coinRefs[index];
  if (!ref || !ref.group) return;

  const group = ref.group;
  const targetSide = targetIsHeads ? 'heads' : 'tails';
  const targetAngleRaw = targetIsHeads ? 0 : Math.PI;
  const targetAngle = normalizeAngle(targetAngleRaw);

  // Получаем текущий угол (от 0 до 2PI)
  let currentAngle = normalizeAngle(group.rotation.y);
  let currentSide = ref.currentSide;

  // Определяем направление вращения (кратчайший путь)
  let delta = targetAngle - currentAngle;

  // Нормализуем дельту в диапазон [-PI, PI]
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;

  // Добавляем 2-3 полных оборота в правильном направлении
  const fullRotations = 2 + Math.floor(Math.random() * 2); // 2-3 оборота
  const totalDelta = delta + (fullRotations * 2 * Math.PI * Math.sign(delta === 0 ? 1 : delta));

  // ЗАМЕДЛЕННАЯ анимация: 1600-2200ms
  const duration = 1600 + Math.random() * 600;
  const startTime = performance.now();
  const startAngle = currentAngle;

  return new Promise((resolve) => {
    function step(now) {
      const elapsed = now - startTime;
      let t = Math.min(1, elapsed / duration);
      // Плавное замедление в конце
      const ease = 1 - Math.pow(1 - t, 3.5);

      if (t < 1) {
        const angle = startAngle + totalDelta * ease;
        group.rotation.y = angle;
        requestAnimationFrame(step);
      } else {
        // Точно фиксируем целевой угол
        group.rotation.y = targetAngle;
        ref.currentSide = targetSide;
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

// Анимировать все три монеты
async function animateAllCoins(results) {
  const animations = [];
  for (let i = 0; i < COINS_PER_LINE; i++) {
    animations.push(animateCoin(i, results[i]));
  }
  await Promise.all(animations);
}

// Создать 3D монету из OBJ/MTL с ПРИГЛУШЁННЫМ освещением
async function create3DCoin(container, index) {
  return new Promise((resolve, reject) => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    // Камера - под углом чтобы видеть грань
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(0, 0.25, 3.0);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.7);
    mainLight.position.set(2, 2, 2);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const backLight = new THREE.DirectionalLight(0xaaccff, 0.4);
    backLight.position.set(-1, 1, -1.8);
    scene.add(backLight);

    const leftLight = new THREE.DirectionalLight(0xffffff, 0.35);
    leftLight.position.set(-1.5, 0.5, 1);
    scene.add(leftLight);

    const rightLight = new THREE.DirectionalLight(0xffffff, 0.35);
    rightLight.position.set(1.5, 0.5, 1);
    scene.add(rightLight);

    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.3);
    fillLight.position.set(3, 4, 2);  // сверху справа
    scene.add(fillLight);

    // ЗАГРУЗКА MTL С ПРИНУДИТЕЛЬНЫМ СЕРЕБРЯНЫМ ЦВЕТОМ
    const mtlLoader = new MTLLoader();
    mtlLoader.load('./coin_obj_package/fat_coin.mtl', (materials) => {
      materials.preload();

      // Принудительно делаем все материалы серебряными
      for (const materialName in materials.materials) {
        const material = materials.materials[materialName];
        if (material) {
          material.color.setHex(0xc0c0c0); // серебряный
          material.metalness = 0.85;
          material.roughness = 0.35;
        }
      }
      let modelGroup = null;
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);

      objLoader.load('./coin_obj_package/fat_coin.obj', (object) => {
        modelGroup = object;

        const box = new THREE.Box3().setFromObject(modelGroup);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        const targetSize = 1.67;
        const scale = targetSize / maxDim;
        modelGroup.scale.set(scale, scale, scale);

        modelGroup.position.x = -center.x * scale;
        modelGroup.position.y = -center.y * scale;
        modelGroup.position.z = -center.z * scale;

        // Небольшой наклон для видимости грани
        modelGroup.rotation.x = 0.1;
        modelGroup.rotation.z = 0.02;

        scene.add(modelGroup);

        const ref = {
          scene, camera, renderer, group: modelGroup,
          currentSide: 'tails', index, container
        };

        function animateRender() {
          if (!ref.renderer) return;
          requestAnimationFrame(animateRender);
          ref.renderer.render(ref.scene, ref.camera);
        }
        animateRender();

        resolve(ref);
      }, undefined, (error) => {
        console.error('Ошибка загрузки OBJ:', error);
        reject(error);
      });
    }, undefined, (error) => {
      console.error('Ошибка загрузки MTL:', error);
      reject(error);
    });
  });
}

// Инициализация трёх монет - В ОДНУ СТРОЧКУ
async function initCoins() {
  coinsContainer.innerHTML = '';
  coinRefs = [];

  for (let i = 0; i < COINS_PER_LINE; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'coin-3d-wrapper';
    coinsContainer.appendChild(wrapper);

    try {
      const ref = await create3DCoin(wrapper, i);
      coinRefs.push(ref);
    } catch (e) {
      console.error(`Не удалось загрузить 3D модель для монеты ${i}:`, e);
      coinRefs.push(null);
    }
  }

  window.addEventListener('resize', () => {
    coinRefs.forEach(ref => {
      if (ref && ref.container) {
        const w = ref.container.clientWidth;
        const h = ref.container.clientHeight;
        ref.camera.aspect = w / h;
        ref.camera.updateProjectionMatrix();
        ref.renderer.setSize(w, h);
      }
    });
  });
}

// ------------------- ГЕКСАГРАММА -------------------
function renderHexagram(currentLines) {
  hexagramEl.innerHTML = "";
  for (let i = LINES - 1; i >= 0; i--) {
    const line = currentLines[i];
    const lineEl = document.createElement("div");
    lineEl.className = "line";
    if (!line) {
      lineEl.classList.add("empty");
      hexagramEl.appendChild(lineEl);
      continue;
    }
    if (line.solid) {
      const solidEl = document.createElement("div");
      solidEl.className = "solid";
      lineEl.appendChild(solidEl);
    } else {
      const brokenEl = document.createElement("div");
      brokenEl.className = "broken";
      const left = document.createElement("div");
      left.className = "segment";
      const right = document.createElement("div");
      right.className = "segment";
      brokenEl.appendChild(left);
      brokenEl.appendChild(right);
      lineEl.appendChild(brokenEl);
    }
    hexagramEl.appendChild(lineEl);
  }
}

function hideReading() {
  readingEl.classList.add("hidden");
}

function getBinarySignature(linesArr) {
  return linesArr.map(line => line.solid ? "1" : "0").join("");
}

function renderReading(currentLines) {
  if (!hexagramLookup || currentLines.length !== LINES) {
    hideReading();
    return;
  }
  const binary = getBinarySignature(currentLines);
  const number = KING_WEN_BY_BINARY[binary];
  const entry = number ? hexagramLookup[number] : null;
  if (!entry) {
    hideReading();
    return;
  }
  const larichevText = larichevLookup?.[number] || "";
  readingMetaEl.textContent = `Гексаграмма ${number} · ${entry.symbol} · ${entry.chinese}`;
  readingLarichevEl.textContent = larichevText;
  readingAphorismEl.textContent = entry.aphorism || "";
  readingCommentaryEl.textContent = entry.commentary || "";
  readingEl.classList.remove("hidden");
}

// ------------------- ОСНОВНАЯ ЛОГИКА -------------------
function reset() {
  if (isTossing) return;
  lines = [];
  renderHexagram(lines);
  hideReading();

  coinRefs.forEach(ref => {
    if (ref && ref.group) {
      ref.currentSide = 'tails';
    }
  });

  tossBtn.disabled = false;
  resetBtn.disabled = false;
}

async function runToss() {
  if (isTossing) return;
  isTossing = true;
  tossBtn.disabled = true;
  resetBtn.disabled = true;

  lines = [];
  renderHexagram(lines);
  hideReading();

  for (let step = 0; step < LINES; step++) {
    const coinResults = [];
    for (let i = 0; i < COINS_PER_LINE; i++) {
      coinResults.push(tossCoinInternal());
    }
    const headsCount = coinResults.filter(r => r === true).length;
    const solid = headsCount > COINS_PER_LINE / 2;
    const newLine = { solid, coinResults };

    await animateAllCoins(coinResults);
    lines.push(newLine);
    renderHexagram(lines);

    if (step < LINES - 1) await delay(500);
  }

  renderReading(lines);
  isTossing = false;
  tossBtn.disabled = false;
  resetBtn.disabled = false;
}

// ------------------- ЗАГРУЗКА ДАННЫХ И СТАРТ -------------------
async function loadLookupData() {
  if (window.HEXAGRAMS && typeof window.HEXAGRAMS === "object") return window.HEXAGRAMS;
  console.warn("HEXAGRAMS не найден");
  return null;
}

async function loadLarichevData() {
  if (window.LARICHEV && typeof window.LARICHEV === "object") return window.LARICHEV;
  console.warn("LARICHEV не найден");
  return null;
}

async function init() {
  hexagramLookup = await loadLookupData();
  larichevLookup = await loadLarichevData();
  await initCoins();
  reset();

  tossBtn.addEventListener("click", () => {
    if (!isTossing) runToss();
  });
  resetBtn.addEventListener("click", () => {
    if (!isTossing) reset();
  });
}

init();