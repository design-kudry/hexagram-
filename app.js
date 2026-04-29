const LINES = 6;
const COINS_PER_LINE = 3;
const COIN_IMAGE_CANDIDATES = {
  heads: ["орел.png", "heads.png", "head.png", "orel.png", "coin-heads.png", "coin_heads.png"],
  tails: ["решка.png", "tails.png", "tail.png", "reshka.png", "coin-tails.png", "coin_tails.png"],
};

const tossBtn = document.getElementById("tossBtn");
const resetBtn = document.getElementById("resetBtn");
const hexagramEl = document.getElementById("hexagram");
const coinsEl = document.getElementById("coins");
const coinNodes = [...coinsEl.querySelectorAll(".coin")];
const readingEl = document.getElementById("reading");
const readingMetaEl = document.getElementById("readingMeta");
const readingTitleEl = document.getElementById("readingTitle");
const readingForecastEl = document.getElementById("readingForecast");
const readingLarichevEl = document.getElementById("readingLarichev");
const readingAphorismEl = document.getElementById("readingAphorism");
const readingCommentaryEl = document.getElementById("readingCommentary");

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let coinAssets = null;
let hexagramLookup = null;
let larichevLookup = null;

function tryLoadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function resolveCoinAssets() {
  async function firstExisting(names) {
    for (const name of names) {
      const loaded = await tryLoadImage(`./${name}`);
      if (loaded) return loaded;
    }
    return null;
  }

  const [heads, tails] = await Promise.all([
    firstExisting(COIN_IMAGE_CANDIDATES.heads),
    firstExisting(COIN_IMAGE_CANDIDATES.tails),
  ]);
  return heads && tails ? { heads, tails } : null;
}

function tossCoin() {
  // true = орёл (heads), false = решка (tails)
  return Math.random() < 0.5;
}

function makeLine() {
  const coinResults = [];
  let heads = 0;
  let tails = 0;

  for (let i = 0; i < COINS_PER_LINE; i++) {
    const isHeads = tossCoin();
    coinResults.push(isHeads);
    if (isHeads) heads++;
    else tails++;
  }

  // Для 3 монет всегда есть большинство (ничьей не будет):
  // больше орлов → цельная черта, больше решек → разорванная черта.
  const solid = heads > tails;

  return {
    heads,
    tails,
    coinResults,
    solid,
    segments: solid ? 1 : 2,
  };
}

function renderCoins(coinResults) {
  coinNodes.forEach((coin, idx) => {
    const isHeads = coinResults[idx];
    coin.dataset.state = isHeads ? "heads" : "tails";
    const frontFace = coin.querySelector(".coin-front");
    const backFace = coin.querySelector(".coin-back");
    const inner = coin.querySelector(".coin-inner");

    if (coinAssets) {
      frontFace.textContent = "";
      backFace.textContent = "";
      frontFace.style.backgroundImage = `url("${coinAssets.heads}")`;
      backFace.style.backgroundImage = `url("${coinAssets.tails}")`;
    } else {
      frontFace.textContent = "О";
      backFace.textContent = "Р";
      frontFace.style.backgroundImage = "none";
      backFace.style.backgroundImage = "none";
    }

    const snapAngle = isHeads ? 0 : 180;
    inner.style.transform = `rotateX(6deg) rotateY(${snapAngle}deg)`;
    coin.dataset.angle = String(snapAngle);
  });
}

async function animateCoins() {
  tossBtn.disabled = true;
  resetBtn.disabled = true;
  const line = makeLine();

  const animations = coinNodes.map((coin, idx) => {
    const isHeads = line.coinResults[idx];
    const currentAngle = Number(coin.dataset.angle || 0);
    const currentMod = ((currentAngle % 360) + 360) % 360;
    const targetMod = isHeads ? 0 : 180;
    // Рандомное число полных оборотов делает вращение живым,
    // а финиш всё равно принудительно доводим до нужной стороны.
    const randomTurns = 3 + Math.floor(Math.random() * 5); // 3..7
    const extraTurns = randomTurns * 360;
    const deltaToTarget = (targetMod - ((currentMod + extraTurns) % 360) + 360) % 360;
    const finalAngle = currentAngle + extraTurns + deltaToTarget;
    const duration = 560 + Math.floor(Math.random() * 240); // 560..799ms

    coin.classList.add("is-spinning");
    const inner = coin.querySelector(".coin-inner");

    const anim = inner.animate(
      [
        { transform: `rotateX(8deg) rotateY(${currentAngle}deg) rotateZ(0deg)` },
        { transform: `rotateX(6deg) rotateY(${finalAngle}deg) rotateZ(${idx % 2 === 0 ? -1 : 1}deg)` },
      ],
      {
        duration,
        easing: "cubic-bezier(0.15, 0.75, 0.2, 1)",
        fill: "forwards",
      }
    );

    return anim.finished.then(() => {
      const normalized = targetMod;
      inner.style.transform = `rotateX(6deg) rotateY(${normalized}deg)`;
      coin.dataset.angle = String(normalized);
      coin.classList.remove("is-spinning");
    }).catch(() => {
      // Если анимация была прервана, аккуратно возвращаем монету в валидное состояние.
      inner.style.transform = `rotateX(6deg) rotateY(${targetMod}deg)`;
      coin.dataset.angle = String(targetMod);
      coin.classList.remove("is-spinning");
    });
  });

  await Promise.allSettled(animations);
  renderCoins(line.coinResults);
  tossBtn.disabled = false;
  resetBtn.disabled = false;
  return line;
}

function renderHexagram(lines) {
  hexagramEl.innerHTML = "";

  // Стандартная нотация гексаграмм: 1-я линия снизу.
  for (let i = LINES - 1; i >= 0; i--) {
    const line = lines[i];

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

function getBinarySignature(lines) {
  // В бинарной сигнатуре используем порядок снизу вверх (line1 -> line6).
  return lines.map((line) => (line.solid ? "1" : "0")).join("");
}

function resolveLookupFromSource(source) {
  const match = source.match(/const\s+HEXAGRAMS\s*=\s*(\{[\s\S]*?\n\});\s*export\s+default/);
  if (!match) return null;
  try {
    return new Function(`return (${match[1]});`)();
  } catch {
    return null;
  }
}

function resolveLarichevFromSource(source) {
  const match = source.match(/const\s+LARICHEV\s*=\s*(\{[\s\S]*?\n\});\s*\n\s*const\s+TANAKA/);
  if (!match) return null;
  try {
    return new Function(`return (${match[1]});`)();
  } catch {
    return null;
  }
}

async function loadLookupData() {
  if (window.HEXAGRAMS && typeof window.HEXAGRAMS === "object") {
    return window.HEXAGRAMS;
  }
  try {
    const response = await fetch("./iching_lookup.jsx");
    if (!response.ok) return null;
    const source = await response.text();
    return resolveLookupFromSource(source);
  } catch {
    return null;
  }
}

async function loadLarichevData() {
  if (window.LARICHEV && typeof window.LARICHEV === "object") {
    return window.LARICHEV;
  }
  try {
    const response = await fetch("./publication.jsx");
    if (!response.ok) return null;
    const source = await response.text();
    return resolveLarichevFromSource(source);
  } catch {
    return null;
  }
}

function renderReading(lines) {
  if (!hexagramLookup || lines.length !== LINES) {
    hideReading();
    return;
  }

  const binary = getBinarySignature(lines);
  const number = KING_WEN_BY_BINARY[binary];
  const entry = number ? hexagramLookup[number] : null;

  if (!entry) {
    hideReading();
    return;
  }

  const cleanForecast = (entry.forecast || "").replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").trim();
  const larichevText = larichevLookup?.[number] || "";

  readingMetaEl.textContent = `Гексаграмма ${number} · ${entry.symbol} · ${entry.chinese}`;
  readingTitleEl.textContent = entry.name;
  readingForecastEl.textContent = cleanForecast;
  readingLarichevEl.textContent = larichevText;
  readingAphorismEl.textContent = entry.aphorism || "";
  readingCommentaryEl.textContent = entry.commentary || "";
  readingEl.classList.remove("hidden");
}

let lines = [];

function reset() {
  lines = [];
  tossBtn.disabled = false;
  resetBtn.disabled = false;
  renderCoins([true, true, true]);
  renderHexagram(lines);
  hideReading();
}

async function runToss() {
  // Каждое нажатие добавляет 1 линию (3 монеты по правилу большинства).
  if (lines.length >= LINES) return;

  const newLine = await animateCoins();
  lines.push(newLine);
  renderHexagram(lines);
  renderReading(lines);

}

tossBtn.addEventListener("click", async () => {
  if (tossBtn.disabled) return;
  await runToss();
});

resetBtn.addEventListener("click", () => {
  if (resetBtn.disabled) return;
  reset();
});

// Начальная отрисовка, чтобы было что смотреть сразу.
(async function init() {
  hexagramLookup = await loadLookupData();
  larichevLookup = await loadLarichevData();
  coinAssets = await resolveCoinAssets();
  reset();
})();

