const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PREVIEW = 20;
const SCORE_TABLE = [0, 100, 300, 500, 800];
const ATTACK_TABLE = [0, 0, 1, 2, 4];

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
  G: ["#8794aa", "#3a4354"],
};

const winsEls = {
  p1: document.querySelector("#wins-p1"),
  p2: document.querySelector("#wins-p2"),
};
const pauseButton = document.querySelector("#pause");
const restartButton = document.querySelector("#restart");
const targetButtons = [...document.querySelectorAll("[data-target]")];

let players;
let paused = false;
let roundOver = false;
let activePlayerId = "p1";
let lastTime = 0;

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

function makePiece(type) {
  const matrix = cloneMatrix(SHAPES[type]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: type === "I" ? -1 : 0,
  };
}

function rotateMatrix(matrix, direction) {
  const rotated = matrix[0].map((_, index) => matrix.map((row) => row[index]));
  return direction > 0 ? rotated.map((row) => row.reverse()) : rotated.reverse();
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

function drawBlock(context, x, y, size, type, alpha = 1) {
  const [start, end] = COLORS[type];
  const px = x * size;
  const py = y * size;
  const gap = Math.max(1, size * 0.06);
  const radius = Math.max(3, size * 0.16);

  context.save();
  context.globalAlpha = alpha;
  context.shadowBlur = size * 0.36;
  context.shadowColor = start;

  const gradient = context.createLinearGradient(px, py, px + size, py + size);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.14, start);
  gradient.addColorStop(1, end);

  roundedRect(context, px + gap, py + gap, size - gap * 2, size - gap * 2, radius);
  context.fillStyle = gradient;
  context.fill();

  context.shadowBlur = 0;
  context.strokeStyle = "rgba(255, 255, 255, 0.52)";
  context.lineWidth = Math.max(1, size * 0.06);
  context.stroke();

  context.fillStyle = "rgba(255, 255, 255, 0.24)";
  roundedRect(context, px + size * 0.2, py + size * 0.18, size * 0.46, size * 0.12, size * 0.06);
  context.fill();
  context.restore();
}

function drawMatrix(context, matrix, offsetX, offsetY, size, type, alpha = 1) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) drawBlock(context, offsetX + x, offsetY + y, size, type, alpha);
    });
  });
}

class Player {
  constructor(id, opponentId) {
    this.id = id;
    this.opponentId = opponentId;
    this.canvas = document.querySelector(`#board-${id}`);
    this.ctx = this.canvas.getContext("2d");
    this.holdCanvas = document.querySelector(`#hold-${id}`);
    this.holdCtx = this.holdCanvas.getContext("2d");
    this.nextCanvas = document.querySelector(`#next-${id}`);
    this.nextCtx = this.nextCanvas.getContext("2d");
    this.panel = document.querySelector(`#panel-${id}`);
    this.scoreEl = document.querySelector(`#score-${id}`);
    this.linesEl = document.querySelector(`#lines-${id}`);
    this.statusEl = document.querySelector(`#status-${id}`);
    this.message = document.querySelector(`#message-${id}`);
    this.messageTitle = document.querySelector(`#message-title-${id}`);
    this.messageHint = document.querySelector(`#message-hint-${id}`);
    this.wins = 0;
    this.resetRound();
  }

  resetRound() {
    this.board = createBoard();
    this.queue = [];
    this.current = null;
    this.hold = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropCounter = 0;
    this.dropInterval = 850;
    this.pendingGarbage = 0;
    this.over = false;
    this.particles = [];
    this.flashRows = [];
    this.statusEl.textContent = "Ready";
    this.setMessage("", "", false);
    this.refillQueue();
    this.spawnPiece();
    this.updateHud();
  }

  opponent() {
    return players[this.opponentId];
  }

  refillQueue() {
    while (this.queue.length < 7) {
      this.queue.push(...createBag());
    }
  }

  spawnPiece() {
    this.refillQueue();
    this.current = makePiece(this.queue.shift());
    this.canHold = true;
    if (this.collides(this.current.x, this.current.y, this.current.matrix)) {
      endRound(this.id);
    }
  }

  collides(nextX, nextY, matrix) {
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) continue;
        const boardX = nextX + x;
        const boardY = nextY + y;
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
        if (boardY >= 0 && this.board[boardY][boardX]) return true;
      }
    }
    return false;
  }

  move(direction) {
    if (!this.canAct()) return;
    if (!this.collides(this.current.x + direction, this.current.y, this.current.matrix)) {
      this.current.x += direction;
    }
  }

  rotate(direction) {
    if (!this.canAct()) return;
    const rotated = rotateMatrix(this.current.matrix, direction);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!this.collides(this.current.x + kick, this.current.y, rotated)) {
        this.current.x += kick;
        this.current.matrix = rotated;
        return;
      }
    }
  }

  softDrop() {
    if (!this.canAct()) return false;
    if (!this.collides(this.current.x, this.current.y + 1, this.current.matrix)) {
      this.current.y += 1;
      this.score += 1;
      this.updateHud();
      return true;
    }
    this.lockPiece();
    return false;
  }

  hardDrop() {
    if (!this.canAct()) return;
    let distance = 0;
    while (!this.collides(this.current.x, this.current.y + 1, this.current.matrix)) {
      this.current.y += 1;
      distance += 1;
    }
    this.score += distance * 2;
    this.lockPiece();
  }

  holdPiece() {
    if (!this.canAct() || !this.canHold) return;
    const heldType = this.current.type;
    if (this.hold) {
      this.current = makePiece(this.hold);
      this.hold = heldType;
    } else {
      this.hold = heldType;
      this.spawnPiece();
    }
    this.canHold = false;
  }

  canAct() {
    return !paused && !roundOver && !this.over && this.current;
  }

  lockPiece() {
    this.mergePiece();
    this.spawnSparkles();
    const cleared = this.clearLines();
    if (!cleared) this.applyPendingGarbage();
    if (!roundOver) this.spawnPiece();
    this.updateHud();
  }

  mergePiece() {
    this.current.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (!value) return;
        const boardY = this.current.y + y;
        if (boardY >= 0) this.board[boardY][this.current.x + x] = this.current.type;
      });
    });
  }

  clearLines() {
    const completed = [];
    for (let y = ROWS - 1; y >= 0; y -= 1) {
      if (this.board[y].every(Boolean)) completed.push(y);
    }
    if (!completed.length) return 0;

    this.flashRows = completed.map((row) => ({ row, life: 14 }));
    const completedSet = new Set(completed);
    this.board = this.board.filter((_, rowIndex) => !completedSet.has(rowIndex));
    while (this.board.length < ROWS) this.board.unshift(Array(COLS).fill(null));

    this.lines += completed.length;
    this.level = Math.floor(this.lines / 10) + 1;
    this.dropInterval = Math.max(90, 850 - (this.level - 1) * 66);
    this.score += SCORE_TABLE[completed.length] * this.level;

    const attack = ATTACK_TABLE[completed.length] || 0;
    if (attack) {
      this.opponent().receiveGarbage(attack);
      this.statusEl.textContent = `Attack +${attack}`;
    }
    return completed.length;
  }

  receiveGarbage(count) {
    this.pendingGarbage += count;
    this.statusEl.textContent = `Danger +${this.pendingGarbage}`;
  }

  applyPendingGarbage() {
    if (!this.pendingGarbage || roundOver) return;
    const count = this.pendingGarbage;
    this.pendingGarbage = 0;
    for (let i = 0; i < count; i += 1) {
      const pushedOut = this.board.shift();
      if (pushedOut.some(Boolean)) {
        endRound(this.id);
        return;
      }
      const hole = Math.floor(Math.random() * COLS);
      this.board.push(Array.from({ length: COLS }, (_, index) => (index === hole ? null : "G")));
    }
    this.statusEl.textContent = "Garbage";
  }

  spawnSparkles() {
    this.current.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (!value || this.current.y + y < 0) return;
        for (let i = 0; i < 2; i += 1) {
          this.particles.push({
            x: (this.current.x + x + 0.5) * BLOCK,
            y: (this.current.y + y + 0.5) * BLOCK,
            vx: (Math.random() - 0.5) * 1.8,
            vy: (Math.random() - 0.5) * 1.8,
            life: 20 + Math.random() * 12,
            color: COLORS[this.current.type][0],
          });
        }
      });
    });
  }

  update(delta) {
    if (!paused && !roundOver && !this.over) {
      this.dropCounter += delta;
      if (this.dropCounter > this.dropInterval) {
        this.softDrop();
        this.dropCounter = 0;
      }
    }
    this.updateParticles();
  }

  updateParticles() {
    this.particles = this.particles.filter((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.025;
      particle.life -= 1;
      return particle.life > 0;
    });
    this.flashRows = this.flashRows.filter((flash) => {
      flash.life -= 1;
      return flash.life > 0;
    });
  }

  ghostPiece() {
    const ghost = { ...this.current, y: this.current.y };
    while (!this.collides(ghost.x, ghost.y + 1, ghost.matrix)) {
      ghost.y += 1;
    }
    return ghost;
  }

  drawGrid() {
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.055)";
    this.ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x += 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * BLOCK + 0.5, 0);
      this.ctx.lineTo(x * BLOCK + 0.5, ROWS * BLOCK);
      this.ctx.stroke();
    }
    for (let y = 1; y < ROWS; y += 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * BLOCK + 0.5);
      this.ctx.lineTo(COLS * BLOCK, y * BLOCK + 0.5);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  draw() {
    const background = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    background.addColorStop(0, "rgba(7, 19, 42, 0.96)");
    background.addColorStop(1, "rgba(2, 7, 18, 0.98)");
    this.ctx.fillStyle = background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();

    this.board.forEach((row, y) => {
      row.forEach((type, x) => {
        if (type) drawBlock(this.ctx, x, y, BLOCK, type);
      });
    });

    for (const flash of this.flashRows) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${flash.life / 18})`;
      this.ctx.fillRect(0, flash.row * BLOCK, this.canvas.width, BLOCK);
    }

    if (this.current && !this.over) {
      const ghost = this.ghostPiece();
      if (ghost.y > this.current.y) {
        drawMatrix(this.ctx, ghost.matrix, ghost.x, ghost.y, BLOCK, ghost.type, 0.2);
      }
      drawMatrix(this.ctx, this.current.matrix, this.current.x, this.current.y, BLOCK, this.current.type);
    }
    this.drawParticles();
    this.drawHold();
    this.drawNext();
  }

  drawParticles() {
    this.ctx.save();
    for (const particle of this.particles) {
      this.ctx.globalAlpha = Math.max(0, particle.life / 28);
      this.ctx.fillStyle = particle.color;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, 2.2, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawHold() {
    this.holdCtx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
    this.holdCtx.fillStyle = "rgba(3, 8, 18, 0.42)";
    this.holdCtx.fillRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
    if (!this.hold) return;
    this.drawPreviewPiece(this.holdCtx, this.holdCanvas, this.hold, this.canHold ? 1 : 0.42);
  }

  drawNext() {
    this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    this.nextCtx.fillStyle = "rgba(3, 8, 18, 0.42)";
    this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    this.refillQueue();
    this.drawPreviewPiece(this.nextCtx, this.nextCanvas, this.queue[0], 1);
  }

  drawPreviewPiece(context, canvasElement, type, alpha) {
    const matrix = SHAPES[type];
    const width = matrix[0].length * PREVIEW;
    const height = matrix.length * PREVIEW;
    const x = (canvasElement.width - width) / 2 / PREVIEW;
    const y = (canvasElement.height - height) / 2 / PREVIEW;
    drawMatrix(context, matrix, x, y, PREVIEW, type, alpha);
  }

  updateHud() {
    this.scoreEl.textContent = this.score.toLocaleString();
    this.linesEl.textContent = String(this.lines);
    if (roundOver) return;
    if (this.pendingGarbage) {
      this.statusEl.textContent = `Danger +${this.pendingGarbage}`;
      return;
    }
    if (this.statusEl.textContent === "Ready" || this.statusEl.textContent === "") {
      this.statusEl.textContent = "Playing";
    }
  }

  setMessage(title, hint, visible) {
    this.messageTitle.textContent = title;
    this.messageHint.textContent = hint;
    this.message.classList.toggle("hidden", !visible);
  }
}

function endRound(loserId) {
  if (roundOver) return;
  const loser = players[loserId];
  const winner = players[loser.opponentId];
  roundOver = true;
  loser.over = true;
  winner.wins += 1;
  winsEls[winner.id].textContent = String(winner.wins);
  loser.setMessage("KO", "Restart", true);
  winner.setMessage("WIN", "Restart", true);
  loser.statusEl.textContent = "Knocked out";
  winner.statusEl.textContent = "Winner";
}

function resetRound() {
  roundOver = false;
  paused = false;
  pauseButton.textContent = "Pause";
  players.p1.resetRound();
  players.p2.resetRound();
}

function togglePause() {
  if (roundOver) return;
  paused = !paused;
  pauseButton.textContent = paused ? "Resume" : "Pause";
  for (const player of Object.values(players)) {
    player.setMessage("Paused", "P to resume", paused);
    player.statusEl.textContent = paused ? "Paused" : "Playing";
  }
}

function setActivePlayer(id) {
  activePlayerId = id;
  for (const button of targetButtons) {
    button.classList.toggle("is-selected", button.dataset.target === id);
  }
  document.querySelector("#panel-p1").classList.toggle("is-active", id === "p1");
  document.querySelector("#panel-p2").classList.toggle("is-active", id === "p2");
}

const actionMap = {
  left: (player) => player.move(-1),
  right: (player) => player.move(1),
  down: (player) => player.softDrop(),
  drop: (player) => player.hardDrop(),
  rotateLeft: (player) => player.rotate(-1),
  rotateRight: (player) => player.rotate(1),
  hold: (player) => player.holdPiece(),
};

function runAction(playerId, action) {
  actionMap[action]?.(players[playerId]);
}

document.addEventListener("keydown", (event) => {
  const keyActions = {
    a: ["p1", "left"],
    A: ["p1", "left"],
    d: ["p1", "right"],
    D: ["p1", "right"],
    s: ["p1", "down"],
    S: ["p1", "down"],
    w: ["p1", "rotateRight"],
    W: ["p1", "rotateRight"],
    e: ["p1", "rotateRight"],
    E: ["p1", "rotateRight"],
    q: ["p1", "hold"],
    Q: ["p1", "hold"],
    f: ["p1", "drop"],
    F: ["p1", "drop"],
    ArrowLeft: ["p2", "left"],
    ArrowRight: ["p2", "right"],
    ArrowDown: ["p2", "down"],
    ArrowUp: ["p2", "rotateRight"],
    "/": ["p2", "hold"],
    Enter: ["p2", "drop"],
  };

  if (keyActions[event.key]) {
    event.preventDefault();
    const [playerId, action] = keyActions[event.key];
    runAction(playerId, action);
  }
  if (event.key === "p" || event.key === "P") togglePause();
  if (event.key === "r" || event.key === "R") resetRound();
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    runAction(activePlayerId, button.dataset.action);
  });
});

targetButtons.forEach((button) => {
  button.addEventListener("click", () => setActivePlayer(button.dataset.target));
});

document.querySelector("#panel-p1").addEventListener("pointerdown", () => setActivePlayer("p1"));
document.querySelector("#panel-p2").addEventListener("pointerdown", () => setActivePlayer("p2"));

pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", resetRound);

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  players.p1.update(delta);
  players.p2.update(delta);
  players.p1.draw();
  players.p2.draw();
  requestAnimationFrame(update);
}

players = {
  p1: new Player("p1", "p2"),
  p2: new Player("p2", "p1"),
};
setActivePlayer("p1");
requestAnimationFrame(update);
