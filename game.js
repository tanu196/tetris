const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PREVIEW = 28;
const SCORE_TABLE = [0, 100, 300, 500, 800];

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const COLORS = {
  I: ["#35f4ff", "#0d8dff"],
  J: ["#5d8bff", "#1b3eff"],
  L: ["#ffc44d", "#ff7a1f"],
  O: ["#fff25d", "#ffb800"],
  S: ["#55ffaf", "#10bd72"],
  T: ["#f85dff", "#9633ff"],
  Z: ["#ff557d", "#e1134f"],
};

const canvas = document.querySelector("#board");
const ctx = canvas.getContext("2d");
const holdCanvas = document.querySelector("#hold");
const holdCtx = holdCanvas.getContext("2d");
const nextCanvas = document.querySelector("#next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const linesEl = document.querySelector("#lines");
const levelEl = document.querySelector("#level");
const bestEl = document.querySelector("#best");
const pauseButton = document.querySelector("#pause");
const restartButton = document.querySelector("#restart");
const message = document.querySelector("#message");
const messageTitle = document.querySelector("#messageTitle");
const messageHint = document.querySelector("#messageHint");

let board;
let queue;
let current;
let hold;
let canHold;
let score;
let lines;
let level;
let best;
let dropCounter;
let dropInterval;
let lastTime;
let paused;
let over;
let particles;
let flashRows;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

function createBag() {
  const bag = Object.keys(SHAPES);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function refillQueue() {
  while (queue.length < 7) {
    queue.push(...createBag());
  }
}

function makePiece(type) {
  const matrix = cloneMatrix(SHAPES[type]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: type === "I" ? -1 : 0,
  };
}

function spawnPiece() {
  refillQueue();
  current = makePiece(queue.shift());
  canHold = true;
  if (collides(current, current.x, current.y, current.matrix)) {
    endGame();
  }
}

function collides(piece, nextX, nextY, matrix) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;
      const boardX = nextX + x;
      const boardY = nextY + y;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
}

function mergePiece() {
  current.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const boardY = current.y + y;
        if (boardY >= 0) board[boardY][current.x + x] = current.type;
      }
    });
  });
}

function rotateMatrix(matrix, direction) {
  const rotated = matrix[0].map((_, index) => matrix.map((row) => row[index]));
  return direction > 0 ? rotated.map((row) => row.reverse()) : rotated.reverse();
}

function rotatePiece(direction) {
  if (paused || over) return;
  const rotated = rotateMatrix(current.matrix, direction);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collides(current, current.x + kick, current.y, rotated)) {
      current.x += kick;
      current.matrix = rotated;
      draw();
      return;
    }
  }
}

function movePiece(direction) {
  if (paused || over) return;
  if (!collides(current, current.x + direction, current.y, current.matrix)) {
    current.x += direction;
    draw();
  }
}

function softDrop() {
  if (paused || over) return false;
  if (!collides(current, current.x, current.y + 1, current.matrix)) {
    current.y += 1;
    score += 1;
    updateHud();
    return true;
  }
  lockPiece();
  return false;
}

function hardDrop() {
  if (paused || over) return;
  let distance = 0;
  while (!collides(current, current.x, current.y + 1, current.matrix)) {
    current.y += 1;
    distance += 1;
  }
  score += distance * 2;
  lockPiece();
}

function holdPiece() {
  if (paused || over || !canHold) return;
  const heldType = current.type;
  if (hold) {
    current = makePiece(hold);
    hold = heldType;
  } else {
    hold = heldType;
    spawnPiece();
  }
  canHold = false;
  draw();
}

function lockPiece() {
  mergePiece();
  spawnSparkles();
  clearLines();
  spawnPiece();
  updateHud();
  draw();
}

function clearLines() {
  const completed = [];
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) completed.push(y);
  }
  if (!completed.length) return;

  flashRows = completed.map((row) => ({ row, life: 14 }));
  const completedSet = new Set(completed);
  board = board.filter((_, rowIndex) => !completedSet.has(rowIndex));
  while (board.length < ROWS) board.unshift(Array(COLS).fill(null));

  lines += completed.length;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(90, 850 - (level - 1) * 66);
  score += SCORE_TABLE[completed.length] * level;
  best = Math.max(best, score);
  localStorage.setItem("neon-tetris-best", String(best));
}

function spawnSparkles() {
  const cells = [];
  current.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value && current.y + y >= 0) {
        cells.push({
          x: (current.x + x + 0.5) * BLOCK,
          y: (current.y + y + 0.5) * BLOCK,
          color: COLORS[current.type][0],
        });
      }
    });
  });

  for (const cell of cells) {
    for (let i = 0; i < 2; i += 1) {
      particles.push({
        x: cell.x,
        y: cell.y,
        vx: (Math.random() - 0.5) * 1.8,
        vy: (Math.random() - 0.5) * 1.8,
        life: 22 + Math.random() * 12,
        color: cell.color,
      });
    }
  }
}

function updateParticles() {
  particles = particles.filter((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.025;
    particle.life -= 1;
    return particle.life > 0;
  });
  flashRows = flashRows.filter((flash) => {
    flash.life -= 1;
    return flash.life > 0;
  });
}

function ghostPiece() {
  const ghost = { ...current, y: current.y };
  while (!collides(ghost, ghost.x, ghost.y + 1, ghost.matrix)) {
    ghost.y += 1;
  }
  return ghost;
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.055)";
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK + 0.5, 0);
    ctx.lineTo(x * BLOCK + 0.5, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let y = 1; y < ROWS; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK + 0.5);
    ctx.lineTo(COLS * BLOCK, y * BLOCK + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBlock(context, x, y, size, type, alpha = 1) {
  const [start, end] = COLORS[type];
  const px = x * size;
  const py = y * size;
  const gap = Math.max(1, size * 0.06);
  const radius = Math.max(3, size * 0.16);

  context.save();
  context.globalAlpha = alpha;
  context.shadowBlur = size * 0.42;
  context.shadowColor = start;

  const gradient = context.createLinearGradient(px, py, px + size, py + size);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.12, start);
  gradient.addColorStop(1, end);

  roundedRect(context, px + gap, py + gap, size - gap * 2, size - gap * 2, radius);
  context.fillStyle = gradient;
  context.fill();

  context.shadowBlur = 0;
  context.strokeStyle = "rgba(255, 255, 255, 0.55)";
  context.lineWidth = Math.max(1, size * 0.06);
  context.stroke();

  context.fillStyle = "rgba(255, 255, 255, 0.28)";
  roundedRect(context, px + size * 0.2, py + size * 0.18, size * 0.46, size * 0.12, size * 0.06);
  context.fill();
  context.restore();
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawMatrix(context, matrix, offsetX, offsetY, size, type, alpha = 1) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) drawBlock(context, offsetX + x, offsetY + y, size, type, alpha);
    });
  });
}

function drawBoard() {
  const background = ctx.createLinearGradient(0, 0, 0, canvas.height);
  background.addColorStop(0, "rgba(7, 19, 42, 0.96)");
  background.addColorStop(1, "rgba(2, 7, 18, 0.98)");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) drawBlock(ctx, x, y, BLOCK, type);
    });
  });

  for (const flash of flashRows) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flash.life / 18})`;
    ctx.fillRect(0, flash.row * BLOCK, canvas.width, BLOCK);
  }

  const ghost = ghostPiece();
  if (ghost.y > current.y) {
    drawMatrix(ctx, ghost.matrix, ghost.x, ghost.y, BLOCK, ghost.type, 0.2);
  }
  drawMatrix(ctx, current.matrix, current.x, current.y, BLOCK, current.type);
  drawParticles();
}

function drawParticles() {
  ctx.save();
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / 28);
    ctx.fillStyle = particle.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPreview(context, canvasElement, types, rows) {
  context.clearRect(0, 0, canvasElement.width, canvasElement.height);
  context.fillStyle = "rgba(3, 8, 18, 0.44)";
  context.fillRect(0, 0, canvasElement.width, canvasElement.height);
  types.slice(0, rows).forEach((type, index) => {
    const matrix = SHAPES[type];
    const width = matrix[0].length * PREVIEW;
    const height = matrix.length * PREVIEW;
    const x = (canvasElement.width - width) / 2 / PREVIEW;
    const y = (index * 76 + 9 + (56 - height) / 2) / PREVIEW;
    drawMatrix(context, matrix, x, y, PREVIEW, type);
  });
}

function drawHold() {
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  holdCtx.fillStyle = "rgba(3, 8, 18, 0.44)";
  holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (!hold) return;
  const matrix = SHAPES[hold];
  const width = matrix[0].length * PREVIEW;
  const height = matrix.length * PREVIEW;
  const x = (holdCanvas.width - width) / 2 / PREVIEW;
  const y = (holdCanvas.height - height) / 2 / PREVIEW;
  drawMatrix(holdCtx, matrix, x, y, PREVIEW, hold, canHold ? 1 : 0.45);
}

function draw() {
  drawBoard();
  drawHold();
  refillQueue();
  drawPreview(nextCtx, nextCanvas, queue, 3);
}

function updateHud() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines.toLocaleString();
  levelEl.textContent = String(level);
  bestEl.textContent = best.toLocaleString();
}

function setMessage(title, hint, visible) {
  messageTitle.textContent = title;
  messageHint.textContent = hint;
  message.classList.toggle("hidden", !visible);
}

function togglePause() {
  if (over) return;
  paused = !paused;
  pauseButton.textContent = paused ? "Resume" : "Pause";
  setMessage("Paused", "Press P to resume", paused);
}

function endGame() {
  over = true;
  paused = false;
  pauseButton.textContent = "Pause";
  best = Math.max(best, score);
  localStorage.setItem("neon-tetris-best", String(best));
  updateHud();
  setMessage("Game Over", "Press R to restart", true);
}

function resetGame() {
  board = createBoard();
  queue = [];
  current = null;
  hold = null;
  canHold = true;
  score = 0;
  lines = 0;
  level = 1;
  best = Number(localStorage.getItem("neon-tetris-best") || 0);
  dropCounter = 0;
  dropInterval = 850;
  lastTime = 0;
  paused = false;
  over = false;
  particles = [];
  flashRows = [];
  pauseButton.textContent = "Pause";
  setMessage("", "", false);
  spawnPiece();
  updateHud();
  draw();
}

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  if (!paused && !over) {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      softDrop();
      dropCounter = 0;
    }
  }
  updateParticles();
  draw();
  requestAnimationFrame(update);
}

const actions = {
  left: () => movePiece(-1),
  right: () => movePiece(1),
  down: () => softDrop(),
  drop: () => hardDrop(),
  rotateLeft: () => rotatePiece(-1),
  rotateRight: () => rotatePiece(1),
  hold: () => holdPiece(),
};

document.addEventListener("keydown", (event) => {
  const keyActions = {
    ArrowLeft: actions.left,
    ArrowRight: actions.right,
    ArrowDown: actions.down,
    ArrowUp: actions.rotateRight,
    x: actions.rotateRight,
    X: actions.rotateRight,
    z: actions.rotateLeft,
    Z: actions.rotateLeft,
    c: actions.hold,
    C: actions.hold,
    " ": actions.drop,
  };

  if (keyActions[event.key]) {
    event.preventDefault();
    keyActions[event.key]();
  }
  if (event.key === "p" || event.key === "P") togglePause();
  if (event.key === "r" || event.key === "R") resetGame();
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    actions[button.dataset.action]?.();
  });
});

pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(update);
